/**
 * Yahoo Finance Japan 網站特定的轉換函數 (簡化版本)
 * 遵循 CLAUDE.md 獨立選擇器原則，只提供基礎解析函數
 */

/**
 * Yahoo Finance JP 轉換函數接口 (簡化版本)
 * 只保留模板中實際使用的函數
 */
export interface YahooFinanceJPTransforms {
  cleanStockSymbol: (value: string) => string;
  parseJapaneseFinancialValue: (value: string) => number;
  parseJapaneseFinancialValuesArray: (content: string | string[]) => number[];
  parseUnifiedFiscalPeriod: (value: string) => {
    year: number;
    quarter?: number;
    month?: number;
  };
  parseUnifiedFiscalPeriodsArray: (content: string | string[]) => Array<{
    year: number;
    quarter?: number;
    month?: number;
  }>;
  combineJapaneseFinancialData: (content: any, context?: any) => any[];
}

/**
 * === 函數實現 ===
 */

export const yahooFinanceJPTransforms: YahooFinanceJPTransforms = {
  /**
   * 清理股票代碼和公司名稱
   * 例如：從 "143A - エフピコ" 提取 "143A"
   */
  cleanStockSymbol: (value: string): string => {
    if (!value) return '';
    const cleaned = value.toString().trim();
    return cleaned.replace(/\s+/g, ' ').replace(/[\r\n\t]/g, '');
  },

  /**
   * 解析日文財務數值
   * 處理百万円、千円等單位，以及 "---" 或 "—" 等缺失值
   */
  parseJapaneseFinancialValue: (value: string): number => {
    if (!value) return 0;
    
    const str = value.toString().trim();
    
    // 處理缺失值
    if (str === '---' || str === '—' || str === '--' || str === '') {
      return 0;
    }
    
    // 移除逗號和空白
    let cleaned = str.replace(/[,\s]/g, '');
    
    // 處理百万円單位 (百万 = million)
    if (cleaned.includes('百万円')) {
      const match = cleaned.match(/([\d.-]+)百万円?/);
      if (match) {
        const num = parseFloat(match[1]);
        return isNaN(num) ? 0 : num;
      }
    }
    
    // 處理千円單位 (千 = thousand)
    if (cleaned.includes('千円')) {
      const match = cleaned.match(/([\d.-]+)千円?/);
      if (match) {
        const num = parseFloat(match[1]);
        return isNaN(num) ? 0 : num / 1000;
      }
    }
    
    // 處理一般數值
    const match = cleaned.match(/([\d.-]+)/);
    if (match) {
      const num = parseFloat(match[1]);
      return isNaN(num) ? 0 : num;
    }
    
    return 0;
  },

  /**
   * 解析日文財務數值陣列
   * 類似台灣模板的 extractCashFlowValuesSeparately
   */
  parseJapaneseFinancialValuesArray: (content: string | string[]): number[] => {
    console.log('[JP Values Array] 💰 處理日文財務數值陣列...');
    const contentArray = Array.isArray(content) ? content : [content];
    const values: number[] = [];

    for (const item of contentArray) {
      if (!item || typeof item !== 'string') continue;
      
      const str = item.toString().trim();
      
      // 處理缺失值
      if (str === '---' || str === '—' || str === '--' || str === '') {
        values.push(0);
        continue;
      }
      
      // 移除逗號和空白
      let cleaned = str.replace(/[,\s]/g, '');
      
      // 處理百万円單位
      if (cleaned.includes('百万円')) {
        const match = cleaned.match(/([\d.-]+)百万円?/);
        if (match) {
          const num = parseFloat(match[1]);
          values.push(isNaN(num) ? 0 : num);
          continue;
        }
      }
      
      // 處理千円單位
      if (cleaned.includes('千円')) {
        const match = cleaned.match(/([\d.-]+)千円?/);
        if (match) {
          const num = parseFloat(match[1]);
          values.push(isNaN(num) ? 0 : num / 1000);
          continue;
        }
      }
      
      // 處理一般數值
      const match = cleaned.match(/([\d.-]+)/);
      if (match) {
        const num = parseFloat(match[1]);
        values.push(isNaN(num) ? 0 : num);
      } else {
        values.push(0);
      }
    }
    
    console.log(`[JP Values Array] ✅ 成功處理 ${values.length} 個數值:`, values);
    return values;
  },

  /**
   * 解析統一的會計年度期間
   */
  parseUnifiedFiscalPeriod: (value: string): {
    year: number;
    quarter?: number;
    month?: number;
  } => {
    if (!value) return { year: new Date().getFullYear() };

    const str = value.toString().trim();
    
    // 日本會計年度格式: 2024年3月期, 2023年度等
    const yearMatch = str.match(/(\d{4})年/);
    if (yearMatch) {
      const year = parseInt(yearMatch[1]);
      
      // 檢查是否有季度信息
      const quarterMatch = str.match(/Q([1-4])/);
      if (quarterMatch) {
        return {
          year,
          quarter: parseInt(quarterMatch[1])
        };
      }
      
      // 檢查是否有月份信息
      const monthMatch = str.match(/(\d{1,2})月/);
      if (monthMatch) {
        return {
          year,
          month: parseInt(monthMatch[1])
        };
      }
      
      return { year };
    }
    
    return { year: new Date().getFullYear() };
  },

  /**
   * 解析統一的會計年度期間陣列
   */
  parseUnifiedFiscalPeriodsArray: (content: string | string[]): Array<{
    year: number;
    quarter?: number;
    month?: number;
  }> => {
    console.log('[JP Periods Array] 📅 處理日文期間陣列...');
    const contentArray = Array.isArray(content) ? content : [content];
    const periods: Array<{ year: number; quarter?: number; month?: number }> = [];

    for (const item of contentArray) {
      if (!item || typeof item !== 'string') continue;
      
      const parsed = yahooFinanceJPTransforms.parseUnifiedFiscalPeriod(item);
      periods.push(parsed);
    }
    
    console.log(`[JP Periods Array] ✅ 成功處理 ${periods.length} 個期間:`, periods);
    return periods;
  },

  /**
   * 組合日本財務數據 (簡化版本)
   * 將個別提取的數據組合成統一格式
   */
  combineJapaneseFinancialData: (content: any, context?: any): any[] => {
    console.log('[JP Combine] 🔗 開始組合日本財務數據...', context?.variables || {});
    
    if (!context) return [];

    const results: any[] = [];
    const symbolCode = context.variables?.symbolCode || context.symbolCode || '0000';
    const vars = context.variables || {};
    
    // 獲取期間陣列 - 支援新的陣列提取函數
    const periodsArray = vars.periodsArray || (Array.isArray(vars.period) ? vars.period : [vars.period]);
    
    // 檢查是否為陣列數據 (cashflow 相關)
    const freeCashflowArray = vars.freeCashflowValues || (Array.isArray(vars.freeCashflow) ? vars.freeCashflow : [vars.freeCashflow]);
    const operatingCashflowArray = vars.operatingCashflowValues || (Array.isArray(vars.operatingCashflow) ? vars.operatingCashflow : [vars.operatingCashflow]);
    const investingCashflowArray = vars.investingCashflowValues || (Array.isArray(vars.investingCashflow) ? vars.investingCashflow : [vars.investingCashflow]);
    const financingCashflowArray = vars.financingCashflowValues || (Array.isArray(vars.financingCashflow) ? vars.financingCashflow : [vars.financingCashflow]);
    
    // 檢查是否為陣列數據 (performance 相關)
    const revenueArray = vars.revenueValues || (Array.isArray(vars.revenue) ? vars.revenue : [vars.revenue]);
    const operationProfitArray = vars.operationProfitValues || (Array.isArray(vars.operationProfit) ? vars.operationProfit : [vars.operationProfit]);
    
    // 檢查是否為陣列數據 (financials 相關)  
    const epsArray = vars.epsValues || (Array.isArray(vars.eps) ? vars.eps : [vars.eps]);
    const bpsArray = vars.bpsValues || (Array.isArray(vars.bps) ? vars.bps : [vars.bps]);
    
    // 找出最大陣列長度
    let maxLength = Math.max(
      periodsArray.length,
      freeCashflowArray.length,
      operatingCashflowArray.length,
      investingCashflowArray.length,
      financingCashflowArray.length,
      revenueArray.length,
      operationProfitArray.length,
      epsArray.length,
      bpsArray.length
    );
    
    // 如果所有陣列都是單一值，則預設為 1
    if (maxLength === 0) maxLength = 1;
    
    console.log(`[JP Combine] 📊 偵測到最大陣列長度: ${maxLength}`);
    
    // 為每個期間創建記錄
    for (let i = 0; i < maxLength; i++) {
      const currentYear = new Date().getFullYear();
      
      const financialData: any = {
        symbolCode: symbolCode.replace('.T', ''),
        exchangeArea: 'JP',
        reportDate: `${currentYear - i}-03-31`, // 日本會計年度通常3月結束
        fiscalYear: currentYear - i,
        reportType: 'annual',
        dataSource: 'yahoo-finance-jp',
        lastUpdated: new Date().toISOString(),
      };

      // 根據數據類型添加相應欄位
      // 檢查 cashflow 相關欄位
      if (freeCashflowArray[0] !== undefined || operatingCashflowArray[0] !== undefined) {
        financialData.freeCashFlow = freeCashflowArray[i] || 0;
        financialData.operatingCashFlow = operatingCashflowArray[i] || 0;
        financialData.investingCashFlow = investingCashflowArray[i] || 0;
        financialData.financingCashFlow = financingCashflowArray[i] || 0;
      }
      // 檢查 performance 相關欄位
      else if (revenueArray[0] !== undefined || operationProfitArray[0] !== undefined) {
        financialData.revenue = revenueArray[i] || 0;
        financialData.grossProfitMargin = (vars.grossProfitMarginValues || [])[i] || vars.grossProfitMargin || 0;
        financialData.operatingProfit = operationProfitArray[i] || 0;
        financialData.operatingMargin = (vars.operationProfitMarginValues || [])[i] || vars.operationProfitMargin || 0;
        financialData.ordinaryProfit = (vars.ordinaryProfitValues || [])[i] || vars.ordinaryProfit || 0;
        financialData.ordinaryMargin = (vars.ordinaryProfitMarginValues || [])[i] || vars.ordinaryProfitMargin || 0;
        financialData.netProfit = (vars.netProfitValues || [])[i] || vars.netProfit || 0;
      }
      // 檢查 financials 相關欄位
      else if (epsArray[0] !== undefined || bpsArray[0] !== undefined) {
        financialData.eps = epsArray[i] || 0;
        financialData.bookValuePerShare = bpsArray[i] || 0;
        financialData.returnOnAssets = (vars.roaValues || [])[i] || vars.roa || 0;
        financialData.returnOnEquity = (vars.roeValues || [])[i] || vars.roe || 0;
        financialData.totalAssets = (vars.totalAssetsValues || [])[i] || vars.totalAssets || 0;
        financialData.equityRatio = (vars.equityRatioValues || [])[i] || vars.equityRatio || 0;
        financialData.shareCapital = (vars.shareCapitalValues || [])[i] || vars.shareCapital || 0;
        financialData.interestBearingDebt = (vars.interestBearingDebtValues || [])[i] || vars.interestBearingDebt || 0;
        financialData.currentReceivables = (vars.currentReceivablesValues || [])[i] || vars.currentReceivables || 0;
      }

      // 處理期間信息
      if (periodsArray[i]) {
        const parsed = typeof periodsArray[i] === 'object' 
          ? periodsArray[i] 
          : yahooFinanceJPTransforms.parseUnifiedFiscalPeriod(periodsArray[i]);
        
        financialData.fiscalYear = parsed.year;
        if (parsed.month) {
          financialData.fiscalMonth = parsed.month;
          financialData.reportDate = `${parsed.year}-${parsed.month.toString().padStart(2, '0')}-31`;
        }
      }

      results.push(financialData);
    }
    
    console.log(`[JP Combine] ✅ 成功組合 ${results.length} 筆日本財務數據`);
    return results;
  }
};

/**
 * 註冊 Yahoo Finance JP 轉換函數
 * 與 index.ts 中的引用保持兼容
 */
export function registerYahooFinanceJPTransforms(): YahooFinanceJPTransforms {
  return yahooFinanceJPTransforms;
}