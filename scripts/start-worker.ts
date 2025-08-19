#!/usr/bin/env node

/**
 * Worker 啟動腳本
 * 
 * 功能：
 * - 主動從 @finance-strategy 後端拉取任務
 * - 執行爬蟲任務
 * - 回傳執行結果到後端
 * 
 * 使用範例：
 * npm run worker:start                              # 啟動全功能 Worker
 * npm run worker:start:tw                           # 啟動台灣市場專用 Worker
 * npm run worker:test                               # 測試模式
 */

import { WorkerClient } from './worker/worker-client';
import { WorkerConfig, MarketRegion, DataType, WorkerStatus } from '../src/common/shared-types/interfaces/crawler.interface';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// 載入環境變數
dotenv.config();

interface StartWorkerOptions {
  regions?: MarketRegion[];
  dataTypes?: DataType[];
  testMode?: boolean;
  debug?: boolean;
  maxConcurrentTasks?: number;
  pollingInterval?: number;
  workerId?: string;
  workerName?: string;
}

class WorkerStarter {
  private options: StartWorkerOptions;
  private worker: WorkerClient;

  constructor(options: StartWorkerOptions = {}) {
    this.options = {
      regions: options.regions || this.getEnvRegions(),
      dataTypes: options.dataTypes || this.getEnvDataTypes(),
      testMode: options.testMode || false,
      debug: options.debug || (process.env.DEBUG_MODE === 'true'),
      maxConcurrentTasks: options.maxConcurrentTasks || parseInt(process.env.MAX_CONCURRENT_TASKS || '3'),
      pollingInterval: options.pollingInterval || parseInt(process.env.TASK_REQUEST_INTERVAL || '10000'),
      workerId: options.workerId || process.env.WORKER_ID || this.generateWorkerId(),
      workerName: options.workerName || process.env.WORKER_NAME || 'Universal Crawler Worker',
    };
  }

  /**
   * 啟動 Worker
   */
  async start(): Promise<void> {
    try {
      console.log('🚀 啟動 Universal Crawler Worker');
      console.log('⚙️  配置資訊:');
      console.log(`   Worker ID: ${this.options.workerId}`);
      console.log(`   支援區域: ${this.options.regions?.join(', ')}`);
      console.log(`   支援數據類型: ${this.options.dataTypes?.join(', ')}`);
      console.log(`   測試模式: ${this.options.testMode ? '是' : '否'}`);
      console.log(`   最大並發: ${this.options.maxConcurrentTasks}`);
      console.log(`   輪詢間隔: ${this.options.pollingInterval}ms`);
      console.log('');

      // 跳過健康檢查 (如用戶建議，@finance-strategy 目前沒有 health 的驗證)
      console.log('⏭️  跳過後端健康檢查 (直接嘗試 Worker 操作)');

      // 初始化 Worker
      await this.initializeWorker();

      // 啟動 Worker
      await this.worker.start();

      // 設置信號處理
      this.setupSignalHandlers();

      console.log('✅ Worker 已啟動，正在等待任務...');
      console.log('按 Ctrl+C 停止 Worker');

    } catch (error) {
      console.error('❌ Worker 啟動失敗:', error);
      process.exit(1);
    }
  }

