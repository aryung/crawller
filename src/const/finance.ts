/**
 * Yahoo Finance Japan 財務數據相關常數定義
 */

// Yahoo Finance Japan Performance 頁面表格標題常數
export const YAHOO_FINANCE_JP_PERFORMANCE_HEADERS = {
  REVENUE: '売上高（百万円）',
  GROSS_PROFIT: '売上総利益（百万円）', 
  GROSS_MARGIN: '粗利率',
  OPERATING_PROFIT: '営業利益（百万円）',
  OPERATING_MARGIN: '営業利益率',
  ORDINARY_PROFIT: '経常利益（百万円）',
  ORDINARY_MARGIN: '経常利益率',
  NET_PROFIT: '純利益（百万円）',
  ACCOUNTING_METHOD: '会計方式',
  UPDATE_DATE: '財務数値更新日'
} as const;

// Yahoo Finance Japan Financials 頁面表格標題常數 (使用實際頁面的全形括弧)
export const YAHOO_FINANCE_JP_FINANCIALS_HEADERS = {
  EPS: 'EPS（円）',
  BPS: 'BPS（円）',
  ROA: 'ROA',
  ROE: 'ROE',
  TOTAL_ASSETS: '総資産（百万円）',
  EQUITY_RATIO: '自己資本比率',
  CAPITAL: '資本金（百万円）',
  DIVIDEND_YIELD: '有利子負債（百万円）',
  REDUCTION_AMOUNT: '減価償却費（百万円）',
  STOCK_COUNT: '発行済み株式総数（千株）'
} as const;

// Yahoo Finance Japan Cashflow 頁面表格標題常數 (根據截圖確認的順序)
export const YAHOO_FINANCE_JP_CASHFLOW_HEADERS = {
  FREE_CASH_FLOW: 'フリーCF（百万円）',
  OPERATING_CASH_FLOW: '営業CF（百万円）',
  INVESTING_CASH_FLOW: '投資CF（百万円）', 
  FINANCING_CASH_FLOW: '財務CF（百万円）'
} as const;

// 向後兼容的別名
export const YAHOO_FINANCE_JP_HEADERS = YAHOO_FINANCE_JP_PERFORMANCE_HEADERS;

// 財務單位常數
export const FINANCIAL_UNITS = {
  MILLION_YEN: '百万円',
  PERCENTAGE: '%',
  RATE: '率',
  DATE: '/',
  YEAR: '年',
  MONTH: '月'
} as const;

// 單位轉換倍數
export const UNIT_MULTIPLIERS = {
  MILLION_YEN: 1000000,    // 百万円 → 実際の円
  THOUSAND_TWD: 1000,      // 仟元 → 元 (台灣)
  PERCENTAGE: 0.01         // % → 小数 (例: 76.28% → 0.7628)
} as const;

// Performance 頁面表格標題陣列（按順序）
export const YAHOO_FINANCE_JP_PERFORMANCE_HEADER_ORDER = [
  YAHOO_FINANCE_JP_PERFORMANCE_HEADERS.REVENUE,
  YAHOO_FINANCE_JP_PERFORMANCE_HEADERS.GROSS_PROFIT,
  YAHOO_FINANCE_JP_PERFORMANCE_HEADERS.GROSS_MARGIN,
  YAHOO_FINANCE_JP_PERFORMANCE_HEADERS.OPERATING_PROFIT,
  YAHOO_FINANCE_JP_PERFORMANCE_HEADERS.OPERATING_MARGIN,
  YAHOO_FINANCE_JP_PERFORMANCE_HEADERS.ORDINARY_PROFIT,
  YAHOO_FINANCE_JP_PERFORMANCE_HEADERS.ORDINARY_MARGIN,
  YAHOO_FINANCE_JP_PERFORMANCE_HEADERS.NET_PROFIT,
  YAHOO_FINANCE_JP_PERFORMANCE_HEADERS.ACCOUNTING_METHOD,
  YAHOO_FINANCE_JP_PERFORMANCE_HEADERS.UPDATE_DATE
] as const;

// Financials 頁面表格標題陣列（按順序）
export const YAHOO_FINANCE_JP_FINANCIALS_HEADER_ORDER = [
  YAHOO_FINANCE_JP_FINANCIALS_HEADERS.EPS,
  YAHOO_FINANCE_JP_FINANCIALS_HEADERS.BPS,
  YAHOO_FINANCE_JP_FINANCIALS_HEADERS.ROA,
  YAHOO_FINANCE_JP_FINANCIALS_HEADERS.ROE,
  YAHOO_FINANCE_JP_FINANCIALS_HEADERS.TOTAL_ASSETS,
  YAHOO_FINANCE_JP_FINANCIALS_HEADERS.EQUITY_RATIO,
  YAHOO_FINANCE_JP_FINANCIALS_HEADERS.CAPITAL,
  YAHOO_FINANCE_JP_FINANCIALS_HEADERS.DIVIDEND_YIELD,
  YAHOO_FINANCE_JP_FINANCIALS_HEADERS.REDUCTION_AMOUNT,
  YAHOO_FINANCE_JP_FINANCIALS_HEADERS.STOCK_COUNT
] as const;

