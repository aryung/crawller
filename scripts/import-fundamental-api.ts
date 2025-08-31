#!/usr/bin/env tsx
/**
 * 基本面資料 API 匯入腳本 v3.0
 * 透過 HTTP API 將 crawler 產出的 JSON 資料匯入到 finance-strategy
 *
 * v3.0 新功能：
 * - 支援結構化目錄掃描 (quarterly/daily/metadata)
 * - 新增按類別、市場、類型的精確篩選
 * - 自動識別新的分類目錄結構
 * - 保持對舊格式的相容性支援
 *
 * v2.0 功能：
 * - 支援 dry-run 模式
 * - 改進的批次處理和進度顯示
 * - 增強錯誤處理和資料驗證
 * - 支援不同地區數據格式的自動識別
 *
 * 使用方式 (v3.0 結構化目錄):
 * npx tsx scripts/import-fundamental-api.ts --category quarterly --market tw
 * npx tsx scripts/import-fundamental-api.ts --market us --type balance-sheet
 * npx tsx scripts/import-fundamental-api.ts --category daily --dry-run
 *
 * 相容性模式 (v2.0):
 * npx tsx scripts/import-fundamental-api.ts --file output/quarterly/tw/balance-sheet/file.json
 * npx tsx scripts/import-fundamental-api.ts --dir output/ --pattern "all-json-files"
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
  TWRegionalData,
  USRegionalData,
  JPRegionalData
} from '../src/common/shared-types/interfaces/crawler.interface';

// API 配置
const DEFAULT_API_URL =
  process.env.INTERNAL_AHA_API_URL || 'http://localhost:3000';
const DEFAULT_API_TOKEN = process.env.INTERNAL_AHA_API_TOKEN || '';

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
 * 轉換爬蟲數據為 API 格式
 */