  /**
   * 檢查後端連接
   */
  private async checkBackendConnection(): Promise<void> {
    const serverUrl = process.env.FINANCE_STRATEGY_API_URL || 'http://localhost:3000';
    
    console.log(`🔍 檢查後端連接: ${serverUrl}`);
    
    try {
      // 使用 Node.js 的 http 模組而不是 fetch (Node.js 18+ 才有 fetch)
      const http = require('http');
      const url = new URL(`${serverUrl}/crawler/health`);
      
      await new Promise((resolve, reject) => {
        const req = http.request({
          hostname: url.hostname,
          port: url.port || 3000,
          path: url.pathname,
          method: 'GET',
          timeout: 5000,
        }, (res) => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            console.log('✅ 後端連接正常');
            resolve(res);
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
          }
        });
        
        req.on('error', reject);
        req.on('timeout', () => {
          req.destroy();
          reject(new Error('Connection timeout'));
        });
        
        req.end();
      });
    } catch (error) {
      console.error('❌ 後端連接失敗:', error);
      console.log('💡 解決方案:');
      console.log('   1. 確認 @finance-strategy 後端服務正在運行 (http://localhost:3000)');
      console.log('   2. 檢查網路連接');
      console.log('   3. 設置環境變數 FINANCE_STRATEGY_API_URL 指向正確的後端地址');
      throw error;
    }
  }

  /**
   * 初始化 Worker
   */
  private async initializeWorker(): Promise<void> {
    const config: WorkerConfig = {
      workerId: this.options.workerId!,
      workerName: this.options.workerName!,
      serverUrl: process.env.FINANCE_STRATEGY_API_URL || 'http://localhost:3000',
      apiKey: process.env.INTERNAL_AHA_API_TOKEN || process.env.WORKER_API_KEY,
      supportedRegions: this.options.regions!,
      supportedDataTypes: this.options.dataTypes!,
      maxConcurrentTasks: this.options.maxConcurrentTasks!,
      pollingInterval: this.options.pollingInterval!,
      preferGitVersion: true,
      versionCacheDir: path.join(process.cwd(), '.cache', 'versions'),
      githubToken: process.env.GITHUB_TOKEN,
    };

    this.worker = new WorkerClient(config);

    // 設置回調函數
    this.worker.setCallbacks({
      onTaskCompletion: async (task, result) => {
        console.log(`📊 任務完成統計:`);
        console.log(`   任務 ID: ${task.id}`);
        console.log(`   股票代碼: ${task.symbol_code}`);
        console.log(`   執行狀態: ${result.status}`);
        console.log(`   執行時間: ${result.execution_time_ms}ms`);
        
        if (result.records_fetched) {
          console.log(`   抓取記錄: ${result.records_fetched} 筆`);
        }
        
        if (result.output_file_path) {
          console.log(`   輸出檔案: ${result.output_file_path}`);
        }
        
        console.log('');
      },

      onError: async (error) => {
        console.error('⚠️  Worker 錯誤:', error);
        
        if (error.type === 'NETWORK_ERROR') {
          console.log('💡 網路錯誤，將重試連接...');
        } else if (error.type === 'TASK_EXECUTION_ERROR') {
          console.log('💡 任務執行錯誤，已記錄失敗原因');
        }
      },

      onVersionSwitch: async (oldVersion, newVersion) => {
        console.log(`🔄 版本切換: ${oldVersion} → ${newVersion}`);
      },

      onHeartbeat: async (stats) => {
        if (this.options.debug) {
          console.log(`💓 心跳 - 運行時間: ${Math.round(stats.worker.uptime)}s, 已完成: ${stats.tasks.completed}`);
        }
      },
    });

    console.log('⚙️  Worker 初始化完成');
  }

  /**
   * 設置信號處理
   */
  private setupSignalHandlers(): void {
    const gracefulShutdown = async (signal: string) => {
      console.log(`\n🛑 接收到 ${signal} 信號，正在優雅關閉 Worker...`);
      
      try {
        if (this.worker) {
          await this.worker.stop();
        }
        
        console.log('✅ Worker 已安全停止');
        process.exit(0);
      } catch (error) {
        console.error('❌ Worker 停止時發生錯誤:', error);
        process.exit(1);
      }
    };

    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  }

  /**
   * 生成 Worker ID
   */
  private generateWorkerId(): string {
    const hostname = require('os').hostname();
    const timestamp = Date.now();
    return `crawler-worker-${hostname}-${timestamp}`;
  }

  /**
   * 從環境變數讀取支援的區域
   */
  private getEnvRegions(): MarketRegion[] {
    const regions = process.env.SUPPORTED_REGIONS || 'TPE,US,JP';
    return regions.split(',').map(r => r.trim() as MarketRegion);
  }

  /**
   * 從環境變數讀取支援的數據類型
   */
  private getEnvDataTypes(): DataType[] {
    const dataTypes = process.env.SUPPORTED_DATA_TYPES || 'quarterly,daily,balance-sheet';
    return dataTypes.split(',').map(t => t.trim() as DataType);
  }
}

/**
 * 解析命令行參數
 */
function parseArgs(): StartWorkerOptions {
  const args = process.argv.slice(2);
  const options: StartWorkerOptions = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--regions':
        const regionStr = args[++i];
        options.regions = regionStr.split(',').map(r => r.trim() as MarketRegion);
        break;
        
      case '--data-types':
        const dataTypeStr = args[++i];
        options.dataTypes = dataTypeStr.split(',').map(t => t.trim() as DataType);
        break;
        
      case '--test-mode':
        options.testMode = true;
        break;
        
      case '--debug':
        options.debug = true;
        break;
        
      case '--max-concurrent':
        options.maxConcurrentTasks = parseInt(args[++i]);
        break;
        
      case '--polling-interval':
        options.pollingInterval = parseInt(args[++i]);
        break;
        
      case '--worker-id':
        options.workerId = args[++i];
        break;
        
      case '--worker-name':
        options.workerName = args[++i];
        break;
        
      case '--help':
      case '-h':
        showHelp();
        process.exit(0);
        break;
    }
  }

  return options;
}

/**
 * 顯示幫助資訊
 */
function showHelp(): void {
  console.log(`
🤖 Universal Crawler Worker

用法:
  npm run worker:start [選項]

選項:
  --regions <regions>         支援的市場區域，逗號分隔 (TPE,US,JP)
  --data-types <types>        支援的數據類型，逗號分隔 (quarterly,daily,balance-sheet)
  --test-mode                 測試模式，不實際執行任務
  --debug                     調試模式，顯示詳細日誌
  --max-concurrent <num>      最大並發任務數 [預設: 3]
  --polling-interval <ms>     任務輪詢間隔毫秒 [預設: 10000]
  --worker-id <id>           Worker 識別碼
  --worker-name <name>        Worker 名稱
  --help, -h                  顯示此幫助資訊

範例:
  # 啟動全功能 Worker
  npm run worker:start
  
  # 啟動台灣市場專用 Worker
  npm run worker:start -- --regions TPE --data-types quarterly
  
  # 測試模式
  npm run worker:start -- --test-mode --debug

環境變數:
  FINANCE_STRATEGY_API_URL    後端 API 地址 [預設: http://localhost:3000]
  WORKER_API_KEY              Worker API 密鑰 (如需要)
  GITHUB_TOKEN                GitHub Token (用於版本管理)
`);
}

/**
 * 主函數
 */
async function main(): Promise<void> {
  try {
    const options = parseArgs();
    const starter = new WorkerStarter(options);
    await starter.start();
  } catch (error) {
    console.error('❌ 程式執行失敗:', error);
    process.exit(1);
  }
}

// 執行主函數
if (require.main === module) {
  main();
}

export { WorkerStarter, StartWorkerOptions };