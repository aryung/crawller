/**
 * Yahoo Finance US 網站特定的轉換函數
 * 包含針對 Yahoo Finance US 網站結構和資料格式的特殊處理邏輯
 */

import { StandardizedFundamentalData, FiscalReportType } from '../../types/standardized.js';

export interface YahooFinanceUSTransforms {
  cleanStockSymbol: (value: string) => string;
  parseUSFinancialValue: (value: string) => number | string | null;
  parseUSPercentage: (value: string) => number | string | null;
  extractFiscalPeriod: (value: string) => string | null;
  parseUSDate: (value: string) => string | null;
  cleanFinancialText: (value: string) => string;
  structureUSFinancialDataFromCells: (cells: string[] | string, context?: any) => USFinancialData[];
  structureUSCashFlowDataFromCells: (cells: string[] | string, context?: any) => USCashFlowData[];
}

// 美國財務數據介面
export interface USFinancialData {
  fiscalPeriod: string | null;
  // 基本財務數據欄位 (基於實際 AAPL 截圖)
  totalRevenue?: number | null;
  costOfRevenue?: number | null;
  grossProfit?: number | null;
  operatingExpense?: number | null;
  operatingIncome?: number | null;
  netNonOperatingInterestIncomeExpense?: number | null;
  otherIncomeExpense?: number | null;
  pretaxIncome?: number | null;
  taxProvision?: number | null;
  earningsFromEquityInterestNetOfTax?: number | null; // 從截圖新增
  netIncomeCommonStockholders?: number | null;
  averageDilutionEarnings?: number | null; // 從截圖新增
  dilutedNIAvailableToComStockholders?: number | null;
  basicEPS?: number | null;
  dilutedEPS?: number | null;
  reportedNormalizedBasicEPS?: number | null; // 從截圖新增
  basicAverageShares?: number | null;
  dilutedAverageShares?: number | null;
  totalOperatingIncomeAsReported?: number | null;
  totalExpenses?: number | null;
  netIncomeFromContinuingAndDiscontinuedOperation?: number | null;
  normalizedIncome?: number | null;
  rentExpenseSupplemental?: number | null; // 從截圖新增
  continuingAndDiscontinuedBasicEPS?: number | null; // 從截圖新增
  continuingAndDiscontinuedDilutedEPS?: number | null; // 從截圖新增
  interestIncome?: number | null;
  interestExpense?: number | null;
  netInterestIncome?: number | null;
  ebit?: number | null;
  ebitda?: number | null;
  reconciledCostOfRevenue?: number | null;
  reconciledDepreciation?: number | null;
  netIncomeFromContinuingOperationNetMinorityInterest?: number | null;
  normalizedEBITDA?: number | null; // 從截圖新增
  totalUnusualItemsExcludingGoodwill?: number | null;
  totalUnusualItems?: number | null;
  taxRateForCalcs?: number | null;
  taxEffectOfUnusualItems?: number | null;
}

// 美國現金流數據介面 (基於 Yahoo Finance US Cash Flow 頁面)
export interface USCashFlowData {
  fiscalPeriod: string | null;
  // 營運現金流相關欄位
  operatingCashFlow?: number | null;
  // 投資現金流相關欄位
  investingCashFlow?: number | null;
  capitalExpenditure?: number | null;
  // 融資現金流相關欄位
  financingCashFlow?: number | null;
  issuanceOfCapitalStock?: number | null;
  issuanceOfDebt?: number | null;
  repaymentOfDebt?: number | null;
  repurchaseOfCapitalStock?: number | null;
  // 其他現金流欄位
  endCashPosition?: number | null;
  incomeTaxPaidSupplemental?: number | null;
  interestPaidSupplemental?: number | null;
  freeCashFlow?: number | null;
}

