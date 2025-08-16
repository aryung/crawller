#!/usr/bin/env node

import { program } from 'commander';
import { UniversalCrawler } from './index';
import { logger } from './utils';
import { formatTimestamp } from './utils/helpers';
import * as path from 'path';
import * as fs from 'fs-extra';
import { EnhancedCrawlerConfig, ExportOptions } from './types';
import { BatchCrawlerManager, BatchOptions } from './batch/BatchCrawlerManager';
import { ProgressTracker } from './batch/ProgressTracker';
import { MarketRegion } from './common/shared-types/interfaces/market-data.interface';

interface CLIOptions {
  config?: string;
  output?: string;
  format?: ExportOptions['format'];
  concurrent?: number;
  list?: boolean;
  verbose?: boolean;
  engine?: string;
  template?: string;
  name?: string;
  encoding?: string;
  keepCookies?: boolean;
  selectors?: string;
  batchSize?: number;
  startFrom?: number;
  generateReport?: boolean;  // New: explicitly enable markdown report generation (default: false)
  debugSelectors?: boolean;  // New: output all intermediate selector data (fiscalPeriodsArray, etc.)
  showIntermediate?: boolean; // New: show intermediate processing steps data
  includeArrays?: boolean;   // New: include raw array data in output
  
  // Batch command options
  category?: 'daily' | 'quarterly' | 'metadata';
  market?: MarketRegion;
  type?: string;
  delayMs?: number;
  retryAttempts?: number;
  resume?: string;
  retryFailed?: string;
  pause?: boolean;
  status?: boolean;
  stats?: boolean;
  errorReport?: boolean;
  performanceReport?: boolean;
  progressId?: string;
  limit?: number;
  
  // Site-based concurrency options
  useSiteConcurrency?: boolean;  // 是否使用 site-based concurrency
  siteConcurrencyStats?: boolean; // 顯示 site concurrency 統計
  globalConcurrency?: boolean;   // 強制使用傳統全域併發 (向後兼容)
  siteOverrides?: string;        // JSON 字串，覆蓋特定站點設定
}

