/**
 * Yahoo Finance Taiwan 网站特定的转换函数 (清理后版本)
 * 只包含配置文件中实际使用的20个函数
 */

import { StandardizedFundamentalData } from '../../types/standardized.js';
import {
  UnifiedFinancialData,
  TableOrientation,
} from '../../types/unified-financial-data';
import { MarketRegion } from '../../common/shared-types/interfaces/market-data.interface';
import { FiscalReportType } from '../../common/shared-types/interfaces/fundamental-data.interface';

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
    context?: any
  ) => UnifiedFinancialData[];

  // 股利数据处理 (实际使用)
  extractDividendPeriodsSeparately: (content: string | string[]) => string[];
  extractCashDividendsSeparately: (content: string | string[]) => number[];
  extractStockDividendsSeparately: (content: string | string[]) => number[];
  combineSimpleDividendData: (
    content: any,
    context?: any
  ) => UnifiedFinancialData[];

  // EPS 数据处理 (实际使用)
  extractEPSPeriodsSeparately: (content: string | string[]) => string[];
  extractEPSValuesSeparately: (content: string | string[]) => number[];
  combineSimpleEPSData: (content: any, context?: any) => UnifiedFinancialData[];

  // 损益表数据处理 (实际使用)
  extractIncomeStatementPeriodsSeparately: (
    content: string | string[]
  ) => string[];
  extractIncomeStatementValuesSeparately: (
    content: string | string[]
  ) => number[];
  combineIncomeStatementData: (
    content: any,
    context?: any
  ) => UnifiedFinancialData[];

  // 现金流数据处理 (实际使用)
  extractCashFlowValuesSeparately: (content: string | string[]) => number[];
  combineCashFlowData: (content: any, context?: any) => UnifiedFinancialData[];

  // 资产负债表数据处理 (实际使用)
  combineBalanceSheetData: (
    content: any,
    context?: any
  ) => UnifiedFinancialData[];

  // === 核心工具函数 (被上述函数内部调用) ===
  detectTableOrientation: (data: string[]) => TableOrientation;
  parseFinancialValue: (value: string) => number;
  parseUnifiedFiscalPeriod: (value: string) => {
    year: number;
    quarter?: number;
    month?: number;
  };
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

  // 提取股票代码 (格式: 1101.TW 或 2330.TWO)
  const stockCodeMatch = cleaned.match(/(\d{4})\.TW[O]?/);
  if (stockCodeMatch) {
    return stockCodeMatch[0];
  }

  // 如果没有找到标准格式，尝试提取数字部分
  const numberMatch = cleaned.match(/\d{4}/);
  if (numberMatch) {
    return numberMatch[0] + '.TW';
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
    `[Separate Revenue Periods] ✅ 提取到 ${periods.length} 个期间: ${periods.slice(0, 5).join(', ')}${periods.length > 5 ? '...' : ''}`
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
    `[Separate Revenue Values] ✅ 提取到 ${values.length} 个数值: ${values.slice(0, 5).join(', ')}${values.length > 5 ? '...' : ''}`
  );

  return values;
}

// 营收数据组合函数 (优化版 - 只处理 revenue 相关数据)
function combineSimpleRevenueData(
  content: any,
  context?: any
): UnifiedFinancialData[] {
  console.log('[Combine Simple Revenue] 🔗 开始组合简化营收数据...');

  const results: UnifiedFinancialData[] = [];

  try {
    // 从上下文获取提取的数据
    const periods = context?.variables?.revenuePeriods || [];
    const values = context?.variables?.revenueValues || [];

    // 获取股票代码 - 支援 stockSymbol 或 symbolCode
    const symbolCode =
      context?.variables?.stockSymbol ||
      context?.variables?.symbolCode ||
      '0000';

    console.log(
      `[Combine Simple Revenue] 数据概览: ${periods.length} 个期间, ${values.length} 个数值`
    );

    // 组合数据
    const minLength = Math.min(periods.length, values.length);
    for (let i = 0; i < minLength; i++) {
      const period = periods[i];
      const revenue = values[i];

      if (period && revenue !== undefined && revenue !== null) {
        // 解析期间信息
        const { year, month } = parseUnifiedFiscalPeriod(period);

        // 生成正确的报告日期 (月底日期)
        const actualMonth = month || 12; // 默认为12月
        const lastDayOfMonth = new Date(year, actualMonth, 0).getDate();
        const reportDate = `${year}-${actualMonth.toString().padStart(2, '0')}-${lastDayOfMonth.toString().padStart(2, '0')}`;

        const unifiedData: UnifiedFinancialData = {
          symbolCode: symbolCode,
          exchangeArea: MarketRegion.TPE,
          reportDate: reportDate,
          fiscalYear: year,
          fiscalMonth: actualMonth, // 營收數據必須包含月份信息
          reportType: FiscalReportType.MONTHLY,
          dataSource: 'yahoo-finance-tw',
          lastUpdated: new Date().toISOString(),
          currencyCode: 'TWD',
          revenue: revenue,
          // 營收數據專用：只處理 revenue 和 fiscalMonth，不包含 fiscalQuarter
        };

        results.push(unifiedData);
      }
    }

    console.log(
      `[Combine Simple Revenue] ✅ 成功组合 ${results.length} 筆營收数据`
    );
  } catch (error) {
    console.error('[Combine Simple Revenue] ❌ 组合过程中发生错误:', error);
  }

  return results;
}