function convertToApiFormat(record: CrawlerRawData): FundamentalApiData {
  // 🔍 診斷模式：檢查是否包含禁用欄位
  console.log(
    `\n🔍 [診斷] 開始處理: ${record.symbolCode} (${record.exchangeArea})`
  );
  console.log(`[診斷] 數據來源: ${record.dataSource || 'unknown'}`);

  // 檢查台灣數據是否意外包含美國專用欄位
  if (record.exchangeArea === MarketRegion.TPE) {
    const forbiddenUSFields = [
      'totalCapitalization',
      'netTangibleAssets',
      'commonStockEquity',
      'netDebt',
      'basicAverageShares',
      'dilutedAverageShares',
      'pretaxIncome',
      'taxProvision',
      'interestIncome',
      'interestExpense',
    ];

    let hasError = false;
    for (const field of forbiddenUSFields) {
      if (record[field] !== undefined) {
        console.error(
          `❌ [嚴重錯誤] 台灣數據 ${record.symbolCode} 包含禁用的美國欄位: ${field}=${record[field]}`
        );
        hasError = true;
      }
    }

    if (hasError) {
      console.error(`[診斷] 完整數據鍵:`, Object.keys(record).sort());
      console.error(`[診斷] 執行參數:`, process.argv.slice(2));
      console.error(`[診斷] 環境變數:`, {
        npm_config_file: process.env.npm_config_file,
        NODE_ENV: process.env.NODE_ENV,
      });
    }
  }

  // 清理 symbolCode - 只清理台灣股票後綴
  let cleanSymbolCode = record.symbolCode;
  if (record.exchangeArea === MarketRegion.TPE) {
    // 只移除台灣股票的 .TW 或 .TWO 後綴
    cleanSymbolCode = cleanSymbolCode.replace(/\.TW[O]?$/, '');
    console.log(
      `[SymbolCode] 台灣股票清理: ${record.symbolCode} → ${cleanSymbolCode}`
    );
  }
  // 日本股票保持原始格式 (如 143A, 7203)，不執行任何清理
  // 美國股票保持原始格式，不需要處理

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

  // 處理 regionalData - 將非標準欄位放入
  const regionalData: RegionalData = {};

  // US market specific fields
  if (record.exchangeArea === MarketRegion.US) {
    if (record.regionalData) {
      // 如果已經有 regionalData，複製所有美國特有欄位
      regionalData.basicAverageShares = record.regionalData.basicAverageShares;
      regionalData.dilutedAverageShares =
        record.regionalData.dilutedAverageShares;
      regionalData.pretaxIncome = record.regionalData.pretaxIncome;
      regionalData.taxProvision = record.regionalData.taxProvision;
      regionalData.interestIncome = record.regionalData.interestIncome;
      regionalData.interestExpense = record.regionalData.interestExpense;
      regionalData.netTangibleAssets = record.regionalData.netTangibleAssets;
      regionalData.totalCapitalization =
        record.regionalData.totalCapitalization;
      regionalData.commonStockEquity = record.regionalData.commonStockEquity;
      regionalData.netDebt = record.regionalData.netDebt;
    }

    // 如果美國特有欄位在主要欄位中，移到 regionalData
    if (record.netTangibleAssets !== undefined) {
      regionalData.netTangibleAssets = record.netTangibleAssets;
    }
    if (record.totalCapitalization !== undefined) {
      regionalData.totalCapitalization = record.totalCapitalization;
    }
    if (record.commonStockEquity !== undefined) {
      regionalData.commonStockEquity = record.commonStockEquity;
    }
    if (record.netDebt !== undefined) {
      regionalData.netDebt = record.netDebt;
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

  // 定義地區特有欄位映射，防止跨地區污染
  const USSpecificFields = new Set([
    'netTangibleAssets',
    'totalCapitalization',
    'commonStockEquity',
    'netDebt',
    'basicAverageShares',
    'dilutedAverageShares',
    'pretaxIncome',
    'taxProvision',
    'interestIncome',
    'interestExpense',
  ]);

  const TWSpecificFields = new Set([
    'monthlyRevenue',
    'yoyGrowth',
    'momGrowth',
  ]);

  const JPSpecificFields = new Set(['operatingProfit', 'ordinaryProfit']);

  // 添加其他未映射的欄位到 regionalData，但防止跨地區欄位污染
  const standardFields = new Set([
    'symbolCode',
    'exchangeArea',
    'reportDate',
    'fiscalYear',
    'fiscalMonth',
    'reportType',
    'dataSource',
    'lastUpdated',
    'revenue',
    'costOfGoodsSold',
    'grossProfit',
    'operatingExpenses',
    'operatingIncome',
    'netIncome',
    'ebitda',
    'eps',
    'dilutedEPS',
    'totalAssets',
    'currentAssets',
    'totalLiabilities',
    'currentLiabilities',
    'shareholdersEquity',
    'totalDebt',
    'longTermDebt',
    'shortTermDebt',
    'cashAndEquivalents',
    'bookValuePerShare',
    'sharesOutstanding',
    'operatingCashFlow',
    'investingCashFlow',
    'financingCashFlow',
    'freeCashFlow',
    'capex',
    'debtIssuance',
    'debtRepayment',
    'dividendPayments',
    'regionalData',
    ...Array.from(USSpecificFields),
    ...Array.from(TWSpecificFields),
    ...Array.from(JPSpecificFields),
  ]);

  for (const key in record) {
    if (
      !standardFields.has(key) &&
      record[key] !== undefined &&
      record[key] !== null
    ) {
      // 跨地區欄位污染檢查
      if (record.exchangeArea === MarketRegion.TPE) {
        // 台灣數據不應包含美國或日本特有欄位
        if (USSpecificFields.has(key) || JPSpecificFields.has(key)) {
          console.warn(
            `[轉換警告] 台灣數據 ${cleanSymbolCode} 包含跨地區欄位: ${key}=${record[key]}，已忽略`
          );
          continue;
        }
      } else if (record.exchangeArea === MarketRegion.US) {
        // 美國數據不應包含台灣或日本特有欄位
        if (TWSpecificFields.has(key) || JPSpecificFields.has(key)) {
          console.warn(
            `[轉換警告] 美國數據 ${cleanSymbolCode} 包含跨地區欄位: ${key}=${record[key]}，已忽略`
          );
          continue;
        }
      } else if (record.exchangeArea === MarketRegion.JP) {
        // 日本數據不應包含台灣或美國特有欄位
        if (TWSpecificFields.has(key) || USSpecificFields.has(key)) {
          console.warn(
            `[轉換警告] 日本數據 ${cleanSymbolCode} 包含跨地區欄位: ${key}=${record[key]}，已忽略`
          );
          continue;
        }
      }

      regionalData[key] = record[key];
    }
  }

  if (Object.keys(regionalData).length > 0) {
    converted.regionalData = regionalData;
  }

  return converted;
}

/**
 * 驗證記錄格式 (v2.0 新增)
 */
function validateRecord(record: unknown): record is CrawlerRawData {
  // 必要欄位檢查
  if (!record || typeof record !== 'object') {
    return false;
  }

  const obj = record as Record<string, unknown>;

  const requiredFields = [
    'symbolCode',
    'exchangeArea',
    'reportDate',
    'fiscalYear',
  ];

  for (const field of requiredFields) {
    if (!obj[field]) {
      return false;
    }
  }

  // 交易所區域驗證
  if (!Object.values(MarketRegion).includes(obj.exchangeArea as MarketRegion)) {
    return false;
  }

  // 日期格式驗證 (YYYY-MM-DD)
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (typeof obj.reportDate !== 'string' || !dateRegex.test(obj.reportDate)) {
    return false;
  }

  // 年份範圍驗證
  const fiscalYear = typeof obj.fiscalYear === 'string' ? parseInt(obj.fiscalYear) : NaN;
  if (
    isNaN(fiscalYear) ||
    fiscalYear < 1990 ||
    fiscalYear > new Date().getFullYear() + 1
  ) {
    return false;
  }

  return true;
}

/**
 * 匯入單個 JSON 檔案 (v2.0 增強版)
 * @param filePath 檔案路徑
 * @param apiClient API 客戶端
 * @param isDryRun 是否為 dry-run 模式
 * @param verbose 是否顯示詳細訊息
 */
async function importJsonFile(
  filePath: string,
  apiClient: AxiosInstance,
  isDryRun: boolean = false,
  verbose: boolean = false
): Promise<{ imported: number; failed: number; errors: string[] }> {
  const fileName = path.basename(filePath);
  console.log(`📄 處理檔案: ${fileName}`);

  if (verbose) {
    console.log(`   路徑: ${filePath}`);
  }

  const result = { imported: 0, failed: 0, errors: [] as string[] };

  try {
    console.log(`📁 [診斷] 讀取文件: ${filePath}`);
    console.log(`📁 [診斷] 文件大小: ${fs.statSync(filePath).size} bytes`);

    const content = fs.readFileSync(filePath, 'utf-8');
    const jsonData = JSON.parse(content);

    console.log(`📁 [診斷] JSON 解析成功`);
    console.log(`📁 [診斷] 頂層鍵值:`, Object.keys(jsonData));

    // 檢查資料結構
    if (!jsonData.results || !Array.isArray(jsonData.results)) {
      result.errors.push('無效的 JSON 結構，缺少 results 陣列');
      console.error(`❌ ${result.errors[result.errors.length - 1]}`);
      return result;
    }

    console.log(`📊 找到 ${jsonData.results.length} 個結果需要處理`);

    for (const [index, crawlResult] of jsonData.results.entries()) {
      if (verbose) {
        console.log(`   處理結果 ${index + 1}/${jsonData.results.length}`);
      }

      if (
        !crawlResult.data ||
        !Array.isArray(crawlResult.data)
      ) {
        const error = `結果 ${index + 1}: 缺少有效的 data 陣列`;
        result.errors.push(error);
        console.warn(`⚠️ ${error}`);
        continue;
      }

      // 批量準備數據並進行驗證
      const validRecords: FundamentalApiData[] = [];
      const invalidRecords: CrawlerRawData[] = [];

      console.log(
        `📊 [診斷] 結果 ${index + 1}: 包含 ${crawlResult.data.length} 條數據記錄`
      );

      for (const [recordIndex, record] of crawlResult.data.entries()) {
        console.log(
          `📊 [診斷] 處理記錄 ${recordIndex + 1}: ${record.symbolCode} (${record.exchangeArea})`
        );
        console.log(`📊 [診斷] 記錄鍵值:`, Object.keys(record).sort());

        if (validateRecord(record)) {
          const converted = convertToApiFormat(record);
          validRecords.push(converted);
        } else {
          console.warn(
            `⚠️ [診斷] 記錄 ${recordIndex + 1} 驗證失敗:`,
            record.symbolCode
          );
          invalidRecords.push(record);
        }
      }

      if (verbose || invalidRecords.length > 0) {
        console.log(
          `   📋 有效記錄: ${validRecords.length}, 無效記錄: ${invalidRecords.length}`
        );
      }

      if (validRecords.length === 0) {
        const error = `結果 ${index + 1}: 沒有有效的記錄可匯入`;
        result.errors.push(error);
        console.warn(`⚠️ ${error}`);
        continue;
      }

      if (isDryRun) {
        console.log(`🔍 DRY-RUN: 將會匯入 ${validRecords.length} 筆記錄`);
        if (verbose && validRecords.length > 0) {
          console.log(
            `   範例記錄: ${validRecords[0].symbolCode} (${validRecords[0].exchangeArea}) - ${validRecords[0].reportDate}`
          );
        }
        result.imported += validRecords.length;
      } else {
        try {
          // 批量發送到 API
          const response = await apiClient.post(
            '/fundamental-data/import',
            validRecords
          );

          if (response.data && response.data.success !== false) {
            const imported = response.data.imported || validRecords.length;
            const failed = response.data.failed || 0;
            console.log(`✅ 成功匯入 ${imported} 筆，失敗 ${failed} 筆`);
            result.imported += imported;
            result.failed += failed;

            if (response.data.errors && Array.isArray(response.data.errors)) {
              result.errors.push(...response.data.errors);
            }
          } else {
            const error = `API 回應失敗: ${JSON.stringify(response.data, null, 2)}`;
            result.errors.push(error);
            console.error(`❌ ${error}`);
            result.failed += validRecords.length;
          }
        } catch (error: unknown) {
          const errorMsg = error && typeof error === 'object' && 'response' in error
            ? `API 錯誤: ${JSON.stringify((error as any).response.data)}`
            : `網路錯誤: ${error instanceof Error ? error.message : String(error)}`;
          result.errors.push(errorMsg);
          console.error(`❌ ${errorMsg}`);
          result.failed += validRecords.length;
        }
      }
    }

    return result;
  } catch (error) {
    const errorMsg = `處理檔案失敗: ${(error as Error).message}`;
    result.errors.push(errorMsg);
    console.error(`❌ ${errorMsg}`);
    return result;
  }
}

/**
 * 掃描結構化目錄以尋找 JSON 檔案
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

  if (options.category) {
    // 指定類別
    if (options.market) {
      if (options.type) {
        // 類別/市場/類型 都指定
        patterns.push(
          path.join(
            baseDir,
            options.category,
            options.market,
            options.type,
            '*.json'
          )
        );
      } else {
        // 類別/市場 指定
        patterns.push(
          path.join(baseDir, options.category, options.market, '**', '*.json')
        );
      }
    } else {
      // 只指定類別
      patterns.push(path.join(baseDir, options.category, '**', '*.json'));
    }
  } else {
    // 掃描所有結構化目錄
    patterns = [
      path.join(baseDir, 'quarterly', '**', '*.json'),
      path.join(baseDir, 'daily', '**', '*.json'),
      path.join(baseDir, 'metadata', '**', '*.json'),
    ];
  }

  console.log(`📁 [診斷] 掃描模式:`, patterns);

  let allFiles: string[] = [];
  for (const pattern of patterns) {
    const files = glob.sync(pattern);
    allFiles = allFiles.concat(Array.from(files));
  }

  // 過濾並排序
  const jsonFiles = allFiles
    .filter((file) => {
      try {
        const stat = fs.statSync(file);
        return stat.isFile() && file.endsWith('.json');
      } catch (err) {
        return false;
      }
    })
    .sort();

  return jsonFiles;
}

/**
 * 主程式
 */
async function main() {
  console.log('🚀 基本面資料 API 匯入工具 v3.0 啟動 (結構化目錄支援)');

  // 🔍 診斷：顯示完整執行環境
  console.log(`📍 [診斷] 執行時間: ${new Date().toISOString()}`);
  console.log(`📍 [診斷] 工作目錄: ${process.cwd()}`);
  console.log(`📍 [診斷] Node.js 版本: ${process.version}`);
  console.log(`📍 [診斷] 完整命令列:`, process.argv);

  // 解析命令列參數 (v3.0 結構化目錄支援)
  const args = process.argv.slice(2);
  console.log(`📍 [診斷] 解析參數:`, args);
  const fileIndex = args.indexOf('--file');
  const dirIndex = args.indexOf('--dir');
  const patternIndex = args.indexOf('--pattern');
  const categoryIndex = args.indexOf('--category');
  const marketIndex = args.indexOf('--market');
  const typeIndex = args.indexOf('--type');
  const apiUrlIndex = args.indexOf('--api-url');
  const tokenIndex = args.indexOf('--token');
  const isDryRun = args.includes('--dry-run');
  const isVerbose = args.includes('--verbose') || args.includes('-v');

  const apiUrl = apiUrlIndex !== -1 ? args[apiUrlIndex + 1] : DEFAULT_API_URL;
  const token = tokenIndex !== -1 ? args[tokenIndex + 1] : DEFAULT_API_TOKEN;
  const category = categoryIndex !== -1 ? args[categoryIndex + 1] : null;
  const market = marketIndex !== -1 ? args[marketIndex + 1] : null;
  const type = typeIndex !== -1 ? args[typeIndex + 1] : null;

  if (isDryRun) {
    console.log('🔍 執行模式: DRY-RUN (不會實際匯入數據)');
  }

  if (isVerbose) {
    console.log('📝 詳細模式已啟用');
  }

  if (!token) {
    console.warn(
      '⚠️ 未提供 API Token，請確保後端允許無認證存取或使用 --token 參數'
    );
    console.log('   或設定環境變數 INTERNAL_AHA_API_TOKEN');
  }

  let filesToImport: string[] = [];

  if (fileIndex !== -1 && args[fileIndex + 1]) {
    // 單檔案模式
    filesToImport = [args[fileIndex + 1]];
    console.log(`📄 單檔案模式: ${filesToImport[0]}`);
  } else if (category || market || type) {
    // 結構化目錄模式 (新功能)
    const baseDir = dirIndex !== -1 ? args[dirIndex + 1] : 'output';
    console.log(`📁 結構化目錄模式: ${baseDir}`);
    console.log(`   分類: ${category || '全部'}`);
    console.log(`   市場: ${market || '全部'}`);
    console.log(`   類型: ${type || '全部'}`);

    filesToImport = scanStructuredDirectory(baseDir, {
      category,
      market,
      type,
    });
    console.log(`📁 找到 ${filesToImport.length} 個檔案符合條件`);
  } else if (dirIndex !== -1 && args[dirIndex + 1]) {
    // 傳統目錄模式 (保留相容性)
    const dir = args[dirIndex + 1];
    const pattern = patternIndex !== -1 ? args[patternIndex + 1] : '*.json';
    const globPattern = path.join(dir, pattern);

    console.log(`📁 傳統目錄模式: ${globPattern}`);
    const matches = await glob.glob(globPattern);
    // 過濾掉目錄，只保留 .json 檔案
    filesToImport = Array.from(matches || []).filter((file: string) => {
      try {
        const stat = fs.statSync(file);
        return stat.isFile() && file.endsWith('.json');
      } catch (err) {
        return false;
      }
    });
    console.log(`📁 找到 ${filesToImport.length} 個檔案符合條件`);
  } else {
    console.error('❌ 請指定檔案或目錄參數');
    console.log('\n📚 使用方式 (v3.0 結構化目錄支援):');
    console.log('\n🔹 單檔案模式:');
    console.log(
      '  npx tsx scripts/import-fundamental-api.ts --file output/quarterly/tw/balance-sheet/file.json'
    );

    console.log('\n🔹 結構化目錄模式 (推薦):');
    console.log(
      '  npx tsx scripts/import-fundamental-api.ts --category quarterly'
    );
    console.log(
      '  npx tsx scripts/import-fundamental-api.ts --category quarterly --market tw'
    );
    console.log(
      '  npx tsx scripts/import-fundamental-api.ts --category daily --market us'
    );
    console.log(
      '  npx tsx scripts/import-fundamental-api.ts --market tw --type balance-sheet'
    );

    console.log('\n🔹 傳統目錄模式 (相容性):');
    console.log(
      '  npx tsx scripts/import-fundamental-api.ts --dir output/ --pattern "**/*.json"'
    );
    console.log(
      '  npx tsx scripts/import-fundamental-api.ts --dir output/quarterly --pattern "**/tw/*.json"'
    );

    console.log('\n🛠️  選項參數:');
    console.log('  --category CAT    指定類別 (quarterly/daily/metadata)');
    console.log('  --market MKT      指定市場 (tw/us/jp)');
    console.log(
      '  --type TYPE       指定類型 (balance-sheet/income-statement/cash-flow-statement/etc)'
    );
    console.log('  --dir DIR         指定基礎目錄 (預設: output)');
    console.log('  --pattern PATTERN 檔案匹配模式');
    console.log(
      '  --api-url URL     指定後端 API 地址 (預設: http://localhost:3000)'
    );
    console.log(
      '  --token TOKEN     指定 JWT Token (或使用環境變數 INTERNAL_AHA_API_TOKEN)'
    );
    console.log('  --dry-run         測試模式，不實際匯入數據');
    console.log('  --verbose, -v     顯示詳細處理資訊');

    console.log('\n💡 範例:');
    console.log('  # 匯入所有台灣季度財務數據');
    console.log(
      '  npx tsx scripts/import-fundamental-api.ts --category quarterly --market tw'
    );
    console.log('  # 測試匯入美國資產負債表數據');
    console.log(
      '  npx tsx scripts/import-fundamental-api.ts --market us --type balance-sheet --dry-run'
    );
    console.log('  # 匯入所有元數據');
    console.log(
      '  npx tsx scripts/import-fundamental-api.ts --category metadata --verbose'
    );
    process.exit(1);
  }

  if (filesToImport.length === 0) {
    console.error('❌ 沒有找到符合條件的檔案');
    process.exit(1);
  }

  // 創建 API 客戶端
  const apiClient = createApiClient(apiUrl, token);
  console.log(`🌐 API 伺服器: ${apiUrl}`);

  // 處理所有檔案 (v2.0 增強版)
  let totalImported = 0;
  let totalFailed = 0;
  const allErrors: string[] = [];
  let processedFiles = 0;

  console.log(`\n🚀 開始處理 ${filesToImport.length} 個檔案...`);

  for (const file of filesToImport) {
    console.log(`\n--- 檔案 ${processedFiles + 1}/${filesToImport.length} ---`);
    const result = await importJsonFile(file, apiClient, isDryRun, isVerbose);

    totalImported += result.imported;
    totalFailed += result.failed;
    allErrors.push(...result.errors);
    processedFiles++;

    if (isVerbose || result.errors.length > 0) {
      console.log(
        `📊 檔案總結: 匯入 ${result.imported}, 失敗 ${result.failed}, 錯誤 ${result.errors.length}`
      );
    }

    console.log(
      `📈 整體進度: ${processedFiles}/${filesToImport.length} 檔案處理完成`
    );
  }

  // 最終總結 (v2.0 增強版)
  console.log('\n' + '='.repeat(60));
  console.log('✨ 匯入作業完成!');
  console.log('='.repeat(60));
  console.log(`📊 總計匯入: ${totalImported} 筆基本面數據`);
  console.log(`❌ 總計失敗: ${totalFailed} 筆`);
  console.log(`📁 處理檔案: ${processedFiles} 個`);

  if (allErrors.length > 0) {
    console.log(`\n⚠️ 錯誤總數: ${allErrors.length}`);
    if (isVerbose) {
      console.log('錯誤詳情:');
      allErrors.forEach((error, index) => {
        console.log(`  ${index + 1}. ${error}`);
      });
    } else if (allErrors.length <= 5) {
      console.log('錯誤詳情:');
      allErrors.forEach((error, index) => {
        console.log(`  ${index + 1}. ${error}`);
      });
    } else {
      console.log('前 5 個錯誤:');
      allErrors.slice(0, 5).forEach((error, index) => {
        console.log(`  ${index + 1}. ${error}`);
      });
      console.log(
        `  ... 還有 ${allErrors.length - 5} 個錯誤 (使用 --verbose 查看全部)`
      );
    }
  }

  if (isDryRun) {
    console.log('\n🔍 這是 DRY-RUN 模式，沒有實際匯入數據');
    console.log('   移除 --dry-run 參數來實際執行匯入');
  }
}

// 執行主程式
main().catch((error) => {
  console.error('❌ 程式執行失敗:', error);
  process.exit(1);
});

