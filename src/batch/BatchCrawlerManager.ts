import { UniversalCrawler } from '../index';
import { BrowserPool } from '../crawler/BrowserPool';
import { ProgressTracker, TaskStatus } from './ProgressTracker';
import { ErrorRecovery, ErrorAction, ErrorType } from './ErrorRecovery';
import { SiteConcurrencyManager } from './SiteConcurrencyManager';
import { logger } from '../utils';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as readline from 'readline';
import { MarketRegion } from '../common/shared-types/interfaces/market-data.interface';

export interface BatchOptions {
  // 篩選選項
  category?: 'daily' | 'quarterly' | 'metadata';
  market?: MarketRegion;
  type?: string;
  
  // 執行控制
  concurrent?: number; // 保留向後兼容，但會被 site-based concurrency 覆蓋
  startFrom?: number;
  limit?: number;
  delayMs?: number; // 保留向後兼容，但會被 site-specific delays 覆蓋
  
  // Site-based concurrency 控制
  useSiteConcurrency?: boolean; // 是否使用 site-based concurrency (預設: true)
  siteConcurrencyOverrides?: Record<string, { maxConcurrent?: number; delayMs?: number }>; // 覆蓋特定站點設定
  
  // 瀏覽器池選項
  browserPoolSize?: number; // 瀏覽器池大小 (預設: 3)
  
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
  url?: string; // 添加 URL 用於 site-based concurrency
  domain?: string; // 添加 domain 快取
}

export class BatchCrawlerManager {
  private crawler: UniversalCrawler;
  private browserPool: BrowserPool | null = null;
  private progressTracker?: ProgressTracker;
  private errorRecovery: ErrorRecovery;
  private siteConcurrencyManager: SiteConcurrencyManager;
  private isRunning = false;
  private isPaused = false;
  private shouldStop = false;
  
  // 向後兼容的全域並發控制 (當 useSiteConcurrency=false 時使用)
  private currentConcurrency = 0;
  private maxConcurrency = 3;
  private delayMs = 5000;
  private runningTasks = new Set<string>();
  
  // Site-based concurrency 設定
  private useSiteConcurrency = true;

  constructor(options: {
    configPath?: string;
    outputDir?: string;
    maxConcurrency?: number;
    delayMs?: number;
    errorLogPath?: string;
    useSiteConcurrency?: boolean; // 新增：是否使用 site-based concurrency
    browserPoolSize?: number; // 新增：瀏覽器池大小
  } = {}) {
    // 創建瀏覽器池
    const browserPoolSize = options.browserPoolSize || options.maxConcurrency || 3;
    this.browserPool = new BrowserPool({
      maxSize: browserPoolSize,
      maxIdleTime: 300000, // 5分鐘
      browserLaunchOptions: {
        headless: true,
        timeout: 30000
      }
    });

    this.crawler = new UniversalCrawler({
      configPath: options.configPath || 'config-categorized',
      outputDir: options.outputDir || 'output',
      browserPool: this.browserPool
    });

    // 向後兼容設定
    this.maxConcurrency = options.maxConcurrency || 3;
    this.delayMs = options.delayMs || 5000;
    this.useSiteConcurrency = options.useSiteConcurrency !== false; // 預設為 true

    // 初始化 Site-based Concurrency Manager
    this.siteConcurrencyManager = new SiteConcurrencyManager();

    this.errorRecovery = new ErrorRecovery({
      maxRetryAttempts: 3,
      baseRetryDelay: 5000,
      maxRetryDelay: 300000,
      errorLogPath: options.errorLogPath || path.join(options.outputDir || 'output', 'errors.log')
    });

    // 設置優雅關閉處理器
    this.setupShutdownHandlers();
    
    logger.info(`🚀 BatchCrawlerManager 初始化完成 (Site-based concurrency: ${this.useSiteConcurrency ? '啟用' : '停用'}, 瀏覽器池大小: ${browserPoolSize})`);
  }

