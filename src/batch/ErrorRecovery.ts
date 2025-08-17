import * as fs from 'fs-extra';
import * as path from 'path';
import { logger } from '../utils';

export enum ErrorType {
  TEMPORARY = 'temporary',    // 網路超時、429限流、暫時性連線問題
  PERMANENT = 'permanent',    // 404、配置錯誤、數據格式問題
  SYSTEM = 'system',         // 系統錯誤、記憶體不足、磁碟空間不足
  RATE_LIMIT = 'rate_limit', // 專門處理速率限制
  TIMEOUT = 'timeout',       // 專門處理超時
  NETWORK = 'network'        // 專門處理網路問題
}

export enum ErrorAction {
  RETRY = 'retry',           // 立即重試
  RETRY_AFTER_DELAY = 'retry_after_delay',  // 延遲後重試
  SKIP = 'skip',            // 跳過此項目
  ABORT = 'abort',          // 中止整個批次
  REDUCE_CONCURRENCY = 'reduce_concurrency' // 降低併發數
}

export interface ErrorInfo {
  configName: string;
  error: Error;
  type: ErrorType;
  action: ErrorAction;
  timestamp: number;
  attempt: number;
  retryDelay?: number;
}

export interface ErrorSummary {
  total: number;
  byType: Record<ErrorType, number>;
  byAction: Record<ErrorAction, number>;
  recentErrors: ErrorInfo[];
  retryableErrors: ErrorInfo[];
  permanentErrors: ErrorInfo[];
}

export class ErrorRecovery {
  private errors: ErrorInfo[] = [];
  private maxRetryAttempts: number;
  private baseRetryDelay: number;
  private maxRetryDelay: number;
  private errorLogPath?: string;

  constructor(options: {
    maxRetryAttempts?: number;
    baseRetryDelay?: number;
    maxRetryDelay?: number;
    errorLogPath?: string;
  } = {}) {
    this.maxRetryAttempts = options.maxRetryAttempts || 3;
    this.baseRetryDelay = options.baseRetryDelay || 5000; // 5秒
    this.maxRetryDelay = options.maxRetryDelay || 300000; // 5分鐘
    this.errorLogPath = options.errorLogPath;
  }

  /**
   * 分類錯誤類型
   */
  classifyError(error: Error): ErrorType {
    const message = error.message.toLowerCase();
    const stack = error.stack?.toLowerCase() || '';

    // 檢查特定錯誤模式
    if (this.isRateLimitError(error)) {
      return ErrorType.RATE_LIMIT;
    }

    if (this.isTimeoutError(error)) {
      return ErrorType.TIMEOUT;
    }

    if (this.isNetworkError(error)) {
      return ErrorType.NETWORK;
    }

    // 暫時性錯誤
    if (
      message.includes('timeout') ||
      message.includes('connection reset') ||
      message.includes('connection refused') ||
      message.includes('socket hang up') ||
      message.includes('network error') ||
      message.includes('econnreset') ||
      message.includes('enotfound') ||
      message.includes('etimedout') ||
      stack.includes('networkidle')
    ) {
      return ErrorType.TEMPORARY;
    }

    // 永久性錯誤
    if (
      message.includes('404') ||
      message.includes('not found') ||
      message.includes('invalid configuration') ||
      message.includes('parse error') ||
      message.includes('malformed') ||
      message.includes('unauthorized') ||
      message.includes('403') ||
      message.includes('access denied')
    ) {
      return ErrorType.PERMANENT;
    }

    // 系統錯誤
    if (
      message.includes('out of memory') ||
      message.includes('enospc') ||
      message.includes('enomem') ||
      message.includes('system error') ||
      message.includes('internal server error') ||
      message.includes('500')
    ) {
      return ErrorType.SYSTEM;
    }

    // 預設為暫時性錯誤，給予重試機會
    return ErrorType.TEMPORARY;
  }

  /**
   * 檢查是否為速率限制錯誤
   */
  private isRateLimitError(error: Error): boolean {
    const message = error.message.toLowerCase();
    return (
      message.includes('429') ||
      message.includes('too many requests') ||
      message.includes('rate limit') ||
      message.includes('quota exceeded') ||
      message.includes('throttle')
    );
  }

  /**
   * 檢查是否為超時錯誤
   */
  private isTimeoutError(error: Error): boolean {
    const message = error.message.toLowerCase();
    return (
      message.includes('timeout') ||
      message.includes('etimedout') ||
      message.includes('request timeout') ||
      message.includes('response timeout')
    );
  }

