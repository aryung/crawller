#!/usr/bin/env tsx
/**
 * 基本面資料 API 串流匯入腳本 v1.0
 * 即時處理版本 - 找到檔案就立即處理並發送到後端
 * 
 * 主要特性：
 * - 即時串流處理，不等待所有檔案
 * - 記憶體效率優化，逐檔處理
 * - 支援並發控制
 * - 即時進度顯示
 * - 單檔失敗不影響其他檔案
 * 
 * 使用方式：
 * npx tsx scripts/import-fundamental-api-stream.ts --market tw
 * npx tsx scripts/import-fundamental-api-stream.ts --market us --category quarterly
 * npx tsx scripts/import-fundamental-api-stream.ts --market jp --type balance-sheet
 * npx tsx scripts/import-fundamental-api-stream.ts --concurrent=3 --market tw
 */

import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import * as glob from 'glob';
import axios, { AxiosInstance } from 'axios';
import { MarketRegion } from '../src/common/shared-types/interfaces/market-data.interface';
import { 
  CrawlerRawData, 
  FundamentalApiData, 
  RegionalData,
} from '../src/common/shared-types/interfaces/crawler.interface';

// API 配置
const DEFAULT_API_URL = process.env.INTERNAL_AHA_API_URL || 'http://localhost:3000';
const DEFAULT_API_TOKEN = process.env.INTERNAL_AHA_API_TOKEN || '';

// 串流處理統計
interface StreamStats {
  totalFiles: number;
  processedFiles: number;
  successFiles: number;
  failedFiles: number;
  totalRecords: number;
  successRecords: number;
  failedRecords: number;
  startTime: number;
  errors: Array<{ file: string; error: string }>;
}

// 創建 axios 實例
function createApiClient(apiUrl: string, token?: string): AxiosInstance {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return axios.create({
    baseURL: apiUrl,
    headers,
    timeout: 30000,
  });
}

/**
 * 轉換爬蟲數據為 API 格式 (從原始腳本複製)
 */
function convertToApiFormat(record: CrawlerRawData): FundamentalApiData {
  // 清理 symbolCode - 只清理台灣股票後綴
  let cleanSymbolCode = record.symbolCode;
  if (record.exchangeArea === MarketRegion.TPE) {
    cleanSymbolCode = cleanSymbolCode.replace(/\.TW[O]?$/, '');
  }

  const converted: FundamentalApiData = {
    symbolCode: cleanSymbolCode,
    exchangeArea: record.exchangeArea,
    reportDate: record.reportDate,
    fiscalYear: record.fiscalYear,
    fiscalMonth: record.fiscalMonth,
    reportType: record.reportType || 'annual',
    dataSource: record.dataSource,
    lastUpdated: record.lastUpdated,

    // Income Statement
    revenue: record.revenue,
    costOfGoodsSold: record.costOfGoodsSold,
    grossProfit: record.grossProfit,
    operatingExpenses: record.operatingExpenses,
    operatingIncome: record.operatingIncome,
    netIncome: record.netIncome,
    ebitda: record.ebitda,
    eps: record.eps,
    dilutedEPS: record.dilutedEPS,

    // Balance Sheet
    totalAssets: record.totalAssets,
    currentAssets: record.currentAssets,
    totalLiabilities: record.totalLiabilities,
    currentLiabilities: record.currentLiabilities,
    shareholdersEquity: record.shareholdersEquity,
    totalDebt: record.totalDebt,
    longTermDebt: record.longTermDebt,
    shortTermDebt: record.shortTermDebt,
    cashAndEquivalents: record.cashAndEquivalents,
    bookValuePerShare: record.bookValuePerShare,
    sharesOutstanding: record.sharesOutstanding,

    // Cash Flow
    operatingCashFlow: record.operatingCashFlow,
    investingCashFlow: record.investingCashFlow,
    financingCashFlow: record.financingCashFlow,
    freeCashFlow: record.freeCashFlow,
    capex: record.capex,
    debtIssuance: record.debtIssuance,
    debtRepayment: record.debtRepayment,
    dividendPayments: record.dividendPayments,
  };

  // 處理 regionalData
  const regionalData: RegionalData = {};

  // US market specific fields
  if (record.exchangeArea === MarketRegion.US) {
    if (record.regionalData) {
      regionalData.basicAverageShares = record.regionalData.basicAverageShares;
      regionalData.dilutedAverageShares = record.regionalData.dilutedAverageShares;
      regionalData.pretaxIncome = record.regionalData.pretaxIncome;
      regionalData.taxProvision = record.regionalData.taxProvision;
      regionalData.interestIncome = record.regionalData.interestIncome;
      regionalData.interestExpense = record.regionalData.interestExpense;
      regionalData.netTangibleAssets = record.regionalData.netTangibleAssets;
      regionalData.totalCapitalization = record.regionalData.totalCapitalization;
      regionalData.commonStockEquity = record.regionalData.commonStockEquity;
      regionalData.netDebt = record.regionalData.netDebt;
    }
  }

  // TW market specific fields
  if (record.exchangeArea === MarketRegion.TPE) {
    if (record.monthlyRevenue) {
      regionalData.monthlyRevenue = record.monthlyRevenue;
    }
    if (record.yoyGrowth) {
      regionalData.yoyGrowth = record.yoyGrowth;
    }
    if (record.momGrowth) {
      regionalData.momGrowth = record.momGrowth;
    }
  }

  // JP market specific fields
  if (record.exchangeArea === MarketRegion.JP) {
    if (record.operatingProfit) {
      regionalData.operatingProfit = record.operatingProfit;
    }
    if (record.ordinaryProfit) {
      regionalData.ordinaryProfit = record.ordinaryProfit;
    }
  }

  if (Object.keys(regionalData).length > 0) {
    converted.regionalData = regionalData;
  }

  return converted;
}

