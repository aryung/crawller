/**
 * Standardized Fundamental Data Interface
 * 
 * This interface defines the standardized format for fundamental data
 * that can be directly imported into the backend FundamentalDataEntity.
 * All crawler outputs should be transformed to this format.
 * 
 * @author AI Assistant
 * @version 1.0.0
 * @date 2025-01-06
 */

export interface StandardizedFundamentalData {
  // === Basic Information (aligned with backend field names) ===
  symbolCode: string;        // Stock code without suffix (.TW/.T)
  exchangeArea: string;      // "TW" | "US" | "JP"
  reportDate: string;        // ISO date format "2024-09-30"
  fiscalYear: number;        // 2024
  fiscalQuarter?: number;    // 1-4 (quarterly reports)
  fiscalMonth?: number;      // 1-12 (monthly reports, JP annual uses 3)
  reportType: string;        // "quarterly" | "annual" | "monthly"
  
  // === Income Statement Fields ===
  revenue?: number;          // Total revenue (base unit)
  costOfGoodsSold?: number;  // Cost of goods sold
  grossProfit?: number;      // Gross profit
  operatingExpenses?: number;// Operating expenses
  operatingIncome?: number;  // Operating income
  interestExpense?: number;  // Interest expense
  taxExpense?: number;       // Tax expense
  incomeBeforeTax?: number;  // Income before tax
  incomeTax?: number;        // Income tax
  netIncome?: number;        // Net income
  ebitda?: number;           // EBITDA
  eps?: number;              // Earnings per share
  dilutedEPS?: number;       // Diluted EPS
  
  // === Balance Sheet Fields ===
  totalAssets?: number;      // Total assets
  currentAssets?: number;    // Current assets
  inventory?: number;        // Inventory
  accountsReceivable?: number; // Accounts receivable
  totalLiabilities?: number; // Total liabilities
  currentLiabilities?: number; // Current liabilities
  accountsPayable?: number;  // Accounts payable
  shareholdersEquity?: number; // Shareholders' equity
  totalDebt?: number;        // Total debt
  longTermDebt?: number;     // Long-term debt
  shortTermDebt?: number;    // Short-term debt
  cashAndEquivalents?: number; // Cash and equivalents
  workingCapital?: number;   // Working capital
  bookValuePerShare?: number;// Book value per share
  propertyPlantEquipment?: number; // PP&E
  intangibleAssets?: number; // Intangible assets
  retainedEarnings?: number; // Retained earnings
  
  // === Cash Flow Statement Fields ===
  operatingCashFlow?: number; // Operating cash flow
  investingCashFlow?: number; // Investing cash flow
  financingCashFlow?: number; // Financing cash flow
  netCashFlow?: number;       // Net cash flow
  freeCashFlow?: number;      // Free cash flow
  capex?: number;             // Capital expenditures
  dividendPayments?: number;  // Dividend payments
  debtIssuance?: number;      // Debt issuance
  debtRepayment?: number;     // Debt repayment
  
  // === Financial Ratios ===
  peRatio?: number;           // P/E ratio
  pbRatio?: number;           // P/B ratio
  roe?: number;               // Return on equity (decimal format)
  roa?: number;               // Return on assets (decimal format)
  grossMargin?: number;       // Gross margin (decimal format)
  operatingMargin?: number;   // Operating margin (decimal format)
  netMargin?: number;         // Net margin (decimal format)
  currentRatio?: number;      // Current ratio
  debtToEquity?: number;      // Debt to equity ratio
  dividendYield?: number;     // Dividend yield (decimal format)
  
  // === Market Data ===
  sharesOutstanding?: number; // Shares outstanding
  marketCap?: number;         // Market capitalization
  dividendPerShare?: number;  // Dividend per share
  
  // === Regional Specific Fields ===
  regionalData?: {
    // Japan specific
    ordinaryProfit?: number;     // 経常利益
    ordinaryMargin?: number;     // 経常利益率
    equityRatio?: number;        // 自己資本比率
    capital?: number;            // 資本金
    // Other regional specific fields...
    [key: string]: any;
  };
  
  // === Metadata ===
  dataSource: string;         // Data source identifier
  lastUpdated: string;        // Last update timestamp (ISO format)
  currencyCode?: string;      // Currency code (TWD, USD, JPY)
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