import { UniversalCrawler } from '../index';
import { ProgressTracker, TaskStatus } from './ProgressTracker';
import { ErrorRecovery, ErrorAction, ErrorType } from './ErrorRecovery';
import { logger } from '../utils';
import * as fs from 'fs-extra';
import * as path from 'path';
import { MarketRegion } from '../common/shared-types/interfaces/market-data.interface';

export interface BatchOptions {
  // 篩選選項
  category?: 'daily' | 'quarterly' | 'metadata';
  market?: MarketRegion;
  type?: string;
  
  // 執行控制
  concurrent?: number;
  startFrom?: number;
  limit?: number;
  delayMs?: number;
  
  // 重試選項
  retryAttempts?: number;
  retryFailedOnly?: boolean;
  
  // 恢復選項
  resumeProgressId?: string;
  
  // 輸出選項
  outputDir?: string;
  generateReport?: boolean;
  
  // 目錄選項
  configPath?: string;
  progressDir?: string;
  errorLogPath?: string;
}

export interface BatchResult {
  success: boolean;
  total: number;
  completed: number;
  failed: number;
  skipped: number;
  duration: number;
  errors: string[];
  progressId: string;
  outputFiles: string[];
}

export interface CrawlTask {
  configName: string;
  attempt: number;
  lastError?: string;
  outputPath?: string;
}

export class BatchCrawlerManager {
  private crawler: UniversalCrawler;
  private progressTracker?: ProgressTracker;
  private errorRecovery: ErrorRecovery;
  private isRunning = false;
  private isPaused = false;
  private shouldStop = false;
  private currentConcurrency = 0;
  private maxConcurrency = 3;
  private delayMs = 5000;
  private runningTasks = new Set<string>();

  constructor(options: {
    configPath?: string;
    outputDir?: string;
    maxConcurrency?: number;
    delayMs?: number;
    errorLogPath?: string;
  } = {}) {
    this.crawler = new UniversalCrawler({
      configPath: options.configPath || 'config-categorized',
      outputDir: options.outputDir || 'output'
    });

    this.maxConcurrency = options.maxConcurrency || 3;
    this.delayMs = options.delayMs || 5000;

    this.errorRecovery = new ErrorRecovery({
      maxRetryAttempts: 3,
      baseRetryDelay: 5000,
      maxRetryDelay: 300000,
      errorLogPath: options.errorLogPath || path.join(options.outputDir || 'output', 'errors.log')
    });

    // 設置優雅關閉處理器
    this.setupShutdownHandlers();
  }

  /**
   * 開始批量爬取
   */
  async startBatch(options: BatchOptions): Promise<BatchResult> {
    if (this.isRunning) {
      throw new Error('批量爬取已在執行中');
    }

    try {
      this.isRunning = true;
      this.shouldStop = false;
      this.isPaused = false;

      logger.info('開始批量爬取任務', options);

      // 獲取配置列表
      const configNames = await this.getConfigNames(options);
      if (configNames.length === 0) {
        throw new Error('沒有找到符合條件的配置檔案');
      }

      // 應用開始位置和限制
      const startFrom = options.startFrom || 0;
      const limit = options.limit;
      const finalConfigs = limit 
        ? configNames.slice(startFrom, startFrom + limit)
        : configNames.slice(startFrom);

      logger.info(`將執行 ${finalConfigs.length} 個配置 (從第 ${startFrom + 1} 個開始)`);

      // 初始化進度追蹤
      this.progressTracker = new ProgressTracker(finalConfigs, {
        category: options.category,
        market: options.market,
        type: options.type,
        progressDir: options.progressDir || '.progress'
      });

      // 設置進度回調
      this.setupProgressCallbacks();

      // 設置併發數和延遲
      this.maxConcurrency = options.concurrent || 3;
      this.delayMs = options.delayMs || 5000;

      const startTime = Date.now();
      
      // 執行批量爬取
      await this.executeBatch(finalConfigs, options);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // 生成結果摘要
      const progress = this.progressTracker.getProgress();
      const result: BatchResult = {
        success: progress.failed === 0,
        total: progress.total,
        completed: progress.completed,
        failed: progress.failed,
        skipped: progress.skipped,
        duration,
        errors: this.errorRecovery.getErrorSummary().permanentErrors.map(e => e.error.message),
        progressId: progress.id,
        outputFiles: await this.collectOutputFiles(options.outputDir || 'output')
      };

      logger.info('批量爬取完成', {
        total: result.total,
        completed: result.completed,
        failed: result.failed,
        duration: Math.round(duration / 1000) + 's'
      });

      return result;

    } finally {
      this.isRunning = false;
      if (this.progressTracker) {
        this.progressTracker.cleanup();
      }
    }
  }

