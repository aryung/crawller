/**
 * Yahoo Finance Taiwan 网站特定的转换函数 (清理后版本)
 * 只包含配置文件中实际使用的20个函数
 */

import { UnifiedFinancialData } from '../../types/unified-financial-data';
import { FiscalReportType, MarketRegion, UNIT_MULTIPLIERS } from '../../common';

/**
 * 歷史股價數據介面 (TWSE API)
 */
export interface HistoricalStockPrice {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  adjustedClose?: number;
  symbolCode: string;
}

/**
 * Yahoo Finance TW 转换函数接口 (大幅清理后的版本)
 * 只保留配置文件中实际使用的20个函数
 */
export interface YahooFinanceTWTransforms {
  // === 实际使用的核心转换函数 ===

  // 股票代码清理 (实际使用)
  cleanStockSymbol: (value: string) => string;

  // 营收数据处理 (实际使用)
  extractRevenuePeriodsSeparately: (content: string | string[]) => string[];
  extractRevenueValuesSeparately: (content: string | string[]) => number[];
  combineSimpleRevenueData: (
    content: any,
    context?: any,
  ) => UnifiedFinancialData[];

  // 股利数据处理 (实际使用)
  extractDividendPeriodsSeparately: (content: string | string[]) => string[];
  extractCashDividendsSeparately: (content: string | string[]) => number[];
  extractStockDividendsSeparately: (content: string | string[]) => number[];
  combineSimpleDividendData: (
    content: any,
    context?: any,
  ) => UnifiedFinancialData[];

  // EPS 数据处理 (实际使用)
  extractEPSPeriodsSeparately: (content: string | string[]) => string[];
  extractEPSValuesSeparately: (content: string | string[]) => number[];
  combineSimpleEPSData: (content: any, context?: any) => UnifiedFinancialData[];

  // 损益表数据处理 (实际使用)
  extractIncomeStatementPeriodsSeparately: (
    content: string | string[],
  ) => string[];
  extractIncomeStatementValuesSeparately: (
    content: string | string[],
  ) => number[];
  combineIncomeStatementData: (
    content: any,
    context?: any,
  ) => UnifiedFinancialData[];

  // 现金流数据处理 (实际使用)
  extractCashFlowValuesSeparately: (content: string | string[]) => number[];
  combineCashFlowData: (content: any, context?: any) => UnifiedFinancialData[];

  // 资产负债表数据处理 (实际使用)
  combineBalanceSheetData: (
    content: any,
    context?: any,
  ) => UnifiedFinancialData[];

  // === 核心工具函数 (被上述函数内部调用) ===
  detectTableOrientation: (data: string[]) => 'horizontal' | 'vertical';
  parseFinancialValue: (value: string) => number;
  parseUnifiedFiscalPeriod: (value: string) => {
    year: number;
    quarter?: number;
    month?: number;
  };

  // === 新增：統一的陣列轉換函數 (與 JP/US 保持一致) ===
  parseTWFinancialPeriodsArray: (content: string | string[]) => Array<{
    year: number;
    quarter?: number;
    month?: number;
    originalPeriod?: string;
  }>;
  parseTWFinancialValuesArray: (content: string | string[]) => number[];

  // === 歷史股價數據轉換函數 (TWSE API) ===
  parseTWStockInfo: (content: string | string[]) => string;
  parseTWDateArray: (content: string | string[]) => string[];
  parseTWOpenPriceArray: (content: string | string[]) => number[];
  parseTWHighPriceArray: (content: string | string[]) => number[];
  parseTWLowPriceArray: (content: string | string[]) => number[];
  parseTWClosePriceArray: (content: string | string[]) => number[];
  parseTWVolumeArray: (content: string | string[]) => number[];
  combineTWHistoricalData: (content: any, context?: any) => HistoricalStockPrice[];
}

/**
 * === 函数实现 ===
 */

// 股票代码清理函数
function cleanStockSymbol(text: string): string {
  if (!text || typeof text !== 'string') return '';

  // 移除常见前缀文字
  let cleaned = text
    .replace(/股票代號[：:]\s*/g, '')
    .replace(/代號[：:]\s*/g, '')
    .replace(/股票[：:]\s*/g, '')
    .replace(/^[：:]\s*/g, '')
    .trim();

  // 提取股票代码並清理為乾淨格式（移除 .TW/.TWO 後綴）
  const stockCodeMatch = cleaned.match(/(\d{4})\.TW[O]?/);
  if (stockCodeMatch) {
    return stockCodeMatch[1]; // 只返回數字部分，不包含 .TW
  }

  // 如果没有找到标准格式，尝试提取数字部分
  const numberMatch = cleaned.match(/\d{4}/);
  if (numberMatch) {
    return numberMatch[0]; // 只返回數字部分
  }

  return cleaned;
}

// 营收期间提取函数
function extractRevenuePeriodsSeparately(content: string | string[]): string[] {
  console.log('[Separate Revenue Periods] 🔍 处理直接选择器结果...');

  const contentArray = Array.isArray(content) ? content : [content];
  const periods: string[] = [];

  for (const item of contentArray) {
    if (!item || typeof item !== 'string') continue;

    // 匹配期间格式: 2025/01, 2024/12, 2024/11 等
    const matches = item.match(/(\d{4}\/\d{1,2})/g);
    if (matches) {
      periods.push(...matches);
    }
  }

  console.log(
    `[Separate Revenue Periods] ✅ 提取到 ${periods.length} 个期间: ${periods.slice(0, 5).join(', ')}${periods.length > 5 ? '...' : ''}`,
  );

  return periods;
}

// 营收数值提取函数
function extractRevenueValuesSeparately(content: string | string[]): number[] {
  console.log('[Separate Revenue Values] 💰 处理直接选择器结果...');

  const contentArray = Array.isArray(content) ? content : [content];
  const values: number[] = [];

  for (const item of contentArray) {
    if (!item || typeof item !== 'string') continue;

    // 清理数值并转换
    const cleanValue = item
      .replace(/[,\s]/g, '') // 移除逗号和空格
      .replace(/[^\d.-]/g, ''); // 只保留数字、负号和小数点

    const num = parseFloat(cleanValue);
    if (!isNaN(num)) {
      values.push(num);
    }
  }

  console.log(
    `[Separate Revenue Values] ✅ 提取到 ${values.length} 个数值: ${values.slice(0, 5).join(', ')}${values.length > 5 ? '...' : ''}`,
  );

  return values;
}