async function main() {
  program
    .name('universal-crawler')
    .description('通用網頁爬蟲工具')
    .version('1.0.0');

  program
    .command('crawl [configs...]')
    .description('執行爬蟲任務')
    .option('-c, --config <path>', '配置檔案目錄或特定配置檔案路徑', 'config-categorized')
    .option('-o, --output <path>', '輸出目錄', 'output')
    .option('-f, --format <format>', '匯出格式 (json|csv|xlsx)', 'json')
    .option('--concurrent <number>', '同時處理的配置檔案數量（非引擎併發）', '1')
    .option('--batch-size <number>', '數據驅動配置的批次大小', '50')
    .option('--start-from <number>', '從第幾個配置開始執行', '0')
    .option('--report', '生成 MD 格式的爬蟲報告（預設只輸出 JSON）')
    .option('-v, --verbose', '詳細日誌')
    .option('--debug-selectors', '輸出所有選擇器的中間數據（fiscalPeriodsArray 等）')
    .option('--show-intermediate', '顯示中間處理步驟的資料')
    .option('--include-arrays', '在輸出中包含原始陣列數據')
    .action(async (configs: string[], options: CLIOptions) => {
      if (options.verbose) {
        process.env.LOG_LEVEL = 'debug';
      }
      
      // 設置 debug 環境變數供 transform 函數使用
      if (options.debugSelectors) {
        process.env.DEBUG_SELECTORS = 'true';
      }
      if (options.showIntermediate) {
        process.env.SHOW_INTERMEDIATE = 'true';
      }
      if (options.includeArrays) {
        process.env.INCLUDE_ARRAYS = 'true';
      }

      // Default behavior: skip markdown report generation unless explicitly requested
      // generateReport will be true only if --report flag is specified

      try {
        // Check if --config points to a specific file
        if (options.config && options.config.endsWith('.json')) {
          // Direct config file specified
          if (!fs.existsSync(options.config)) {
            console.error(`❌ 找不到配置檔案: ${options.config}`);
            process.exit(1);
          }
          await runDirectConfigFile(options.config, options);
          return;
        }

        if (!configs || configs.length === 0) {
          console.error('❌ 請指定配置檔案名稱');
          console.log('💡 範例: npm run crawl moneydj');
          console.log('💡 或使用完整路徑: npx tsx src/cli.ts crawl --config configs/active/test.json');
          console.log('💡 或使用: npm run crawler list 查看所有配置');
          process.exit(1);
        }

        await runCrawler(configs, options);
      } catch (error) {
        console.error('❌ 爬蟲失敗:', (error as Error).message);
        process.exit(1);
      }
    });

  program
    .command('list')
    .description('列出所有可用的配置檔案')
    .option('-c, --config <path>', '配置檔案目錄', 'configs')
    .action(async (options: CLIOptions) => {
      await listConfigs(options.config || 'configs');
    });

  program
    .command('create <name>')
    .description('建立新的配置檔案')
    .option('-c, --config <path>', '配置檔案目錄', 'configs')
    .option('-t, --template <template>', '使用模板 (news|ecommerce|social|table|api)')
    .action(async (name: string, options: CLIOptions) => {
      await createConfig(name, options);
    });

  program
    .command('validate <config>')
    .description('驗證配置檔案')
    .option('-c, --config <path>', '配置檔案目錄', 'configs')
    .action(async (configName: string, options: CLIOptions) => {
      await validateConfig(configName, options.config || 'configs');
    });

  program
    .command('crawl-batch')
    .description('批量爬取工具 - 支援斷點續傳、錯誤恢復、進度追蹤、Site-based Concurrency')
    .option('-c, --config <path>', '配置檔案目錄', 'config-categorized')
    .option('-o, --output <path>', '輸出目錄', 'output')
    .option('--category <type>', '指定類別 (daily|quarterly|metadata)')
    .option('--market <region>', '指定市場 (tw|us|jp)')
    .option('--type <datatype>', '指定數據類型 (eps|history|financials等)')
    .option('--concurrent <num>', '併發數量 (傳統模式，site-based 時被忽略)', '3')
    .option('--start-from <num>', '從第幾個開始執行', '0')
    .option('--limit <num>', '限制執行數量')
    .option('--delay <ms>', '請求間隔毫秒數 (傳統模式，site-based 時被忽略)', '5000')
    .option('--retry-attempts <num>', '最大重試次數', '3')
    .option('--resume <id>', '恢復指定進度ID的執行')
    .option('--retry-failed <id>', '只重試失敗的配置')
    .option('--pause', '暫停當前執行')
    .option('--status', '查看執行狀態')
    .option('--stats', '顯示統計資訊')
    .option('--error-report', '生成錯誤報告')
    .option('--performance-report', '生成性能報告')
    .option('--progress-id <id>', '指定進度ID')
    .option('-v, --verbose', '詳細日誌')
    
    // Site-based concurrency options
    .option('--site-concurrency', '啟用 Site-based Concurrency (預設啟用)', true)
    .option('--global-concurrency', '強制使用傳統全域併發控制')
    .option('--site-stats', '顯示 Site Concurrency 統計資訊')
    .option('--site-overrides <json>', '覆蓋特定站點設定 (JSON格式)')
    
    .action(async (options: CLIOptions) => {
      await runBatchCrawler(options);
    });

  program
    .command('curl2config <curl-command>')
    .description('將 curl 命令轉換為配置檔案')
    .option('-c, --config <path>', '配置檔案目錄', 'configs')
    .option('-n, --name <name>', '配置檔案名稱（自動生成如果未指定）')
    .option('-e, --encoding <encoding>', '指定編碼 (utf-8|big5|gb2312)')
    .option('--keep-cookies', '保留所有 cookies（預設會移除敏感 cookies）')
    .option('--selectors <selectors>', '自定義選擇器 JSON 字串')
    .action(async (curlCommand: string, options: CLIOptions) => {
      await curl2config(curlCommand, options);
    });

  program
    .command('doctor')
    .description('診斷系統環境和依賴')
    .action(async () => {
      await runDiagnostics();
    });

  // Check if we should handle legacy config name execution first
  const args = process.argv.slice(2);
  if (args.length > 0) {
    const firstArg = args[0];
    const knownCommands = ['crawl', 'list', 'create', 'validate', 'doctor', 'curl2config', '--help', '-h', '--version', '-V'];
    
    // Check if any flag options are present
    const hasOptions = args.some(arg => arg.startsWith('-'));
    
    // Check if --config option is present anywhere in args
    const hasConfigOption = args.includes('--config') || args.includes('-c');
    
    // Handle --config option for direct config file execution
    if (hasConfigOption && firstArg === '--config') {
      const configFilePath = args[1];
      if (!configFilePath) {
        console.error('❌ --config 選項需要指定配置檔案路徑');
        console.log('💡 範例: npx tsx src/cli.ts --config configs/active/test.json');
        process.exit(1);
      }
      
      try {
        // Parse additional options after config file path
        const remainingArgs = args.slice(2);
        const generateReport = remainingArgs.includes('--report');
        const verboseIndex = remainingArgs.findIndex(arg => arg === '-v' || arg === '--verbose');
        
        const options: CLIOptions = {
          config: configFilePath,
          output: 'output',
          format: 'json',
          concurrent: 1,
          verbose: verboseIndex >= 0,
          generateReport,
          debugSelectors: remainingArgs.includes('--debug-selectors'),
          showIntermediate: remainingArgs.includes('--show-intermediate'),
          includeArrays: remainingArgs.includes('--include-arrays')
        };
        
        if (options.verbose) {
          process.env.LOG_LEVEL = 'debug';
        }
        
        // 設置 debug 環境變數供 transform 函數使用
        if (options.debugSelectors) {
          process.env.DEBUG_SELECTORS = 'true';
        }
        if (options.showIntermediate) {
          process.env.SHOW_INTERMEDIATE = 'true';
        }
        if (options.includeArrays) {
          process.env.INCLUDE_ARRAYS = 'true';
        }
        
        await runDirectConfigFile(configFilePath, options);
        return;
      } catch (error) {
        console.error('❌ 執行配置檔案失敗:', (error as Error).message);
        process.exit(1);
      }
    }
    
    if (!knownCommands.includes(firstArg) && !hasOptions) {
      try {
        console.log('🔄 檢測到配置名稱，執行爬蟲任務...');
        
        // Parse CLI arguments for direct config execution
        const generateReport = args.includes('--report');
        const verboseIndex = args.findIndex(arg => arg === '-v' || arg === '--verbose');
        const concurrentIndex = args.findIndex(arg => arg === '--concurrent');
        const formatIndex = args.findIndex(arg => arg === '-f' || arg === '--format');
        const outputIndex = args.findIndex(arg => arg === '-o' || arg === '--output');
        const configIndex = args.findIndex(arg => arg === '-c' || arg === '--config');
        
        const options: CLIOptions = {
          config: configIndex >= 0 && args[configIndex + 1] ? args[configIndex + 1] : 'config',
          output: outputIndex >= 0 && args[outputIndex + 1] ? args[outputIndex + 1] : 'output',
          format: formatIndex >= 0 && args[formatIndex + 1] ? args[formatIndex + 1] as ExportOptions['format'] : 'json',
          concurrent: concurrentIndex >= 0 && args[concurrentIndex + 1] ? Number(args[concurrentIndex + 1]) : 3,
          verbose: verboseIndex >= 0,
          generateReport,
          debugSelectors: args.includes('--debug-selectors'),
          showIntermediate: args.includes('--show-intermediate'),
          includeArrays: args.includes('--include-arrays')
        };
        
        if (options.verbose) {
          process.env.LOG_LEVEL = 'debug';
        }
        
        // 設置 debug 環境變數供 transform 函數使用
        if (options.debugSelectors) {
          process.env.DEBUG_SELECTORS = 'true';
        }
        if (options.showIntermediate) {
          process.env.SHOW_INTERMEDIATE = 'true';
        }
        if (options.includeArrays) {
          process.env.INCLUDE_ARRAYS = 'true';
        }
        
        await runCrawler([firstArg], options);
        return;
      } catch (error) {
        console.error('❌ 執行配置失敗:', (error as Error).message);
        console.log('💡 可用命令: crawl, list, create, validate, doctor, curl2config');
        console.log('💡 或是配置名稱: moneydj, moneydj-links 等');
        process.exit(1);
      }
    }
  }

  // Handle standard commander.js commands
  await program.parseAsync();
}