  /**
   * 恢復中斷的批量爬取
   */
  async resumeBatch(progressId: string, options: BatchOptions = {}): Promise<BatchResult> {
    const progressFiles = await ProgressTracker.listProgressFiles(options.progressDir || '.progress');
    const progressFile = progressFiles.find(file => file.includes(progressId));

    if (!progressFile) {
      throw new Error(`找不到進度檔案: ${progressId}`);
    }

    logger.info(`恢復批量爬取: ${progressFile}`);

    // 載入進度
    this.progressTracker = await ProgressTracker.load(progressFile);
    const progress = this.progressTracker.getProgress();

    // 獲取未完成的配置
    const pendingConfigs: string[] = [];
    const failedConfigs: string[] = [];

    progress.tasks.forEach((task, configName) => {
      if (task.status === TaskStatus.PENDING) {
        pendingConfigs.push(configName);
      } else if (task.status === TaskStatus.FAILED && (task.attempts || 0) < 3) {
        failedConfigs.push(configName);
        // 重置為待執行狀態
        this.progressTracker!.resetConfig(configName);
      }
    });

    const remainingConfigs = [...pendingConfigs, ...failedConfigs];

    if (remainingConfigs.length === 0) {
      logger.info('所有配置已完成，無需恢復');
      return {
        success: true,
        total: progress.total,
        completed: progress.completed,
        failed: progress.failed,
        skipped: progress.skipped,
        duration: 0,
        errors: [],
        progressId: progress.id,
        outputFiles: []
      };
    }

    logger.info(`恢復執行 ${remainingConfigs.length} 個配置 (待執行: ${pendingConfigs.length}, 重試: ${failedConfigs.length})`);

    // 繼續執行
    this.isRunning = true;
    this.setupProgressCallbacks();

    try {
      const startTime = Date.now();
      await this.executeBatch(remainingConfigs, options);
      const duration = Date.now() - startTime;

      const finalProgress = this.progressTracker.getProgress();
      return {
        success: finalProgress.failed === 0,
        total: finalProgress.total,
        completed: finalProgress.completed,
        failed: finalProgress.failed,
        skipped: finalProgress.skipped,
        duration,
        errors: this.errorRecovery.getErrorSummary().permanentErrors.map(e => e.error.message),
        progressId: finalProgress.id,
        outputFiles: await this.collectOutputFiles(options.outputDir || 'output')
      };

    } finally {
      this.isRunning = false;
      if (this.progressTracker) {
        this.progressTracker.cleanup();
      }
    }
  }

  /**
   * 只重試失敗的配置
   */
  async retryFailed(progressId: string, options: BatchOptions = {}): Promise<BatchResult> {
    const progressFiles = await ProgressTracker.listProgressFiles(options.progressDir || '.progress');
    const progressFile = progressFiles.find(file => file.includes(progressId));

    if (!progressFile) {
      throw new Error(`找不到進度檔案: ${progressId}`);
    }

    this.progressTracker = await ProgressTracker.load(progressFile);
    const retryableConfigs = this.progressTracker.getRetryableConfigs();

    if (retryableConfigs.length === 0) {
      logger.info('沒有可重試的失敗配置');
      const progress = this.progressTracker.getProgress();
      return {
        success: true,
        total: progress.total,
        completed: progress.completed,
        failed: progress.failed,
        skipped: progress.skipped,
        duration: 0,
        errors: [],
        progressId: progress.id,
        outputFiles: []
      };
    }

    logger.info(`重試 ${retryableConfigs.length} 個失敗配置`);

    // 重置失敗配置的狀態
    retryableConfigs.forEach(configName => {
      this.progressTracker!.resetConfig(configName);
    });

    // 執行重試
    return this.resumeBatch(progressId, options);
  }

  /**
   * 暫停批量爬取
   */
  async pauseBatch(): Promise<void> {
    if (!this.isRunning) {
      throw new Error('沒有正在執行的批量爬取');
    }

    this.isPaused = true;
    logger.info('批量爬取已暫停');
  }

  /**
   * 恢復批量爬取
   */
  async unpauseBatch(): Promise<void> {
    if (!this.isRunning) {
      throw new Error('沒有正在執行的批量爬取');
    }

    this.isPaused = false;
    logger.info('批量爬取已恢復');
  }

  /**
   * 停止批量爬取
   */
  async stopBatch(): Promise<void> {
    this.shouldStop = true;
    logger.info('正在停止批量爬取...');
  }

  /**
   * 獲取當前進度
   */
  getProgress(): any {
    return this.progressTracker?.getProgress();
  }