// 营收数据组合函数 (优化版 - 只处理 revenue 相关数据)
function combineSimpleRevenueData(
  content: any,
  context?: any,
): UnifiedFinancialData[] {
  console.log('[Combine Simple Revenue] 🔗 开始组合简化营收数据...');

  const results: UnifiedFinancialData[] = [];

  try {
    // 从上下文获取提取的数据 - 使用新的統一變數名稱
    const periodsArray = context?.fiscalPeriodsArray || context?.variables?.fiscalPeriodsArray || context?.variables?.revenuePeriods || [];
    const values = context?.revenueValues || context?.variables?.revenueValues || [];

    // 优先从 URL 提取 symbolCode 並清理為乾淨格式
    let symbolCode = '0000';
    if (context?.url) {
      const urlMatch = context.url.match(/\/quote\/([^\/]+)\//);
      if (urlMatch) {
        // 清理 symbolCode: 移除 .TW 或 .TWO 後綴
        symbolCode = urlMatch[1].replace(/\.TW[O]?$/, '');
        console.log(`[Combine Simple Revenue] 從 URL 提取並清理 symbolCode: ${urlMatch[1]} -> ${symbolCode}`);
      }
    }
    if (symbolCode === '0000') {
      symbolCode = context?.symbolCode ||
        context?.variables?.symbolCode ||
        context?.variables?.stockSymbol ||
        '0000';
    }

    console.log(
      `[Combine Simple Revenue] 数据概览: ${periodsArray.length} 个期间, ${values.length} 个数值`,
    );

    // 组合数据
    const minLength = Math.min(periodsArray.length, values.length);
    for (let i = 0; i < minLength; i++) {
      const periodData = periodsArray[i];
      const revenue = values[i];

      if (periodData && revenue !== undefined && revenue !== null) {
        // 使用統一格式的期間數據
        const year = periodData.year || new Date().getFullYear();
        const month = periodData.month;

        // 生成正确的报告日期 (月底日期)
        const actualMonth = month || 12; // 默认为12月
        const lastDayOfMonth = new Date(year, actualMonth, 0).getDate();
        const reportDate = `${year}-${actualMonth.toString().padStart(2, '0')}-${lastDayOfMonth.toString().padStart(2, '0')}`;

        const unifiedData: UnifiedFinancialData = {
          symbolCode: symbolCode,
          exchangeArea: 'TPE' as MarketRegion,
          reportDate: reportDate,
          fiscalYear: year,
          fiscalMonth: actualMonth, // 營收數據必須包含月份信息
          reportType: FiscalReportType.MONTHLY,
          dataSource: 'yahoo-finance-tw',
          lastUpdated: new Date().toISOString(),
          revenue: revenue,
          // 營收數據專用：只處理 revenue 和 fiscalMonth
        };

        results.push(unifiedData);
      }
    }

    console.log(
      `[Combine Simple Revenue] ✅ 成功组合 ${results.length} 筆營收数据`,
    );
  } catch (error) {
    console.error('[Combine Simple Revenue] ❌ 组合过程中发生错误:', error);
  }

  return results;
}

// 股利期间提取函数
function extractDividendPeriodsSeparately(
  content: string | string[],
): string[] {
  console.log('[Extract Dividend Periods] 🔍 开始提取股利所属期间...');

  const contentArray = Array.isArray(content) ? content : [content];
  const periods: string[] = [];

  for (const item of contentArray) {
    if (!item || typeof item !== 'string') continue;

    const cleanedItem = item.trim();

    // 匹配多種季度格式: "2025 Q1", "2025Q1", "2025-Q1", "2024Q4", "2024-4", "2025-1" 等
    // 優先匹配 "2025 Q1" 格式（空格分隔）
    const spaceMatch = cleanedItem.match(/^(\d{4})\s+Q(\d)$/);
    if (spaceMatch) {
      const period = `${spaceMatch[1]}-Q${spaceMatch[2]}`;
      periods.push(period);
      console.log(`[Extract Dividend Periods] 匹配到期間: "${cleanedItem}" → "${period}"`);
      continue;
    }

    // 半年度格式: 2024H1, 2024H2 等
    const halfYearMatches = cleanedItem.match(/(\d{4})H([12])/g);
    if (halfYearMatches) {
      const normalizedMatches = halfYearMatches.map(match => {
        const halfYearMatch = match.match(/(\d{4})H([12])/);
        if (halfYearMatch) {
          const year = halfYearMatch[1];
          const half = halfYearMatch[2];
          // 轉換為季度格式: H1 → Q2 (上半年結束於Q2), H2 → Q4 (下半年結束於Q4)
          const quarter = half === '1' ? '2' : '4';
          return `${year}-Q${quarter}`;
        }
        return match;
      });
      periods.push(...normalizedMatches);
      console.log(`[Extract Dividend Periods] 半年度格式匹配: "${cleanedItem}" → [${normalizedMatches.join(', ')}]`);
    } else {
      // 其他季度格式: 2025Q1, 2025-Q1, 2024-4, 2025-1 等
      const quarterMatches = cleanedItem.match(/(\d{4}[-]?[Q]?\d{1})/g);
      if (quarterMatches) {
        // 轉換為統一格式 (例如: 2025-1 → 2025-Q1)
        const normalizedMatches = quarterMatches.map(match => {
          if (match.match(/\d{4}-\d{1}/)) {
            // 2025-1 → 2025-Q1
            return match.replace('-', '-Q');
          } else if (match.match(/\d{4}-Q\d{1}/)) {
            // 2025-Q1 → 2025-Q1 (已是目標格式)
            return match;
          } else if (match.match(/\d{4}Q\d{1}/)) {
            // 2025Q1 → 2025-Q1
            return match.replace('Q', '-Q');
          }
          return match;
        });
        periods.push(...normalizedMatches);
        console.log(`[Extract Dividend Periods] 季度格式匹配: "${cleanedItem}" → [${normalizedMatches.join(', ')}]`);
      } else {
        // 純年度格式: 匹配 2024, 2023 等
        const yearMatches = cleanedItem.match(/(\d{4})/g);
        if (yearMatches) {
          periods.push(...yearMatches);
          console.log(`[Extract Dividend Periods] 年度格式匹配: "${cleanedItem}" → [${yearMatches.join(', ')}]`);
        }
      }
    }
  }

  console.log(`[Extract Dividend Periods] ✅ 提取到 ${periods.length} 个期间`);
  return periods;
}

// 现金股利提取函数
function extractCashDividendsSeparately(content: string | string[]): number[] {
  console.log('[Extract Cash Dividends] 💰 开始提取现金股利数值...');

  const contentArray = Array.isArray(content) ? content : [content];
  const dividends: number[] = [];

  for (const item of contentArray) {
    if (!item || typeof item !== 'string') {
      dividends.push(0); // 空值转为 0
      continue;
    }

    const cleanValue = item.trim().replace(/[,\s]/g, '');

    // 处理 "-" 符号，表示该期间没有现金股利
    if (cleanValue === '-' || cleanValue === '－' || cleanValue === '') {
      dividends.push(0); // "-" 转为 0
    } else {
      const num = parseFloat(cleanValue);
      dividends.push(!isNaN(num) && num >= 0 ? num : 0);
    }
  }

  console.log(
    `[Extract Cash Dividends] ✅ 提取到 ${dividends.length} 个现金股利数值`,
  );

  return dividends;
}

// 股票股利提取函数
function extractStockDividendsSeparately(content: string | string[]): number[] {
  console.log('[Extract Stock Dividends] 📈 开始提取股票股利数值...');

  const contentArray = Array.isArray(content) ? content : [content];
  const dividends: number[] = [];

  for (const item of contentArray) {
    if (!item || typeof item !== 'string') {
      dividends.push(0); // 空值转为 0
      continue;
    }

    const cleanValue = item.trim().replace(/[,\s]/g, '');

    // 处理 "-" 符号，表示该期间没有股票股利
    if (cleanValue === '-' || cleanValue === '－' || cleanValue === '') {
      dividends.push(0); // "-" 转为 0
    } else {
      const num = parseFloat(cleanValue);
      dividends.push(!isNaN(num) && num >= 0 ? num : 0);
    }
  }

  console.log(
    `[Extract Stock Dividends] ✅ 提取到 ${dividends.length} 个股票股利数值`,
  );

  return dividends;
}

// 股利数据组合函数
function combineSimpleDividendData(
  content: any,
  context?: any,
): UnifiedFinancialData[] {
  console.log('[Combine Dividend] 🔗 开始组合股利数据...');
  console.log('[Combine Dividend] 📊 Context 詳細資訊:', {
    hasContext: !!context,
    hasVariables: !!context?.variables,
    variableKeys: context?.variables ? Object.keys(context.variables) : [],
    contentType: typeof content,
    contentLength: Array.isArray(content) ? content.length : (typeof content === 'string' ? content.length : 0),
  });

  if (context?.variables) {
    console.log('[Combine Dividend] 🔍 Variables 內容預覽:', {
      dividendPeriods: context.variables.dividendPeriods ? `Array(${context.variables.dividendPeriods.length})` : 'undefined',
      cashDividends: context.variables.cashDividends ? `Array(${context.variables.cashDividends.length})` : 'undefined',
      stockDividends: context.variables.stockDividends ? `Array(${context.variables.stockDividends.length})` : 'undefined',
      symbolCode: context.variables.symbolCode || context.variables.stockSymbol || 'undefined',
    });
  }

  const results: UnifiedFinancialData[] = [];

  // 先嘗試從 context 根層級讀取，再從 variables 讀取 - 使用新的統一變數名稱
  const periodsArray = context?.fiscalPeriodsArray || context?.variables?.fiscalPeriodsArray || context?.variables?.dividendPeriods || [];
  const cashDividends: number[] = context?.cashDividendsValues || context?.variables?.cashDividendsValues || context?.variables?.cashDividends || [];
  const stockDividends: number[] = context?.stockDividendsValues || context?.variables?.stockDividendsValues || context?.variables?.stockDividends || [];

  try {

    // 優先從 URL 提取 symbolCode 並清理為乾淨格式
    let symbolCode = '0000';
    if (context?.url) {
      const urlMatch = context.url.match(/\/quote\/([^\/]+)\//);
      if (urlMatch) {
        // 清理 symbolCode: 移除 .TW 或 .TWO 後綴
        symbolCode = urlMatch[1].replace(/\.TW[O]?$/, '');
        console.log(`[Combine Dividend] 從 URL 提取並清理 symbolCode: ${urlMatch[1]} -> ${symbolCode}`);
      }
    }
    if (symbolCode === '0000') {
      symbolCode = context?.symbolCode ||
        context?.variables?.symbolCode ||
        context?.variables?.stockSymbol ||
        '0000';
    }

    console.log('[Combine Dividend] 📊 提取的數據詳情:', {
      periods: { length: periodsArray.length, sample: periodsArray.slice(0, 3) },
      cashDividends: { length: cashDividends.length, sample: cashDividends.slice(0, 3) },
      stockDividends: { length: stockDividends.length, sample: stockDividends.slice(0, 3) },
      symbolCode,
    });

    // 如果所有陣列都為空，進行詳細檢查
    if (periodsArray.length === 0 && cashDividends.length === 0 && stockDividends.length === 0) {
      console.error('[Combine Dividend] ❌ 所有數據陣列都為空！');
      console.log('[Combine Dividend] 🔍 所有可用的變量:',
        context?.variables ? Object.keys(context.variables) : '無 variables',
      );
      console.log('[Combine Dividend] 🔍 完整 context 結構:',
        JSON.stringify(context, null, 2).slice(0, 500) + '...',
      );
      return [];
    }

    // 验证数组长度是否一致
    if (periodsArray.length !== cashDividends.length || periodsArray.length !== stockDividends.length) {
      console.warn(
        `[Combine Dividend] ⚠️ 数组长度不一致: periods=${periodsArray.length}, cashDividends=${cashDividends.length}, stockDividends=${stockDividends.length}`,
      );
    }

    // 使用最短的数组长度，确保数据对齐
    const minLength = Math.min(
      periodsArray.length,
      cashDividends.length,
      stockDividends.length,
    );

    console.log(
      `[Combine Dividend] 📈 处理 ${minLength} 条记录 (periods=${periodsArray.length}, cash=${cashDividends.length}, stock=${stockDividends.length})`,
    );

    for (let i = 0; i < minLength; i++) {
      const periodData = periodsArray[i];
      const cashDividend = cashDividends[i] || 0;
      const stockDividend = stockDividends[i] || 0;

      if (periodData && periodData.year) {
        // 直接使用已解析的期間數據
        const year = periodData.year;
        const quarter = periodData.quarter;
        const month = periodData.month;

        console.log(`[Combine Dividend] 🔍 處理期間: Year: ${year}, Quarter: ${quarter}, Month: ${month}`);

        // 生成正確的報告日期
        let reportDate: string;
        if (quarter) {
          // 季度數據 - 使用季度末日期
          const quarterEndMonth = quarter * 3;
          const lastDayOfQuarter = new Date(year, quarterEndMonth, 0).getDate();
          reportDate = `${year}-${quarterEndMonth.toString().padStart(2, '0')}-${lastDayOfQuarter.toString().padStart(2, '0')}`;
        } else {
          // 年度數據
          reportDate = `${year}-12-31`;
        }

        const unifiedData: UnifiedFinancialData = {
          symbolCode: symbolCode,
          exchangeArea: 'TPE' as MarketRegion,
          reportDate: reportDate,
          fiscalYear: year,
          fiscalMonth: quarter ? quarter * 3 : 12, // Q1→3, Q2→6, Q3→9, Q4→12
          reportType: quarter ? FiscalReportType.QUARTERLY : FiscalReportType.ANNUAL,
          dataSource: 'yahoo-finance-tw',
          lastUpdated: new Date().toISOString(),
          // 股利數據專用
          cashDividend: cashDividend,
          stockDividend: stockDividend,
        };

        results.push(unifiedData);
        console.log(`[Combine Dividend] ✅ 組合第 ${i + 1} 筆: ${reportDate} (現金: ${cashDividend}, 股票: ${stockDividend})`);
      }
    }

    console.log(`[Combine Dividend] ✅ 成功组合 ${results.length} 筆股利数据`);

    if (results.length === 0) {
      console.error('[Combine Dividend] ⚠️ 警告：沒有生成任何組合數據！');
      console.log('[Combine Dividend] 🔍 檢查點:', {
        minLength,
        hasValidPeriodsArray: periodsArray.some((p: any) => p && p.year),
        cashDividendsNonZero: cashDividends.some((c: number) => c !== 0),
        stockDividendsNonZero: stockDividends.some((s: number) => s !== 0),
      });
    }
  } catch (error: any) {
    console.error('[Combine Dividend] ❌ 组合过程中发生错误:', error);
    console.error('[Combine Dividend] 錯誤詳情:', {
      message: error.message,
      stack: error.stack?.slice(0, 500),
    });
  }

  return results;
}

// EPS 期间提取函数
function extractEPSPeriodsSeparately(content: string | string[]): string[] {
  console.log('[Extract EPS Periods] 🔍 开始提取 EPS 所属期间...');

  const contentArray = Array.isArray(content) ? content : [content];
  const periods: string[] = [];

  for (const item of contentArray) {
    if (!item || typeof item !== 'string') continue;

    const cleanedItem = item.trim();

    // 匹配多種季度格式: "2025 Q1", "2025Q1", "2025-Q1", "2024Q4", "2024-4", "2025-1" 等
    // 優先匹配 "2025 Q1" 格式（空格分隔）
    const spaceMatch = cleanedItem.match(/^(\d{4})\s+Q(\d)$/);
    if (spaceMatch) {
      const period = `${spaceMatch[1]}-Q${spaceMatch[2]}`;
      periods.push(period);
      console.log(`[Extract EPS Periods] 匹配到期間: "${cleanedItem}" → "${period}"`);
      continue;
    }

    // 其他格式: 2025Q1, 2025-Q1, 2024-4, 2025-1 等
    const matches = cleanedItem.match(/(\d{4}[-]?[Q]?\d{1})/g);
    if (matches) {
      // 轉換為統一格式 (例如: 2025-1 → 2025-Q1)
      const normalizedMatches = matches.map(match => {
        if (match.match(/\d{4}-\d{1}/)) {
          // 2025-1 → 2025-Q1
          return match.replace('-', '-Q');
        } else if (match.match(/\d{4}-Q\d{1}/)) {
          // 2025-Q1 → 2025-Q1 (已是目標格式)
          return match;
        } else if (match.match(/\d{4}Q\d{1}/)) {
          // 2025Q1 → 2025-Q1
          return match.replace('Q', '-Q');
        }
        return match;
      });
      periods.push(...normalizedMatches);
    }
  }

  console.log(`[Extract EPS Periods] ✅ 提取到 ${periods.length} 个期间`);

  return periods;
}

// EPS 数值提取函数
function extractEPSValuesSeparately(content: string | string[]): number[] {
  console.log('[Extract EPS Values] 💰 开始提取 EPS 数值 (独立选择器)...');

  const contentArray = Array.isArray(content) ? content : [content];
  const epsValues: number[] = [];

  for (const item of contentArray) {
    if (!item || typeof item !== 'string') continue;

    const cleanValue = item.replace(/[,\s]/g, '');
    const num = parseFloat(cleanValue);
    if (!isNaN(num)) {
      epsValues.push(num);
    }
  }

  console.log(`[Extract EPS Values] ✅ 提取到 ${epsValues.length} 个 EPS 数值`);

  return epsValues;
}

// EPS 数据组合函数
function combineSimpleEPSData(
  content: any,
  context?: any,
): UnifiedFinancialData[] {
  console.log('[Combine EPS] 🔗 开始组合 EPS 数据...');

  const results: UnifiedFinancialData[] = [];

  try {
    // 使用新的統一變數名稱
    const periodsArray = context?.fiscalPeriodsArray || context?.variables?.fiscalPeriodsArray || context?.variables?.epsPeriods || [];
    const values = context?.epsValues || context?.variables?.epsValues || [];

    // 優先從 URL 提取 symbolCode 並清理為乾淨格式
    let symbolCode = '0000';
    if (context?.url) {
      const urlMatch = context.url.match(/\/quote\/([^\/]+)\//);
      if (urlMatch) {
        // 清理 symbolCode: 移除 .TW 或 .TWO 後綴
        symbolCode = urlMatch[1].replace(/\.TW[O]?$/, '');
        console.log(`[Combine EPS] 從 URL 提取並清理 symbolCode: ${urlMatch[1]} -> ${symbolCode}`);
      }
    }
    if (symbolCode === '0000') {
      symbolCode = context?.symbolCode ||
        context?.variables?.symbolCode ||
        context?.variables?.stockSymbol ||
        '0000';
    }

    const minLength = Math.min(periodsArray.length, values.length);

    for (let i = 0; i < minLength; i++) {
      const periodData = periodsArray[i];
      const epsValue = values[i];

      if (!periodData || epsValue === null || epsValue === undefined) continue;

      // 使用統一格式的期間數據
      const year = periodData.year || new Date().getFullYear();
      const quarter = periodData.quarter;
      const month = periodData.month;

      // 生成报告日期
      let reportDate: string;
      if (quarter) {
        // 季度数据 - 使用季度末日期
        const quarterEndMonth = quarter * 3;
        const lastDayOfQuarter = new Date(
          year,
          quarterEndMonth,
          0,
        ).getDate();
        reportDate = `${year}-${quarterEndMonth.toString().padStart(2, '0')}-${lastDayOfQuarter.toString().padStart(2, '0')}`;
      } else {
        // 年度数据
        reportDate = `${year}-12-31`;
      }

      const unifiedData: UnifiedFinancialData = {
        symbolCode: symbolCode,
        exchangeArea: 'TPE' as MarketRegion,
        reportDate: reportDate,
        fiscalYear: year,
        fiscalMonth: quarter ? quarter * 3 : 12, // Q1→3, Q2→6, Q3→9, Q4→12
        reportType: quarter ? FiscalReportType.QUARTERLY : FiscalReportType.ANNUAL,
        dataSource: 'yahoo-finance-tw',
        lastUpdated: new Date().toISOString(),
        eps: epsValue,
      };

      results.push(unifiedData);
    }

    console.log(`[Combine EPS] ✅ 成功组合 ${results.length} 筆 EPS 数据`);
  } catch (error) {
    console.error('[Combine EPS] ❌ 组合过程中发生错误:', error);
  }

  return results;
}

// 损益表期间提取函数
function extractIncomeStatementPeriodsSeparately(
  content: string | string[],
): string[] {
  console.log('[Income Statement Periods] 🔍 处理直接选择器结果...');

  const contentArray = Array.isArray(content) ? content : [content];
  const periods: string[] = [];

  for (const item of contentArray) {
    if (!item || typeof item !== 'string') continue;

    const matches = item.match(/(\d{4}[-Q]\d{1})/g);
    if (matches) {
      periods.push(...matches);
    }
  }

  console.log(`[Income Statement Periods] ✅ 提取到 ${periods.length} 个期间`);

  return periods;
}

// 损益表数值提取函数
function extractIncomeStatementValuesSeparately(
  content: string | string[],
): number[] {
  console.log('[Income Statement Values] 💰 处理直接选择器结果...');

  const contentArray = Array.isArray(content) ? content : [content];
  const values: number[] = [];

  for (const item of contentArray) {
    if (!item || typeof item !== 'string') continue;

    const cleanValue = item.replace(/[,\s]/g, '');
    const num = parseFloat(cleanValue);
    if (!isNaN(num)) {
      values.push(num);
    }
  }

  console.log(`[Income Statement Values] ✅ 提取到 ${values.length} 个数值`);

  return values;
}

// 损益表数据组合函数
function combineIncomeStatementData(
  content: any,
  context?: any,
): UnifiedFinancialData[] {
  console.log('[Combine Income Statement] 🔗 开始组合收益表数据...');

  // 從 context.variables 讀取已提取的數據

  const results: UnifiedFinancialData[] = [];

  try {
    // 使用新的統一變數名稱
    const periodsArray = context?.fiscalPeriodsArray ||
      context?.variables?.fiscalPeriodsArray ||
      context?.variables?.incomeStatementPeriods || [];
    const revenueValues = context?.revenueValues ||
      context?.variables?.revenueValues || [];
    const grossProfitValues = context?.grossProfitValues ||
      context?.variables?.grossProfitValues || [];
    const operatingExpenseValues = context?.operatingExpenseValues ||
      context?.variables?.operatingExpenseValues || [];
    const operatingIncomeValues = context?.operatingIncomeValues ||
      context?.variables?.operatingIncomeValues || [];
    const netIncomeValues = context?.netIncomeValues ||
      context?.variables?.netIncomeValues || [];

    // 優先從 URL 提取 symbolCode 並清理為乾淨格式
    let symbolCode = '0000';
    if (context?.url) {
      const urlMatch = context.url.match(/\/quote\/([^\/]+)\//);
      if (urlMatch) {
        // 清理 symbolCode: 移除 .TW 或 .TWO 後綴
        symbolCode = urlMatch[1].replace(/\.TW[O]?$/, '');
        console.log(`[Combine Income Statement] 從 URL 提取並清理 symbolCode: ${urlMatch[1]} -> ${symbolCode}`);
      }
    }
    if (symbolCode === '0000') {
      symbolCode = context?.symbolCode ||
        context?.variables?.symbolCode ||
        context?.variables?.stockSymbol ||
        '0000';
    }

    console.log(`[Combine Income Statement] 📊 數據統計:`);
    console.log(`  期間: ${periodsArray.length} 個`);
    console.log(`  營業收入: ${revenueValues.length} 個`);
    console.log(`  營業毛利: ${grossProfitValues.length} 個`);
    console.log(`  營業費用: ${operatingExpenseValues.length} 個`);
    console.log(`  營業利益: ${operatingIncomeValues.length} 個`);
    console.log(`  稅後淨利: ${netIncomeValues.length} 個`);

    const minLength = Math.min(
      periodsArray.length,
      revenueValues.length,
      grossProfitValues.length,
      operatingExpenseValues.length,
      operatingIncomeValues.length,
      netIncomeValues.length,
    );

    console.log(`[Combine Income Statement] 🔄 將組合 ${minLength} 筆數據`);

    for (let i = 0; i < minLength; i++) {
      const periodData = periodsArray[i];
      const revenue = revenueValues[i];
      const grossProfit = grossProfitValues[i];
      const operatingExpense = operatingExpenseValues[i];
      const operatingIncome = operatingIncomeValues[i];
      const netIncome = netIncomeValues[i];

      if (periodData && periodData.year && revenue !== undefined && revenue !== null) {
        const year = periodData.year;
        const quarter = periodData.quarter;
        const month = periodData.month;

        // 生成正确的报告日期 (季末日期)
        const quarterEndMonth = quarter ? quarter * 3 : 12;
        const lastDayOfQuarter = new Date(year, quarterEndMonth, 0).getDate();
        const reportDate = `${year}-${quarterEndMonth.toString().padStart(2, '0')}-${lastDayOfQuarter.toString().padStart(2, '0')}`;

        const unifiedData: UnifiedFinancialData = {
          symbolCode: symbolCode,
          exchangeArea: 'TPE' as MarketRegion,
          reportDate: reportDate,
          fiscalYear: year,
          fiscalMonth: quarter ? quarter * 3 : 12,
          reportType: quarter ? FiscalReportType.QUARTERLY : FiscalReportType.ANNUAL,
          dataSource: 'yahoo-finance-tw',
          lastUpdated: new Date().toISOString(),
          // 損益表數據 - Yahoo Finance TW 數據單位為仟元，需要乘以 1000
          revenue: revenue * UNIT_MULTIPLIERS.THOUSAND_TWD,
          grossProfit: grossProfit * UNIT_MULTIPLIERS.THOUSAND_TWD,
          operatingExpenses: operatingExpense * UNIT_MULTIPLIERS.THOUSAND_TWD,
          operatingIncome: operatingIncome * UNIT_MULTIPLIERS.THOUSAND_TWD,
          netIncome: netIncome * UNIT_MULTIPLIERS.THOUSAND_TWD,
        };

        results.push(unifiedData);
        const periodStr = quarter ? `${year}Q${quarter}` : `${year}`;
        console.log(`[Combine Income Statement] ✅ 組合第 ${i + 1} 筆: ${periodStr} - 營收: ${revenue.toLocaleString()}`);
      }
    }

    console.log(
      `[Combine Income Statement] ✅ 成功组合 ${results.length} 筆收益表数据`,
    );
  } catch (error) {
    console.error('[Combine Income Statement] ❌ 组合过程中发生错误:', error);
  }

  return results;
}

// 现金流数值提取函数
function extractCashFlowValuesSeparately(content: string | string[]): number[] {
  console.log('[Cash Flow Values] 💰 处理现金流直接选择器结果...');

  const contentArray = Array.isArray(content) ? content : [content];
  const values: number[] = [];

  for (const item of contentArray) {
    if (!item || typeof item !== 'string') continue;

    const cleanValue = item.replace(/[,\s]/g, '');
    const num = parseFloat(cleanValue);
    if (!isNaN(num)) {
      values.push(num);
    }
  }

  console.log(`[Cash Flow Values] ✅ 提取到 ${values.length} 个现金流数值`);

  return values;
}

// 现金流数据组合函数
function combineCashFlowData(
  content: any,
  context?: any,
): UnifiedFinancialData[] {
  console.log('[Combine Cash Flow] 🔗 开始组合现金流量表数据...');

  const results: UnifiedFinancialData[] = [];

  try {
    // 使用新的統一變數名稱
    const periodsArray = context?.fiscalPeriodsArray ||
      context?.variables?.fiscalPeriodsArray ||
      context?.variables?.cashFlowPeriods || [];
    const operatingCashFlowValues = context?.operatingCashFlowValues || context?.variables?.operatingCashFlowValues || [];
    const investingCashFlowValues = context?.investingCashFlowValues || context?.variables?.investingCashFlowValues || [];
    const financingCashFlowValues = context?.financingCashFlowValues || context?.variables?.financingCashFlowValues || [];
    const freeCashFlowValues = context?.freeCashFlowValues || context?.variables?.freeCashFlowValues || [];
    const netCashFlowValues = context?.netCashFlowValues || context?.variables?.netCashFlowValues || [];

    // 優先從 URL 提取 symbolCode 並清理為乾淨格式
    let symbolCode = '0000';
    if (context?.url) {
      const urlMatch = context.url.match(/\/quote\/([^\/]+)\//);
      if (urlMatch) {
        // 清理 symbolCode: 移除 .TW 或 .TWO 後綴
        symbolCode = urlMatch[1].replace(/\.TW[O]?$/, '');
        console.log(`[Combine Cash Flow] 從 URL 提取並清理 symbolCode: ${urlMatch[1]} -> ${symbolCode}`);
      }
    }
    if (symbolCode === '0000') {
      symbolCode = context?.symbolCode ||
        context?.variables?.symbolCode ||
        context?.variables?.stockSymbol ||
        '0000';
    }

    console.log(`[Combine Cash Flow] 📊 數據統計:`);
    console.log(`  期間: ${periodsArray.length} 個`);
    console.log(`  營業現金流: ${operatingCashFlowValues.length} 個`);
    console.log(`  投資現金流: ${investingCashFlowValues.length} 個`);
    console.log(`  融資現金流: ${financingCashFlowValues.length} 個`);

    // 生成现金流数据记录
    if (symbolCode && symbolCode !== '0000' && periodsArray.length > 0) {
      const minLength = Math.min(
        periodsArray.length,
        operatingCashFlowValues.length,
        investingCashFlowValues.length,
        financingCashFlowValues.length,
      );

      for (let i = 0; i < minLength; i++) {
        const periodData = periodsArray[i];
        const operatingCF = operatingCashFlowValues[i] || 0;
        const investingCF = investingCashFlowValues[i] || 0;
        const financingCF = financingCashFlowValues[i] || 0;
        const freeCF = freeCashFlowValues[i] || 0;
        const netCF = netCashFlowValues[i] || 0;

        if (periodData && periodData.year) {
          const year = periodData.year;
          const quarter = periodData.quarter;
          const month = periodData.month;

          // 生成正确的报告日期
          const quarterEndMonth = quarter ? quarter * 3 : 12;
          const lastDayOfQuarter = new Date(year, quarterEndMonth, 0).getDate();
          const reportDate = `${year}-${quarterEndMonth.toString().padStart(2, '0')}-${lastDayOfQuarter.toString().padStart(2, '0')}`;

          const unifiedData: UnifiedFinancialData = {
            symbolCode: symbolCode,
            exchangeArea: 'TPE' as MarketRegion,
            reportDate: reportDate,
            fiscalYear: year,
            fiscalMonth: quarter ? quarter * 3 : 12,
            reportType: quarter ? FiscalReportType.QUARTERLY : FiscalReportType.ANNUAL,
            dataSource: 'yahoo-finance-tw',
            lastUpdated: new Date().toISOString(),
            // 現金流數據 - Yahoo Finance TW 數據單位為仟元，需要乘以 1000
            operatingCashFlow: operatingCF * UNIT_MULTIPLIERS.THOUSAND_TWD,
            investingCashFlow: investingCF * UNIT_MULTIPLIERS.THOUSAND_TWD,
            financingCashFlow: financingCF * UNIT_MULTIPLIERS.THOUSAND_TWD,
            freeCashFlow: freeCF * UNIT_MULTIPLIERS.THOUSAND_TWD,
            netCashFlow: netCF * UNIT_MULTIPLIERS.THOUSAND_TWD,
          };

          results.push(unifiedData);
          console.log(`[Combine Cash Flow] ✅ 組合第 ${i + 1} 筆: ${reportDate}`);
        }
      }

      console.log(
        `[Combine Cash Flow] ✅ 成功组合 ${results.length} 筆现金流数据`,
      );
    }
  } catch (error) {
    console.error('[Combine Cash Flow] ❌ 组合过程中发生错误:', error);
  }

  return results;
}

// 资产负债表数据组合函数
function combineBalanceSheetData(
  content: any,
  context?: any,
): UnifiedFinancialData[] {
  console.log('[Combine Balance Sheet] 🔗 开始组合资产负债表数据...');

  const results: UnifiedFinancialData[] = [];

  try {
    // 使用新的統一變數名稱
    const periodsArray = context?.fiscalPeriodsArray ||
      context?.variables?.fiscalPeriodsArray ||
      context?.variables?.balanceSheetPeriods || [];
    const totalAssetsValues = context?.totalAssetsValues || context?.variables?.totalAssetsValues || [];
    const totalLiabilitiesValues = context?.totalLiabilitiesValues || context?.variables?.totalLiabilitiesValues || [];
    const shareholdersEquityValues = context?.shareholdersEquityValues || context?.variables?.shareholdersEquityValues || [];
    const currentAssetsValues = context?.currentAssetsValues || context?.variables?.currentAssetsValues || [];
    const currentLiabilitiesValues = context?.currentLiabilitiesValues || context?.variables?.currentLiabilitiesValues || [];

    // 優先從 URL 提取 symbolCode 並清理為乾淨格式
    let symbolCode = '0000';
    if (context?.url) {
      const urlMatch = context.url.match(/\/quote\/([^\/]+)\//);
      if (urlMatch) {
        // 清理 symbolCode: 移除 .TW 或 .TWO 後綴
        symbolCode = urlMatch[1].replace(/\.TW[O]?$/, '');
        console.log(`[Combine Balance Sheet] 從 URL 提取並清理 symbolCode: ${urlMatch[1]} -> ${symbolCode}`);
      }
    }
    if (symbolCode === '0000') {
      symbolCode = context?.symbolCode ||
        context?.variables?.symbolCode ||
        context?.variables?.stockSymbol ||
        '0000';
    }

    console.log(`[Combine Balance Sheet] 📊 數據統計:`);
    console.log(`  期間: ${periodsArray.length} 個`);
    console.log(`  總資產: ${totalAssetsValues.length} 個`);
    console.log(`  總負債: ${totalLiabilitiesValues.length} 個`);
    console.log(`  股東權益: ${shareholdersEquityValues.length} 個`);

    if (symbolCode && symbolCode !== '0000' && periodsArray.length > 0) {
      const minLength = Math.min(
        periodsArray.length,
        totalAssetsValues.length,
        totalLiabilitiesValues.length,
        shareholdersEquityValues.length,
      );

      for (let i = 0; i < minLength; i++) {
        const periodData = periodsArray[i];
        const totalAssets = totalAssetsValues[i] || 0;
        const totalLiabilities = totalLiabilitiesValues[i] || 0;
        const shareholdersEquity = shareholdersEquityValues[i] || 0;
        const currentAssets = currentAssetsValues[i] || 0;
        const currentLiabilities = currentLiabilitiesValues[i] || 0;

        if (periodData && periodData.year) {
          const year = periodData.year;
          const quarter = periodData.quarter;
          const month = periodData.month;

          // 生成正确的报告日期
          const quarterEndMonth = quarter ? quarter * 3 : 12;
          const lastDayOfQuarter = new Date(year, quarterEndMonth, 0).getDate();
          const reportDate = `${year}-${quarterEndMonth.toString().padStart(2, '0')}-${lastDayOfQuarter.toString().padStart(2, '0')}`;

          const unifiedData: UnifiedFinancialData = {
            symbolCode: symbolCode,
            exchangeArea: 'TPE' as MarketRegion,
            reportDate: reportDate,
            fiscalYear: year,
            fiscalMonth: quarter ? quarter * 3 : 12,
            reportType: quarter ? FiscalReportType.QUARTERLY : FiscalReportType.ANNUAL,
            dataSource: 'yahoo-finance-tw',
            lastUpdated: new Date().toISOString(),
            // 資產負債表數據 - Yahoo Finance TW 數據單位為仟元，需要乘以 1000
            totalAssets: totalAssets * UNIT_MULTIPLIERS.THOUSAND_TWD,
            totalLiabilities: totalLiabilities * UNIT_MULTIPLIERS.THOUSAND_TWD,
            shareholdersEquity: shareholdersEquity * UNIT_MULTIPLIERS.THOUSAND_TWD,
            currentAssets: currentAssets * UNIT_MULTIPLIERS.THOUSAND_TWD,
            currentLiabilities: currentLiabilities * UNIT_MULTIPLIERS.THOUSAND_TWD,
          };

          results.push(unifiedData);
          console.log(`[Combine Balance Sheet] ✅ 組合第 ${i + 1} 筆: ${reportDate}`);
        }
      }

      console.log(
        `[Combine Balance Sheet] ✅ 成功转换 ${results.length} 筆资产负债表数据`,
      );
    }
  } catch (error) {
    console.error('[Combine Balance Sheet] ❌ 转换过程中发生错误:', error);
  }

  console.log(
    `[Combine Balance Sheet] 🎯 成功转换 ${results.length} 筆资产负债表数据`,
  );
  return results;
}

// 表格方向检测函数
function detectTableOrientation(data: string[]): 'horizontal' | 'vertical' {
  if (data.length < 10) return 'horizontal';

  // 检查期间数据的分布模式
  const periodCount = data.filter((item) =>
    /20\d{2}[\/\-Q]/.test(item?.toString() || ''),
  ).length;

  // 如果期间数据较多且连续，可能是垂直布局
  return periodCount > data.length * 0.3 ? 'vertical' : 'horizontal';
}

// 财务数值解析函数
function parseFinancialValue(value: string): number {
  if (!value || typeof value !== 'string') return 0;

  // 移除非数字字符，保留负号、逗号和小数点
  const cleanValue = value.replace(/[^\d.,-]/g, '');

  const parsed = parseFloat(cleanValue.replace(/,/g, ''));
  return isNaN(parsed) ? 0 : parsed;
}

// 统一财政期间解析函数
function parseUnifiedFiscalPeriod(value: string): {
  year: number;
  quarter?: number;
  month?: number;
} {
  if (!value || typeof value !== 'string') {
    return { year: new Date().getFullYear() };
  }

  // 解析年份
  const yearMatch = value.match(/(\d{4})/);
  const year = yearMatch ? parseInt(yearMatch[1]) : new Date().getFullYear();

  // 解析季度
  const quarterMatch = value.match(/Q(\d)/);
  const quarter = quarterMatch ? parseInt(quarterMatch[1]) : undefined;

  // 解析月份
  const monthMatch = value.match(/\/(\d{1,2})/);
  const month = monthMatch ? parseInt(monthMatch[1]) : undefined;

  return { year, quarter, month };
}

/**
 * 統一的台灣財務期間陣列解析函數
 * 與 JP/US 保持一致的架構
 */
function parseTWFinancialPeriodsArray(content: string | string[]): Array<{
  year: number;
  quarter?: number;
  month?: number;
  originalPeriod?: string;
}> {
  console.log('[TW Periods Array] 📅 處理台灣期間陣列...');
  const contentArray = Array.isArray(content) ? content : [content];
  const periods: Array<{ year: number; quarter?: number; month?: number; originalPeriod?: string }> = [];

  for (const item of contentArray) {
    if (!item || typeof item !== 'string') continue;

    const cleanText = item.trim();

    // 處理不同格式的期間
    // 格式1: "2024H2" - 半年度格式
    const halfYearMatch = cleanText.match(/(\d{4})\s*H([1-2])/);
    if (halfYearMatch) {
      const year = parseInt(halfYearMatch[1]);
      const half = parseInt(halfYearMatch[2]);
      const quarter = half === 1 ? 2 : 4; // H1 = Q2 (上半年結束), H2 = Q4 (下半年結束)
      const month = quarter * 3; // Q2=6, Q4=12

      periods.push({
        year,
        quarter,
        month,
        originalPeriod: cleanText,
      });
      console.log(`[TW Periods] 半年度格式: ${cleanText} -> ${year}Q${quarter}`);
      continue;
    }

    // 格式2: "2024Q3" - 季度格式
    const quarterMatch = cleanText.match(/(\d{4})\s*Q(\d)/);
    if (quarterMatch) {
      periods.push({
        year: parseInt(quarterMatch[1]),
        quarter: parseInt(quarterMatch[2]),
        month: parseInt(quarterMatch[2]) * 3, // Q1=3, Q2=6, Q3=9, Q4=12
        originalPeriod: cleanText,
      });
      continue;
    }

    // 格式3: "2024/11" - 月份格式
    const monthMatch = cleanText.match(/(\d{4})[\/\-](\d{1,2})/);
    if (monthMatch) {
      periods.push({
        year: parseInt(monthMatch[1]),
        month: parseInt(monthMatch[2]),
        originalPeriod: cleanText,
      });
      continue;
    }

    // 格式4: "2024" - 年度格式
    const yearMatch = cleanText.match(/^(\d{4})$/);
    if (yearMatch) {
      periods.push({
        year: parseInt(yearMatch[1]),
        originalPeriod: cleanText,
      });
      continue;
    }
  }

  console.log(`[TW Periods Array] ✅ 成功處理 ${periods.length} 個期間`);
  return periods;
}

/**
 * 統一的台灣財務數值陣列解析函數
 * 與 JP/US 保持一致的架構
 */
function parseTWFinancialValuesArray(content: string | string[]): number[] {
  console.log('[TW Values Array] 💰 處理台灣財務數值陣列...');
  const contentArray = Array.isArray(content) ? content : [content];
  const values: number[] = [];

  for (const item of contentArray) {
    if (!item || typeof item !== 'string') {
      values.push(0);
      continue;
    }

    const cleanValue = item.trim()
      .replace(/[,\s]/g, '')  // 移除逗號和空格
      .replace(/[（()]/g, ''); // 移除括號

    // 處理 "-" 或空值
    if (cleanValue === '-' || cleanValue === '－' || cleanValue === '') {
      values.push(0);
      continue;
    }

    // 處理負數（括號表示）
    const isNegative = item.includes('(') || item.includes('（');

    const num = parseFloat(cleanValue);
    if (!isNaN(num)) {
      values.push(isNegative ? -Math.abs(num) : num);
    } else {
      values.push(0);
    }
  }

  console.log(`[TW Values Array] ✅ 成功處理 ${values.length} 個數值: [${values.slice(0, 3).join(', ')}...]`);
  return values;
}

/**
 * === 歷史股價數據轉換函數實現 (TWSE API) ===
 */

/**
 * 解析台灣股票資訊 (從 TWSE API JSON 回應)
 */
function parseTWStockInfo(content: string | string[]): string {
  console.log('[TW Stock Info] 📈 解析台灣股票資訊...');
  
  try {
    const contentStr = Array.isArray(content) ? content[0] : content;
    if (!contentStr) return '';

    // 嘗試解析 JSON
    const jsonData = JSON.parse(contentStr);
    
    // TWSE API 回應格式: { "stat": "OK", "date": "20250815", "title": "XXX股份有限公司" }
    if (jsonData.title) {
      console.log(`[TW Stock Info] ✅ 解析到股票資訊: ${jsonData.title}`);
      return jsonData.title;
    }
    
    return jsonData.stat === 'OK' ? 'TWSE Stock Data' : '';
  } catch (error) {
    console.error('[TW Stock Info] ❌ JSON 解析失敗:', error);
    return '';
  }
}

/**
 * 解析台灣歷史價格日期陣列 (從 TWSE API JSON 回應)
 */
function parseTWDateArray(content: string | string[]): string[] {
  console.log('[TW Date Array] 📅 解析台灣歷史價格日期...');
  
  try {
    const contentStr = Array.isArray(content) ? content[0] : content;
    if (!contentStr) return [];

    const jsonData = JSON.parse(contentStr);
    const dates: string[] = [];
    
    // TWSE API 回應格式: { "data": [["114/08/01", "價格數據..."], ["114/08/02", "價格數據..."]] }
    if (jsonData.data && Array.isArray(jsonData.data)) {
      for (const row of jsonData.data) {
        if (Array.isArray(row) && row.length > 0) {
          const rocDate = row[0]; // ROC 年格式: 114/08/01
          const standardDate = convertROCToStandardDate(rocDate);
          if (standardDate) {
            dates.push(standardDate);
          }
        }
      }
    }
    
    console.log(`[TW Date Array] ✅ 解析到 ${dates.length} 個日期`);
    return dates;
  } catch (error) {
    console.error('[TW Date Array] ❌ JSON 解析失敗:', error);
    return [];
  }
}

/**
 * 解析台灣歷史開盤價陣列
 */
function parseTWOpenPriceArray(content: string | string[]): number[] {
  return parseTWPriceColumnArray(content, 3, 'Open Price');
}

/**
 * 解析台灣歷史最高價陣列  
 */
function parseTWHighPriceArray(content: string | string[]): number[] {
  return parseTWPriceColumnArray(content, 4, 'High Price');
}

/**
 * 解析台灣歷史最低價陣列
 */
function parseTWLowPriceArray(content: string | string[]): number[] {
  return parseTWPriceColumnArray(content, 5, 'Low Price');
}

/**
 * 解析台灣歷史收盤價陣列
 */
function parseTWClosePriceArray(content: string | string[]): number[] {
  return parseTWPriceColumnArray(content, 6, 'Close Price');
}

/**
 * 解析台灣歷史成交量陣列
 */
function parseTWVolumeArray(content: string | string[]): number[] {
  return parseTWPriceColumnArray(content, 1, 'Volume');
}

/**
 * 通用的台灣價格欄位解析函數
 */
function parseTWPriceColumnArray(content: string | string[], columnIndex: number, fieldName: string): number[] {
  console.log(`[TW ${fieldName} Array] 💰 解析台灣歷史${fieldName}...`);
  
  try {
    const contentStr = Array.isArray(content) ? content[0] : content;
    if (!contentStr) return [];

    const jsonData = JSON.parse(contentStr);
    const values: number[] = [];
    
    // TWSE API 回應格式: { "data": [["114/08/01", "成交股數", "成交金額", "開盤價", "最高價", "最低價", "收盤價", "漲跌價差"]] }
    if (jsonData.data && Array.isArray(jsonData.data)) {
      for (const row of jsonData.data) {
        if (Array.isArray(row) && row.length > columnIndex) {
          const valueStr = row[columnIndex];
          
          // 處理台灣數據格式 (移除逗號，處理 "--" 等)
          if (valueStr === '--' || valueStr === '-' || valueStr === '') {
            values.push(0);
          } else {
            const cleanValue = valueStr.toString().replace(/,/g, '');
            const numValue = parseFloat(cleanValue);
            values.push(isNaN(numValue) ? 0 : numValue);
          }
        }
      }
    }
    
    console.log(`[TW ${fieldName} Array] ✅ 解析到 ${values.length} 個${fieldName}數值`);
    return values;
  } catch (error) {
    console.error(`[TW ${fieldName} Array] ❌ JSON 解析失敗:`, error);
    return [];
  }
}

/**
 * 組合台灣歷史股價數據
 */
function combineTWHistoricalData(content: any, context?: any): HistoricalStockPrice[] {
  console.log('[Combine TW Historical] 🔗 開始組合台灣歷史股價數據...');
  
  const results: HistoricalStockPrice[] = [];
  
  try {
    // 從 context.variables 獲取各項數據
    const dates = context?.historicalDates || context?.variables?.historicalDates || [];
    const openPrices = context?.openPrices || context?.variables?.openPrices || [];
    const highPrices = context?.highPrices || context?.variables?.highPrices || [];
    const lowPrices = context?.lowPrices || context?.variables?.lowPrices || [];
    const closePrices = context?.closePrices || context?.variables?.closePrices || [];
    const volumes = context?.volumes || context?.variables?.volumes || [];
    
    // 優先從 URL 提取 symbolCode
    let symbolCode = '1560'; // 預設值
    if (context?.url) {
      const urlMatch = context.url.match(/stockNo=([^&]+)/);
      if (urlMatch) {
        symbolCode = urlMatch[1];
        console.log(`[Combine TW Historical] 從 URL 提取 symbolCode: ${symbolCode}`);
      }
    }
    if (!symbolCode || symbolCode === '1560') {
      symbolCode = context?.symbolCode || 
        context?.variables?.symbolCode || 
        context?.variables?.stockSymbol || 
        '1560';
    }
    
    console.log(`[Combine TW Historical] 📊 數據統計:`);
    console.log(`  日期: ${dates.length} 個`);
    console.log(`  開盤價: ${openPrices.length} 個`);
    console.log(`  最高價: ${highPrices.length} 個`);
    console.log(`  最低價: ${lowPrices.length} 個`);
    console.log(`  收盤價: ${closePrices.length} 個`);
    console.log(`  成交量: ${volumes.length} 個`);
    
    // 確保所有陣列長度一致
    const minLength = Math.min(
      dates.length,
      openPrices.length,
      highPrices.length,
      lowPrices.length,
      closePrices.length,
      volumes.length
    );
    
    for (let i = 0; i < minLength; i++) {
      const historicalData: HistoricalStockPrice = {
        date: dates[i],
        open: openPrices[i],
        high: highPrices[i],
        low: lowPrices[i],
        close: closePrices[i],
        volume: volumes[i],
        adjustedClose: closePrices[i], // TWSE 通常提供調整後收盤價
        symbolCode: symbolCode
      };
      
      results.push(historicalData);
    }
    
    console.log(`[Combine TW Historical] ✅ 成功組合 ${results.length} 筆台灣歷史股價數據`);
  } catch (error) {
    console.error('[Combine TW Historical] ❌ 組合過程中發生錯誤:', error);
  }
  
  return results;
}

/**
 * 將 ROC (民國) 年格式轉換為標準日期格式
 * 例如: "114/08/01" -> "2025-08-01"
 */
function convertROCToStandardDate(rocDate: string): string | null {
  try {
    const match = rocDate.match(/^(\d+)\/(\d+)\/(\d+)$/);
    if (!match) return null;
    
    const rocYear = parseInt(match[1]);
    const month = match[2].padStart(2, '0');
    const day = match[3].padStart(2, '0');
    
    // ROC 年份 + 1911 = 西元年份
    const adYear = rocYear + 1911;
    
    return `${adYear}-${month}-${day}`;
  } catch (error) {
    console.error(`[ROC Date Convert] ❌ 轉換失敗: ${rocDate}`, error);
    return null;
  }
}


/**
 * 导出对象 - 只包含实际使用的20个函数
 */
export const yahooFinanceTWTransforms: YahooFinanceTWTransforms = {
  // === 实际使用的20个函数 ===
  cleanStockSymbol,
  extractRevenuePeriodsSeparately,
  extractRevenueValuesSeparately,
  combineSimpleRevenueData,
  extractDividendPeriodsSeparately,
  extractCashDividendsSeparately,
  extractStockDividendsSeparately,
  combineSimpleDividendData,
  extractEPSPeriodsSeparately,
  extractEPSValuesSeparately,
  combineSimpleEPSData,
  extractIncomeStatementPeriodsSeparately,
  extractIncomeStatementValuesSeparately,
  combineIncomeStatementData,
  extractCashFlowValuesSeparately,
  combineCashFlowData,
  combineBalanceSheetData,
  // === 工具函数 ===
  detectTableOrientation,
  parseFinancialValue,
  parseUnifiedFiscalPeriod,
  // === 新增：統一的陣列轉換函數 ===
  parseTWFinancialPeriodsArray,
  parseTWFinancialValuesArray,
  // === 歷史股價數據轉換函數 (TWSE API) ===
  parseTWStockInfo,
  parseTWDateArray,
  parseTWOpenPriceArray,
  parseTWHighPriceArray,
  parseTWLowPriceArray,
  parseTWClosePriceArray,
  parseTWVolumeArray,
  combineTWHistoricalData,
};

export default yahooFinanceTWTransforms;
