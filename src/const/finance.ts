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

// 統一的欄位映射系統
export const FIELD_MAPPINGS = {
  performance: PERFORMANCE_DATA_FIELD_MAPPING,
  financials: FINANCIALS_DATA_FIELD_MAPPING
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
 * 根據實際表格標題動態判斷數據類型
 */
export function detectDataTypeFromHeaders(headers: string[]): 'performance' | 'financials' {
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
