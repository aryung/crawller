export enum FiscalReportType {
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  HALF = 'half-yearly',
  ANNUAL = 'annual',
}

// 新增月度數據專用的週期標識
export interface FiscalPeriod {
  reportType: FiscalReportType;
  fiscalYear: number;
  fiscalQuarter?: number; // 1-4, 季度和年度使用
  fiscalMonth?: number; // 1-12, 月度使用
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
