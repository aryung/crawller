#!/usr/bin/env node

import { program } from 'commander';
import { UniversalCrawler } from './index';
import { logger } from './utils';
import * as path from 'path';
import * as fs from 'fs-extra';

interface CLIOptions {
  config?: string;
  output?: string;
  format?: string;
  concurrent?: number;
  engine?: 'puppeteer' | 'playwright';
  list?: boolean;
  verbose?: boolean;
}

async function main() {
  program
    .name('universal-crawler')
    .description('通用網頁爬蟲工具')
    .version('1.0.0');

  program
    .command('crawl [configs...]')
    .description('執行爬蟲任務')
    .option('-c, --config <path>', '配置檔案目錄', 'configs')
    .option('-o, --output <path>', '輸出目錄', 'output')
    .option('-f, --format <format>', '匯出格式 (json|csv|xlsx)', 'json')
    .option('--concurrent <number>', '併發數量', '3')
    .option('--engine <engine>', '爬蟲引擎 (puppeteer|playwright)', 'puppeteer')
    .option('-v, --verbose', '詳細日誌')
    .action(async (configs: string[], options: CLIOptions) => {
      if (options.verbose) {
        process.env.LOG_LEVEL = 'debug';
      }

      try {
        if (!configs || configs.length === 0) {
          console.error('❌ 請指定配置檔案名稱');
          console.log('💡 範例: npm run crawl moneydj');
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
    .action(async (name: string, options: CLIOptions & { template?: string }) => {
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
    .command('doctor')
    .description('診斷系統環境和依賴')
    .action(async () => {
      await runDiagnostics();
    });

  await program.parseAsync();
}

// 全域變數用於優雅關閉
let globalCrawler: UniversalCrawler | null = null;
let isShuttingDown = false;

async function runCrawler(configNames: string[], options: CLIOptions) {
  const crawler = new UniversalCrawler({
    usePlaywright: options.engine === 'playwright',
    usePuppeteerCore: options.engine !== 'playwright', // 預設使用 puppeteer-core
    configPath: options.config,
    outputDir: options.output
  });

  globalCrawler = crawler;

  // 設定信號處理器
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
    console.log(`⚡ 引擎: ${options.engine || 'puppeteer'}`);
    console.log(`🔢 併發數: ${options.concurrent || '3'}`);
    console.log(`📋 配置列表: ${configNames.join(', ')}`);
    console.log('='.repeat(50));

    // 驗證配置檔案是否存在
    const availableConfigs = await crawler.listConfigs();
    const missingConfigs = configNames.filter(name => !availableConfigs.includes(name));

    if (missingConfigs.length > 0) {
      console.error(`❌ 找不到配置檔案: ${missingConfigs.join(', ')}`);
      console.log(`📋 可用配置: ${availableConfigs.join(', ')}`);
      console.log('💡 使用 "npm run crawler list" 查看所有配置');
      return;
    }

    // 設定總體超時（預設 10 分鐘）
    const totalTimeout = 10 * 60 * 1000; // 10 分鐘
    const startTime = Date.now();

    console.log(`⏱️  總體超時: ${totalTimeout / 1000} 秒`);
    console.log('💡 按 Ctrl+C 可隨時中斷\n');

    // 進度追蹤
    let completedCount = 0;
    const totalCount = configNames.length;

    // 簡單的進度顯示
    const progressInterval = setInterval(() => {
      if (!isShuttingDown) {
        const elapsed = Math.round((Date.now() - startTime) / 1000);
        process.stdout.write(`\r⏳ 進度: ${completedCount}/${totalCount} | 已執行: ${elapsed}s`);
      }
    }, 1000);

    const crawlPromise = crawler.crawlMultiple(
      configNames,
      options.concurrent || 3,
    ).then(results => {
      clearInterval(progressInterval);
      process.stdout.write('\r'); // 清除進度行
      return results;
    });

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`總體執行超時 (${totalTimeout / 1000} 秒)`));
      }, totalTimeout);
    });

    const results = await Promise.race([crawlPromise, timeoutPromise]);
    const executionTime = Math.round((Date.now() - startTime) / 1000);

    // 確保 results 是陣列
    if (!Array.isArray(results)) {
      throw new Error('爬蟲執行返回的結果格式異常');
    }

    // 統計結果
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

    // 匯出結果
    if (successful.length > 0) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `crawl_results_${timestamp}`;

      const exportPath = await crawler.export(successful, {
        format: (options.format as any) || 'json',
        filename
      });

      console.log(`📄 結果已匯出: ${exportPath}`);

      // 生成報告
      const reportPath = await crawler.generateReport(results);
      console.log(`📊 報告已生成: ${reportPath}`);

      // 保存截圖
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
        // 確保程式正確退出
        setTimeout(() => {
          process.exit(0);
        }, 1000);
      } catch (cleanupError) {
        console.warn('⚠️  清理過程中發生錯誤:', cleanupError);
        setTimeout(() => {
          process.exit(1);
        }, 1000);
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

    const files = await fs.readdir(configDir);
    const configFiles = files.filter(file => file.endsWith('.json'));

    if (configFiles.length === 0) {
      console.log('📂 沒有找到配置檔案');
      console.log('💡 使用 "npm run crawl create <name>" 建立新配置');
      return;
    }

    console.log(`📋 可用的配置檔案 (${configFiles.length} 個):`);
    console.log('');

    for (const file of configFiles) {
      const configName = path.basename(file, '.json');
      const configPath = path.join(configDir, file);

      try {
        const config = await fs.readJson(configPath);
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

async function createConfig(name: string, options: CLIOptions & { template?: string }) {
  try {
    const configDir = path.resolve(options.config || 'configs');
    const configFile = path.join(configDir, `${name}.json`);

    if (await fs.pathExists(configFile)) {
      console.error(`❌ 配置檔案已存在: ${name}.json`);
      return;
    }

    await fs.ensureDir(configDir);

    let template: any = {
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
      }
    };

    // 使用預設模板
    if (options.template) {
      const { getPresetConfig } = await import('./config/defaultConfigs');
      try {
        template = getPresetConfig(options.template as any);
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

  // 1. 系統資訊
  console.log('\n📋 系統資訊:');
  console.log(`   作業系統: ${process.platform} ${process.arch}`);
  console.log(`   Node.js: ${process.version}`);
  console.log(`   記憶體: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB / ${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)}MB`);

  // 2. 依賴檢查
  console.log('\n📦 依賴檢查:');

  // 檢查 Puppeteer
  try {
    await import('puppeteer');
    console.log(`   ✅ Puppeteer: installed`);
  } catch (error) {
    console.log(`   ⚠️  Puppeteer: Not installed (using puppeteer-core instead)`);
  }

  // 檢查 Puppeteer-Core
  try {
    await import('puppeteer-core');
    console.log(`   ✅ Puppeteer-Core: installed`);
  } catch (error) {
    console.log(`   ❌ Puppeteer-Core: Not installed`);
  }

  // 檢查 Playwright
  try {
    await import('playwright');
    console.log(`   ✅ Playwright: installed`);
  } catch (error) {
    console.log(`   ⚠️  Playwright: Not installed (optional)`);
  }

  // 檢查其他依賴
  const dependencies = ['axios', 'cheerio', 'winston', 'fs-extra'];
  for (const dep of dependencies) {
    try {
      await import(dep);
      console.log(`   ✅ ${dep}: installed`);
    } catch (error) {
      console.log(`   ❌ ${dep}: Not installed`);
    }
  }

  // 3. 瀏覽器檢測
  console.log('\n🔍 系統瀏覽器檢測:');
  
  try {
    const { BrowserDetector } = await import('./utils');
    const report = await BrowserDetector.generateDiagnosticReport();
    console.log(report);
  } catch (error) {
    console.log(`   ❌ 瀏覽器檢測失敗: ${(error as Error).message}`);
  }

  // 4. 瀏覽器引擎測試
  console.log('\n🌐 瀏覽器引擎測試:');

  // 測試 Puppeteer-Core
  try {
    const puppeteerCore = await import('puppeteer-core');
    const { BrowserDetector } = await import('./utils');
    
    console.log('   🔄 測試 Puppeteer-Core 瀏覽器啟動...');
    
    const browserPath = await BrowserDetector.getBestBrowserPath();
    if (!browserPath) {
      console.log('   ❌ Puppeteer-Core: 未找到可用瀏覽器');
    } else {
      const browser = await Promise.race([
        puppeteerCore.default.launch({
          executablePath: browserPath,
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox'],
          timeout: 8000  // 8秒超時
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('啟動超時')), 8000)
        )
      ]);

      await (browser as any).close();
      console.log('   ✅ Puppeteer-Core: 可以啟動瀏覽器');
    }
  } catch (error) {
    const errorMsg = (error as Error).message;
    console.log(`   ❌ Puppeteer-Core: 無法啟動瀏覽器 - ${errorMsg}`);
  }

  // 測試 Playwright
  try {
    const { chromium } = await import('playwright');
    console.log('   🔄 測試 Playwright 瀏覽器啟動...');

    const browser = await Promise.race([
      chromium.launch({
        headless: true,
        timeout: 8000
      }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('啟動超時')), 8000)
      )
    ]);

    await (browser as any).close();
    console.log('   ✅ Playwright: 可以啟動瀏覽器');
  } catch (error) {
    const errorMsg = (error as Error).message;
    console.log(`   ⚠️  Playwright: 無法啟動瀏覽器 - ${errorMsg}`);
  }

  // 4. HTTP 測試
  console.log('\n🌍 網路連線測試:');
  try {
    const axios = await import('axios');
    const response = await axios.default.get('https://httpbin.org/get', { timeout: 5000 });
    console.log(`   ✅ HTTP 請求: 正常 (${response.status})`);
  } catch (error) {
    console.log(`   ❌ HTTP 請求: 失敗 - ${(error as Error).message}`);
  }

  // 5. 檔案權限測試
  console.log('\n📁 檔案系統測試:');
  try {
    const fs = await import('fs-extra');
    const testDir = './test-crawler-permissions';
    await fs.default.ensureDir(testDir);
    await fs.default.writeFile(`${testDir}/test.txt`, 'test');
    await fs.default.remove(testDir);
    console.log('   ✅ 檔案權限: 正常');
  } catch (error) {
    console.log(`   ❌ 檔案權限: 異常 - ${(error as Error).message}`);
  }

  // 6. 建議
  console.log('\n💡 建議:');
  if (process.platform === 'darwin') {
    console.log('   • macOS 用戶建議安裝 Xcode Command Line Tools');
    console.log('   • 執行: xcode-select --install');
  }
  console.log('   • 如果瀏覽器無法啟動，嘗試使用 HTTP 模式');
  console.log('   • 使用 --engine http 參數強制使用 HTTP 模式');

  console.log('\n✅ 診斷完成');
}

// 處理未捕獲的錯誤
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