/**
 * 驗證記錄格式
 */
function validateRecord(record: unknown): record is CrawlerRawData {
  if (!record || typeof record !== 'object') {
    return false;
  }

  const obj = record as Record<string, unknown>;
  const requiredFields = ['symbolCode', 'exchangeArea', 'reportDate', 'fiscalYear'];

  for (const field of requiredFields) {
    if (!obj[field]) {
      return false;
    }
  }

  if (!Object.values(MarketRegion).includes(obj.exchangeArea as MarketRegion)) {
    return false;
  }

  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (typeof obj.reportDate !== 'string' || !dateRegex.test(obj.reportDate)) {
    return false;
  }

  return true;
}

/**
 * 串流處理單個檔案 - 即時發送
 */
async function processFileStream(
  filePath: string,
  apiClient: AxiosInstance,
  stats: StreamStats,
  options: { isDryRun: boolean; verbose: boolean; retry: number }
): Promise<void> {
  const fileName = path.basename(filePath);
  const fileNumber = stats.processedFiles + 1;
  const progress = `[${fileNumber}/${stats.totalFiles}]`;
  
  console.log(`\n${progress} 📄 處理檔案: ${fileName}`);
  
  let fileSuccess = true;
  let fileRecords = 0;
  let fileImported = 0;
  let fileFailed = 0;

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const jsonData = JSON.parse(content);

    if (!jsonData.results || !Array.isArray(jsonData.results)) {
      throw new Error('無效的 JSON 結構，缺少 results 陣列');
    }

    // 即時處理每個結果
    for (const [index, crawlResult] of jsonData.results.entries()) {
      if (!crawlResult.data || !Array.isArray(crawlResult.data)) {
        console.warn(`  ⚠️ 結果 ${index + 1}: 缺少有效的 data 陣列`);
        continue;
      }

      // 判斷資料類型並處理
      const validRecords: FundamentalApiData[] = [];
      
      // 檢查是否為 OHLCV 資料（透過檢查第一筆記錄）
      const isOhlcvData = crawlResult.data.length > 0 && 
        crawlResult.data[0].date && 
        crawlResult.data[0].open !== undefined &&
        crawlResult.data[0].close !== undefined;
      
      if (isOhlcvData) {
        // OHLCV 資料特殊處理
        console.log(`  📈 偵測到 OHLCV 資料，包含 ${crawlResult.data.length} 筆`);
        
        // OHLCV 資料直接發送，不需要轉換
        if (options.isDryRun) {
          console.log(`  🔍 DRY-RUN: 將發送 ${crawlResult.data.length} 筆 OHLCV 記錄`);
          fileImported += crawlResult.data.length;
        } else {
          try {
            // 發送到 market-data endpoint
            const endpoint = '/market-data/ohlcv/import';
            const response = await apiClient.post(endpoint, crawlResult.data);
            console.log(`  ✅ 成功發送 ${crawlResult.data.length} 筆 OHLCV 記錄`);
            fileImported += crawlResult.data.length;
          } catch (error: any) {
            const errorMsg = error.response?.data?.message || error.message;
            console.error(`  ❌ OHLCV 發送失敗: ${errorMsg}`);
            fileFailed += crawlResult.data.length;
          }
        }
        fileRecords += crawlResult.data.length;
        continue; // 跳過後續的財務資料處理
      }
      
      // 財務資料處理
      for (const record of crawlResult.data) {
        if (validateRecord(record)) {
          validRecords.push(convertToApiFormat(record));
        }
      }

      if (validRecords.length === 0) {
        console.warn(`  ⚠️ 結果 ${index + 1}: 沒有有效記錄`);
        continue;
      }

      fileRecords += validRecords.length;

      // 即時發送到 API (串流核心)
      if (options.isDryRun) {
        console.log(`  🔍 DRY-RUN: 將發送 ${validRecords.length} 筆記錄`);
        fileImported += validRecords.length;
      } else {
        let attempts = 0;
        let success = false;
        
        while (attempts < options.retry && !success) {
          attempts++;
          try {
            const response = await apiClient.post('/fundamental-data/import', validRecords);
            
            if (response.data && response.data.success !== false) {
              const imported = response.data.imported || validRecords.length;
              const failed = response.data.failed || 0;
              console.log(`  ✅ 即時發送成功: ${imported} 筆匯入, ${failed} 筆失敗`);
              fileImported += imported;
              fileFailed += failed;
              success = true;
            } else {
              throw new Error(`API 回應失敗: ${JSON.stringify(response.data)}`);
            }
          } catch (error) {
            if (attempts >= options.retry) {
              console.error(`  ❌ 發送失敗 (嘗試 ${attempts} 次): ${error}`);
              fileFailed += validRecords.length;
            } else {
              console.warn(`  ⚠️ 發送失敗，重試中... (${attempts}/${options.retry})`);
              await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
            }
          }
        }
      }
    }

    // 更新檔案統計
    if (fileFailed === 0) {
      stats.successFiles++;
      console.log(`${progress} ✨ 檔案處理完成: ${fileImported}/${fileRecords} 筆成功`);
    } else {
      console.log(`${progress} ⚠️ 檔案處理完成: ${fileImported}/${fileRecords} 筆成功, ${fileFailed} 筆失敗`);
    }

    stats.successRecords += fileImported;
    stats.failedRecords += fileFailed;
    stats.totalRecords += fileRecords;

  } catch (error) {
    fileSuccess = false;
    stats.failedFiles++;
    const errorMsg = error instanceof Error ? error.message : String(error);
    stats.errors.push({ file: fileName, error: errorMsg });
    console.error(`${progress} ❌ 檔案處理失敗: ${errorMsg}`);
  } finally {
    stats.processedFiles++;
    
    // 即時顯示進度統計
    const elapsed = Date.now() - stats.startTime;
    const avgTime = elapsed / stats.processedFiles;
    const remainingFiles = stats.totalFiles - stats.processedFiles;
    const eta = remainingFiles * avgTime;
    
    console.log(`${progress} 📊 進度: ${stats.processedFiles}/${stats.totalFiles} 檔案 | ` +
      `成功率: ${((stats.successRecords / (stats.totalRecords || 1)) * 100).toFixed(1)}% | ` +
      `預計剩餘: ${(eta / 1000).toFixed(0)}秒`);
  }
}