let globalCrawler: UniversalCrawler | null = null;
let isShuttingDown = false;

/**
 * 直接執行指定的配置檔案
 */
async function runDirectConfigFile(configFilePath: string, options: CLIOptions) {
  // 從檔案路徑提取配置名稱和目錄
  const configDir = path.dirname(configFilePath);
  const configFileName = path.basename(configFilePath, '.json');
  
  console.log(`🎯 直接執行配置檔案: ${configFilePath}`);
  
  const crawler = new UniversalCrawler({
    configPath: configDir,
    outputDir: options.output || 'output'  // 統一輸出到 output 目錄
  });
  
  globalCrawler = crawler;
  setupShutdownHandlers(crawler);
  
  try {
    console.log('🚀 Universal Web Crawler v1.0.0');
    console.log('='.repeat(50));
    console.log(`📁 配置檔案: ${configFilePath}`);
    console.log(`📂 輸出目錄: ${options.output || 'output'}`);
    console.log(`⚡ 引擎: playwright`);
    console.log(`🔢 併發數: ${options.concurrent || '1'}`);
    console.log('='.repeat(50));
    
    const configs = [configFileName];
    console.log(`📊 將執行 ${configs.length} 個配置任務`);
    
    const totalTimeout = 10 * 60 * 1000;
    const startTime = Date.now();
    
    const concurrent = Number(options.concurrent) || 1;
    const results = await crawler.crawlMultiple(configs, concurrent);
    
    const endTime = Date.now();
    const duration = Math.round((endTime - startTime) / 1000);
    
    console.log('\n🎉 所有爬蟲任務已完成!');
    console.log(`⏱️  總執行時間: ${duration} 秒`);
    console.log(`📈 成功: ${results.filter(r => r.success).length}/${results.length}`);
    console.log(`📂 輸出目錄: ${options.output || 'output'}`);
    
    if (results.some(r => !r.success)) {
      console.log('\n❌ 部分任務失敗:');
      results.filter(r => !r.success).forEach(r => {
        console.log(`   • ${r.url || 'Unknown'}: ${r.error}`);
      });
    }

    // Export results if successful
    if (results.filter(r => r.success).length > 0) {
      const successful = results.filter(r => r.success);
      const timestamp = formatTimestamp();
      const filename = timestamp;
      
      const exportPath = await crawler.export(successful, {
        format: options.format || 'json',
        filename,
        configName: configFileName
      });

      console.log(`📄 結果已匯出: ${exportPath}`);

      if (options.generateReport) {
        const reportPath = await crawler.generateReport(results);
        console.log(`📊 MD 報告已生成: ${reportPath}`);
      } else {
        console.log(`📊 已跳過 MD 報告生成（預設行為，使用 --report 可啟用）`);
      }

      const screenshotResults = results.filter(r => r.screenshot);
      if (screenshotResults.length > 0) {
        const screenshotPaths = await crawler.saveScreenshots(screenshotResults);
        console.log(`📸 截圖已保存: ${screenshotPaths.length} 張`);
      }
    }
    
  } catch (error) {
    console.error('❌ 執行配置失敗:', (error as Error).message);
    process.exit(1);
  } finally {
    await crawler.cleanup();
  }
}

function setupShutdownHandlers(crawler: UniversalCrawler) {
  const handleShutdown = async (signal: string) => {
    if (isShuttingDown) {
      console.log('\n🚨 強制終止...');
      process.exit(1);
    }
    isShuttingDown = true;
    console.log(`\n📡 收到 ${signal} 信號，正在優雅關閉...`);
    console.log('💡 再次按 Ctrl+C 可強制終止');
    try {
      await crawler.cleanup();
      console.log('✅ 爬蟲已安全關閉');
      process.exit(0);
    } catch (error) {
      console.error('❌ 關閉過程中發生錯誤:', error);
      process.exit(1);
    }
  };
  
  process.on('SIGINT', () => handleShutdown('SIGINT'));
  process.on('SIGTERM', () => handleShutdown('SIGTERM'));
}

