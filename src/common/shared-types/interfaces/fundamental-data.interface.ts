export enum FiscalReportType {
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  ANNUAL = 'annual',
  HALF = 'half-yearly',
}

// 財務週期標識
export interface FiscalPeriod {
  reportType: FiscalReportType;
  fiscalYear: number;
  fiscalMonth?: number; // quarterly(1-4表示Q1-Q4), monthly(1-12), annual(12), half-yearly(2或4)
}

// 財報頻率對應關係
export const FISCAL_REPORT_HIERARCHY = {
  // 年度包含的季度
  ANNUAL_QUARTERS: [1, 2, 3, 4],
  // 季度包含的月份
  Q1_MONTHS: [1, 2, 3],
  Q2_MONTHS: [4, 5, 6],
  Q3_MONTHS: [7, 8, 9],
  Q4_MONTHS: [10, 11, 12],
} as const;