/**
 * 掃描結構化目錄
 */
function scanStructuredDirectory(
  baseDir: string,
  options: {
    category?: string | null;
    market?: string | null;
    type?: string | null;
  }
): string[] {
  let patterns: string[] = [];

  if (options.market) {
    // 指定市場優先
    if (options.category) {
      if (options.type) {
        patterns.push(path.join(baseDir, options.category, options.market, options.type, '*.json'));
      } else {
        patterns.push(path.join(baseDir, options.category, options.market, '**', '*.json'));
      }
    } else {
      // 只指定市場，掃描所有類別
      patterns = [
        path.join(baseDir, 'quarterly', options.market, '**', '*.json'),
        path.join(baseDir, 'daily', options.market, '**', '*.json'),
        path.join(baseDir, 'metadata', options.market, '**', '*.json'),
      ];
    }
  } else if (options.category) {
    patterns.push(path.join(baseDir, options.category, '**', '*.json'));
  } else {
    // 掃描所有
    patterns = [
      path.join(baseDir, 'quarterly', '**', '*.json'),
      path.join(baseDir, 'daily', '**', '*.json'),
      path.join(baseDir, 'metadata', '**', '*.json'),
    ];
  }

  let allFiles: string[] = [];
  for (const pattern of patterns) {
    const files = glob.sync(pattern);
    allFiles = allFiles.concat(Array.from(files));
  }

  return allFiles.filter((file) => {
    try {
      const stat = fs.statSync(file);
      return stat.isFile() && file.endsWith('.json');
    } catch {
      return false;
    }
  }).sort();
}

