/**
 * Worker Client - 核心協調模組
 * 整合版本管理、API 通訊、配置解析的主要 Worker 腳本
 */

import { EventEmitter } from 'events';
import { VersionManager } from './version-manager';
import { TaskApiService } from './task-api';
import { ConfigResolver } from './config-resolver';
import {
  WorkerConfig,
  CrawlerTask,
  ExecutionResultDto,
  VersionCheckResult,
  WorkerStats,
  WorkerStatus,
  WorkerError,
  TaskStatus,
  HistoryStatus,
  TaskCompletionCallback,
  ErrorCallback,
  VersionSwitchCallback,
  HeartbeatCallback,
  WorkerEvent,
  ResolvedConfig
} from './types';
import { execSync } from 'child_process';
import { join } from 'path';

export class WorkerClient extends EventEmitter {
  private config: WorkerConfig;
  private versionManager: VersionManager;
  private apiService: TaskApiService;
  private configResolver: ConfigResolver;
  
  private currentTasks: Map<string, CrawlerTask> = new Map();
  private workerStats: WorkerStats;
  private status: WorkerStatus = WorkerStatus.INACTIVE;
  private heartbeatTimer?: NodeJS.Timeout;
  private taskPollingTimer?: NodeJS.Timeout;
  private errorCount = 0;
  private lastErrorTime?: Date;
  private startTime = new Date();

  // 回調函數
  private onTaskCompletion?: TaskCompletionCallback;
  private onError?: ErrorCallback;
  private onVersionSwitch?: VersionSwitchCallback;
  private onHeartbeat?: HeartbeatCallback;

  constructor(config: WorkerConfig) {
    super();
    this.config = config;
    
    // 初始化組件
    this.versionManager = new VersionManager({
      projectRoot: process.cwd(),
      preferGitVersion: config.preferGitVersion,
      versionCacheDir: config.versionCacheDir,
      githubToken: config.githubToken,
    });

    this.apiService = new TaskApiService({
      serverUrl: config.serverUrl,
      apiKey: config.apiKey,
      workerId: config.workerId,
      timeout: 30000,
      retryAttempts: 3,
      retryDelay: 1000,
    });

    this.configResolver = new ConfigResolver({
      projectRoot: process.cwd(),
    });

    // 初始化統計資訊
    this.workerStats = this.initializeStats();
    
    // 設置事件監聽
    this.setupEventHandlers();
  }

  /**
   * 啟動 Worker
   */
  async start(): Promise<void> {
    try {
      console.log(`🚀 啟動 Worker: ${this.config.workerId}`);
      
      // 1. 測試 API 連接
      const connected = await this.apiService.testConnection();
      if (!connected) {
        throw new Error('無法連接到 Server API');
      }

      // 2. 註冊 Worker
      const registered = await this.apiService.registerWorker({
        name: this.config.workerName,
        supported_regions: this.config.supportedRegions,
        supported_data_types: this.config.supportedDataTypes,
        max_concurrent_tasks: this.config.maxConcurrent,
      });

      if (!registered) {
        throw new Error('Worker 註冊失敗');
      }

      // 3. 更新狀態
      this.status = WorkerStatus.ACTIVE;
      this.workerStats.worker.status = this.status;
      
      // 4. 啟動心跳
      this.startHeartbeat();
      
      // 5. 啟動任務輪詢
      this.startTaskPolling();
      
      // 6. 發送啟動事件
      this.emit('started', { workerId: this.config.workerId });
      
      console.log(`✅ Worker 啟動成功: ${this.config.workerId}`);
      
    } catch (error) {
      console.error(`❌ Worker 啟動失敗:`, error);
      this.status = WorkerStatus.ERROR;
      this.handleError(this.createWorkerError('WORKER_START_FAILED', error));
      throw error;
    }
  }