async function runCrawler(configNames: string[], options: CLIOptions) {
  const crawler = new UniversalCrawler({
    configPath: options.config,
    outputDir: options.output
  });

  globalCrawler = crawler;

  const handleShutdown = async (signal: string) => {
    if (isShuttingDown) {
      console.log('\n🚨 強制終止...');
      process.exit(1);
    }

    isShuttingDown = true;
    console.log(`\n📡 收到 ${signal} 信號，正在優雅關閉...`);
    console.log('💡 再次按 Ctrl+C 可強制終止');

    try {
      await crawler.cleanup();
      console.log('✅ 爬蟲已安全關閉');
      process.exit(0);
    } catch (error) {
      console.error('❌ 關閉過程中發生錯誤:', error);
      process.exit(1);
    }
  };

  process.on('SIGINT', () => handleShutdown('SIGINT'));
  process.on('SIGTERM', () => handleShutdown('SIGTERM'));

  try {
    console.log('🚀 Universal Web Crawler v1.0.0');
    console.log('='.repeat(50));
    console.log(`📁 配置目錄: ${options.config || 'configs'}`);
    console.log(`📂 輸出目錄: ${options.output || 'output'}`);
    console.log(`⚡ 引擎: ${options.engine || 'playwright'}`);
    console.log(`🔢 併發數: ${options.concurrent || '3'}`);
    console.log(`📋 配置列表: ${configNames.join(', ')}`);
    console.log('='.repeat(50));

    const availableConfigs = await crawler.listConfigs();
    const missingConfigs = configNames.filter(name => !availableConfigs.includes(name));

    if (missingConfigs.length > 0) {
      console.error(`❌ 找不到配置檔案: ${missingConfigs.join(', ')}`);
      console.log(`📋 可用配置: ${availableConfigs.join(', ')}`);
      console.log('💡 使用 "npm run crawler list" 查看所有配置');
      return;
    }

    // 處理數據驅動配置擴展
    const allConfigsToRun: (string | EnhancedCrawlerConfig)[] = [];
    for (const name of configNames) {
      try {
        const expandedConfigs = await crawler.configManager.expandDataDrivenConfigs(name, options.output || 'output');
        if (expandedConfigs.length === 1 && !expandedConfigs[0].dataDriven) {
          // 非數據驅動配置，使用原始名稱
          allConfigsToRun.push(name);
        } else {
          // 數據驅動配置，應用批次大小和起始位置限制
          const batchSize = Number(options.batchSize) || 50;
          const startFrom = Number(options.startFrom) || 0;
          const endAt = Math.min(startFrom + batchSize, expandedConfigs.length);
          
          console.log(`🔢 數據驅動配置擴展: ${expandedConfigs.length} 個配置`);
          console.log(`📊 批次處理: 第 ${startFrom + 1} - ${endAt} 個 (批次大小: ${batchSize})`);
          
          const batchConfigs = expandedConfigs.slice(startFrom, endAt);
          allConfigsToRun.push(...batchConfigs);
        }
      } catch (error) {
        logger.warn(`Failed to expand data-driven configs for ${name}:`, error);
        allConfigsToRun.push(name);
      }
    }


    const totalTimeout = 10 * 60 * 1000;
    const startTime = Date.now();

    console.log(`⏱️  總體超時: ${totalTimeout / 1000} 秒`);
    console.log('💡 按 Ctrl+C 可隨時中斷\n');

    let completedCount = 0;
    const totalCount = allConfigsToRun.length;

    console.log(`📊 將執行 ${totalCount} 個配置任務`);

    const progressInterval = setInterval(() => {
      if (!isShuttingDown) {
        const elapsed = Math.round((Date.now() - startTime) / 1000);
        process.stdout.write(`\r⏳ 進度: ${completedCount}/${totalCount} | 已執行: ${elapsed}s`);
      }
    }, 1000);

    const crawlPromise = crawler.crawlMultiple(
      allConfigsToRun,
      Number(options.concurrent) || 3,
      (completed, total) => {
        completedCount = completed;
      }
    ).then(results => {
      clearInterval(progressInterval);
      process.stdout.write('\r');
      return results;
    });

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`總體執行超時 (${totalTimeout / 1000} 秒)`));
      }, totalTimeout);
    });

    const results = await Promise.race([crawlPromise, timeoutPromise]);

    if (!Array.isArray(results)) {
      throw new Error('爬蟲執行返回的結果格式異常');
    }
    
    completedCount = results.length;
    const executionTime = Math.round((Date.now() - startTime) / 1000);
    const successful = results.filter(r => r && r.success);
    const failed = results.filter(r => r && !r.success);

    console.log(`\n✅ 執行完成！`);
    console.log(`📊 統計: 總計 ${results.length} 個, 成功 ${successful.length} 個, 失敗 ${failed.length} 個`);
    console.log(`⏱️  執行時間: ${executionTime} 秒`);

    if (failed.length > 0) {
      console.log('\n❌ 失敗的任務:');
      failed.forEach((result, index) => {
        console.log(`  ${index + 1}. ${result.url || '未知URL'}`);
        console.log(`     錯誤: ${result.error || '未知錯誤'}`);
      });
    }

    if (successful.length > 0) {
      const timestamp = formatTimestamp();
      const filename = timestamp;
      
      const configName = configNames.length === 1 
        ? configNames[0] 
        : configNames.length > 1 
          ? `multiple-${configNames.slice(0, 2).join('-')}` 
          : undefined;

      const exportPath = await crawler.export(successful, {
        format: options.format || 'json',
        filename,
        configName
      });

      console.log(`📄 結果已匯出: ${exportPath}`);

      if (options.generateReport) {
        const reportPath = await crawler.generateReport(results);
        console.log(`📊 MD 報告已生成: ${reportPath}`);
      } else {
        console.log(`📊 已跳過 MD 報告生成（預設行為，使用 --report 可啟用）`);
      }

      const screenshotResults = results.filter(r => r.screenshot);
      if (screenshotResults.length > 0) {
        const screenshotPaths = await crawler.saveScreenshots(screenshotResults);
        console.log(`📸 截圖已保存: ${screenshotPaths.length} 張`);
      }
    }

  } catch (error) {
    if (isShuttingDown) {
      console.log('\n🛑 爬蟲已中斷');
      return;
    }

    console.error('\n❌ 爬蟲執行失敗:', (error as Error).message);

    if ((error as Error).message.includes('總體執行超時')) {
      console.log('💡 建議: 增加超時時間或減少併發數量');
    }
  } finally {
    globalCrawler = null;
    if (!isShuttingDown) {
      try {
        await crawler.cleanup();
        console.log('✅ 爬蟲已完成，正在關閉...');
        setTimeout(() => process.exit(0), 1000);
      } catch (cleanupError) {
        console.warn('⚠️  清理過程中發生錯誤:', cleanupError);
        setTimeout(() => process.exit(1), 1000);
      }
    }
  }
}

