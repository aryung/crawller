/**
 * Unified Financial Data Interface
 * 
 * This interface defines the unified format for all financial data
 * that can be directly imported into the backend FundamentalDataEntity.
 * All Yahoo Finance TW transforms should output this format.
 * 
 * @author AI Assistant
 * @version 1.0.0
 * @date 2025-01-06
 */

/**
 * 統一的財務數據介面 - 直接對應 FundamentalDataEntity
 * 所有財務數據轉換使用統一的介面，不再使用複雜的 switch/case
 */
export interface UnifiedFinancialData {
  // === 必要識別欄位 (與 FundamentalDataEntity 完全一致) ===
  symbolCode: string;        // 股票代碼 (不含後綴 .TW)
  exchangeArea: string;      // 交易所區域 "TPE" | "US" | "JP"
  reportDate: string;        // 報告日期 ISO 格式 "2024-09-30"
  fiscalYear: number;        // 會計年度 2024
  fiscalQuarter?: number;    // 會計季度 (1-4) 季度報告
  fiscalMonth?: number;      // 會計月份 (1-12) 月度報告
  reportType: string;        // "quarterly" | "annual" | "monthly"
  
  // === Income Statement Fields (損益表欄位) ===
  revenue?: number;          // 營收 (基本單位)
  costOfGoodsSold?: number;  // 銷貨成本
  grossProfit?: number;      // 營業毛利
  operatingExpenses?: number;// 營業費用
  operatingIncome?: number;  // 營業利益
  interestExpense?: number;  // 利息支出
  taxExpense?: number;       // 稅費支出
  incomeBeforeTax?: number;  // 稅前淨利
  incomeTax?: number;        // 所得稅
  netIncome?: number;        // 稅後淨利
  ebitda?: number;           // EBITDA
  eps?: number;              // 每股盈餘
  dilutedEPS?: number;       // 稀釋每股盈餘
  
  // === Balance Sheet Fields (資產負債表欄位) ===
  totalAssets?: number;      // 總資產
  currentAssets?: number;    // 流動資產
  inventory?: number;        // 存貨
  accountsReceivable?: number; // 應收帳款
  totalLiabilities?: number; // 總負債
  currentLiabilities?: number; // 流動負債
  accountsPayable?: number;  // 應付帳款
  shareholdersEquity?: number; // 股東權益
  totalDebt?: number;        // 總債務
  longTermDebt?: number;     // 長期借款
  shortTermDebt?: number;    // 短期借款
  cashAndEquivalents?: number; // 現金及約當現金
  workingCapital?: number;   // 營運資金
  bookValuePerShare?: number;// 每股淨值
  propertyPlantEquipment?: number; // 不動產廠房及設備
  intangibleAssets?: number; // 無形資產
  retainedEarnings?: number; // 保留盈餘
  
  // === Cash Flow Statement Fields (現金流量表欄位) ===
  operatingCashFlow?: number; // 營業現金流
  investingCashFlow?: number; // 投資現金流
  financingCashFlow?: number; // 融資現金流
  netCashFlow?: number;       // 淨現金流
  freeCashFlow?: number;      // 自由現金流
  capex?: number;             // 資本支出
  dividendPayments?: number;  // 股利支付
  debtIssuance?: number;      // 債務發行
  debtRepayment?: number;     // 債務償還
  
  // === Financial Ratios (財務比率) ===
  peRatio?: number;           // 本益比
  pbRatio?: number;           // 股價淨值比
  roe?: number;               // 股東權益報酬率 (小數格式)
  roa?: number;               // 資產報酬率 (小數格式)
  grossMargin?: number;       // 營業毛利率 (小數格式)
  operatingMargin?: number;   // 營業利益率 (小數格式)
  netMargin?: number;         // 淨利率 (小數格式)
  currentRatio?: number;      // 流動比率
  debtToEquity?: number;      // 負債權益比
  dividendYield?: number;     // 殖利率 (小數格式)
  
  // === Market Data (市場數據) ===
  sharesOutstanding?: number; // 流通在外股數
  marketCap?: number;         // 市值
  dividendPerShare?: number;  // 每股股利
  
  // === Dividend Fields (股利相關) ===
  cashDividend?: number;      // 現金股利
  stockDividend?: number;     // 股票股利
  cashYield?: number;         // 現金殖利率 (小數格式)
  exDividendDate?: string;    // 除息日期
  exRightsDate?: string;      // 除權日期
  paymentDate?: string;       // 股利發放日期
  
  // === Regional Specific Fields (區域特定欄位) ===
  regionalData?: {
    // Taiwan specific
    quarterlyGrowth?: number;     // 季增率 (小數格式)
    yearOverYearGrowth?: number;  // 年增率 (小數格式)
    averagePrice?: number;        // 季均價 (EPS相關)
    // Japan specific
    ordinaryProfit?: number;      // 経常利益
    ordinaryMargin?: number;      // 経常利益率
    equityRatio?: number;         // 自己資本比率
    capital?: number;             // 資本金
    // Other regional specific fields...
    [key: string]: any;
  };
  
  // === Metadata (元數據) ===
  dataSource: string;         // 數據來源標識 'yahoo-finance-tw'
  lastUpdated: string;        // 最後更新時間戳 (ISO格式)
  currencyCode?: string;      // 幣別代碼 (TWD, USD, JPY)
}

/**
 * Helper type for fiscal period parsing
 */
export interface ParsedFiscalPeriod {
  year: number;
  quarter?: number;
  month?: number;
  isAnnual: boolean;
}

/**
 * 表格方向檢測結果
 */
export type TableOrientation = 'horizontal' | 'vertical';

/**
 * Unit conversion constants
 */
export const UNIT_MULTIPLIERS = {
  THOUSAND_TO_BASE: 1000,    // Convert thousands to base unit
  MILLION_TO_BASE: 1000000,  // Convert millions to base unit
  PERCENTAGE_TO_DECIMAL: 0.01, // Convert percentage to decimal
} as const;

/**
 * Report type enum matching backend
 */
export enum FiscalReportType {
  QUARTERLY = 'quarterly',
  ANNUAL = 'annual',
  MONTHLY = 'monthly',
}