// 美國財務數據欄位對應表 (根據 Yahoo Finance US 的標準欄位)
export const US_FINANCIAL_HEADERS = {
  // 收入相關
  'Total Revenue': 'totalRevenue',
  'Cost of Revenue': 'costOfRevenue',
  'Gross Profit': 'grossProfit',

  // 營運相關
  'Operating Expense': 'operatingExpense',
  'Operating Income': 'operatingIncome',
  'Net Non Operating Interest Income Expense': 'netNonOperatingInterestIncomeExpense',
  'Other Income Expense': 'otherIncomeExpense',

  // 稅前和稅後
  'Pretax Income': 'pretaxIncome',
  'Tax Provision': 'taxProvision',
  'Net Income Common Stockholders': 'netIncomeCommonStockholders',
  'Diluted NI Available to Com Stockholders': 'dilutedNIAvailableToComStockholders',

  // 每股收益
  'Basic EPS': 'basicEPS',
  'Diluted EPS': 'dilutedEPS',
  'Basic Average Shares': 'basicAverageShares',
  'Diluted Average Shares': 'dilutedAverageShares',

  // 其他指標
  'Total Operating Income As Reported': 'totalOperatingIncomeAsReported',
  'Total Expenses': 'totalExpenses',
  'Net Income From Continuing & Discontinued Operation': 'netIncomeFromContinuingAndDiscontinuedOperation',
  'Normalized Income': 'normalizedIncome',
  'Interest Income': 'interestIncome',
  'Interest Expense': 'interestExpense',
  'Net Interest Income': 'netInterestIncome',
  'EBIT': 'ebit',
  'EBITDA': 'ebitda',
  'Reconciled Cost of Revenue': 'reconciledCostOfRevenue',
  'Reconciled Depreciation': 'reconciledDepreciation',
  'Net Income From Continuing Operation Net Minority Interest': 'netIncomeFromContinuingOperationNetMinorityInterest',
  'Total Unusual Items Excluding Goodwill': 'totalUnusualItemsExcludingGoodwill',
  'Total Unusual Items': 'totalUnusualItems',
  'Normalized EBITDA': 'normalizedEBITDA',
  'Tax Rate for Calcs': 'taxRateForCalcs',
  'Tax Effect of Unusual Items': 'taxEffectOfUnusualItems'
} as const;

// 美國現金流數據欄位對應表 (根據 Yahoo Finance US Cash Flow 頁面的標準欄位)
export const US_CASHFLOW_HEADERS = {
  // 營運現金流
  'Operating Cash Flow': 'operatingCashFlow',
  
  // 投資現金流
  'Investing Cash Flow': 'investingCashFlow',
  'Capital Expenditure': 'capitalExpenditure',
  
  // 融資現金流
  'Financing Cash Flow': 'financingCashFlow',
  'Issuance of Capital Stock': 'issuanceOfCapitalStock',
  'Issuance of Debt': 'issuanceOfDebt',
  'Repayment of Debt': 'repaymentOfDebt',
  'Repurchase of Capital Stock': 'repurchaseOfCapitalStock',
  
  // 其他現金流
  'End Cash Position': 'endCashPosition',
  'Income Tax Paid Supplemental Data': 'incomeTaxPaidSupplemental',
  'Interest Paid Supplemental Data': 'interestPaidSupplemental',
  'Free Cash Flow': 'freeCashFlow'
} as const;

// 基於實際截圖的固定左欄順序 (Yahoo Finance US Financials 頁面)
export const US_FINANCIAL_HEADER_ORDER = [
  'Total Revenue',
  'Total Expenses',
  'Pretax Income',
  'Tax Provision',
  'Net Income Common Stockholders',
  'Diluted NI Available to Common Stockholders',
  'Basic EPS',
  'Diluted EPS',
  'Basic Average Shares',
  'Diluted Average Shares',
  'Net Income from Continuing & Discontinued Operation',
  'Normalized Income',
  'Rent Expense Supplemental',
  'EBIT',
  'Reconciled Depreciation',
  'Net Income from Continuing Operation Net Minority Interest',
  'Total Unusual Items Excluding Goodwill',
  'Total Unusual Items',
  'Tax Rate for Calcs',
  'Tax Effect of Unusual Items',
  'Interest Expense'
];