async function listConfigs(configPath: string) {
  try {
    const configDir = path.resolve(configPath);

    if (!await fs.pathExists(configDir)) {
      console.log(`📁 配置目錄不存在: ${configDir}`);
      console.log('💡 使用 "npm run crawl create <name>" 建立新配置');
      return;
    }

    // 遞歸搜索所有 JSON 配置文件（包括子目錄）
    const configFiles: string[] = [];
    const searchDirectory = async (dir: string, basePath: string = '') => {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relativePath = basePath ? path.join(basePath, entry.name) : entry.name;
        
        if (entry.isDirectory()) {
          // 遞歸搜索子目錄
          await searchDirectory(fullPath, relativePath);
        } else if (entry.isFile() && entry.name.endsWith('.json')) {
          // 添加配置文件
          const configFile = basePath 
            ? path.join(basePath, entry.name)
            : entry.name;
          configFiles.push(configFile.replace(/[\\]/g, '/')); // 統一使用 / 分隔符
        }
      }
    };
    
    await searchDirectory(configDir);

    if (configFiles.length === 0) {
      console.log('📂 沒有找到配置檔案');
      console.log('💡 使用 "npm run crawl create <name>" 建立新配置');
      return;
    }

    console.log(`📋 可用的配置檔案 (${configFiles.length} 個):`);
    console.log('');

    for (const file of configFiles) {
      const configName = path.basename(file, '.json');
      const configFilePath = path.join(configDir, file);

      try {
        const config = await fs.readJson(configFilePath) as EnhancedCrawlerConfig;
        const url = config.url || '未設定 URL';
        const selectorsCount = config.selectors ? Object.keys(config.selectors).length : 0;

        console.log(`  📄 ${configName}`);
        console.log(`     🌐 URL: ${url}`);
        console.log(`     🎯 選擇器: ${selectorsCount} 個`);
        console.log('');
      } catch (error) {
        console.log(`  ❌ ${configName} (配置檔案格式錯誤)`);
        console.log('');
      }
    }

    console.log('💡 使用方式: npm run crawl <配置名稱>');
    console.log('💡 範例: npm run crawl moneydj');
  } catch (error) {
    console.error('❌ 列出配置失敗:', (error as Error).message);
    process.exit(1);
  }
}

async function createConfig(name: string, options: CLIOptions) {
  try {
    const configDir = path.resolve(options.config || 'configs');
    const configFile = path.join(configDir, `${name}.json`);

    if (await fs.pathExists(configFile)) {
      console.error(`❌ 配置檔案已存在: ${name}.json`);
      return;
    }

    await fs.ensureDir(configDir);

    let template: EnhancedCrawlerConfig = {
      url: 'https://example.com',
      selectors: {
        title: 'h1',
        content: '.content'
      },
      options: {
        waitFor: 2000,
        timeout: 30000,
        retries: 3,
        headless: true
      },
      export: {
        formats: ['json'],
        filename: name
      }
    };

    if (options.template) {
      const { getPresetConfig } = await import('./config/defaultConfigs');
      try {
        template = getPresetConfig(options.template as 'news' | 'ecommerce' | 'social' | 'table' | 'api');
      } catch (error) {
        console.warn(`⚠️  未知模板: ${options.template}，使用預設模板`);
      }
    }

    await fs.writeJson(configFile, template, { spaces: 2 });

    console.log(`✅ 配置檔案已建立: ${name}.json`);
    console.log(`📁 位置: ${configFile}`);
    console.log('');
    console.log('💡 下一步:');
    console.log(`   1. 編輯 ${configFile} 設定目標網站和選擇器`);
    console.log(`   2. 執行 npm run crawl ${name} 開始爬蟲`);

  } catch (error) {
    console.error('❌ 建立配置失敗:', (error as Error).message);
    process.exit(1);
  }
}

async function validateConfig(configName: string, configPath: string) {
  try {
    const crawler = new UniversalCrawler({ configPath });
    const config = await crawler.loadConfig(configName);

    console.log(`✅ 配置檔案 "${configName}" 驗證通過`);
    console.log(`🌐 URL: ${config.url}`);
    console.log(`🎯 選擇器: ${config.selectors ? Object.keys(config.selectors).length : 0} 個`);
    console.log(`🍪 Cookie: ${config.cookies?.enabled ? '啟用' : '停用'}`);
    console.log(`⚙️  選項: ${config.options ? Object.keys(config.options).length : 0} 個設定`);

  } catch (error) {
    console.error(`❌ 配置檔案 "${configName}" 驗證失敗:`, (error as Error).message);
    process.exit(1);
  }
}