  /**
   * 檢查是否為網路錯誤
   */
  private isNetworkError(error: Error): boolean {
    const message = error.message.toLowerCase();
    return (
      message.includes('network') ||
      message.includes('connection') ||
      message.includes('econnrefused') ||
      message.includes('econnreset') ||
      message.includes('enotfound') ||
      message.includes('socket')
    );
  }

  /**
   * 決定錯誤處理行動
   */
  shouldRetry(error: Error, attempt: number): boolean {
    if (attempt >= this.maxRetryAttempts) {
      return false;
    }

    const errorType = this.classifyError(error);

    switch (errorType) {
      case ErrorType.TEMPORARY:
      case ErrorType.TIMEOUT:
      case ErrorType.NETWORK:
        return true;
      
      case ErrorType.RATE_LIMIT:
        return attempt < 2; // 速率限制最多重試2次
      
      case ErrorType.SYSTEM:
        return attempt < 1; // 系統錯誤只重試1次
      
      case ErrorType.PERMANENT:
        return false; // 永久性錯誤不重試
      
      default:
        return attempt < 2;
    }
  }

  /**
   * 計算重試延遲時間 (指數退避 + 隨機抖動)
   */
  calculateRetryDelay(attempt: number, errorType?: ErrorType): number {
    // 基於錯誤類型調整延遲
    let baseDelay = this.baseRetryDelay;
    
    switch (errorType) {
      case ErrorType.RATE_LIMIT:
        baseDelay = 30000; // 速率限制延遲30秒
        break;
      case ErrorType.TIMEOUT:
        baseDelay = 10000; // 超時延遲10秒
        break;
      case ErrorType.NETWORK:
        baseDelay = 15000; // 網路錯誤延遲15秒
        break;
      case ErrorType.SYSTEM:
        baseDelay = 60000; // 系統錯誤延遲1分鐘
        break;
    }

    // 指數退避：每次重試延遲翻倍
    const exponentialDelay = baseDelay * Math.pow(2, attempt - 1);
    
    // 加入隨機抖動 (±25%)
    const jitter = exponentialDelay * 0.25 * (Math.random() * 2 - 1);
    const finalDelay = Math.max(1000, exponentialDelay + jitter);
    
    // 限制最大延遲時間
    return Math.min(finalDelay, this.maxRetryDelay);
  }

  /**
   * 處理錯誤並決定行動
   */
  handleError(configName: string, error: Error, attempt: number): ErrorAction {
    const errorType = this.classifyError(error);
    const timestamp = Date.now();
    
    let action: ErrorAction;
    let retryDelay: number | undefined;

    if (this.shouldRetry(error, attempt)) {
      retryDelay = this.calculateRetryDelay(attempt, errorType);
      action = retryDelay > this.baseRetryDelay ? ErrorAction.RETRY_AFTER_DELAY : ErrorAction.RETRY;
    } else {
      switch (errorType) {
        case ErrorType.SYSTEM:
          action = ErrorAction.REDUCE_CONCURRENCY;
          break;
        case ErrorType.PERMANENT:
          action = ErrorAction.SKIP;
          break;
        default:
          action = ErrorAction.SKIP;
      }
    }

    const errorInfo: ErrorInfo = {
      configName,
      error,
      type: errorType,
      action,
      timestamp,
      attempt,
      retryDelay
    };

    this.errors.push(errorInfo);
    this.logError(errorInfo);

    logger.warn(`Error handled for ${configName} (attempt ${attempt}): ${errorType} -> ${action}`, {
      error: error.message,
      retryDelay
    });

    return action;
  }

  /**
   * 記錄錯誤到檔案
   */
  private async logError(errorInfo: ErrorInfo): Promise<void> {
    try {
      if (!this.errorLogPath) return;

      await fs.ensureDir(path.dirname(this.errorLogPath));
      
      const logEntry = {
        timestamp: new Date(errorInfo.timestamp).toISOString(),
        configName: errorInfo.configName,
        errorType: errorInfo.type,
        action: errorInfo.action,
        attempt: errorInfo.attempt,
        message: errorInfo.error.message,
        stack: errorInfo.error.stack,
        retryDelay: errorInfo.retryDelay
      };

      const logLine = JSON.stringify(logEntry) + '\n';
      await fs.appendFile(this.errorLogPath, logLine);
    } catch (error) {
      logger.error('Failed to log error:', error);
    }
  }