// Cashflow 頁面表格標題陣列（按順序）
export const YAHOO_FINANCE_JP_CASHFLOW_HEADER_ORDER = [
  YAHOO_FINANCE_JP_CASHFLOW_HEADERS.FREE_CASH_FLOW,
  YAHOO_FINANCE_JP_CASHFLOW_HEADERS.OPERATING_CASH_FLOW,
  YAHOO_FINANCE_JP_CASHFLOW_HEADERS.INVESTING_CASH_FLOW,
  YAHOO_FINANCE_JP_CASHFLOW_HEADERS.FINANCING_CASH_FLOW
] as const;

// Performance 欄位到表格標題的映射
export const PERFORMANCE_DATA_FIELD_MAPPING = {
  revenue: YAHOO_FINANCE_JP_PERFORMANCE_HEADERS.REVENUE,
  grossProfit: YAHOO_FINANCE_JP_PERFORMANCE_HEADERS.GROSS_PROFIT,
  grossMargin: YAHOO_FINANCE_JP_PERFORMANCE_HEADERS.GROSS_MARGIN,
  operatingProfit: YAHOO_FINANCE_JP_PERFORMANCE_HEADERS.OPERATING_PROFIT,
  operatingMargin: YAHOO_FINANCE_JP_PERFORMANCE_HEADERS.OPERATING_MARGIN,
  ordinaryProfit: YAHOO_FINANCE_JP_PERFORMANCE_HEADERS.ORDINARY_PROFIT,
  ordinaryMargin: YAHOO_FINANCE_JP_PERFORMANCE_HEADERS.ORDINARY_MARGIN,
  netProfit: YAHOO_FINANCE_JP_PERFORMANCE_HEADERS.NET_PROFIT,
  accountingMethod: YAHOO_FINANCE_JP_PERFORMANCE_HEADERS.ACCOUNTING_METHOD,
  updateDate: YAHOO_FINANCE_JP_PERFORMANCE_HEADERS.UPDATE_DATE
} as const;

// Financials 欄位到表格標題的映射
export const FINANCIALS_DATA_FIELD_MAPPING = {
  eps: YAHOO_FINANCE_JP_FINANCIALS_HEADERS.EPS,
  bps: YAHOO_FINANCE_JP_FINANCIALS_HEADERS.BPS,
  roa: YAHOO_FINANCE_JP_FINANCIALS_HEADERS.ROA,
  roe: YAHOO_FINANCE_JP_FINANCIALS_HEADERS.ROE,
  totalAssets: YAHOO_FINANCE_JP_FINANCIALS_HEADERS.TOTAL_ASSETS,
  equityRatio: YAHOO_FINANCE_JP_FINANCIALS_HEADERS.EQUITY_RATIO,
  capital: YAHOO_FINANCE_JP_FINANCIALS_HEADERS.CAPITAL,
  dividendYield: YAHOO_FINANCE_JP_FINANCIALS_HEADERS.DIVIDEND_YIELD,
  reductionAmount: YAHOO_FINANCE_JP_FINANCIALS_HEADERS.REDUCTION_AMOUNT,
  stockCount: YAHOO_FINANCE_JP_FINANCIALS_HEADERS.STOCK_COUNT
} as const;

// Cashflow 欄位到表格標題的映射
export const CASHFLOW_DATA_FIELD_MAPPING = {
  freeCashFlow: YAHOO_FINANCE_JP_CASHFLOW_HEADERS.FREE_CASH_FLOW,
  operatingCashFlow: YAHOO_FINANCE_JP_CASHFLOW_HEADERS.OPERATING_CASH_FLOW,
  investingCashFlow: YAHOO_FINANCE_JP_CASHFLOW_HEADERS.INVESTING_CASH_FLOW,
  financingCashFlow: YAHOO_FINANCE_JP_CASHFLOW_HEADERS.FINANCING_CASH_FLOW
} as const;

// 統一的欄位映射系統
export const FIELD_MAPPINGS = {
  performance: PERFORMANCE_DATA_FIELD_MAPPING,
  financials: FINANCIALS_DATA_FIELD_MAPPING,
  cashflow: CASHFLOW_DATA_FIELD_MAPPING
} as const;

// 向後兼容的別名
export const YAHOO_FINANCE_JP_HEADER_ORDER = YAHOO_FINANCE_JP_PERFORMANCE_HEADER_ORDER;