  /**
   * 根據選項篩選配置名稱
   */
  private async getConfigNames(options: BatchOptions): Promise<string[]> {
    const allConfigs = await this.crawler.listConfigs();
    
    return allConfigs.filter(configName => {
      // 排除模板配置（templates 目錄下的配置）
      if (configName.startsWith('templates/')) {
        return false;
      }
      
      // 排除測試配置（active 目錄下的配置）
      if (configName.startsWith('active/')) {
        return false;
      }
      // 按類別篩選
      if (options.category) {
        switch (options.category) {
          case 'daily':
            if (!configName.includes('history')) return false;
            break;
          case 'quarterly':
            if (configName.includes('history') || configName.includes('symbols') || 
                configName.includes('labels') || configName.includes('categories')) return false;
            break;
          case 'metadata':
            if (!configName.includes('symbols') && !configName.includes('labels') && 
                !configName.includes('categories') && !configName.includes('details')) return false;
            break;
        }
      }

      // 按市場篩選
      if (options.market) {
        if (!configName.includes(`-${options.market}-`)) return false;
      }

      // 按類型篩選
      if (options.type) {
        if (!configName.includes(options.type)) return false;
      }

      return true;
    });
  }

  /**
   * 執行批量爬取
   */
  private async executeBatch(configNames: string[], options: BatchOptions): Promise<void> {
    const tasks: CrawlTask[] = configNames.map(name => ({
      configName: name,
      attempt: 0
    }));

    let taskIndex = 0;

    while (taskIndex < tasks.length && !this.shouldStop) {
      // 檢查是否暫停
      if (this.isPaused) {
        await this.delay(1000);
        continue;
      }

      // 控制併發數
      if (this.currentConcurrency >= this.maxConcurrency) {
        await this.delay(100);
        continue;
      }

      const task = tasks[taskIndex];
      taskIndex++;

      // 跳過已在執行的任務
      if (this.runningTasks.has(task.configName)) {
        continue;
      }

      // 執行任務
      this.executeTask(task, options);
    }

    // 等待所有任務完成
    while (this.currentConcurrency > 0 && !this.shouldStop) {
      await this.delay(1000);
    }
  }

  /**
   * 執行單個爬取任務
   */
  private async executeTask(task: CrawlTask, options: BatchOptions): Promise<void> {
    this.currentConcurrency++;
    this.runningTasks.add(task.configName);

    try {
      task.attempt++;
      this.progressTracker?.updateProgress(task.configName, TaskStatus.RUNNING);

      logger.debug(`開始執行: ${task.configName} (嘗試 ${task.attempt})`);

      // 執行爬取
      const results = await this.crawler.crawlMultiple([task.configName], 1);
      const result = results[0];

      if (result.success) {
        this.progressTracker?.updateProgress(task.configName, TaskStatus.COMPLETED);
        logger.debug(`完成: ${task.configName}`);
        
        // 自動導出成功的結果
        try {
          logger.debug(`🔍 開始自動導出: ${task.configName}`);
          // 從配置加載 export 配置 - 需要構造正確的配置路徑
          // task.configName 格式: quarterly/jp/financials/yahoo-finance-jp-financials-9993_T
          // configManager 期望的是相對於 configPath 的路徑
          const configPath = task.configName; // 保持完整路徑
          logger.debug(`📂 使用配置路徑: ${configPath}`);
          
          // 直接讀取配置文件，不依賴 configManager 的路徑拼接
          // BatchCrawlerManager 的 configPath 已經是 "config-categorized"
          // task.configName 是 "quarterly/jp/financials/yahoo-finance-jp-financials-9993_T"
          const fullConfigPath = path.join(this.crawler.configManager['configPath'] || 'config-categorized', `${configPath}.json`);
          logger.debug(`📂 完整配置文件路徑: ${fullConfigPath}`);
          
          const configData = await fs.readJson(fullConfigPath);
          logger.debug(`📋 配置數據加載成功，檢查 export 設定...`);
          
          if (configData.export && configData.export.formats) {
            logger.debug(`🎯 找到 export 配置:`, configData.export);
            const format = configData.export.formats[0] || 'json';
            // 提取配置檔案的基本名稱，用於 DataExporter 的路徑解析
            const configBaseName = task.configName.split('/').pop() || task.configName;
            
            const exportOptions = {
              format: format as 'json' | 'csv' | 'xlsx',
              filename: configData.export.filename || `${configBaseName}_${new Date().toISOString().split('T')[0]}`,
              configName: configBaseName // 用於路徑解析，DataExporter 會智能處理重複前綴
            };
            
            logger.debug(`📤 開始導出，選項:`, exportOptions);
            const exportPath = await this.crawler.export([result], exportOptions);
            logger.info(`✅ 已導出結果到: ${exportPath}`);
          } else {
            logger.warn(`⚠️ 配置中沒有找到 export 設定: ${task.configName}`);
          }
        } catch (exportError) {
          logger.warn(`⚠️ 導出失敗: ${task.configName}`, exportError);
        }
      } else {
        // 處理錯誤
        const error = new Error(result.error || '未知錯誤');
        const action = this.errorRecovery.handleError(task.configName, error, task.attempt);

        switch (action) {
          case ErrorAction.RETRY:
            // 立即重試
            this.progressTracker?.updateProgress(task.configName, TaskStatus.PENDING);
            this.executeTask(task, options);
            break;

          case ErrorAction.RETRY_AFTER_DELAY:
            // 延遲重試
            const delay = this.errorRecovery.calculateRetryDelay(task.attempt);
            logger.info(`將在 ${Math.round(delay / 1000)} 秒後重試: ${task.configName}`);
            setTimeout(() => {
              this.progressTracker?.updateProgress(task.configName, TaskStatus.PENDING);
              this.executeTask(task, options);
            }, delay);
            break;

          case ErrorAction.REDUCE_CONCURRENCY:
            // 降低併發數
            this.maxConcurrency = Math.max(1, Math.floor(this.maxConcurrency * 0.8));
            logger.warn(`降低併發數至 ${this.maxConcurrency}`);
            this.progressTracker?.updateProgress(task.configName, TaskStatus.FAILED, error.message);
            break;

          case ErrorAction.SKIP:
            this.progressTracker?.updateProgress(task.configName, TaskStatus.SKIPPED, error.message);
            break;

          case ErrorAction.ABORT:
            this.shouldStop = true;
            this.progressTracker?.updateProgress(task.configName, TaskStatus.FAILED, error.message);
            break;
        }
      }

      // 任務間延遲
      if (this.delayMs > 0) {
        await this.delay(this.delayMs);
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`任務執行異常: ${task.configName}`, error);
      this.progressTracker?.updateProgress(task.configName, TaskStatus.FAILED, errorMessage);
    } finally {
      this.currentConcurrency--;
      this.runningTasks.delete(task.configName);
    }
  }