async function runDiagnostics() {
  console.log('🏥 Universal Web Crawler - 系統診斷');
  console.log('='.repeat(50));

  console.log('\n📋 系統資訊:');
  console.log(`   作業系統: ${process.platform} ${process.arch}`);
  console.log(`   Node.js: ${process.version}`);
  console.log(`   記憶體: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB / ${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)}MB`);

  console.log('\n📦 依賴檢查:');
  const dependencies = ['playwright', 'axios', 'cheerio', 'winston', 'fs-extra'];
  for (const dep of dependencies) {
    try {
      await import(dep);
      console.log(`   ✅ ${dep}: installed`);
    } catch (error) {
      console.log(`   ❌ ${dep}: Not installed`);
    }
  }

  console.log('\n🔍 系統瀏覽器檢測:');
  try {
    const { BrowserDetector } = await import('./utils');
    const report = await BrowserDetector.generateDiagnosticReport();
    console.log(report);
  } catch (error) {
    console.log(`   ❌ 瀏覽器檢測失敗: ${(error as Error).message}`);
  }

  console.log('\n🌐 瀏覽器引擎測試:');
  try {
    const playwright = await import('playwright');
    console.log('   🔄 測試 Playwright 瀏覽器啟動...');
    const browser = await playwright.chromium.launch({ headless: true });
    await browser.close();
    console.log('   ✅ Playwright: 可以啟動瀏覽器');
  } catch (error) {
    console.log(`   ❌ Playwright: 無法啟動瀏覽器 - ${(error as Error).message}`);
  }

  console.log('\n🌍 網路連線測試:');
  try {
    const axios = (await import('axios')).default;
    const response = await axios.get('https://httpbin.org/get', { timeout: 5000 });
    console.log(`   ✅ HTTP 請求: 正常 (${response.status})`);
  } catch (error) {
    console.log(`   ❌ HTTP 請求: 失敗 - ${(error as Error).message}`);
  }

  console.log('\n💡 建議:');
  console.log('   • 如果瀏覽器無法啟動，嘗試使用 --engine http 參數');
  console.log('\n✅ 診斷完成');
}

async function curl2config(curlCommand: string, options: CLIOptions) {
  try {
    const { CurlParser } = await import('./utils');
    
    console.log('🔄 解析 curl 命令...');
    const parsedCurl = CurlParser.parseCurlCommand(curlCommand);
    if (!parsedCurl) {
      console.error('❌ 無法解析 curl 命令');
      process.exit(1);
    }

    console.log(`✅ 成功解析 URL: ${parsedCurl.url}`);
    
    let selectors: Record<string, string> = {};
    if (options.selectors) {
      try {
        selectors = JSON.parse(options.selectors);
      } catch {
        console.error('❌ 選擇器 JSON 格式錯誤');
        process.exit(1);
      }
    } else {
      selectors = CurlParser.createExampleSelectors(parsedCurl.url);
    }

    const config = CurlParser.curlToConfig(parsedCurl, selectors, {
      encoding: options.encoding,
      removeSensitiveCookies: !options.keepCookies
    });

    const configName = options.name || CurlParser.generateConfigName(parsedCurl.url);
    const configDir = path.resolve(options.config || 'configs');
    const configFile = path.join(configDir, `${configName}.json`);

    if (await fs.pathExists(configFile)) {
      console.error(`❌ 配置檔案已存在: ${configName}.json`);
      process.exit(1);
    }

    await fs.ensureDir(configDir);
    await fs.writeJson(configFile, config, { spaces: 2 });

    console.log(`\n✅ 配置檔案已建立: ${configName}.json`);
    console.log(`📁 位置: ${configFile}`);
    
  } catch (error) {
    console.error('❌ 轉換失敗:', (error as Error).message);
    process.exit(1);
  }
}

/**
 * 批量爬取命令處理器
 */
