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
  THOUSAND_USD: 1000,      // 千美元 → 美元 (美國)
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

// Yahoo Finance Taiwan EPS 頁面表格標題常數
export const YAHOO_FINANCE_TW_EPS_HEADERS = {
  EPS: '每股盈餘',
  QUARTERLY_GROWTH: '季增率',
  YEAR_OVER_YEAR_GROWTH: '年增率',
  AVERAGE_PRICE: '季均價',
  PERIOD: '年度/季別'
} as const;

// Yahoo Finance Taiwan Income Statement 頁面表格標題常數
export const YAHOO_FINANCE_TW_INCOME_STATEMENT_HEADERS = {
  TOTAL_REVENUE: '營收',
  OPERATING_REVENUE: '營業收入',
  GROSS_PROFIT: '營業毛利',
  OPERATING_EXPENSES: '營業費用',
  OPERATING_INCOME: '營業利益',
  NON_OPERATING_INCOME: '營業外收入',
  NON_OPERATING_EXPENSES: '營業外費用',
  INCOME_BEFORE_TAX: '稅前淨利',
  INCOME_TAX: '所得稅',
  NET_INCOME: '稅後淨利',
  COMPREHENSIVE_INCOME: '綜合損益',
  BASIC_EPS: '基本每股盈餘',
  DILUTED_EPS: '稀釋每股盈餘',
  UNIT: '仟元'
} as const;

// Yahoo Finance Taiwan Balance Sheet 頁面表格標題常數
export const YAHOO_FINANCE_TW_BALANCE_SHEET_HEADERS = {
  TOTAL_ASSETS: '總資產',
  CURRENT_ASSETS: '流動資產',
  CASH_AND_EQUIVALENTS: '現金及約當現金',
  ACCOUNTS_RECEIVABLE: '應收帳款',
  INVENTORY: '存貨',
  NON_CURRENT_ASSETS: '非流動資產',
  PROPERTY_PLANT_EQUIPMENT: '不動產廠房及設備',
  INTANGIBLE_ASSETS: '無形資產',
  TOTAL_LIABILITIES: '總負債',
  CURRENT_LIABILITIES: '流動負債',
  ACCOUNTS_PAYABLE: '應付帳款',
  SHORT_TERM_DEBT: '短期借款',
  NON_CURRENT_LIABILITIES: '非流動負債',
  LONG_TERM_DEBT: '長期借款',
  TOTAL_EQUITY: '總權益',
  STOCKHOLDERS_EQUITY: '股東權益',
  RETAINED_EARNINGS: '保留盈餘',
  BOOK_VALUE_PER_SHARE: '每股淨值',
  UNIT: '仟元'
} as const;