/**
 * 根據表格標題判斷數值轉換方式
 */
export function getUnitMultiplier(header: string): number {
  if (header.includes(FINANCIAL_UNITS.MILLION_YEN)) {
    return UNIT_MULTIPLIERS.MILLION_YEN;
  } else if (header.includes(FINANCIAL_UNITS.RATE) || header.includes(FINANCIAL_UNITS.PERCENTAGE)) {
    return UNIT_MULTIPLIERS.PERCENTAGE;
  }
  return 1; // 無需轉換
}

/**
 * 檢查標題是否為金額類型（百万円）
 */
export function isAmountHeader(header: string): boolean {
  return header.includes(FINANCIAL_UNITS.MILLION_YEN);
}

/**
 * 檢查標題是否為百分比類型（率或%）
 */
export function isPercentageHeader(header: string): boolean {
  return header.includes(FINANCIAL_UNITS.RATE) || header.includes(FINANCIAL_UNITS.PERCENTAGE);
}

/**
 * 檢查標題是否為日期類型
 */
export function isDateHeader(header: string): boolean {
  return header.includes(FINANCIAL_UNITS.DATE) || 
         header.includes(FINANCIAL_UNITS.YEAR) || 
         header.includes(FINANCIAL_UNITS.MONTH);
}

/**
 * 根據台灣財務單位判斷數值轉換方式
 */
export function getTWUnitMultiplier(unit: string): number {
  if (unit.includes(TW_FINANCIAL_UNITS.THOUSAND_TWD)) {
    return UNIT_MULTIPLIERS.THOUSAND_TWD;
  } else if (unit.includes(TW_FINANCIAL_UNITS.PERCENTAGE) || unit.includes(TW_FINANCIAL_UNITS.GROWTH_RATE)) {
    return UNIT_MULTIPLIERS.PERCENTAGE;
  }
  return 1; // 無需轉換
}

/**
 * 檢查是否為台灣仟元單位
 */
export function isTWThousandUnit(text: string): boolean {
  return text.includes(TW_FINANCIAL_UNITS.THOUSAND_TWD);
}

/**
 * 根據實際表格標題動態判斷數據類型
 */
export function detectDataTypeFromHeaders(headers: string[]): 'performance' | 'financials' | 'cashflow' {
  // 檢查是否包含 cashflow 特有的標題
  const cashflowKeywords = ['フリーCF（百万円）', '営業CF（百万円）', '投資CF（百万円）', '財務CF（百万円）', 'フリーCF', '営業CF', '投資CF', '財務CF'];
  const hasCashflowHeaders = headers.some(header => 
    cashflowKeywords.some(keyword => header.includes(keyword))
  );
  
  if (hasCashflowHeaders) {
    return 'cashflow';
  }
  
  // 檢查是否包含 financials 特有的標題 (支援全形和半形括弧)
  const financialsKeywords = ['EPS（円）', 'BPS（円）', 'EPS (円)', 'BPS (円)', 'EPS', 'BPS', 'ROA', 'ROE', '総資産', '自己資本比率'];
  const hasFinancialsHeaders = headers.some(header => 
    financialsKeywords.some(keyword => header.includes(keyword))
  );
  
  if (hasFinancialsHeaders) {
    return 'financials';
  }
  
  // 檢查是否包含 performance 特有的標題 (確保不會干擾原有功能)
  const performanceKeywords = ['売上高（百万円）', '営業利益（百万円）', '経常利益（百万円）', '純利益（百万円）', '売上高', '営業利益', '経常利益', '純利益'];
  const hasPerformanceHeaders = headers.some(header => 
    performanceKeywords.some(keyword => header.includes(keyword))
  );
  
  if (hasPerformanceHeaders) {
    return 'performance';
  }
  
  // 預設為 performance
  return 'performance';
}

/**
 * Yahoo Finance Taiwan 財務數據相關常數定義
 */

// Yahoo Finance Taiwan Dividend 頁面表格標題常數
export const YAHOO_FINANCE_TW_DIVIDEND_HEADERS = {
  CASH_DIVIDEND: '現金股利',
  STOCK_DIVIDEND: '股票股利', 
  CASH_YIELD: '現金殖利率',
  EX_DIVIDEND_DATE: '除息日',
  EX_RIGHTS_DATE: '除權日',
  PAYMENT_DATE: '股利發放日'
} as const;

// Yahoo Finance Taiwan Revenue 頁面表格標題常數
export const YAHOO_FINANCE_TW_REVENUE_HEADERS = {
  REVENUE: '營收',
  MONTHLY_REVENUE: '單月合併',
  MONTHLY_GROWTH: '月增率',
  YEAR_OVER_YEAR_GROWTH: '年增率',
  CUMULATIVE_REVENUE: '累計營收',
  CUMULATIVE_GROWTH: '累計年增率',
  UNIT: '仟元'
} as const;