async function runBatchCrawler(options: CLIOptions): Promise<void> {
  try {
    // 設置日誌級別
    if (options.verbose) {
      process.env.LOG_LEVEL = 'debug';
    }

    // 創建批量管理器 - 支援分類配置目錄和 Site-based Concurrency
    const defaultConfigPath = options.config || 'config-categorized';
    
    // 決定使用 site-based 還是 global concurrency
    const useSiteConcurrency = !options.globalConcurrency && options.siteConcurrency !== false;
    
    const batchManager = new BatchCrawlerManager({
      configPath: defaultConfigPath,
      outputDir: options.output || 'output',
      maxConcurrency: parseInt(options.concurrent?.toString() || '3'),
      delayMs: parseInt(options.delayMs?.toString() || '5000'),
      useSiteConcurrency: useSiteConcurrency
    });

    // 處理特殊命令
    if (options.status) {
      await showBatchStatus(options);
      return;
    }

    if (options.stats) {
      await showBatchStats(options);
      return;
    }

    if (options.errorReport) {
      await generateErrorReport(options);
      return;
    }

    if (options.performanceReport) {
      await generatePerformanceReport(options);
      return;
    }

    // 顯示 Site Concurrency 統計
    if (options.siteStats) {
      console.log('🌐 Site Concurrency 統計資訊');
      console.log('='.repeat(50));
      const stats = batchManager.getSiteConcurrencyStatistics();
      console.log(JSON.stringify(stats, null, 2));
      return;
    }

    // 恢復執行
    if (options.resume) {
      console.log(`🔄 恢復批量執行: ${options.resume}`);
      
      // 解析 site overrides (如果提供)
      let siteConcurrencyOverrides;
      if (options.siteOverrides) {
        try {
          siteConcurrencyOverrides = JSON.parse(options.siteOverrides);
        } catch (error) {
          console.error('❌ Site overrides JSON 格式錯誤:', error);
          process.exit(1);
        }
      }
      
      const result = await batchManager.resumeBatch(options.resume, {
        concurrent: parseInt(options.concurrent?.toString() || '3'),
        delayMs: parseInt(options.delayMs?.toString() || '5000'),
        outputDir: options.output || 'output',
        useSiteConcurrency: useSiteConcurrency,
        siteConcurrencyOverrides: siteConcurrencyOverrides
      });
      displayBatchResult(result);
      return;
    }

    // 重試失敗
    if (options.retryFailed) {
      console.log(`🔄 重試失敗配置: ${options.retryFailed}`);
      
      // 解析 site overrides (如果提供)
      let siteConcurrencyOverrides;
      if (options.siteOverrides) {
        try {
          siteConcurrencyOverrides = JSON.parse(options.siteOverrides);
        } catch (error) {
          console.error('❌ Site overrides JSON 格式錯誤:', error);
          process.exit(1);
        }
      }
      
      const result = await batchManager.retryFailed(options.retryFailed, {
        concurrent: parseInt(options.concurrent?.toString() || '3'),
        delayMs: parseInt(options.delayMs?.toString() || '5000'),
        outputDir: options.output || 'output',
        useSiteConcurrency: useSiteConcurrency,
        siteConcurrencyOverrides: siteConcurrencyOverrides
      });
      displayBatchResult(result);
      return;
    }

    // 標準批量執行
    console.log('🚀 Universal Web Crawler - 批量模式');
    console.log('='.repeat(50));

    // 解析 site overrides (如果提供)
    let siteConcurrencyOverrides;
    if (options.siteOverrides) {
      try {
        siteConcurrencyOverrides = JSON.parse(options.siteOverrides);
      } catch (error) {
        console.error('❌ Site overrides JSON 格式錯誤:', error);
        process.exit(1);
      }
    }

    const batchOptions: BatchOptions = {
      category: options.category,
      market: options.market,
      type: options.type,
      concurrent: parseInt(options.concurrent?.toString() || '3'),
      startFrom: parseInt(options.startFrom?.toString() || '0'),
      limit: options.limit ? parseInt(options.limit.toString()) : undefined,
      delayMs: parseInt(options.delayMs?.toString() || '5000'),
      retryAttempts: parseInt(options.retryAttempts?.toString() || '3'),
      outputDir: options.output || 'output',
      configPath: defaultConfigPath,
      progressDir: '.progress',
      // Site-based concurrency 選項
      useSiteConcurrency: useSiteConcurrency,
      siteConcurrencyOverrides: siteConcurrencyOverrides
    };

    console.log(`📁 配置目錄: ${batchOptions.configPath}`);
    console.log(`📂 輸出目錄: ${batchOptions.outputDir}`);
    
    // 顯示併發控制模式
    if (useSiteConcurrency) {
      console.log(`🌐 併發控制: Site-based Concurrency (自動根據網站調整)`);
      if (siteConcurrencyOverrides) {
        console.log(`⚙️ 站點覆蓋設定: ${JSON.stringify(siteConcurrencyOverrides)}`);
      }
    } else {
      console.log(`🔢 併發控制: 傳統全域模式 (併發: ${batchOptions.concurrent}, 延遲: ${batchOptions.delayMs}ms)`);
    }
    
    if (batchOptions.category) console.log(`📋 類別: ${batchOptions.category}`);
    if (batchOptions.market) console.log(`🌍 市場: ${batchOptions.market}`);
    if (batchOptions.type) console.log(`📊 類型: ${batchOptions.type}`);
    console.log('='.repeat(50));

    const result = await batchManager.startBatch(batchOptions);
    displayBatchResult(result);

  } catch (error) {
    console.error('❌ 批量爬取失敗:', (error as Error).message);
    if (options.verbose) {
      console.error(error);
    }
    process.exit(1);
  }
}

/**
 * 顯示批量狀態
 */
async function showBatchStatus(options: CLIOptions): Promise<void> {
  try {
    const progressFiles = await ProgressTracker.listProgressFiles(options.progressId ? '.' : '.progress');
    
    if (progressFiles.length === 0) {
      console.log('📊 沒有找到進行中的批量任務');
      return;
    }

    console.log('📊 批量任務狀態');
    console.log('='.repeat(50));

    for (const file of progressFiles) {
      try {
        const tracker = await ProgressTracker.load(file);
        const progress = tracker.getProgress();
        
        console.log(`\n📋 進度ID: ${progress.id}`);
        if (progress.category) console.log(`   類別: ${progress.category}`);
        if (progress.market) console.log(`   市場: ${progress.market}`);
        if (progress.type) console.log(`   類型: ${progress.type}`);
        console.log(`   進度: ${progress.percentage.toFixed(1)}% (${progress.completed + progress.failed + progress.skipped}/${progress.total})`);
        console.log(`   狀態: 完成 ${progress.completed}, 失敗 ${progress.failed}, 跳過 ${progress.skipped}, 執行中 ${progress.running}, 待處理 ${progress.pending}`);
        
        if (progress.currentItem) {
          console.log(`   當前: ${progress.currentItem}`);
        }

        const duration = Date.now() - progress.startTime;
        console.log(`   耗時: ${Math.round(duration / 1000)}s`);
        
        if (progress.estimatedTimeRemaining > 0) {
          console.log(`   預估剩餘: ${Math.round(progress.estimatedTimeRemaining / 1000)}s`);
        }
      } catch (error) {
        console.log(`   ❌ 無法讀取進度檔案: ${file}`);
      }
    }
  } catch (error) {
    console.error('❌ 獲取狀態失敗:', (error as Error).message);
  }
}