// Yahoo Finance Taiwan Cash Flow Statement 頁面表格標題常數
export const YAHOO_FINANCE_TW_CASH_FLOW_HEADERS = {
  OPERATING_CASH_FLOW: '營業現金流',
  NET_INCOME_OPERATING: '來自營業活動現金流',
  INVESTING_CASH_FLOW: '投資現金流',
  CAPITAL_EXPENDITURE: '資本支出',
  INVESTMENT_ACTIVITIES: '投資活動現金流',
  FINANCING_CASH_FLOW: '融資現金流',
  DEBT_ISSUANCE: '債務發行',
  DEBT_REPAYMENT: '債務償還',
  DIVIDEND_PAYMENTS: '股利支付',
  FINANCING_ACTIVITIES: '融資活動現金流',
  FREE_CASH_FLOW: '自由現金流',
  NET_CASH_FLOW: '淨現金流',
  CASH_BEGINNING: '期初現金',
  CASH_ENDING: '期末現金',
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

// 台灣營收數據處理常數 - 基於實際範圍的動態驗證
export const TW_REVENUE_DATA_CONSTANTS = {
  // 年份範圍 (基本合理性檢查)
  MIN_YEAR: 1990,                  // 最早年份 (台灣股市開始電子化交易)
  MAX_YEAR_OFFSET: 2,              // 相對於當前年份的最大偏移 (允許未來2年)
  
  // 月份範圍
  MIN_MONTH: 1,
  MAX_MONTH: 12,
  
  // 數值基本檢查 - 基於台灣上市公司實際營收範圍
  MIN_REASONABLE_VALUE: 1,         // 最小合理數值 (避免0或負數)
  MAX_REASONABLE_REVENUE: 1500000000000, // 最大合理營收 (1.5兆，考慮台積電等超大型公司月營收)
  MAX_DIGITS: 15,                  // 避免超大數字錯誤
  
  // 動態驗證參數 (替代硬編碼位數檢測)
  CONCATENATED_DETECTION: {
    // 基於數值範圍而非字符串長度的檢測
    SUSPICIOUS_MULTIPLIER: 100,     // 如果數值超過合理範圍100倍，可能是串接
    MIN_VALID_REVENUE: 1000,        // 最小有效營收 (千元)
    MAX_SINGLE_COMPANY: 2000000000000 // 智能分離觸發閾值 (2兆，超過合理範圍即觸發修正)
  }
} as const;

// 台灣EPS數據處理常數 - 基於實際EPS範圍的動態驗證
export const TW_EPS_DATA_CONSTANTS = {
  // EPS 基本檢查 - 基於台灣上市公司實際EPS範圍
  MIN_REASONABLE_EPS: -100,        // 最小合理EPS (-100元，考慮虧損公司)
  MAX_REASONABLE_EPS: 100,         // 最大合理EPS (100元，基於高獲利公司如台積電)
  
  // 股價數據排除閾值 - 核心功能
  STOCK_PRICE_THRESHOLD: 150,      // 股價通常超過此值 (台積電 ~600-1000元)
  MIN_STOCK_PRICE: 50,             // 最小股價範圍 (避免誤判低價股)
  
  // 精度控制 (替代硬編碼小數位檢測)
  MAX_DECIMAL_PLACES: 2,           // EPS 最多2位小數
  SUSPICIOUS_EPS_THRESHOLD: 200,   // 超過此值可能是股價數據
  
  // 動態分離參數
  CONCATENATION_DETECTION: {
    VALUE_RATIO_THRESHOLD: 50,     // 如果數值超過合理範圍50倍，可能是股價
    MIN_VALID_EPS: -100,           // 最小有效EPS (包含虧損)
    MAX_SINGLE_COMPANY_EPS: 100    // 單一公司最大可能EPS
  }
} as const;

// 台灣股息數據處理常數 - 基於實際股息分佈的動態驗證
export const TW_DIVIDEND_DATA_CONSTANTS = {
  // 股息基本檢查 - 基於台灣上市公司實際股息範圍
  MIN_REASONABLE_DIVIDEND: 0.1,       // 最小合理股息 (0.1元，避免雜訊)
  MAX_REASONABLE_DIVIDEND: 200,        // 最大合理股息 (200元，基於高股息股票如金融股)
  
  // 年份數據排除閾值 - 核心功能
  YEAR_VALUE_THRESHOLD: 1980,         // 年份通常超過此值 (1980-2030)
  MAX_VALID_YEAR: 2030,               // 最大有效年份
  MIN_VALID_YEAR: 1990,               // 最小有效年份 (台灣股市電子化)
  
  // 動態檢測參數
  CONCATENATION_DETECTION: {
    SUSPICIOUS_PATTERN_THRESHOLD: 1000, // 超過此值可能是年份或錯誤數據
    MIN_VALID_DIVIDEND: 0.01,          // 最小有效股息
    MAX_SINGLE_COMPANY_DIVIDEND: 150   // 單一公司最大可能股息
  },
  
  // 期間格式檢查
  PERIOD_VALIDATION: {
    VALID_HALF_YEAR_PATTERN: /^(20\d{2})-H[12]$/,  // 2024-H1, 2024-H2
    VALID_YEAR_PATTERN: /^(20\d{2})$/,              // 2024, 2025
    VALID_QUARTER_PATTERN: /^(20\d{2})-Q[1-4]$/    // 2024-Q1 (備用)
  }
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

// EPS 欄位到表格標題的映射
export const TW_EPS_DATA_FIELD_MAPPING = {
  eps: YAHOO_FINANCE_TW_EPS_HEADERS.EPS,
  quarterlyGrowth: YAHOO_FINANCE_TW_EPS_HEADERS.QUARTERLY_GROWTH,
  yearOverYearGrowth: YAHOO_FINANCE_TW_EPS_HEADERS.YEAR_OVER_YEAR_GROWTH,
  averagePrice: YAHOO_FINANCE_TW_EPS_HEADERS.AVERAGE_PRICE
} as const;

// Income Statement 欄位到表格標題的映射
export const TW_INCOME_STATEMENT_DATA_FIELD_MAPPING = {
  totalRevenue: YAHOO_FINANCE_TW_INCOME_STATEMENT_HEADERS.TOTAL_REVENUE,
  operatingRevenue: YAHOO_FINANCE_TW_INCOME_STATEMENT_HEADERS.OPERATING_REVENUE,
  grossProfit: YAHOO_FINANCE_TW_INCOME_STATEMENT_HEADERS.GROSS_PROFIT,
  operatingExpenses: YAHOO_FINANCE_TW_INCOME_STATEMENT_HEADERS.OPERATING_EXPENSES,
  operatingIncome: YAHOO_FINANCE_TW_INCOME_STATEMENT_HEADERS.OPERATING_INCOME,
  nonOperatingIncome: YAHOO_FINANCE_TW_INCOME_STATEMENT_HEADERS.NON_OPERATING_INCOME,
  nonOperatingExpenses: YAHOO_FINANCE_TW_INCOME_STATEMENT_HEADERS.NON_OPERATING_EXPENSES,
  incomeBeforeTax: YAHOO_FINANCE_TW_INCOME_STATEMENT_HEADERS.INCOME_BEFORE_TAX,
  incomeTax: YAHOO_FINANCE_TW_INCOME_STATEMENT_HEADERS.INCOME_TAX,
  netIncome: YAHOO_FINANCE_TW_INCOME_STATEMENT_HEADERS.NET_INCOME,
  comprehensiveIncome: YAHOO_FINANCE_TW_INCOME_STATEMENT_HEADERS.COMPREHENSIVE_INCOME,
  basicEPS: YAHOO_FINANCE_TW_INCOME_STATEMENT_HEADERS.BASIC_EPS,
  dilutedEPS: YAHOO_FINANCE_TW_INCOME_STATEMENT_HEADERS.DILUTED_EPS
} as const;

// Balance Sheet 欄位到表格標題的映射
export const TW_BALANCE_SHEET_DATA_FIELD_MAPPING = {
  totalAssets: YAHOO_FINANCE_TW_BALANCE_SHEET_HEADERS.TOTAL_ASSETS,
  currentAssets: YAHOO_FINANCE_TW_BALANCE_SHEET_HEADERS.CURRENT_ASSETS,
  cashAndEquivalents: YAHOO_FINANCE_TW_BALANCE_SHEET_HEADERS.CASH_AND_EQUIVALENTS,
  accountsReceivable: YAHOO_FINANCE_TW_BALANCE_SHEET_HEADERS.ACCOUNTS_RECEIVABLE,
  inventory: YAHOO_FINANCE_TW_BALANCE_SHEET_HEADERS.INVENTORY,
  nonCurrentAssets: YAHOO_FINANCE_TW_BALANCE_SHEET_HEADERS.NON_CURRENT_ASSETS,
  propertyPlantEquipment: YAHOO_FINANCE_TW_BALANCE_SHEET_HEADERS.PROPERTY_PLANT_EQUIPMENT,
  intangibleAssets: YAHOO_FINANCE_TW_BALANCE_SHEET_HEADERS.INTANGIBLE_ASSETS,
  totalLiabilities: YAHOO_FINANCE_TW_BALANCE_SHEET_HEADERS.TOTAL_LIABILITIES,
  currentLiabilities: YAHOO_FINANCE_TW_BALANCE_SHEET_HEADERS.CURRENT_LIABILITIES,
  accountsPayable: YAHOO_FINANCE_TW_BALANCE_SHEET_HEADERS.ACCOUNTS_PAYABLE,
  shortTermDebt: YAHOO_FINANCE_TW_BALANCE_SHEET_HEADERS.SHORT_TERM_DEBT,
  nonCurrentLiabilities: YAHOO_FINANCE_TW_BALANCE_SHEET_HEADERS.NON_CURRENT_LIABILITIES,
  longTermDebt: YAHOO_FINANCE_TW_BALANCE_SHEET_HEADERS.LONG_TERM_DEBT,
  totalEquity: YAHOO_FINANCE_TW_BALANCE_SHEET_HEADERS.TOTAL_EQUITY,
  stockholdersEquity: YAHOO_FINANCE_TW_BALANCE_SHEET_HEADERS.STOCKHOLDERS_EQUITY,
  retainedEarnings: YAHOO_FINANCE_TW_BALANCE_SHEET_HEADERS.RETAINED_EARNINGS,
  bookValuePerShare: YAHOO_FINANCE_TW_BALANCE_SHEET_HEADERS.BOOK_VALUE_PER_SHARE
} as const;

// Cash Flow Statement 欄位到表格標題的映射
export const TW_CASH_FLOW_DATA_FIELD_MAPPING = {
  operatingCashFlow: YAHOO_FINANCE_TW_CASH_FLOW_HEADERS.OPERATING_CASH_FLOW,
  netIncomeOperating: YAHOO_FINANCE_TW_CASH_FLOW_HEADERS.NET_INCOME_OPERATING,
  investingCashFlow: YAHOO_FINANCE_TW_CASH_FLOW_HEADERS.INVESTING_CASH_FLOW,
  capitalExpenditure: YAHOO_FINANCE_TW_CASH_FLOW_HEADERS.CAPITAL_EXPENDITURE,
  investmentActivities: YAHOO_FINANCE_TW_CASH_FLOW_HEADERS.INVESTMENT_ACTIVITIES,
  financingCashFlow: YAHOO_FINANCE_TW_CASH_FLOW_HEADERS.FINANCING_CASH_FLOW,
  debtIssuance: YAHOO_FINANCE_TW_CASH_FLOW_HEADERS.DEBT_ISSUANCE,
  debtRepayment: YAHOO_FINANCE_TW_CASH_FLOW_HEADERS.DEBT_REPAYMENT,
  dividendPayments: YAHOO_FINANCE_TW_CASH_FLOW_HEADERS.DIVIDEND_PAYMENTS,
  financingActivities: YAHOO_FINANCE_TW_CASH_FLOW_HEADERS.FINANCING_ACTIVITIES,
  freeCashFlow: YAHOO_FINANCE_TW_CASH_FLOW_HEADERS.FREE_CASH_FLOW,
  netCashFlow: YAHOO_FINANCE_TW_CASH_FLOW_HEADERS.NET_CASH_FLOW,
  cashBeginning: YAHOO_FINANCE_TW_CASH_FLOW_HEADERS.CASH_BEGINNING,
  cashEnding: YAHOO_FINANCE_TW_CASH_FLOW_HEADERS.CASH_ENDING
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