  /**
   * 設置進度回調
   */
  private setupProgressCallbacks(): void {
    if (!this.progressTracker) return;

    this.progressTracker.onProgress((progress) => {
      if (progress.percentage % 10 === 0) { // 每10%輸出一次進度
        logger.info(`批量進度: ${progress.percentage.toFixed(1)}% (${progress.completed}/${progress.total})`);
      }
    });

    this.progressTracker.onError((configName, error) => {
      logger.warn(`配置失敗: ${configName} - ${error}`);
    });

    this.progressTracker.onComplete((progress) => {
      logger.info('批量爬取完成', {
        total: progress.total,
        completed: progress.completed,
        failed: progress.failed,
        skipped: progress.skipped,
        percentage: progress.percentage
      });
    });
  }

  /**
   * 設置優雅關閉處理器
   */
  private setupShutdownHandlers(): void {
    const handleShutdown = async (signal: string) => {
      logger.info(`收到 ${signal} 信號，正在優雅關閉...`);
      this.shouldStop = true;
      
      if (this.progressTracker) {
        await this.progressTracker.save();
        this.progressTracker.cleanup();
      }
      
      await this.crawler.cleanup();
      process.exit(0);
    };

    process.on('SIGINT', () => handleShutdown('SIGINT'));
    process.on('SIGTERM', () => handleShutdown('SIGTERM'));
  }

  /**
   * 延遲函數
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 收集輸出檔案（遞歸搜索所有子目錄）
   */
  private async collectOutputFiles(outputDir: string): Promise<string[]> {
    try {
      if (!await fs.pathExists(outputDir)) {
        return [];
      }

      const files: string[] = [];
      
      const collectRecursively = async (dir: string) => {
        const items = await fs.readdir(dir, { withFileTypes: true });
        
        for (const item of items) {
          const fullPath = path.join(dir, item.name);
          
          if (item.isDirectory()) {
            // 跳過 screenshots 目錄
            if (item.name !== 'screenshots') {
              await collectRecursively(fullPath);
            }
          } else if (item.isFile() && item.name.endsWith('.json')) {
            files.push(fullPath);
          }
        }
      };
      
      await collectRecursively(outputDir);
      return files;
    } catch (error) {
      logger.error('收集輸出檔案失敗:', error);
      return [];
    }
  }

  /**
   * 清理資源
   */
  async cleanup(): Promise<void> {
    this.shouldStop = true;
    
    if (this.progressTracker) {
      this.progressTracker.cleanup();
    }
    
    await this.crawler.cleanup();
  }
}