/**
 * 顯示批量統計
 */
async function showBatchStats(options: CLIOptions): Promise<void> {
  console.log('📊 批量爬取統計功能開發中...');
}

/**
 * 生成錯誤報告
 */
async function generateErrorReport(options: CLIOptions): Promise<void> {
  console.log('📋 錯誤報告生成功能開發中...');
}

/**
 * 生成性能報告
 */
async function generatePerformanceReport(options: CLIOptions): Promise<void> {
  console.log('📈 性能報告生成功能開發中...');
}

/**
 * 顯示批量執行結果
 */
function displayBatchResult(result: any): void {
  console.log('\n🎉 批量爬取完成!');
  console.log('='.repeat(60));
  
  // 執行統計
  console.log(`📊 執行統計:`);
  console.log(`   總數: ${result.total}`);
  console.log(`   ✅ 成功: ${result.completed} (${((result.completed / result.total) * 100).toFixed(1)}%)`);
  console.log(`   ❌ 失敗: ${result.failed} (${((result.failed / result.total) * 100).toFixed(1)}%)`);
  console.log(`   ⏭️  跳過: ${result.skipped} (${((result.skipped / result.total) * 100).toFixed(1)}%)`);
  console.log(`   ⏱️  耗時: ${Math.round(result.duration / 1000)} 秒`);
  
  // 輸出檔案信息
  if (result.outputFiles && result.outputFiles.length > 0) {
    console.log(`\n📂 輸出檔案: ${result.outputFiles.length} 個`);
    console.log(`   📁 保存位置: output/`);
    
    // 按目錄結構分組顯示檔案
    const filesByCategory = result.outputFiles.reduce((acc: any, file: string) => {
      const relativePath = path.relative('output', file);
      const pathParts = relativePath.split(path.sep);
      
      if (pathParts.length >= 2) {
        const category = pathParts[0]; // daily, quarterly, metadata
        const subcategory = pathParts[1]; // market 或 type
        const key = `${category}/${subcategory}`;
        
        if (!acc[key]) acc[key] = [];
        acc[key].push(path.basename(file));
      } else {
        // 根目錄下的檔案
        if (!acc['root']) acc['root'] = [];
        acc['root'].push(path.basename(file));
      }
      return acc;
    }, {});
    
    // 顯示分類結構
    Object.entries(filesByCategory).slice(0, 8).forEach(([category, files]: [string, any]) => {
      if (category === 'root') {
        console.log(`   📄 根目錄: ${files.length} 個檔案`);
      } else {
        console.log(`   📁 ${category}: ${files.length} 個檔案`);
      }
    });
    
    if (Object.keys(filesByCategory).length > 8) {
      console.log(`   📁 ... 還有 ${Object.keys(filesByCategory).length - 8} 個分類`);
    }
    
    console.log(`\n📋 目錄結構範例:`);
    console.log(`   output/`);
    if (filesByCategory['daily/tw']) console.log(`   ├── daily/tw/ (${filesByCategory['daily/tw'].length} 個檔案)`);
    if (filesByCategory['quarterly/tw']) console.log(`   ├── quarterly/tw/ (${filesByCategory['quarterly/tw'].length} 個檔案)`);
    if (filesByCategory['quarterly/us']) console.log(`   ├── quarterly/us/ (${filesByCategory['quarterly/us'].length} 個檔案)`);
    if (filesByCategory['quarterly/jp']) console.log(`   ├── quarterly/jp/ (${filesByCategory['quarterly/jp'].length} 個檔案)`);
    if (filesByCategory['metadata/symbols']) console.log(`   └── metadata/symbols/ (${filesByCategory['metadata/symbols'].length} 個檔案)`);
  } else {
    console.log(`\n📂 無輸出檔案生成`);
  }

  // 錯誤摘要
  if (result.errors && result.errors.length > 0) {
    console.log(`\n❌ 錯誤摘要 (前5個):`);
    result.errors.slice(0, 5).forEach((error: string, index: number) => {
      console.log(`   ${index + 1}. ${error.length > 80 ? error.substring(0, 80) + '...' : error}`);
    });
    if (result.errors.length > 5) {
      console.log(`   ... 還有 ${result.errors.length - 5} 個錯誤`);
    }
  }

  // 最終狀態
  console.log('\n' + '='.repeat(60));
  if (result.success) {
    console.log('🎊 所有任務執行成功！');
  } else {
    console.log('⚠️  部分任務執行失敗，請檢查錯誤報告');
    console.log('💡 使用以下命令重試失敗的配置:');
    console.log(`   npm run crawl-batch --retry-failed=${result.progressId}`);
  }
  
  // 下一步建議
  console.log('\n💡 下一步操作:');
  console.log('   📊 查看狀態: npm run crawl:status');
  console.log('   📋 查看統計: npm run crawl:stats');
  console.log('   📁 檢查輸出: ls -la output/');
  
  console.log('\n✅ 任務完成，系統正在關閉...');
  
  // 優雅退出
  setTimeout(() => {
    console.log('👋 再見！');
    process.exit(0);
  }, 2000);
}

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

if (require.main === module) {
  main().catch(error => {
    console.error('❌ CLI 執行錯誤:', error.message);
    process.exit(1);
  });
}