  /**
   * 停止 Worker
   */
  async stop(): Promise<void> {
    try {
      console.log(`🛑 停止 Worker: ${this.config.workerId}`);
      
      // 1. 停止計時器
      this.stopHeartbeat();
      this.stopTaskPolling();
      
      // 2. 等待當前任務完成
      await this.waitForTasksCompletion();
      
      // 3. 更新狀態
      this.status = WorkerStatus.INACTIVE;
      
      // 4. 關閉 API 連接
      await this.apiService.close();
      
      // 5. 發送停止事件
      this.emit('stopped', { workerId: this.config.workerId });
      
      console.log(`✅ Worker 停止成功: ${this.config.workerId}`);
      
    } catch (error) {
      console.error(`❌ Worker 停止失敗:`, error);
      throw error;
    }
  }

  /**
   * 執行單一任務
   */
  async executeTask(task: CrawlerTask): Promise<ExecutionResultDto> {
    const startTime = Date.now();
    let result: ExecutionResultDto;

    try {
      console.log(`📋 開始執行任務: ${task.id} (${task.symbol_code})`);
      
      // 1. 更新任務狀態
      this.currentTasks.set(task.id, { ...task, status: TaskStatus.RUNNING });
      await this.apiService.updateTaskStatus(task.id, 'running');
      
      // 2. 版本相容性檢查
      const versionCheck = await this.checkTaskVersionCompatibility(task);
      if (!versionCheck.compatible && this.config.autoVersionSwitch) {
        console.log(`🔄 嘗試自動切換版本: ${versionCheck.action}`);
        const switched = await this.handleVersionSwitch(versionCheck);
        if (!switched) {
          throw new Error(`版本切換失敗: ${versionCheck.reason}`);
        }
      } else if (!versionCheck.compatible) {
        throw new Error(`版本不相容: ${versionCheck.reason}`);
      }

      // 3. 解析配置
      const resolvedConfig = await this.configResolver.resolveTaskConfig(task);
      
      // 4. 執行爬蟲
      const crawlResult = await this.executeCrawler(task, resolvedConfig);
      
      // 5. 建立結果
      result = {
        task_id: task.id,
        status: crawlResult.success ? HistoryStatus.SUCCESS : HistoryStatus.FAILED,
        worker_version: this.versionManager.getCurrentVersion(),
        config_version_used: resolvedConfig.source.version,
        execution_time_ms: Date.now() - startTime,
        memory_usage_mb: process.memoryUsage().heapUsed / 1024 / 1024,
        records_fetched: crawlResult.recordCount || 0,
        records_saved: crawlResult.recordCount || 0,
        data_quality_score: crawlResult.qualityScore || 1.0,
        output_file_path: crawlResult.outputPath,
        response_summary: crawlResult.summary,
        crawled_data: crawlResult.data,
      };

      // 6. 更新統計
      this.updateTaskStats(true, Date.now() - startTime);
      
      console.log(`✅ 任務執行成功: ${task.id}`);
      
    } catch (error) {
      console.error(`❌ 任務執行失敗: ${task.id}`, error);
      
      result = {
        task_id: task.id,
        status: HistoryStatus.FAILED,
        worker_version: this.versionManager.getCurrentVersion(),
        execution_time_ms: Date.now() - startTime,
        memory_usage_mb: process.memoryUsage().heapUsed / 1024 / 1024,
        error: {
          code: 'EXECUTION_ERROR',
          message: error instanceof Error ? error.message : String(error),
          details: error,
        },
      };

      this.updateTaskStats(false, Date.now() - startTime);
    } finally {
      // 7. 清理任務狀態
      this.currentTasks.delete(task.id);
      
      // 8. 回報結果
      await this.apiService.reportTaskResult(result);
      
      // 9. 觸發回調
      if (this.onTaskCompletion) {
        try {
          await this.onTaskCompletion(task, result);
        } catch (callbackError) {
          console.warn('任務完成回調執行失敗:', callbackError);
        }
      }
    }

    return result;
  }