// 台灣財務單位常數
export const TW_FINANCIAL_UNITS = {
  TWD: '元',           // 新台幣
  THOUSAND_TWD: '仟元', // 新台幣千元
  PERCENTAGE: '%',     // 百分比
  GROWTH_RATE: '增率', // 增長率
  DATE: '/',          // 日期分隔符
  YEAR: '年',         // 年度
  MONTH: '月',        // 月份
  DAY: '日'           // 日期
} as const;

// 台灣財務數據處理常數
export const TW_DATA_PROCESSING = {
  DEFAULT_DATE: '1900/01/01',    // 默認日期
  DATE_SEPARATOR: '/',           // 日期分隔符
  MONTH_DAY_DEFAULT: '01',       // 默認日和月
  SORT_ORDER: {
    DESC: 'desc',               // 降序 (最新在前)
    ASC: 'asc'                  // 升序 (最舊在前)
  }
} as const;

// 台灣營收數據處理常數 - 僅包含基本格式驗證
export const TW_REVENUE_DATA_CONSTANTS = {
  // 年份範圍 (基本合理性檢查)
  MIN_YEAR: 1990,                  // 最早年份 (台灣股市開始電子化交易)
  MAX_YEAR_OFFSET: 2,              // 相對於當前年份的最大偏移 (允許未來2年)
  
  // 月份範圍
  MIN_MONTH: 1,
  MAX_MONTH: 12,
  
  // 數值基本檢查
  MIN_REASONABLE_VALUE: 1,         // 最小合理數值 (避免0或負數)
  MAX_DIGITS: 15                   // 最大數字位數 (避免超大數字錯誤)
} as const;

// Dividend 欄位到表格標題的映射
export const TW_DIVIDEND_DATA_FIELD_MAPPING = {
  cashDividend: YAHOO_FINANCE_TW_DIVIDEND_HEADERS.CASH_DIVIDEND,
  stockDividend: YAHOO_FINANCE_TW_DIVIDEND_HEADERS.STOCK_DIVIDEND,
  cashYield: YAHOO_FINANCE_TW_DIVIDEND_HEADERS.CASH_YIELD,
  exDividendDate: YAHOO_FINANCE_TW_DIVIDEND_HEADERS.EX_DIVIDEND_DATE,
  exRightsDate: YAHOO_FINANCE_TW_DIVIDEND_HEADERS.EX_RIGHTS_DATE,
  paymentDate: YAHOO_FINANCE_TW_DIVIDEND_HEADERS.PAYMENT_DATE
} as const;

// Revenue 欄位到表格標題的映射
export const TW_REVENUE_DATA_FIELD_MAPPING = {
  revenue: YAHOO_FINANCE_TW_REVENUE_HEADERS.REVENUE,
  monthlyGrowth: YAHOO_FINANCE_TW_REVENUE_HEADERS.MONTHLY_GROWTH,
  yearOverYearGrowth: YAHOO_FINANCE_TW_REVENUE_HEADERS.YEAR_OVER_YEAR_GROWTH,
  cumulativeRevenue: YAHOO_FINANCE_TW_REVENUE_HEADERS.CUMULATIVE_REVENUE,
  cumulativeGrowth: YAHOO_FINANCE_TW_REVENUE_HEADERS.CUMULATIVE_GROWTH
} as const;

// Yahoo Finance US 財務數據相關常數定義
export const US_CASHFLOW_HEADERS = {
  operatingCashFlow: 'Operating Cash Flow',
  investingCashFlow: 'Investing Cash Flow',
  financingCashFlow: 'Financing Cash Flow',
  endCashPosition: 'End Cash Position',
  capitalExpenditure: 'Capital Expenditure',
  issuanceOfCapitalStock: 'Issuance of Capital Stock',
  issuanceOfDebt: 'Issuance of Debt',
  repaymentOfDebt: 'Repayment of Debt',
  repurchaseOfCapitalStock: 'Repurchase of Capital Stock',
  freeCashFlow: 'Free Cash Flow'
} as const;

export const US_FINANCIALS_HEADERS = {
  totalRevenue: 'Total Revenue',
  costOfRevenue: 'Cost of Revenue',
  grossProfit: 'Gross Profit',
  operatingExpense: 'Operating Expense',
  operatingIncome: 'Operating Income',
  interestExpense: 'Interest Expense',
  incomeBeforeTax: 'Income Before Tax',
  incomeTaxExpense: 'Income Tax Expense',
  netIncome: 'Net Income',
  basicEPS: 'Basic EPS',
  dilutedEPS: 'Diluted EPS'
} as const;