/**
 * 並發處理多個檔案
 */
async function processFilesConcurrently(
  files: string[],
  apiClient: AxiosInstance,
  stats: StreamStats,
  options: { isDryRun: boolean; verbose: boolean; retry: number; concurrent: number }
): Promise<void> {
  const chunks: string[][] = [];
  
  // 將檔案分組以進行並發處理
  for (let i = 0; i < files.length; i += options.concurrent) {
    chunks.push(files.slice(i, i + options.concurrent));
  }

  for (const chunk of chunks) {
    // 並發處理當前批次
    await Promise.all(
      chunk.map(file => 
        processFileStream(file, apiClient, stats, options)
          .catch(error => {
            console.error(`❌ 處理檔案時發生未預期錯誤: ${file}`, error);
          })
      )
    );
  }
}

/**
 * 主程式
 */
async function main() {
  console.log('🚀 基本面資料 API 串流匯入工具 v1.0 啟動');
  console.log('⚡ 即時處理模式 - 找到檔案就立即發送\n');

  // 解析命令列參數
  const args = process.argv.slice(2);
  const categoryIndex = args.indexOf('--category');
  const marketIndex = args.indexOf('--market');
  const typeIndex = args.indexOf('--type');
  const apiUrlIndex = args.indexOf('--api-url');
  const tokenIndex = args.indexOf('--token');
  const concurrentIndex = args.indexOf('--concurrent');
  const retryIndex = args.indexOf('--retry');
  const isDryRun = args.includes('--dry-run');
  const isVerbose = args.includes('--verbose') || args.includes('-v');

  const apiUrl = apiUrlIndex !== -1 ? args[apiUrlIndex + 1] : DEFAULT_API_URL;
  const token = tokenIndex !== -1 ? args[tokenIndex + 1] : DEFAULT_API_TOKEN;
  const category = categoryIndex !== -1 ? args[categoryIndex + 1] : null;
  const market = marketIndex !== -1 ? args[marketIndex + 1] : null;
  const type = typeIndex !== -1 ? args[typeIndex + 1] : null;
  const concurrent = concurrentIndex !== -1 ? parseInt(args[concurrentIndex + 1]) : 1;
  const retry = retryIndex !== -1 ? parseInt(args[retryIndex + 1]) : 3;

  // 參數驗證
  if (!market && !category && !type) {
    console.error('❌ 請至少指定一個參數: --market, --category 或 --type');
    console.log('\n📚 使用方式:');
    console.log('  npx tsx scripts/import-fundamental-api-stream.ts --market tw');
    console.log('  npx tsx scripts/import-fundamental-api-stream.ts --market us --category quarterly');
    console.log('  npx tsx scripts/import-fundamental-api-stream.ts --market jp --type balance-sheet');
    console.log('\n🛠️  選項:');
    console.log('  --market MKT      指定市場 (tw/us/jp)');
    console.log('  --category CAT    指定類別 (quarterly/daily/metadata)');
    console.log('  --type TYPE       指定類型 (balance-sheet/income-statement/etc)');
    console.log('  --concurrent N    並發處理檔案數 (預設: 1)');
    console.log('  --retry N         失敗重試次數 (預設: 3)');
    console.log('  --dry-run         測試模式，不實際發送');
    console.log('  --verbose         顯示詳細資訊');
    process.exit(1);
  }

  // 顯示配置
  console.log('📋 配置:');
  console.log(`  市場: ${market || '全部'}`);
  console.log(`  類別: ${category || '全部'}`);
  console.log(`  類型: ${type || '全部'}`);
  console.log(`  並發數: ${concurrent}`);
  console.log(`  重試次數: ${retry}`);
  if (isDryRun) console.log('  🔍 DRY-RUN 模式');
  if (isVerbose) console.log('  📝 詳細模式');
  console.log();

  // 掃描檔案
  const baseDir = 'output';
  const files = scanStructuredDirectory(baseDir, { category, market, type });

  if (files.length === 0) {
    console.error('❌ 沒有找到符合條件的檔案');
    process.exit(1);
  }

  console.log(`📁 找到 ${files.length} 個檔案需要處理\n`);

  // 初始化統計
  const stats: StreamStats = {
    totalFiles: files.length,
    processedFiles: 0,
    successFiles: 0,
    failedFiles: 0,
    totalRecords: 0,
    successRecords: 0,
    failedRecords: 0,
    startTime: Date.now(),
    errors: [],
  };

  // 創建 API 客戶端
  const apiClient = createApiClient(apiUrl, token);
  console.log(`🌐 API 伺服器: ${apiUrl}`);
  
  if (!token) {
    console.warn('⚠️ 未提供 API Token，請確保後端允許無認證存取\n');
  }

  console.log('🚀 開始串流處理...\n');
  console.log('=' * 60);

  // 執行串流處理
  if (concurrent > 1) {
    console.log(`⚡ 使用並發模式 (${concurrent} 個檔案同時處理)\n`);
    await processFilesConcurrently(files, apiClient, stats, {
      isDryRun,
      verbose: isVerbose,
      retry,
      concurrent,
    });
  } else {
    // 順序處理
    for (const file of files) {
      await processFileStream(file, apiClient, stats, {
        isDryRun,
        verbose: isVerbose,
        retry,
      });
    }
  }

  // 顯示最終統計
  const totalTime = (Date.now() - stats.startTime) / 1000;
  console.log('\n' + '=' * 60);
  console.log('✨ 串流匯入完成!');
  console.log('=' * 60);
  console.log(`📊 總計統計:`);
  console.log(`  處理檔案: ${stats.processedFiles}/${stats.totalFiles}`);
  console.log(`  成功檔案: ${stats.successFiles}`);
  console.log(`  失敗檔案: ${stats.failedFiles}`);
  console.log(`  處理記錄: ${stats.totalRecords}`);
  console.log(`  成功記錄: ${stats.successRecords}`);
  console.log(`  失敗記錄: ${stats.failedRecords}`);
  console.log(`  成功率: ${((stats.successRecords / (stats.totalRecords || 1)) * 100).toFixed(1)}%`);
  console.log(`  總耗時: ${totalTime.toFixed(1)} 秒`);
  console.log(`  平均速度: ${(stats.totalRecords / totalTime).toFixed(1)} 筆/秒`);

  if (stats.errors.length > 0) {
    console.log(`\n⚠️ 錯誤清單 (${stats.errors.length} 個):`);
    stats.errors.slice(0, 10).forEach(({ file, error }, index) => {
      console.log(`  ${index + 1}. ${file}: ${error}`);
    });
    if (stats.errors.length > 10) {
      console.log(`  ... 還有 ${stats.errors.length - 10} 個錯誤`);
    }
  }

  if (isDryRun) {
    console.log('\n🔍 這是 DRY-RUN 模式，沒有實際發送數據');
  }

  // 根據結果設定退出碼
  process.exit(stats.failedFiles > 0 ? 1 : 0);
}

// 執行主程式
main().catch((error) => {
  console.error('❌ 程式執行失敗:', error);
  process.exit(1);
});