export const yahooFinanceUSTransforms: YahooFinanceUSTransforms = {
  /**
   * 清理美國股票代碼和公司名稱
   * 例如：從 "Berkshire Hathaway Inc. (BRK-B)" 提取乾淨的文本
   */
  cleanStockSymbol: (value: string): string => {
    if (!value) return '';
    const cleaned = value.toString().trim();
    // 移除多餘的空白和特殊字符
    return cleaned.replace(/\s+/g, ' ').replace(/[\r\n\t]/g, '');
  },

  /**
   * 解析美國財務數值
   * 處理千分位逗號、B (Billion)、M (Million)、K (Thousand) 等單位
   * 例如：從 "415.78B" 提取 415780000000，從 "1,234.56M" 提取 1234560000
   */
  parseUSFinancialValue: (value: string): number | string | null => {
    if (!value) return null;

    const str = value.toString().trim();

    // 處理 "---" 或 "--" 等缺失值
    if (str === '---' || str === '--' || str === '-' || str === 'N/A' || str === '') {
      return null;
    }

    // 移除千分位逗號和空白
    let cleanValue = str.replace(/[,\s()]/g, '');

    // 處理負數
    let isNegative = cleanValue.includes('-') || str.includes('(') && str.includes(')');
    cleanValue = cleanValue.replace('-', '');

    // 處理單位縮寫
    let multiplier = 1;
    if (cleanValue.endsWith('B')) {
      multiplier = 1000000000; // Billion
      cleanValue = cleanValue.slice(0, -1);
    } else if (cleanValue.endsWith('M')) {
      multiplier = 1000000; // Million
      cleanValue = cleanValue.slice(0, -1);
    } else if (cleanValue.endsWith('K')) {
      multiplier = 1000; // Thousand
      cleanValue = cleanValue.slice(0, -1);
    }

    const numValue = parseFloat(cleanValue);
    if (isNaN(numValue)) {
      return str; // 如果無法解析為數字，返回原始字串
    }

    return isNegative ? -(numValue * multiplier) : (numValue * multiplier);
  },

  /**
   * 解析美國百分比
   * 例如：從 "12.34%" 提取 0.1234
   */
  parseUSPercentage: (value: string): number | string | null => {
    if (!value) return null;

    const str = value.toString().trim();
    if (str === '---' || str === '--' || str === '-' || str === 'N/A') {
      return null;
    }

    if (str.includes('%')) {
      const numStr = str.replace('%', '').replace(/[,\s]/g, '');
      const num = parseFloat(numStr);
      return isNaN(num) ? null : num / 100;
    }

    return null;
  },

  /**
   * 提取會計年度期間
   * 美國格式通常是 "12/31/2023", "Dec 31, 2023" 等
   */
  extractFiscalPeriod: (value: string): string | null => {
    if (!value) return null;

    const str = value.toString().trim();

    // 匹配各種日期格式
    const datePatterns = [
      /(\d{1,2}\/\d{1,2}\/\d{4})/,  // MM/DD/YYYY
      /(\d{4}-\d{1,2}-\d{1,2})/,   // YYYY-MM-DD
      /(Dec|Mar|Jun|Sep)\s+\d{1,2},?\s+\d{4}/i, // Dec 31, 2023
      /ttm/i // Trailing Twelve Months
    ];

    for (const pattern of datePatterns) {
      const match = str.match(pattern);
      if (match) {
        return match[0];
      }
    }

    return null;
  },

  /**
   * 解析美國日期格式
   */
  parseUSDate: (value: string): string | null => {
    if (!value) return null;
    return yahooFinanceUSTransforms.extractFiscalPeriod(value);
  },

  /**
   * 清理財務文本
   */
  cleanFinancialText: (value: string): string => {
    if (!value) return '';
    return value.toString().trim().replace(/\s+/g, ' ');
  },

  /**
   * 從表格單元格陣列結構化美國現金流數據
   * 針對 Yahoo Finance US Cash Flow 頁面的季度數據解析
   * 注意：Yahoo Finance US 現金流數據單位為千 (thousands)，需要乘以 1000
   */
  structureUSCashFlowDataFromCells: (cells: string[] | string, context?: any): USCashFlowData[] => {
    console.log('Starting US Cash Flow data parsing');
    console.log('Data type received:', typeof cells);
    console.log('Data length:', Array.isArray(cells) ? cells.length : (typeof cells === 'string' ? cells.length : 'unknown'));

    if (!cells) {
      console.warn('No data provided for US cash flow data parsing');
      return [];
    }

    // 處理數據可能是字符串或數組的情況
    let cellsArray: string[] = [];
    if (typeof cells === 'string') {
      cellsArray = cells.split(/[\n\r\t]+/).map(s => s.trim()).filter(s => s.length > 0);
      console.log('Converted string to array with', cellsArray.length, 'elements');
    } else if (Array.isArray(cells)) {
      cellsArray = cells;
    } else {
      console.warn('Unexpected data type for cells:', typeof cells);
      return [];
    }

    // 清理和過濾cells
    const cleanCells = cellsArray.filter(cell => {
      if (!cell || typeof cell !== 'string' || cell.trim().length === 0) return false;

      // 過濾掉不相關的內容
      const irrelevantPatterns = [
        /window\._nimbus/,
        /--yb-/,
        /color-scheme/,
        /rgba?\(/,
        /\.yahoo\./,
        /javascript:/,
        /data-reactid/,
        /^if\s*\(/,
        /^function/,
        /^window\./
      ];

      return !irrelevantPatterns.some(pattern => pattern.test(cell));
    });

    console.log('Filtered to', cleanCells.length, 'relevant cells');
    console.log('Sample cleaned cells:', cleanCells.slice(0, 10));

    // 動態尋找時間期間
    const periods = findCashFlowTimePeriods(cleanCells);
    console.log('Dynamically found periods:', periods);

    if (periods.length === 0) {
      console.warn('No time periods found in cash flow data');
      return [];
    }

    // 動態尋找現金流指標和對應數值
    const cashFlowData = extractCashFlowMetrics(cleanCells, periods);
    console.log('Extracted cash flow metrics for', cashFlowData.length, 'periods');

    return cashFlowData;

    // 內部函數：尋找現金流時間期間
    function findCashFlowTimePeriods(cells: string[]): string[] {
      const periods: string[] = [];

      for (const cell of cells) {
        if (!cell || typeof cell !== 'string') continue;

        // 尋找包含時間期間的行 - 支援任意財年模式
        const periodMatches = cell.match(/\b(TTM|\d{1,2}\/\d{1,2}\/\d{4})\b/g);

        if (periodMatches && periodMatches.length > 0) {
          periodMatches.forEach(match => {
            if (!periods.includes(match) && periods.length < 8) {
              periods.push(match);
              console.log('Cash flow period detection found:', match);
            }
          });
        }
      }

      return periods;
    }

    // 內部函數：提取現金流指標
    function extractCashFlowMetrics(cells: string[], periods: string[]): USCashFlowData[] {
      const results: USCashFlowData[] = [];

      // 為每個期間創建數據結構
      periods.forEach(period => {
        results.push({
          fiscalPeriod: period,
          operatingCashFlow: extractCashFlowMetricValue(cells, 'Operating Cash Flow', period),
          investingCashFlow: extractCashFlowMetricValue(cells, 'Investing Cash Flow', period),
          financingCashFlow: extractCashFlowMetricValue(cells, 'Financing Cash Flow', period),
          endCashPosition: extractCashFlowMetricValue(cells, 'End Cash Position', period),
          capitalExpenditure: extractCashFlowMetricValue(cells, 'Capital Expenditure', period),
          issuanceOfCapitalStock: extractCashFlowMetricValue(cells, 'Issuance of Capital Stock', period),
          issuanceOfDebt: extractCashFlowMetricValue(cells, 'Issuance of Debt', period),
          repaymentOfDebt: extractCashFlowMetricValue(cells, 'Repayment of Debt', period),
          repurchaseOfCapitalStock: extractCashFlowMetricValue(cells, 'Repurchase of Capital Stock', period),
          freeCashFlow: extractCashFlowMetricValue(cells, 'Free Cash Flow', period)
        });
      });

      return results;
    }

    // 內部函數：提取特定現金流指標的數值 - 處理千為單位
    function extractCashFlowMetricValue(cells: string[], metric: string, period: string): number | null {
      console.log(`Extracting cash flow metric: ${metric} for period: ${period}`);

      // 首先找到期間標題行，獲取期間的順序
      let periodOrder: string[] = [];
      for (const cell of cells) {
        if (!cell || typeof cell !== 'string') continue;
        
        // 尋找包含期間信息的行（通常包含 TTM 和多個日期）
        if (cell.includes('TTM') && cell.match(/\d{1,2}\/\d{1,2}\/\d{4}/)) {
          const periodsInCell = cell.match(/\b(TTM|\d{1,2}\/\d{1,2}\/\d{4})\b/g);
          if (periodsInCell && periodsInCell.length > 0) {
            periodOrder = periodsInCell;
            console.log(`Period order found: ${periodOrder.join(', ')}`);
            break;
          }
        }
      }

      if (periodOrder.length === 0) {
        console.log(`No period order found for ${metric}`);
        return null;
      }

      const periodIndex = periodOrder.indexOf(period);
      if (periodIndex === -1) {
        console.log(`Period ${period} not found in order: ${periodOrder.join(', ')}`);
        return null;
      }

      // 新的策略：找到每個指標專屬的行，並確保只從該行提取數據
      for (const cell of cells) {
        if (!cell || typeof cell !== 'string') continue;

        // 檢查是否找到了包含指標名稱和數據的具體行
        const metricLinePattern = new RegExp(`${metric.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s+([\\d,\\-\\s]+)`, 'i');
        const metricMatch = cell.match(metricLinePattern);
        
        if (!metricMatch) continue;

        console.log(`Found specific data line for ${metric}: ${metricMatch[0]}`);

        // 直接從匹配的行中提取數值部分
        const dataSection = metricMatch[1];
        console.log(`Data section: "${dataSection}"`);

        // 從數據部分提取所有數值
        const values = dataSection.match(/(--)|(--)|(-?\d{1,3}(?:,\d{3})*(?:\.\d+)?[BMKbmk]?)|(-?\d+\.?\d*[eE][+-]?\d+)/g);

        if (!values || values.length === 0) {
          console.log(`No values found in data section for ${metric}`);
          continue;
        }

        if (values.length > 0) {
          console.log(`Found ${values.length} values for ${metric}: [${values.join(', ')}]`);
          console.log(`Looking for period ${period} at index ${periodIndex}`);
          
          // 確保我們有足夠的數值來對應期間
          if (periodIndex < values.length) {
            const rawValue = values[periodIndex];
            console.log(`Raw value for ${metric} ${period}: ${rawValue}`);
            
            if (rawValue === '--' || rawValue === '-') {
              return null;
            }
            
            // 解析數值並轉換單位 (thousands -> actual)
            const parsedValue = yahooFinanceUSTransforms.parseUSFinancialValue(rawValue);
            if (typeof parsedValue === 'number') {
              // Yahoo Finance US Cash Flow 數據單位為千，需要乘以 1000
              const finalValue = parsedValue * 1000;
              console.log(`Final value for ${metric} ${period}: ${finalValue}`);
              return finalValue;
            }
            return parsedValue as number | null;
          } else {
            console.log(`Not enough values for ${metric}. Expected index ${periodIndex}, but only have ${values.length} values`);
          }
        } else {
          console.log(`No values found for ${metric} in this cell`);
        }

        // 如果在這個 cell 中找到了指標但沒有合適的數據，繼續查找其他 cell
      }

      console.log(`No value found for cash flow metric ${metric} period ${period}`);
      return null;
    }
  },

  /**
   * 從表格單元格陣列結構化美國財務數據 - 真正的動態解析器
   * 不再使用硬編碼數據，而是解析實際的網頁內容
   */
  structureUSFinancialDataFromCells: (cells: string[] | string, context?: any): USFinancialData[] => {
    console.log('Starting real-time parsing of Yahoo Finance US data');
    console.log('Data type received:', typeof cells);
    console.log('Data length:', Array.isArray(cells) ? cells.length : (typeof cells === 'string' ? cells.length : 'unknown'));

    if (!cells) {
      console.warn('No data provided for US financial data parsing');
      return [];
    }

    // 處理數據可能是字符串或數組的情況
    let cellsArray: string[] = [];
    if (typeof cells === 'string') {
      // 如果是單一字符串，將其分割成數組
      cellsArray = cells.split(/[\n\r\t]+/).map(s => s.trim()).filter(s => s.length > 0);
      console.log('Converted string to array with', cellsArray.length, 'elements');
    } else if (Array.isArray(cells)) {
      cellsArray = cells;
    } else {
      console.warn('Unexpected data type for cells:', typeof cells);
      return [];
    }

    // 步驟1: 清理和過濾cells，移除JavaScript、CSS等無關內容
    const cleanCells = cellsArray.filter(cell => {
      if (!cell || typeof cell !== 'string' || cell.trim().length === 0) return false;

      // 過濾掉不相關的內容
      const irrelevantPatterns = [
        /window\._nimbus/,
        /--yb-/,
        /color-scheme/,
        /rgba?\(/,
        /\.yahoo\./,
        /javascript:/,
        /data-reactid/,
        /^if\s*\(/,
        /^function/,
        /^window\./
      ];

      return !irrelevantPatterns.some(pattern => pattern.test(cell));
    });

    console.log('Filtered to', cleanCells.length, 'relevant cells');
    console.log('Sample cleaned cells:', cleanCells.slice(0, 20));

    // 步驟2: 動態尋找時間期間
    const periods = findTimePeriods(cleanCells);
    console.log('Dynamically found periods:', periods);

    if (periods.length === 0) {
      console.warn('No time periods found in data');
      return createMinimalFallback();
    }

    // 步驟3: 動態尋找財務指標和對應數值
    const financialData = extractFinancialMetrics(cleanCells, periods);
    console.log('Extracted financial metrics for', financialData.length, 'periods');

    return financialData;

    // 內部函數：尋找時間期間 - 支援任意財年模式
    function findTimePeriods(cells: string[]): string[] {
      const periods: string[] = [];

      // 從實際數據中提取期間信息 - 支援任意財年模式
      for (const cell of cells) {
        if (!cell || typeof cell !== 'string') continue;

        // 尋找包含時間期間的行 - 更廣泛的格式支援
        // 支援: "TTM 6/30/2024 6/30/2023" (MSFT), "TTM 9/30/2024 9/30/2023" (AAPL), "TTM 12/31/2024" 等
        const periodMatches = cell.match(/\b(TTM|\d{1,2}\/\d{1,2}\/\d{4})\b/g);

        if (periodMatches && periodMatches.length > 0) {
          periodMatches.forEach(match => {
            if (!periods.includes(match) && periods.length < 8) {
              periods.push(match);
              console.log('Dynamic period detection found:', match);
            }
          });
        }
      }

      // 如果沒有找到期間，嘗試更寬鬆的匹配
      if (periods.length === 0) {
        console.log('No periods found with standard patterns, trying fallback detection');
        for (const cell of cells) {
          if (!cell || typeof cell !== 'string') continue;
          
          // 備用模式：查找年份模式
          const yearMatches = cell.match(/\b(20\d{2})\b/g);
          if (yearMatches && yearMatches.length > 2) {
            console.log('Fallback: found year pattern in cell:', cell.substring(0, 100));
            // 基於年份推測期間格式
            yearMatches.slice(0, 5).forEach(year => {
              if (!periods.includes(year)) {
                periods.push(`12/31/${year}`); // 預設使用 12/31 格式
              }
            });
            break;
          }
        }
      }

      return periods;
    }

    // 內部函數：提取財務指標
    function extractFinancialMetrics(cells: string[], periods: string[]): USFinancialData[] {
      const results: USFinancialData[] = [];

      // 為每個期間創建數據結構
      periods.forEach(period => {
        results.push({
          fiscalPeriod: period,
          totalRevenue: extractMetricValue(cells, 'Total Revenue', period),
          costOfRevenue: extractMetricValue(cells, 'Cost of Revenue', period),
          grossProfit: extractMetricValue(cells, 'Gross Profit', period),
          operatingExpense: extractMetricValue(cells, 'Operating Expense', period),
          pretaxIncome: extractMetricValue(cells, 'Pretax Income', period),
          taxProvision: extractMetricValue(cells, 'Tax Provision', period),
          netIncomeCommonStockholders: extractMetricValue(cells, 'Net Income Common Stockholders', period),
          basicEPS: extractMetricValue(cells, 'Basic EPS', period),
          dilutedEPS: extractMetricValue(cells, 'Diluted EPS', period),
          ebit: extractMetricValue(cells, 'EBIT', period),
          ebitda: extractMetricValue(cells, 'EBITDA', period)
        });
      });

      return results;
    }

    // 內部函數：提取特定指標的數值 - 支援任意財年模式
    function extractMetricValue(cells: string[], metric: string, period: string): number | null {
      console.log(`Extracting metric: ${metric} for period: ${period}`);

      for (const cell of cells) {
        if (!cell || typeof cell !== 'string') continue;

        // 尋找包含指標名稱的行
        if (cell.toLowerCase().includes(metric.toLowerCase())) {
          // 更精確的數值提取：找到指標名稱後的特定位置
          const metricNameRegex = new RegExp(metric.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
          const metricIndex = cell.search(metricNameRegex);

          if (metricIndex !== -1) {
            // 提取指標名稱之後的部分
            const afterMetric = cell.substring(metricIndex + metric.length).trim();

            // 提取該指標對應的數值行 - 支援更多格式
            // 匹配: 數字(含千分位)、科學記號、單位縮寫(B/M/K)、缺失值(--)
            const values = afterMetric.match(/(--)|(--)|(-?\d{1,3}(?:,\d{3})*(?:\.\d+)?[BMKbmk]?)|(-?\d+\.?\d*[eE][+-]?\d+)/g);

            if (values && values.length > 0) {
              console.log(`Found ${values.length} values for ${metric}:`, values);

              // 動態找出包含期間信息的單元格 - 不限制於特定財年
              const mainDataCell = cells.find(c => {
                // 找到同時包含 TTM 和日期格式的行
                return c.includes('TTM') && c.match(/\d{1,2}\/\d{1,2}\/\d{4}/);
              });

              if (mainDataCell) {
                const periodsInData = mainDataCell.match(/\b(TTM|\d{1,2}\/\d{1,2}\/\d{4})\b/g);
                console.log('Periods found in main data cell:', periodsInData);
                
                if (!periodsInData) {
                  console.log('No periods found in main data cell');
                  return null;
                }
                
                const periodIndex = periodsInData.indexOf(period);
                console.log(`Period ${period} index:`, periodIndex);
                
                // 確保期間索引有效且對應的數值存在
                if (periodIndex >= 0 && periodIndex < values.length) {
                  const rawValue = values[periodIndex];
                  console.log(`Raw value for ${period}:`, rawValue);
                  
                  if (rawValue === '--' || rawValue === '-') {
                    return null;
                  }
                  return yahooFinanceUSTransforms.parseUSFinancialValue(rawValue) as number | null;
                }
              } else {
                console.log('No main data cell found with TTM and date pattern');
              }

              // 備用邏輯1：如果是 TTM，直接返回第一個數值
              if (period === 'TTM' && values.length > 0) {
                const rawValue = values[0];
                console.log(`TTM fallback value:`, rawValue);
                if (rawValue === '--' || rawValue === '-') {
                  return null;
                }
                return yahooFinanceUSTransforms.parseUSFinancialValue(rawValue) as number | null;
              }

              // 備用邏輯2：嘗試通過期間順序匹配
              const allPeriods = findTimePeriods(cells);
              const globalPeriodIndex = allPeriods.indexOf(period);
              if (globalPeriodIndex >= 0 && globalPeriodIndex < values.length) {
                const rawValue = values[globalPeriodIndex];
                console.log(`Global period index ${globalPeriodIndex} value:`, rawValue);
                if (rawValue === '--' || rawValue === '-') {
                  return null;
                }
                return yahooFinanceUSTransforms.parseUSFinancialValue(rawValue) as number | null;
              }

              // 備用邏輯3：更寬鬆的行匹配 - 尋找任何包含期間和數值的行
              for (const cellCheck of cells) {
                if (!cellCheck || typeof cellCheck !== 'string') continue;
                
                // 如果這行同時包含指標名稱和目標期間
                if (cellCheck.toLowerCase().includes(metric.toLowerCase()) && cellCheck.includes(period)) {
                  console.log(`Fallback: found cell with both metric and period:`, cellCheck.substring(0, 150));
                  
                  // 提取這行中所有的數值
                  const numbersInLine = cellCheck.match(/\b\d{1,3}(?:,\d{3})*(?:\.\d+)?[BMKbmk]?\b/g);
                  if (numbersInLine && numbersInLine.length > 0) {
                    console.log(`Fallback: extracted numbers from line:`, numbersInLine);
                    // 取第一個看起來合理的數值
                    const fallbackValue = numbersInLine[0];
                    if (fallbackValue !== '--' && fallbackValue !== '-') {
                      return yahooFinanceUSTransforms.parseUSFinancialValue(fallbackValue) as number | null;
                    }
                  }
                }
              }
            }
          }
        }
      }

      console.log(`No value found for metric ${metric} period ${period}`);
      return null;
    }


    // 內部函數：創建最小的備用數據
    function createMinimalFallback(): USFinancialData[] {
      return [{
        fiscalPeriod: "Parsing failed",
        totalRevenue: null
      }];
    }
  }
};

/**
 * 註冊 Yahoo Finance US 轉換函數到全域註冊表
 */
export function registerYahooFinanceUSTransforms(registry: any): void {
  Object.entries(yahooFinanceUSTransforms).forEach(([name, fn]) => {
    registry[name] = fn;
  });
}

/**
 * 獲取 Yahoo Finance US 特定轉換函數
 */
export function getYahooFinanceUSTransform(name: keyof YahooFinanceUSTransforms): Function | null {
  return yahooFinanceUSTransforms[name] || null;
}

/**
 * ==========================================
 * 標準化資料轉換函數 (Standardization Functions)
 * ==========================================
 * 將美國 Yahoo Finance 資料轉換為標準化格式
 * 用於匯入後端 FundamentalDataEntity
 */

/**
 * 轉換美國日期格式為 ISO 格式
 * @param dateStr 美國日期字串，如 "9/30/2024" 或 "TTM"
 * @returns ISO 日期格式 "2024-09-30"
 */
function convertUSDateFormat(dateStr: string | null): string {
  if (!dateStr || dateStr === 'TTM') {
    return new Date().toISOString().split('T')[0];
  }
  
  // 處理 "9/30/2024" 格式
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    const month = parts[0].padStart(2, '0');
    const day = parts[1].padStart(2, '0');
    const year = parts[2];
    return `${year}-${month}-${day}`;
  }
  
  return new Date().toISOString().split('T')[0];
}

/**
 * 從日期推算季度
 * @param dateStr ISO 日期格式
 * @returns 季度 (1-4)
 */
function getQuarterFromDate(dateStr: string): number | undefined {
  const date = new Date(dateStr);
  const month = date.getMonth() + 1; // getMonth() returns 0-11
  return Math.ceil(month / 3);
}

/**
 * 將美國財務報表資料轉換為標準化格式
 * @param data 美國財務資料
 * @param symbolCode 股票代碼 (如 "AAPL")
 * @returns 標準化財務資料
 */
export function toStandardizedFromFinancials(
  data: USFinancialData,
  symbolCode: string
): StandardizedFundamentalData {
  const reportDate = convertUSDateFormat(data.fiscalPeriod);
  const isTTM = data.fiscalPeriod === 'TTM';
  const fiscalYear = new Date(reportDate).getFullYear();
  const fiscalQuarter = isTTM ? undefined : getQuarterFromDate(reportDate);
  
  return {
    // 基本資訊
    symbolCode: symbolCode, // 美國股票不需要去除後綴
    exchangeArea: 'US',
    reportDate: reportDate,
    fiscalYear: fiscalYear,
    fiscalQuarter: fiscalQuarter,
    reportType: isTTM ? FiscalReportType.ANNUAL : 
                (fiscalQuarter ? FiscalReportType.QUARTERLY : FiscalReportType.ANNUAL),
    
    // 損益表數據（千美元 × 1000 → 美元）
    revenue: data.totalRevenue ? data.totalRevenue * 1000 : undefined,
    costOfGoodsSold: data.costOfRevenue ? data.costOfRevenue * 1000 : undefined,
    grossProfit: data.grossProfit ? data.grossProfit * 1000 : undefined,
    operatingExpenses: data.operatingExpense ? data.operatingExpense * 1000 : undefined,
    operatingIncome: data.operatingIncome ? data.operatingIncome * 1000 : undefined,
    incomeBeforeTax: data.pretaxIncome ? data.pretaxIncome * 1000 : undefined,
    taxExpense: data.taxProvision ? data.taxProvision * 1000 : undefined,
    netIncome: data.netIncomeCommonStockholders ? data.netIncomeCommonStockholders * 1000 : undefined,
    ebitda: data.ebitda ? data.ebitda * 1000 : undefined,
    
    // EPS 不需轉換
    eps: data.basicEPS || undefined,
    dilutedEPS: data.dilutedEPS || undefined,
    
    // 元數據
    dataSource: 'yahoo-finance-us',
    lastUpdated: new Date().toISOString(),
    currencyCode: 'USD'
  };
}

/**
 * 將美國現金流量表資料轉換為標準化格式
 * @param data 美國現金流資料
 * @param symbolCode 股票代碼 (如 "AAPL")
 * @returns 標準化財務資料
 */
export function toStandardizedFromCashFlow(
  data: USCashFlowData,
  symbolCode: string
): StandardizedFundamentalData {
  const reportDate = convertUSDateFormat(data.fiscalPeriod);
  const isTTM = data.fiscalPeriod === 'TTM';
  const fiscalYear = new Date(reportDate).getFullYear();
  const fiscalQuarter = isTTM ? undefined : getQuarterFromDate(reportDate);
  
  return {
    // 基本資訊
    symbolCode: symbolCode,
    exchangeArea: 'US',
    reportDate: reportDate,
    fiscalYear: fiscalYear,
    fiscalQuarter: fiscalQuarter,
    reportType: isTTM ? FiscalReportType.ANNUAL : 
                (fiscalQuarter ? FiscalReportType.QUARTERLY : FiscalReportType.ANNUAL),
    
    // 現金流數據（單位已是美元，直接使用）
    operatingCashFlow: data.operatingCashFlow || undefined,
    investingCashFlow: data.investingCashFlow || undefined,
    financingCashFlow: data.financingCashFlow || undefined,
    freeCashFlow: data.freeCashFlow || undefined,
    capex: data.capitalExpenditure || undefined,
    debtIssuance: data.issuanceOfDebt || undefined,
    debtRepayment: data.repaymentOfDebt || undefined,
    
    // 元數據
    dataSource: 'yahoo-finance-us',
    lastUpdated: new Date().toISOString(),
    currencyCode: 'USD'
  };
}

/**
 * 批量轉換美國財務資料為標準化格式
 * @param dataType 資料類型
 * @param dataArray 資料陣列
 * @param symbolCode 股票代碼
 * @returns 標準化財務資料陣列
 */
export function batchToStandardized(
  dataType: 'financials' | 'cashflow',
  dataArray: any[],
  symbolCode: string
): StandardizedFundamentalData[] {
  const results: StandardizedFundamentalData[] = [];
  
  for (const data of dataArray) {
    let standardized: StandardizedFundamentalData | null = null;
    
    switch (dataType) {
      case 'financials':
        standardized = toStandardizedFromFinancials(data as USFinancialData, symbolCode);
        break;
      case 'cashflow':
        standardized = toStandardizedFromCashFlow(data as USCashFlowData, symbolCode);
        break;
    }
    
    if (standardized) {
      results.push(standardized);
    }
  }
  
  return results;
}