// 股利期间提取函数
function extractDividendPeriodsSeparately(
  content: string | string[]
): string[] {
  console.log('[Extract Dividend Periods] 🔍 开始提取股利所属期间...');

  const contentArray = Array.isArray(content) ? content : [content];
  const periods: string[] = [];

  for (const item of contentArray) {
    if (!item || typeof item !== 'string') continue;

    // 匹配年度格式
    const matches = item.match(/(\d{4})/g);
    if (matches) {
      periods.push(...matches);
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
    if (!item || typeof item !== 'string') continue;

    const cleanValue = item.replace(/[,\s]/g, '');
    const num = parseFloat(cleanValue);
    if (!isNaN(num) && num >= 0) {
      dividends.push(num);
    }
  }

  console.log(
    `[Extract Cash Dividends] ✅ 提取到 ${dividends.length} 个现金股利数值`
  );

  return dividends;
}

// 股票股利提取函数
function extractStockDividendsSeparately(content: string | string[]): number[] {
  console.log('[Extract Stock Dividends] 📈 开始提取股票股利数值...');

  const contentArray = Array.isArray(content) ? content : [content];
  const dividends: number[] = [];

  for (const item of contentArray) {
    if (!item || typeof item !== 'string') continue;

    const cleanValue = item.replace(/[,\s]/g, '');
    const num = parseFloat(cleanValue);
    if (!isNaN(num) && num >= 0) {
      dividends.push(num);
    }
  }

  console.log(
    `[Extract Stock Dividends] ✅ 提取到 ${dividends.length} 个股票股利数值`
  );

  return dividends;
}

// 股利数据组合函数
function combineSimpleDividendData(
  content: any,
  context?: any
): UnifiedFinancialData[] {
  console.log('[Combine Dividend] 🔗 开始组合股利数据...');

  const results: UnifiedFinancialData[] = [];

  try {
    const periods = context?.variables?.dividendPeriods || [];
    const cashDividends = context?.variables?.cashDividends || [];
    const stockDividends = context?.variables?.stockDividends || [];
    const symbolCode =
      context?.variables?.stockSymbol ||
      context?.variables?.symbolCode ||
      '0000';

    const minLength = Math.min(
      periods.length,
      Math.max(cashDividends.length, stockDividends.length)
    );

    for (let i = 0; i < minLength; i++) {
      const period = periods[i];
      const cashDividend = cashDividends[i] || 0;
      const stockDividend = stockDividends[i] || 0;

      if (period) {
        const year = parseInt(period);
        const reportDate = `${year}-12-31`;

        const unifiedData: UnifiedFinancialData = {
          symbolCode: symbolCode,
          exchangeArea: MarketRegion.TPE,
          reportDate: reportDate,
          fiscalYear: year,
          reportType: FiscalReportType.ANNUAL,
          dataSource: 'yahoo-finance-tw',
          lastUpdated: new Date().toISOString(),
          currencyCode: 'TWD',
          // 股利數據專用：只處理 cashDividend 和 stockDividend
          cashDividend: cashDividend,
          stockDividend: stockDividend,
        };

        results.push(unifiedData);
      }
    }

    console.log(`[Combine Dividend] ✅ 成功组合 ${results.length} 筆股利数据`);
  } catch (error) {
    console.error('[Combine Dividend] ❌ 组合过程中发生错误:', error);
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
  context?: any
): UnifiedFinancialData[] {
  console.log('[Combine EPS] 🔗 开始组合 EPS 数据...');

  const results: UnifiedFinancialData[] = [];

  try {
    const periods = context?.variables?.epsPeriods || [];
    const values = context?.variables?.epsValues || [];
    const symbolCode =
      context?.variables?.stockSymbol ||
      context?.variables?.symbolCode ||
      '0000';

    const minLength = Math.min(periods.length, values.length);

    for (let i = 0; i < minLength; i++) {
      const period = periods[i];
      const epsValue = values[i];

      if (!period || epsValue === null || epsValue === undefined) continue;

      const parsed = parseUnifiedFiscalPeriod(period);

      // 生成报告日期
      let reportDate: string;
      if (parsed.quarter) {
        // 季度数据 - 使用季度末日期
        const quarterEndMonth = parsed.quarter * 3;
        const lastDayOfQuarter = new Date(
          parsed.year,
          quarterEndMonth,
          0
        ).getDate();
        reportDate = `${parsed.year}-${quarterEndMonth.toString().padStart(2, '0')}-${lastDayOfQuarter.toString().padStart(2, '0')}`;
      } else {
        // 年度数据
        reportDate = `${parsed.year}-12-31`;
      }

      const unifiedData: UnifiedFinancialData = {
        symbolCode: symbolCode,
        exchangeArea: MarketRegion.TPE,
        reportDate: reportDate,
        fiscalYear: parsed.year,
        fiscalQuarter: parsed.quarter, // EPS 數據包含季度信息
        reportType: parsed.quarter ? FiscalReportType.QUARTERLY : FiscalReportType.ANNUAL,
        dataSource: 'yahoo-finance-tw',
        lastUpdated: new Date().toISOString(),
        currencyCode: 'TWD',
        eps: epsValue,
        // EPS 數據專用：只處理 eps 和 fiscalQuarter，移除不相關字段
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
  content: string | string[]
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
  content: string | string[]
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
  context?: any
): UnifiedFinancialData[] {
  console.log('[Combine Income Statement] 🔗 开始组合收益表数据...');

  const results: UnifiedFinancialData[] = [];

  try {
    const periods = context?.variables?.incomeStatementPeriods || [];
    const revenueValues = context?.variables?.incomeStatementValues || [];
    const symbolCode =
      context?.variables?.stockSymbol ||
      context?.variables?.symbolCode ||
      '0000';

    const minLength = Math.min(periods.length, revenueValues.length);

    for (let i = 0; i < minLength; i++) {
      const period = periods[i];
      const revenue = revenueValues[i];

      if (period && revenue !== undefined && revenue !== null) {
        const { year, quarter } = parseUnifiedFiscalPeriod(period);

        // 生成正确的报告日期 (季末日期)
        const quarterEndMonth = quarter ? quarter * 3 : 12;
        const lastDayOfQuarter = new Date(year, quarterEndMonth, 0).getDate();
        const reportDate = `${year}-${quarterEndMonth.toString().padStart(2, '0')}-${lastDayOfQuarter.toString().padStart(2, '0')}`;

        const unifiedData: UnifiedFinancialData = {
          symbolCode: symbolCode,
          exchangeArea: MarketRegion.TPE,
          reportDate: reportDate,
          fiscalYear: year,
          fiscalQuarter: quarter, // 收益表數據包含季度信息
          reportType: quarter ? FiscalReportType.QUARTERLY : FiscalReportType.ANNUAL,
          dataSource: 'yahoo-finance-tw',
          lastUpdated: new Date().toISOString(),
          currencyCode: 'TWD',
          revenue: revenue,
          // 收益表數據專用：只處理 revenue 和 fiscalQuarter，移除不相關字段
        };

        results.push(unifiedData);
      }
    }

    console.log(
      `[Combine Income Statement] ✅ 成功组合 ${results.length} 筆收益表数据`
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
  context?: any
): UnifiedFinancialData[] {
  console.log('[Combine Cash Flow] 🔗 开始组合现金流量表数据...');

  const results: UnifiedFinancialData[] = [];

  try {
    const symbolCode =
      context?.variables?.stockSymbol ||
      context?.variables?.symbolCode ||
      '0000';
    const cashFlowValues = context?.variables?.cashFlowValues || [];

    // 生成基本的现金流数据记录
    if (symbolCode && symbolCode !== '0000' && cashFlowValues.length > 0) {
      const currentYear = new Date().getFullYear();

      for (let i = 0; i < Math.min(cashFlowValues.length, 4); i++) {
        const unifiedData: UnifiedFinancialData = {
          symbolCode: symbolCode,
          exchangeArea: MarketRegion.TPE,
          reportDate: `${currentYear - i}-12-31`,
          fiscalYear: currentYear - i,
          reportType: FiscalReportType.ANNUAL,
          dataSource: 'yahoo-finance-tw',
          lastUpdated: new Date().toISOString(),
          currencyCode: 'TWD',
          // 現金流數據專用：只處理 operatingCashFlow
          operatingCashFlow: cashFlowValues[i] || 0,
        };

        results.push(unifiedData);
      }

      console.log(
        `[Combine Cash Flow] ✅ 成功组合 ${results.length} 筆现金流数据`
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
  context?: any
): UnifiedFinancialData[] {
  console.log('[Combine Balance Sheet] 🔗 开始组合资产负债表数据...');

  const results: UnifiedFinancialData[] = [];

  try {
    const symbolCode =
      context?.variables?.stockSymbol ||
      context?.variables?.symbolCode ||
      '0000';

    if (symbolCode && symbolCode !== '0000') {
      // 创建一笔基本的资产负债表数据记录
      const currentYear = new Date().getFullYear();
      const unifiedData: UnifiedFinancialData = {
        symbolCode: symbolCode,
        exchangeArea: MarketRegion.TPE,
        reportDate: `${currentYear}-12-31`,
        fiscalYear: currentYear,
        reportType: FiscalReportType.ANNUAL,
        dataSource: 'yahoo-finance-tw',
        lastUpdated: new Date().toISOString(),
        currencyCode: 'TWD',
        // 資產負債表數據專用：只處理資產負債表相關字段
        totalAssets: 0,
        totalLiabilities: 0,
        shareholdersEquity: 0,
      };

      results.push(unifiedData);
      console.log(
        `[Combine Balance Sheet] ✅ 转换: ${symbolCode} → 资产负债表数据`
      );
    }
  } catch (error) {
    console.error('[Combine Balance Sheet] ❌ 转换过程中发生错误:', error);
  }

  console.log(
    `[Combine Balance Sheet] 🎯 成功转换 ${results.length} 筆资产负债表数据`
  );
  return results;
}

// 表格方向检测函数
function detectTableOrientation(data: string[]): TableOrientation {
  if (data.length < 10) return 'horizontal';

  // 检查期间数据的分布模式
  const periodCount = data.filter((item) =>
    /20\d{2}[\/\-Q]/.test(item?.toString() || '')
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
 * 标准化转换函数 (被聚合器使用)
 */
export function toStandardizedFromCashFlow(
  data: UnifiedFinancialData[]
): StandardizedFundamentalData[] {
  return data.map((item) => ({
    symbolCode: item.symbolCode,
    exchangeArea: item.exchangeArea,
    fiscalYear: item.fiscalYear,
    reportDate: item.reportDate,
    reportType: item.reportType as FiscalReportType,
    dataSource: item.dataSource,
    lastUpdated: item.lastUpdated,
    operatingCashFlow: item.operatingCashFlow || 0,
  }));
}

export function toStandardizedFromIncomeStatement(
  data: UnifiedFinancialData[]
): StandardizedFundamentalData[] {
  return data.map((item) => ({
    symbolCode: item.symbolCode,
    exchangeArea: item.exchangeArea,
    fiscalYear: item.fiscalYear,
    reportDate: item.reportDate,
    reportType: item.reportType as FiscalReportType,
    dataSource: item.dataSource,
    lastUpdated: item.lastUpdated,
    revenue: item.revenue,
    grossProfit: item.grossProfit,
    operatingIncome: item.operatingIncome,
    netIncome: item.netIncome,
  }));
}

export function toStandardizedFromBalanceSheet(
  data: UnifiedFinancialData[]
): StandardizedFundamentalData[] {
  return data.map((item) => ({
    symbolCode: item.symbolCode,
    exchangeArea: item.exchangeArea,
    fiscalYear: item.fiscalYear,
    reportDate: item.reportDate,
    reportType: item.reportType as FiscalReportType,
    dataSource: item.dataSource,
    lastUpdated: item.lastUpdated,
    totalAssets: item.totalAssets,
    totalLiabilities: item.totalLiabilities,
    shareholdersEquity: item.shareholdersEquity,
  }));
}

export function toStandardizedFromEPS(
  data: UnifiedFinancialData[]
): StandardizedFundamentalData[] {
  return data.map((item) => ({
    symbolCode: item.symbolCode,
    exchangeArea: item.exchangeArea,
    fiscalYear: item.fiscalYear,
    reportDate: item.reportDate,
    reportType: item.reportType as FiscalReportType,
    dataSource: item.dataSource,
    lastUpdated: item.lastUpdated,
    eps: item.eps,
  }));
}

export function toStandardizedFromDividend(
  data: UnifiedFinancialData[]
): StandardizedFundamentalData[] {
  return data.map((item) => ({
    symbolCode: item.symbolCode,
    exchangeArea: item.exchangeArea,
    fiscalYear: item.fiscalYear,
    reportDate: item.reportDate,
    reportType: item.reportType as FiscalReportType,
    dataSource: item.dataSource,
    lastUpdated: item.lastUpdated,
    cashDividend: item.cashDividend,
    stockDividend: item.stockDividend,
  }));
}

export function toStandardizedFromRevenue(
  data: UnifiedFinancialData[]
): StandardizedFundamentalData[] {
  return data.map((item) => ({
    symbolCode: item.symbolCode,
    exchangeArea: item.exchangeArea,
    fiscalYear: item.fiscalYear,
    reportDate: item.reportDate,
    reportType: item.reportType as FiscalReportType,
    dataSource: item.dataSource,
    lastUpdated: item.lastUpdated,
    revenue: item.revenue,
  }));
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
};

export default yahooFinanceTWTransforms;