  /**
   * 獲取錯誤統計摘要
   */
  getErrorSummary(): ErrorSummary {
    const byType: Record<ErrorType, number> = {
      [ErrorType.TEMPORARY]: 0,
      [ErrorType.PERMANENT]: 0,
      [ErrorType.SYSTEM]: 0,
      [ErrorType.RATE_LIMIT]: 0,
      [ErrorType.TIMEOUT]: 0,
      [ErrorType.NETWORK]: 0
    };

    const byAction: Record<ErrorAction, number> = {
      [ErrorAction.RETRY]: 0,
      [ErrorAction.RETRY_AFTER_DELAY]: 0,
      [ErrorAction.SKIP]: 0,
      [ErrorAction.ABORT]: 0,
      [ErrorAction.REDUCE_CONCURRENCY]: 0
    };

    this.errors.forEach(error => {
      byType[error.type]++;
      byAction[error.action]++;
    });

    const now = Date.now();
    const recentErrors = this.errors.filter(error => 
      now - error.timestamp < 300000 // 最近5分鐘的錯誤
    );

    const retryableErrors = this.errors.filter(error =>
      [ErrorAction.RETRY, ErrorAction.RETRY_AFTER_DELAY].includes(error.action)
    );

    const permanentErrors = this.errors.filter(error =>
      error.type === ErrorType.PERMANENT
    );

    return {
      total: this.errors.length,
      byType,
      byAction,
      recentErrors,
      retryableErrors,
      permanentErrors
    };
  }

  /**
   * 獲取可重試的配置列表
   */
  getRetryableConfigs(): string[] {
    const retryable = new Set<string>();
    
    this.errors
      .filter(error => [ErrorAction.RETRY, ErrorAction.RETRY_AFTER_DELAY].includes(error.action))
      .forEach(error => retryable.add(error.configName));
    
    return Array.from(retryable);
  }

  /**
   * 獲取永久失敗的配置列表
   */
  getPermanentFailures(): string[] {
    const permanent = new Set<string>();
    
    this.errors
      .filter(error => error.type === ErrorType.PERMANENT)
      .forEach(error => permanent.add(error.configName));
    
    return Array.from(permanent);
  }

  /**
   * 清除舊錯誤記錄 (保留最近24小時)
   */
  cleanupOldErrors(maxAge: number = 86400000): void {
    const cutoff = Date.now() - maxAge;
    this.errors = this.errors.filter(error => error.timestamp >= cutoff);
  }

  /**
   * 導出錯誤報告
   */
  exportErrorReport(): string {
    const summary = this.getErrorSummary();
    
    const formatErrorCount = (count: number, total: number): string => {
      const percentage = total > 0 ? ((count / total) * 100).toFixed(1) : '0.0';
      return `${count} (${percentage}%)`;
    };

    return `
錯誤恢復報告
=====================================
總錯誤數: ${summary.total}

按類型分佈:
- 暫時性錯誤: ${formatErrorCount(summary.byType.temporary, summary.total)}
- 網路錯誤: ${formatErrorCount(summary.byType.network, summary.total)}
- 超時錯誤: ${formatErrorCount(summary.byType.timeout, summary.total)}
- 速率限制: ${formatErrorCount(summary.byType.rate_limit, summary.total)}
- 系統錯誤: ${formatErrorCount(summary.byType.system, summary.total)}
- 永久性錯誤: ${formatErrorCount(summary.byType.permanent, summary.total)}

按處理行動分佈:
- 立即重試: ${formatErrorCount(summary.byAction.retry, summary.total)}
- 延遲重試: ${formatErrorCount(summary.byAction.retry_after_delay, summary.total)}
- 跳過: ${formatErrorCount(summary.byAction.skip, summary.total)}
- 降低併發: ${formatErrorCount(summary.byAction.reduce_concurrency, summary.total)}
- 中止: ${formatErrorCount(summary.byAction.abort, summary.total)}

最近錯誤 (5分鐘內): ${summary.recentErrors.length}
可重試配置: ${summary.retryableErrors.length}
永久失敗配置: ${summary.permanentErrors.length}

${summary.permanentErrors.length > 0 ? `
永久失敗的配置:
${summary.permanentErrors.slice(0, 10).map(error => 
  `- ${error.configName}: ${error.error.message}`
).join('\n')}
${summary.permanentErrors.length > 10 ? `... 還有 ${summary.permanentErrors.length - 10} 個` : ''}
` : ''}
`;
  }

  /**
   * 重置錯誤統計
   */
  reset(): void {
    this.errors = [];
  }
}