  /**
   * 分類跳過錯誤類型
   */
  private categorizeSkipError(error: string): string {
    const lowerError = error.toLowerCase();
    
    if (lowerError.includes('404') || lowerError.includes('not found')) {
      return '404 頁面不存在';
    }
    if (lowerError.includes('403') || lowerError.includes('forbidden') || lowerError.includes('access denied')) {
      return '403 權限錯誤';
    }
    if (lowerError.includes('401') || lowerError.includes('unauthorized')) {
      return '401 未授權';
    }
    if (lowerError.includes('invalid configuration') || lowerError.includes('parse error')) {
      return '配置錯誤';
    }
    if (lowerError.includes('malformed') || lowerError.includes('format')) {
      return '格式錯誤';
    }
    
    return '其他永久性錯誤';
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

      // 檢查進度目錄並提醒
      await this.checkProgressDirectory(options.progressDir || '.progress');

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

      // 設置併發數和延遲 (根據 useSiteConcurrency 決定行為)
      this.useSiteConcurrency = options.useSiteConcurrency !== false; // 預設為 true
      
      if (this.useSiteConcurrency) {
        logger.info('🌐 使用 Site-based Concurrency 控制，自動根據網站特性調整併發');
        if (options.siteConcurrencyOverrides) {
          logger.info('⚙️ 應用 Site Concurrency 覆蓋設定', options.siteConcurrencyOverrides);
          // TODO: 應用覆蓋設定到 SiteConcurrencyManager
        }
      } else {
        // 傳統全域併發控制
        this.maxConcurrency = options.concurrent || 3;
        this.delayMs = options.delayMs || 5000;
        logger.info(`🔄 使用傳統全域併發控制 (併發: ${this.maxConcurrency}, 延遲: ${this.delayMs}ms)`);
      }

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
   * 重試所有失敗和跳過的配置（強制重試）
   */
  async retryAll(progressId: string, options: BatchOptions & {
    includeSkipped?: boolean;
    resetAttempts?: boolean;
    skippedOnly?: boolean;
  } = {}): Promise<BatchResult> {
    const progressFiles = await ProgressTracker.listProgressFiles(options.progressDir || '.progress');
    const progressFile = progressFiles.find(file => file.includes(progressId));

    if (!progressFile) {
      throw new Error(`找不到進度檔案: ${progressId}`);
    }

    this.progressTracker = await ProgressTracker.load(progressFile);
    
    let configsToRetry: string[];
    
    if (options.skippedOnly) {
      // 只重試跳過的任務
      configsToRetry = this.progressTracker.getSkippedConfigs();
      console.log(`🔄 準備重試 ${configsToRetry.length} 個跳過的任務...`);
    } else if (options.includeSkipped) {
      // 重試失敗 + 跳過的任務
      configsToRetry = this.progressTracker.getRetryableConfigsIncludeSkipped();
      console.log(`🔄 準備重試 ${configsToRetry.length} 個失敗和跳過的任務...`);
    } else {
      // 強制重試所有失敗和跳過的任務（忽略重試次數限制）
      configsToRetry = this.progressTracker.getAllFailedAndSkippedConfigs();
      console.log(`🔄 準備強制重試 ${configsToRetry.length} 個失敗和跳過的任務...`);
    }

    if (configsToRetry.length === 0) {
      const progress = this.progressTracker.getProgress();
      console.log('');
      console.log('✅ 沒有需要重試的任務');
      console.log('='.repeat(60));
      console.log(`📋 批次 ID: ${progress.id}`);
      console.log(`📊 當前狀態:`);
      console.log(`   • 總任務數: ${progress.total}`);
      console.log(`   • ✅ 成功: ${progress.completed}`);
      console.log(`   • ❌ 失敗: ${progress.failed}`);
      console.log(`   • ⏭️  跳過: ${progress.skipped}`);
      console.log('='.repeat(60));
      console.log('');

      return {
        success: true,
        total: 0,
        completed: 0,
        failed: 0,
        skipped: 0,
        duration: 0,
        errors: [],
        progressId: progress.id,
        outputFiles: []
      };
    }

    // 顯示即將重試的任務詳情
    const progress = this.progressTracker.getProgress();
    const tasks = progress.tasks instanceof Map ? 
      Object.fromEntries(progress.tasks) : 
      progress.tasks;

    console.log('');
    console.log('📋 重試任務詳情：');
    console.log('='.repeat(60));

    // 按狀態分組顯示
    const failedTasks = configsToRetry.filter(name => 
      tasks[name]?.status === 'failed'
    );
    const skippedTasks = configsToRetry.filter(name => 
      tasks[name]?.status === 'skipped'
    );

    if (failedTasks.length > 0) {
      console.log(`⚠️  失敗任務 (${failedTasks.length} 個) - 將重新嘗試:`);
      failedTasks.slice(0, 5).forEach((name, i) => {
        const task = tasks[name];
        console.log(`   ${i + 1}. ${name} (已嘗試 ${task.attempts || 0} 次)`);
      });
      if (failedTasks.length > 5) {
        console.log(`   ... 還有 ${failedTasks.length - 5} 個失敗任務`);
      }
    }

    if (skippedTasks.length > 0) {
      console.log(`⏭️  跳過任務 (${skippedTasks.length} 個) - 將強制重試:`);
      skippedTasks.slice(0, 5).forEach((name, i) => {
        const task = tasks[name];
        console.log(`   ${i + 1}. ${name} (原因: ${task.error || '未知'})`);
      });
      if (skippedTasks.length > 5) {
        console.log(`   ... 還有 ${skippedTasks.length - 5} 個跳過任務`);
      }
      
      console.log('');
      console.log('💡 跳過任務重試說明:');
      console.log('   • 這些任務原本因永久性錯誤被跳過');
      console.log('   • 強制重試可能有助於處理暫時性問題');
      console.log('   • 如果仍然失敗，考慮檢查股票代碼有效性');
    }

    console.log('='.repeat(60));

    // 重置任務狀態
    const resetCount = this.progressTracker.resetConfigs(configsToRetry, {
      resetAttempts: options.resetAttempts
    });
    
    console.log(`🔄 已重置 ${resetCount} 個任務狀態為 PENDING`);
    if (options.resetAttempts) {
      console.log('🔢 已重置所有任務的嘗試次數');
    }

    // 保存進度
    await this.progressTracker.save();

    // 開始執行重試
    return this.executeBatch(configsToRetry, options);
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
      const progress = this.progressTracker.getProgress();
      const startTime = new Date(progress.startTime);
      const endTime = new Date(progress.lastUpdateTime);
      const originalDuration = (progress.lastUpdateTime - progress.startTime) / 1000;
      
      // 分析跳過的任務
      const skippedTasks: Array<{configName: string; error?: string; stockCode?: string}> = [];
      const tasks = progress.tasks instanceof Map ? 
        Object.fromEntries(progress.tasks) : 
        progress.tasks;

      Object.entries(tasks).forEach(([configName, task]) => {
        if (task.status === 'skipped') {
          const stockCodeMatch = configName.match(/-([A-Z0-9]+(?:_TW)?).json$/);
          const stockCode = stockCodeMatch ? stockCodeMatch[1].replace('_TW', '') : undefined;
          skippedTasks.push({
            configName,
            error: (task as any).error || '未知原因',
            stockCode
          });
        }
      });
      
      console.log('');
      if (progress.skipped > 0) {
        console.log('⚠️  批次任務完成，但有部分任務被跳過');
      } else {
        console.log('✅ 批次任務已完全成功，無需重試');
      }
      console.log('='.repeat(60));
      console.log(`📋 批次 ID: ${progress.id}`);
      console.log(`📊 原始執行統計:`);
      console.log(`   • 執行時間: ${startTime.toISOString().replace('T', ' ').slice(0, 19)}`);
      console.log(`   • 結束時間: ${endTime.toISOString().replace('T', ' ').slice(0, 19)}`);
      console.log(`   • 總耗時: ${originalDuration.toFixed(1)} 秒 (${(originalDuration/60).toFixed(1)} 分鐘)`);
      console.log(`   • 總任務數: ${progress.total}`);
      console.log(`   • ✅ 成功: ${progress.completed} (${(progress.completed/progress.total*100).toFixed(1)}%)`);
      console.log(`   • ❌ 失敗: ${progress.failed} (暫時性錯誤，已全部重試完成)`);
      console.log(`   • ⏭️  跳過: ${progress.skipped} (永久性錯誤，不可重試)`);
      if (progress.averageTimePerTask) {
        console.log(`   • ⏱️  平均每任務: ${(progress.averageTimePerTask/1000).toFixed(1)} 秒`);
      }

      // 顯示跳過任務的詳細信息
      if (skippedTasks.length > 0) {
        console.log('');
        console.log('⏭️  跳過任務詳情（永久性錯誤）:');
        
        // 按錯誤類型分組
        const errorGroups: Record<string, typeof skippedTasks> = {};
        skippedTasks.forEach(task => {
          const errorType = this.categorizeSkipError(task.error || '');
          if (!errorGroups[errorType]) {
            errorGroups[errorType] = [];
          }
          errorGroups[errorType].push(task);
        });

        Object.entries(errorGroups).forEach(([errorType, tasks]) => {
          console.log(`   📌 ${errorType} (${tasks.length} 個股票):`);
          const stockCodes = tasks.slice(0, 10).map(t => t.stockCode || 'Unknown').join(', ');
          console.log(`      股票: ${stockCodes}${tasks.length > 10 ? '...' : ''}`);
        });

        console.log('');
        console.log('💡 跳過任務處理建議:');
        console.log('   • 詳細診斷: npm run crawl:diagnose:skipped');
        console.log(`   • 進度詳情: npm run crawl:progress:info -- ${progress.id}`);
        console.log('   • 檢查股票有效性: npm run crawl:validate:stocks');
        console.log('   • 清理無效股票: npm run crawl:clean:invalid');
      }
      console.log('='.repeat(60));
      console.log('💡 所有任務都已成功完成，沒有需要重試的失敗配置');
      console.log('');
      
      logger.info('沒有可重試的失敗配置');
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
    // 初始化任務並提取 URL 信息
    const tasks: CrawlTask[] = await Promise.all(
      configNames.map(async (name) => {
        const task: CrawlTask = {
          configName: name,
          attempt: 0
        };
        
        // 為 site-based concurrency 提取 URL
        if (this.useSiteConcurrency) {
          try {
            const url = await this.extractUrlFromConfig(name);
            task.url = url;
            task.domain = this.extractDomainFromUrl(url);
          } catch (error) {
            logger.warn(`無法從配置 ${name} 提取 URL:`, error);
          }
        }
        
        return task;
      })
    );

    let taskIndex = 0;

    while (taskIndex < tasks.length && !this.shouldStop) {
      // 檢查是否暫停
      if (this.isPaused) {
        await this.delay(1000);
        continue;
      }

      const task = tasks[taskIndex];

      // 跳過已在執行的任務
      if (this.runningTasks.has(task.configName)) {
        taskIndex++;
        continue;
      }

      let canExecute = false;

      if (this.useSiteConcurrency) {
        // Site-based concurrency 控制
        if (task.url) {
          canExecute = this.siteConcurrencyManager.canExecute(task.url);
        } else {
          // 如果沒有 URL，回退到全域控制
          canExecute = this.currentConcurrency < this.maxConcurrency;
        }
      } else {
        // 傳統全域併發控制
        canExecute = this.currentConcurrency < this.maxConcurrency;
      }

      if (!canExecute) {
        await this.delay(100);
        continue;
      }

      taskIndex++;

      // 執行任務
      this.executeTask(task, options);
    }

    // 等待所有任務完成
    if (this.useSiteConcurrency) {
      // 等待 site-based concurrency manager 完成所有任務
      while (this.getTotalRunningTasks() > 0 && !this.shouldStop) {
        await this.delay(1000);
      }
    } else {
      // 等待傳統全域任務完成
      while (this.currentConcurrency > 0 && !this.shouldStop) {
        await this.delay(1000);
      }
    }
  }

  /**
   * 執行單個爬取任務
   */
  private async executeTask(task: CrawlTask, options: BatchOptions): Promise<void> {
    // 獲取 site concurrency slot (如果啟用)
    let taskId = `task_${task.configName}_${Date.now()}`;
    
    if (this.useSiteConcurrency && task.url) {
      // 使用 site-based concurrency
      await this.siteConcurrencyManager.acquireSlot(taskId, task.url, 1);
    } else {
      // 使用傳統全域併發控制
      this.currentConcurrency++;
    }
    
    this.runningTasks.add(task.configName);

    try {
      task.attempt++;
      this.progressTracker?.updateProgress(task.configName, TaskStatus.RUNNING);

      const domainInfo = task.domain ? ` [${task.domain}]` : '';
      logger.debug(`開始執行: ${task.configName}${domainInfo} (嘗試 ${task.attempt})`);

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

      // 任務間延遲 (site-based concurrency 自動處理，這裡只處理全域模式)
      if (!this.useSiteConcurrency && this.delayMs > 0) {
        await this.delay(this.delayMs);
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`任務執行異常: ${task.configName}`, error);
      this.progressTracker?.updateProgress(task.configName, TaskStatus.FAILED, errorMessage);
    } finally {
      // 釋放 concurrency slot
      if (this.useSiteConcurrency && task.url) {
        this.siteConcurrencyManager.releaseSlot(taskId, task.url);
      } else {
        this.currentConcurrency--;
      }
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
   * 檢查進度目錄並提醒用戶
   */
  private async checkProgressDirectory(progressDir: string): Promise<void> {
    try {
      if (!await fs.pathExists(progressDir)) {
        return; // 目錄不存在，無需檢查
      }

      const progressFiles = await ProgressTracker.listProgressFiles(progressDir);
      const fileCount = progressFiles.length;
      
      if (fileCount > 10) {  // 超過 10 個檔案時提醒
        const oldFiles = await this.getOldProgressFiles(progressDir, 7);  // 7 天前的檔案
        const totalSize = await this.getDirectorySize(progressDir);
        
        console.log(`
╔════════════════════════════════════════════════════════════╗
║                    📁 進度檔案提醒                          ║
╠════════════════════════════════════════════════════════════╣
║  目前 ${progressDir} 目錄狀態：                              ║
║  • 檔案數量：${fileCount} 個                                ║
║  • 目錄大小：${totalSize}                                   ║
║  • 7 天前檔案：${oldFiles.length} 個                       ║
║                                                            ║
║  建議執行清理命令：                                          ║
║  • npm run clean:progress:safe  (清理 3 天前)              ║
║  • npm run clean:progress:old   (清理 7 天前)              ║
║  • npm run clean:progress:keep-recent (保留最近 5 個)      ║
╚════════════════════════════════════════════════════════════╝
        `);
        
        // 如果是互動模式，詢問是否繼續
        if (process.stdout.isTTY && !process.env.CI) {
          const answer = await this.promptUser('是否繼續執行？(Y/n): ');
          if (answer.toLowerCase() === 'n') {
            console.log('已取消執行');
            process.exit(0);
          }
        }
      }
    } catch (error) {
      logger.warn('檢查進度目錄時發生錯誤:', error);
      // 不阻塞執行，只記錄警告
    }
  }

  /**
   * 取得舊進度檔案列表
   */
  private async getOldProgressFiles(progressDir: string, days: number): Promise<string[]> {
    try {
      const files = await fs.readdir(progressDir);
      const oldFiles: string[] = [];
      const cutoffTime = Date.now() - (days * 24 * 60 * 60 * 1000);
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          const filePath = path.join(progressDir, file);
          const stats = await fs.stat(filePath);
          if (stats.mtime.getTime() < cutoffTime) {
            oldFiles.push(file);
          }
        }
      }
      
      return oldFiles;
    } catch (error) {
      return [];
    }
  }

  /**
   * 取得目錄大小
   */
  private async getDirectorySize(dir: string): Promise<string> {
    try {
      const files = await fs.readdir(dir);
      let totalSize = 0;
      
      for (const file of files) {
        const filePath = path.join(dir, file);
        const stats = await fs.stat(filePath);
        if (stats.isFile()) {
          totalSize += stats.size;
        }
      }
      
      // 格式化大小
      if (totalSize < 1024) return `${totalSize} B`;
      if (totalSize < 1024 * 1024) return `${(totalSize / 1024).toFixed(1)} KB`;
      if (totalSize < 1024 * 1024 * 1024) return `${(totalSize / 1024 / 1024).toFixed(1)} MB`;
      return `${(totalSize / 1024 / 1024 / 1024).toFixed(1)} GB`;
    } catch (error) {
      return 'Unknown';
    }
  }

  /**
   * 提示用戶輸入
   */
  private async promptUser(message: string): Promise<string> {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    return new Promise((resolve) => {
      rl.question(message, (answer) => {
        rl.close();
        resolve(answer || 'y');
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
      
      // 清理瀏覽器池
      if (this.browserPool) {
        await this.browserPool.destroy();
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
   * 從配置文件提取 URL
   */
  private async extractUrlFromConfig(configName: string): Promise<string> {
    try {
      const fullConfigPath = path.join(
        this.crawler.configManager['configPath'] || 'config-categorized', 
        `${configName}.json`
      );
      const configData = await fs.readJson(fullConfigPath);
      return configData.url || '';
    } catch (error) {
      throw new Error(`無法讀取配置文件 ${configName}: ${error}`);
    }
  }

  /**
   * 從 URL 提取域名
   */
  private extractDomainFromUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch (error) {
      return 'unknown';
    }
  }

  /**
   * 獲取總運行任務數 (site-based concurrency)
   */
  private getTotalRunningTasks(): number {
    if (this.useSiteConcurrency) {
      return this.siteConcurrencyManager.getQueueStatistics().totalRunning;
    } else {
      return this.currentConcurrency;
    }
  }

  /**
   * 獲取 Site Concurrency 統計
   */
  public getSiteConcurrencyStatistics(): any {
    if (this.useSiteConcurrency) {
      return {
        siteStats: this.siteConcurrencyManager.getSiteStatistics(),
        queueStats: this.siteConcurrencyManager.getQueueStatistics(),
        enabled: true
      };
    } else {
      return {
        globalStats: {
          running: this.currentConcurrency,
          maxConcurrent: this.maxConcurrency,
          totalQueued: 0
        },
        enabled: false
      };
    }
  }

  /**
   * 獲取瀏覽器池統計資訊
   */
  getBrowserPoolStatistics() {
    if (!this.browserPool) {
      return null;
    }
    return this.browserPool.getStatistics();
  }

  /**
   * 清理資源
   */
  async cleanup(): Promise<void> {
    this.shouldStop = true;
    
    if (this.progressTracker) {
      this.progressTracker.cleanup();
    }
    
    // 優雅關閉 site concurrency manager
    if (this.useSiteConcurrency) {
      await this.siteConcurrencyManager.shutdown(30000);
    }
    
    // 清理瀏覽器池
    if (this.browserPool) {
      await this.browserPool.destroy();
      this.browserPool = null;
    }
    
    await this.crawler.cleanup();
  }
}