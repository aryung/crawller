/**
 * Yahoo Finance Japan 財務數據相關常數定義
 */

// Yahoo Finance Japan 表格標題常數
export const YAHOO_FINANCE_JP_HEADERS = {
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

// 表格標題陣列（按順序）
export const YAHOO_FINANCE_JP_HEADER_ORDER = [
  YAHOO_FINANCE_JP_HEADERS.REVENUE,
  YAHOO_FINANCE_JP_HEADERS.GROSS_PROFIT,
  YAHOO_FINANCE_JP_HEADERS.GROSS_MARGIN,
  YAHOO_FINANCE_JP_HEADERS.OPERATING_PROFIT,
  YAHOO_FINANCE_JP_HEADERS.OPERATING_MARGIN,
  YAHOO_FINANCE_JP_HEADERS.ORDINARY_PROFIT,
  YAHOO_FINANCE_JP_HEADERS.ORDINARY_MARGIN,
  YAHOO_FINANCE_JP_HEADERS.NET_PROFIT,
  YAHOO_FINANCE_JP_HEADERS.ACCOUNTING_METHOD,
  YAHOO_FINANCE_JP_HEADERS.UPDATE_DATE
] as const;

// PerformanceData 欄位到表格標題的映射
export const PERFORMANCE_DATA_FIELD_MAPPING = {
  revenue: YAHOO_FINANCE_JP_HEADERS.REVENUE,
  grossProfit: YAHOO_FINANCE_JP_HEADERS.GROSS_PROFIT,
  grossMargin: YAHOO_FINANCE_JP_HEADERS.GROSS_MARGIN,
  operatingProfit: YAHOO_FINANCE_JP_HEADERS.OPERATING_PROFIT,
  operatingMargin: YAHOO_FINANCE_JP_HEADERS.OPERATING_MARGIN,
  ordinaryProfit: YAHOO_FINANCE_JP_HEADERS.ORDINARY_PROFIT,
  ordinaryMargin: YAHOO_FINANCE_JP_HEADERS.ORDINARY_MARGIN,
  netProfit: YAHOO_FINANCE_JP_HEADERS.NET_PROFIT,
  accountingMethod: YAHOO_FINANCE_JP_HEADERS.ACCOUNTING_METHOD,
  updateDate: YAHOO_FINANCE_JP_HEADERS.UPDATE_DATE
} as const;

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
