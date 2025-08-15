import { MarketRegion } from '../shared-types/interfaces/market-data.interface';

// 檔案系統路徑映射
export const MarketRegionPathMapping = {
  [MarketRegion.TPE]: 'tw',  // TPE 在檔案路徑中使用 tw
  [MarketRegion.US]: 'us',
  [MarketRegion.JP]: 'jp',
} as const;

/**
 * 報表數據欄位名稱對應
 * 不同市場和報表類型可能使用不同的欄位名稱
 */
export const REPORT_DATA_FIELDS = {
  // 主要欄位（所有市場通用）
  PRIMARY: 'data',
  
  // 替代欄位名稱（向後兼容或特殊報表）
  ALTERNATIVE: [
    'simpleEPSData',           // TW EPS 數據
    'independentCashFlowData', // TW 現金流數據（備用）
    'dividendData',            // TW 股利數據
    'performanceData',         // JP 績效數據
    'historyData',             // US/JP/TW 歷史價格數據
    'revenueData',             // TW 營收數據
    'financialsData',          // US/JP 財務數據
    'cashFlowData',            // US 現金流數據
    'balanceSheetData',        // US 資產負債表數據
    'incomeStatementData',     // US 損益表數據
  ],
} as const;

/**
 * 報表類型定義
 */
export const REPORT_TYPES = {
  // 季度報表
  QUARTERLY: {
    INCOME_STATEMENT: 'income-statement',
    BALANCE_SHEET: 'balance-sheet',
    CASH_FLOW: 'cash-flow-statement',
    CASHFLOW: 'cashflow',  // US/JP 簡化名稱
    EPS: 'eps',
    DIVIDEND: 'dividend',
    REVENUE: 'revenue',
    FINANCIALS: 'financials',
    PERFORMANCE: 'performance',
  },
  
  // 每日數據
  DAILY: {
    HISTORY: 'history',
    PRICE: 'price',
  },
  
  // 元數據
  METADATA: {
    SYMBOLS: 'symbols',
    LABELS: 'labels',
  },
} as const;

/**
 * 獲取報表類型的所有可能數據欄位
 */
export function getPossibleDataFields(): string[] {
  return [REPORT_DATA_FIELDS.PRIMARY, ...REPORT_DATA_FIELDS.ALTERNATIVE];
}