  /**
   * 設置回調函數
   */
  setCallbacks(callbacks: {
    onTaskCompletion?: TaskCompletionCallback;
    onError?: ErrorCallback;
    onVersionSwitch?: VersionSwitchCallback;
    onHeartbeat?: HeartbeatCallback;
  }): void {
    this.onTaskCompletion = callbacks.onTaskCompletion;
    this.onError = callbacks.onError;
    this.onVersionSwitch = callbacks.onVersionSwitch;
    this.onHeartbeat = callbacks.onHeartbeat;
  }

  /**
   * 獲取 Worker 統計資訊
   */
  getStats(): WorkerStats {
    this.workerStats.worker.uptime = (Date.now() - this.startTime.getTime()) / 1000;
    this.workerStats.system = this.getSystemStats();
    return { ...this.workerStats };
  }

  /**
   * 獲取當前狀態
   */
  getStatus(): WorkerStatus {
    return this.status;
  }

  /**
   * 手動觸發版本切換
   */
  async switchVersion(targetVersion: string): Promise<boolean> {
    try {
      console.log(`🔄 手動切換版本: ${targetVersion}`);
      
      const oldVersion = this.versionManager.getCurrentVersion();
      const success = await this.versionManager.switchVersion(targetVersion);
      
      if (success) {
        // 更新統計
        this.workerStats.version.current = targetVersion;
        this.workerStats.version.switches += 1;
        this.workerStats.version.last_switch = new Date();
        
        // 觸發回調
        if (this.onVersionSwitch) {
          await this.onVersionSwitch(oldVersion, targetVersion);
        }
        
        console.log(`✅ 版本切換成功: ${oldVersion} → ${targetVersion}`);
        return true;
      } else {
        console.error(`❌ 版本切換失敗: ${targetVersion}`);
        return false;
      }
    } catch (error) {
      console.error('版本切換過程中發生錯誤:', error);
      this.handleError(this.createWorkerError('VERSION_SWITCH_FAILED', error));
      return false;
    }
  }

  /**
   * 啟動心跳
   */
  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(async () => {
      try {
        const heartbeat = {
          current_load: this.currentTasks.size,
          memory_usage_mb: process.memoryUsage().heapUsed / 1024 / 1024,
          cpu_usage_percent: this.getCpuUsage(),
          status: this.status,
          metadata: {
            version: this.versionManager.getCurrentVersion(),
            uptime: (Date.now() - this.startTime.getTime()) / 1000,
            error_count: this.errorCount,
          },
        };

        await this.apiService.sendHeartbeat(heartbeat);
        
        // 觸發心跳回調
        if (this.onHeartbeat) {
          await this.onHeartbeat(this.getStats());
        }
        
      } catch (error) {
        console.warn('心跳發送失敗:', error);
      }
    }, this.config.heartbeatInterval);
  }

  /**
   * 停止心跳
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }
  }

  /**
   * 啟動任務輪詢
   */
  private startTaskPolling(): void {
    this.taskPollingTimer = setInterval(async () => {
      if (this.status !== WorkerStatus.ACTIVE) {
        return;
      }

      // 檢查是否有空閒容量
      if (this.currentTasks.size >= this.config.maxConcurrent) {
        return;
      }

      try {
        // 請求新任務
        const availableSlots = this.config.maxConcurrent - this.currentTasks.size;
        const tasks = await this.apiService.requestTasks({
          supported_regions: this.config.supportedRegions,
          supported_data_types: this.config.supportedDataTypes,
          worker_version: this.versionManager.getCurrentVersion(),
          limit: availableSlots,
        });

        // 並發執行任務
        if (tasks.length > 0) {
          console.log(`📋 收到 ${tasks.length} 個新任務`);
          
          const taskPromises = tasks.map(task => 
            this.executeTask(task).catch(error => {
              console.error(`任務執行失敗 (${task.id}):`, error);
              this.handleError(this.createWorkerError('TASK_EXECUTION_FAILED', error));
            })
          );

          // 不等待任務完成，讓它們並發執行
          Promise.allSettled(taskPromises);
        }
        
      } catch (error) {
        console.warn('任務輪詢失敗:', error);
        this.handleError(this.createWorkerError('TASK_POLLING_FAILED', error));
      }
    }, this.config.taskRequestInterval);
  }

  /**
   * 停止任務輪詢
   */
  private stopTaskPolling(): void {
    if (this.taskPollingTimer) {
      clearInterval(this.taskPollingTimer);
      this.taskPollingTimer = undefined;
    }
  }

  /**
   * 檢查任務版本相容性
   */
  private async checkTaskVersionCompatibility(task: CrawlerTask): Promise<VersionCheckResult> {
    try {
      // 先使用本地版本管理器檢查
      const localCheck = this.versionManager.checkVersionCompatibility(
        task.required_config_version,
        task.version_constraints
      );

      // 如果本地檢查通過，再向服務器確認
      if (localCheck.compatible) {
        const serverResponse = await this.apiService.checkVersionCompatibility(
          task.id,
          this.versionManager.getCurrentVersion()
        );
        
        if (!serverResponse.compatible) {
          return {
            compatible: false,
            currentVersion: localCheck.currentVersion,
            requiredVersion: serverResponse.required_version,
            action: serverResponse.action,
            reason: serverResponse.reason || 'Server version check failed',
          };
        }
      }

      return localCheck;
    } catch (error) {
      console.warn('版本相容性檢查失敗，假設不相容:', error);
      return {
        compatible: false,
        currentVersion: this.versionManager.getCurrentVersion(),
        reason: `版本檢查失敗: ${error instanceof Error ? error.message : error}`,
      };
    }
  }

  /**
   * 處理版本切換
   */
  private async handleVersionSwitch(versionCheck: VersionCheckResult): Promise<boolean> {
    if (!versionCheck.requiredVersion) {
      return false;
    }

    const oldVersion = versionCheck.currentVersion;
    const success = await this.versionManager.switchVersion(versionCheck.requiredVersion);
    
    if (success && this.onVersionSwitch) {
      try {
        await this.onVersionSwitch(oldVersion, versionCheck.requiredVersion);
      } catch (error) {
        console.warn('版本切換回調執行失敗:', error);
      }
    }

    return success;
  }

  /**
   * 執行爬蟲
   */
  private async executeCrawler(task: CrawlerTask, config: ResolvedConfig): Promise<{
    success: boolean;
    recordCount?: number;
    qualityScore?: number;
    outputPath?: string;
    summary?: Record<string, unknown>;
    data?: unknown;
  }> {
    try {
      // 準備執行參數
      const configPath = join(process.cwd(), '.temp', `config-${task.id}.json`);
      
      // 寫入臨時配置文件
      require('fs').writeFileSync(configPath, JSON.stringify(config, null, 2));
      
      try {
        // 執行爬蟲命令
        const command = `npx tsx src/cli.ts --config "${configPath}"`;
        const output = execSync(command, {
          encoding: 'utf8',
          cwd: process.cwd(),
          timeout: 300000, // 5分鐘超時
        });

        // 分析輸出結果
        const result = this.parseExecutionOutput(output);
        
        return {
          success: true,
          recordCount: result.recordCount,
          qualityScore: result.qualityScore,
          outputPath: result.outputPath,
          summary: result.summary,
          data: result.data,
        };
        
      } finally {
        // 清理臨時文件
        try {
          require('fs').unlinkSync(configPath);
        } catch (cleanupError) {
          console.warn('清理臨時配置文件失敗:', cleanupError);
        }
      }
      
    } catch (error) {
      console.error('爬蟲執行失敗:', error);
      return { success: false };
    }
  }

  /**
   * 解析執行輸出
   */
  private parseExecutionOutput(output: string): {
    recordCount?: number;
    qualityScore?: number;
    outputPath?: string;
    summary?: Record<string, unknown>;
    data?: unknown;
  } {
    try {
      // 尋找輸出中的結果信息
      const lines = output.split('\n');
      let recordCount: number | undefined;
      let outputPath: string | undefined;
      
      for (const line of lines) {
        // 匹配記錄數量
        const recordMatch = line.match(/(\d+)\s*(records?|項目|筆)/i);
        if (recordMatch) {
          recordCount = parseInt(recordMatch[1]);
        }
        
        // 匹配輸出路徑
        const pathMatch = line.match(/output.*?:\s*(.+\.json)/i);
        if (pathMatch) {
          outputPath = pathMatch[1].trim();
        }
      }

      return {
        recordCount,
        qualityScore: recordCount && recordCount > 0 ? 1.0 : 0.0,
        outputPath,
        summary: {
          output_lines: lines.length,
          execution_log: output.slice(-1000), // 保留最後 1000 字符
        },
      };
    } catch (error) {
      console.warn('解析執行輸出失敗:', error);
      return {};
    }
  }

  /**
   * 等待任務完成
   */
  private async waitForTasksCompletion(timeout = 30000): Promise<void> {
    const startTime = Date.now();
    
    while (this.currentTasks.size > 0) {
      if (Date.now() - startTime > timeout) {
        console.warn(`⚠️ 等待任務完成超時，強制停止 ${this.currentTasks.size} 個任務`);
        
        // 取消所有運行中的任務
        for (const [taskId] of this.currentTasks) {
          await this.apiService.cancelTask(taskId, 'Worker shutdown');
        }
        this.currentTasks.clear();
        break;
      }
      
      // 等待 1 秒再檢查
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  /**
   * 初始化統計資訊
   */
  private initializeStats(): WorkerStats {
    const versionInfo = this.versionManager.getCurrentVersionInfo();
    
    return {
      worker: {
        id: this.config.workerId,
        name: this.config.workerName,
        version: versionInfo.current,
        uptime: 0,
        status: WorkerStatus.INACTIVE,
      },
      tasks: {
        total: 0,
        completed: 0,
        failed: 0,
        running: 0,
        average_execution_time: 0,
      },
      system: this.getSystemStats(),
      version: {
        current: versionInfo.current,
        switches: 0,
      },
      errors: {
        total: 0,
        by_type: {},
        recent: [],
      },
    };
  }

  /**
   * 更新任務統計
   */
  private updateTaskStats(success: boolean, executionTime: number): void {
    this.workerStats.tasks.total += 1;
    
    if (success) {
      this.workerStats.tasks.completed += 1;
    } else {
      this.workerStats.tasks.failed += 1;
    }
    
    // 更新平均執行時間
    const total = this.workerStats.tasks.completed + this.workerStats.tasks.failed;
    this.workerStats.tasks.average_execution_time = 
      (this.workerStats.tasks.average_execution_time * (total - 1) + executionTime) / total;
    
    this.workerStats.tasks.running = this.currentTasks.size;
  }

  /**
   * 獲取系統統計
   */
  private getSystemStats(): {
    memory_usage_mb: number;
    cpu_usage_percent: number;
    disk_usage_mb: number;
  } {
    const memUsage = process.memoryUsage();
    
    return {
      memory_usage_mb: memUsage.heapUsed / 1024 / 1024,
      cpu_usage_percent: this.getCpuUsage(),
      disk_usage_mb: 0, // 簡化實現，實際可計算磁盤使用量
    };
  }

  /**
   * 獲取 CPU 使用率（簡化實現）
   */
  private getCpuUsage(): number {
    // 簡化實現，實際可使用更精確的 CPU 監控
    return Math.random() * 10 + 5; // 模擬 5-15% 的 CPU 使用率
  }

  /**
   * 設置事件處理器
   */
  private setupEventHandlers(): void {
    // 處理未捕獲的異常
    process.on('uncaughtException', (error) => {
      console.error('未捕獲的異常:', error);
      this.handleError(this.createWorkerError('UNCAUGHT_EXCEPTION', error));
    });

    process.on('unhandledRejection', (reason) => {
      console.error('未處理的 Promise 拒絕:', reason);
      this.handleError(this.createWorkerError('UNHANDLED_REJECTION', reason));
    });

    // 處理程序退出信號
    process.on('SIGINT', async () => {
      console.log('收到 SIGINT 信號，準備優雅退出...');
      await this.stop();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      console.log('收到 SIGTERM 信號，準備優雅退出...');
      await this.stop();
      process.exit(0);
    });
  }

  /**
   * 處理錯誤
   */
  private async handleError(error: WorkerError): Promise<void> {
    this.errorCount += 1;
    this.lastErrorTime = new Date();
    
    // 更新錯誤統計
    this.workerStats.errors.total += 1;
    this.workerStats.errors.by_type[error.code] = 
      (this.workerStats.errors.by_type[error.code] || 0) + 1;
    this.workerStats.errors.recent.push(error);
    
    // 只保留最近 10 個錯誤
    if (this.workerStats.errors.recent.length > 10) {
      this.workerStats.errors.recent = this.workerStats.errors.recent.slice(-10);
    }
    
    // 觸發錯誤回調
    if (this.onError) {
      try {
        await this.onError(error);
      } catch (callbackError) {
        console.error('錯誤回調執行失敗:', callbackError);
      }
    }
    
    // 發送錯誤事件
    this.emit('error', error);
    
    // 檢查是否需要重啟
    if (this.config.autoRestartOnError && 
        this.errorCount >= this.config.maxErrorRetries) {
      console.log(`❌ 錯誤次數過多 (${this.errorCount})，嘗試重啟 Worker`);
      
      try {
        await this.stop();
        await this.start();
        this.errorCount = 0; // 重置錯誤計數
      } catch (restartError) {
        console.error('Worker 重啟失敗:', restartError);
        this.status = WorkerStatus.ERROR;
      }
    }
  }

  /**
   * 創建 Worker 錯誤
   */
  private createWorkerError(code: string, originalError: unknown): WorkerError {
    return {
      code,
      message: originalError instanceof Error ? originalError.message : String(originalError),
      details: originalError,
      timestamp: new Date(),
      source: 'system',
      retryable: ['TASK_POLLING_FAILED', 'VERSION_CHECK_FAILED'].includes(code),
    };
  }
}

// 工廠函數：從環境變數創建 WorkerClient
export function createWorkerClient(config?: Partial<WorkerConfig>): WorkerClient {
  const defaultConfig: WorkerConfig = {
    workerId: config?.workerId || process.env.WORKER_ID || `worker-${Date.now()}`,
    workerName: config?.workerName || process.env.WORKER_NAME || 'Crawler Worker',
    serverUrl: config?.serverUrl || `${process.env.INTERNAL_AHA_API_URL || 'http://localhost:3000'}/crawler`,
    apiKey: config?.apiKey || process.env.API_KEY || '',
    autoVersionSwitch: config?.autoVersionSwitch ?? true,
    preferGitVersion: config?.preferGitVersion ?? true,
    versionCacheDir: config?.versionCacheDir || '.version-cache',
    supportedRegions: config?.supportedRegions || ['TW', 'US', 'JP'],
    supportedDataTypes: config?.supportedDataTypes || ['eps', 'balance_sheet', 'income_statement'],
    maxConcurrent: config?.maxConcurrent || 3,
    taskRequestInterval: config?.taskRequestInterval || 30000, // 30秒
    heartbeatInterval: config?.heartbeatInterval || 60000, // 1分鐘
    versionCheckTimeout: config?.versionCheckTimeout || 10000, // 10秒
    autoRestartOnError: config?.autoRestartOnError ?? true,
    maxErrorRetries: config?.maxErrorRetries || 5,
    githubToken: config?.githubToken || process.env.GITHUB_TOKEN,
  };

  const finalConfig = { ...defaultConfig, ...config };
  return new WorkerClient(finalConfig);
}

// 便利函數：快速啟動 Worker
export async function startWorker(config?: Partial<WorkerConfig>): Promise<WorkerClient> {
  const worker = createWorkerClient(config);
  await worker.start();
  return worker;
}

export default WorkerClient;