/**
 * Yahoo Finance US 網站特定的轉換函數 (簡化版本)
 * 遵循 CLAUDE.md 獨立選擇器原則，符合 UnifiedFinancialData 規範
 */

import { UnifiedFinancialData } from '../../types/unified-financial-data';
import { FiscalReportType, MarketRegion, UNIT_MULTIPLIERS } from '../../common/';

/**
 * 歷史股價數據類型定義
 */
export interface HistoricalStockPrice {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  adjustedClose?: number;
  symbolCode: string;
}

/**
 * Yahoo Finance US 轉換函數接口 (簡化版本)
 * 統一返回 UnifiedFinancialData[] 格式
 */
export interface YahooFinanceUSTransforms {
  cleanStockSymbol: (value: string) => string;
  parseUSFinancialValue: (value: string) => number;
  parseUSFinancialValuesArray: (content: string | string[]) => number[];
  parseUSFinancialPeriodsArray: (content: string | string[]) => Array<{
    year: number;
    quarter?: number;
    month?: number;
    day?: number;
    isTTM?: boolean;
    originalDate?: string;
  }>;
  parseUnifiedFiscalPeriod: (value: string) => {
    year: number;
    quarter?: number;
    month?: number;
  };
  parseUSFinancialDatesArray: (content: string | string[]) => string[];
  combineUSFinancialData: (content: any, context?: any) => UnifiedFinancialData[];
  // 歷史股價數據轉換函數
  parseUSDateArray: (content: string | string[]) => string[];
  parseUSStockPriceArray: (content: string | string[]) => number[];
  parseUSVolumeArray: (content: string | string[]) => number[];
  combineUSHistoricalData: (content: any, context?: any) => HistoricalStockPrice[];
}

/**
 * === 函數實現 ===
 */

export const yahooFinanceUSTransforms: YahooFinanceUSTransforms = {
  /**
   * 清理美國股票代碼和公司名稱
   * 例如：從 "Berkshire Hathaway Inc. (BRK-B)" 提取乾淨的文本
   */
  cleanStockSymbol: (value: string): string => {
    if (!value) return '';
    const cleaned = value.toString().trim();
    return cleaned.replace(/\s+/g, ' ').replace(/[\r\n\t]/g, '');
  },

  /**
   * 解析美國財務數值
   * 處理千分位逗號、B (Billion)、M (Million)、K (Thousand) 等單位
   * 例如：從 "415.78B" 提取 415780000000，從 "1,234.56M" 提取 1234560000
   */
  parseUSFinancialValue: (value: string): number => {
    if (!value) return 0;

    const str = value.toString().trim();

    // 處理 "---" 或 "--" 等缺失值
    const missingValueRegex = /^[-—\-*・\s]*$|^(N\/A|n\/a|NA|--)$/;
    if (missingValueRegex.test(str)) {
      return 0;
    }

    // 移除千分位逗號和空白
    let cleanValue = str.replace(/[,\s()]/g, '');

    // 處理負數
    let isNegative = cleanValue.includes('-') || (str.includes('(') && str.includes(')'));
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
      return 0;
    }

    return isNegative ? -(numValue * multiplier) : (numValue * multiplier);
  },

  /**
   * 解析美國財務數值陣列
   * 類似台灣和日本模板的數值陣列處理
   */
  parseUSFinancialValuesArray: (content: string | string[]): number[] => {
    console.log('[US Values Array] 💰 處理美國財務數值陣列...');
    const contentArray = Array.isArray(content) ? content : [content];
    const values: number[] = [];

    for (const item of contentArray) {
      if (!item || typeof item !== 'string') continue;

      const str = item.toString().trim();

      // 缺失值檢測
      const missingValueRegex = /^[-—\-*・\s]*$|^(N\/A|n\/a|NA|--)$/;
      if (missingValueRegex.test(str)) {
        console.log(`[US Values Array] 🔍 檢測到缺失值: "${str}" -> 轉換為 0`);
        values.push(0);
        continue;
      }

      // 使用現有的 parseUSFinancialValue 函數
      const parsedValue = yahooFinanceUSTransforms.parseUSFinancialValue(str);
      values.push(parsedValue);
    }

    console.log(`[US Values Array] ✅ 成功處理 ${values.length} 個數值:`, values);
    return values;
  },

  /**
   * 解析美國財務期間陣列
   */
  parseUSFinancialPeriodsArray: (content: string | string[]): Array<{
    year: number;
    quarter?: number;
    month?: number;
    day?: number;
    isTTM?: boolean;
    originalDate?: string;
  }> => {
    console.log('[US Periods Array] 📅 處理美國期間陣列...');
    const contentArray = Array.isArray(content) ? content : [content];
    const periods: Array<{
      year: number;
      quarter?: number;
      month?: number;
      day?: number;
      isTTM?: boolean;
      originalDate?: string
    }> = [];

    for (const item of contentArray) {
      if (!item || typeof item !== 'string') continue;

      const str = item.toString().trim();

      // TTM (Trailing Twelve Months) 特殊處理
      if (str.toUpperCase() === 'TTM') {
        periods.push({
          year: new Date().getFullYear(),
          month: new Date().getMonth() + 1,
          originalDate: 'TTM',
          isTTM: true,
        });
        continue;
      }

      // 日期格式: M/D/YYYY 或 MM/DD/YYYY (如 9/30/2024)
      const dateMatch = str.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
      if (dateMatch) {
        periods.push({
          year: parseInt(dateMatch[3]),
          month: parseInt(dateMatch[1]),
          day: parseInt(dateMatch[2]),
          originalDate: str,
        });
        continue;
      }

      // 季度格式: Q1 2024, Q2 2024 等
      const quarterMatch = str.match(/Q([1-4])\s+(\d{4})/);
      if (quarterMatch) {
        periods.push({
          year: parseInt(quarterMatch[2]),
          quarter: parseInt(quarterMatch[1]),
          originalDate: str,
        });
        continue;
      }

      // 純年份格式: 2024
      const yearMatch = str.match(/(\d{4})/);
      if (yearMatch) {
        periods.push({
          year: parseInt(yearMatch[1]),
          originalDate: str,
        });
        continue;
      }

      // 默認當年
      periods.push({
        year: new Date().getFullYear(),
        originalDate: str,
      });
    }

    console.log(`[US Periods Array] ✅ 成功處理 ${periods.length} 個期間`);
    return periods;
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

    // TTM 處理
    if (str.toUpperCase() === 'TTM') {
      return { year: new Date().getFullYear() };
    }

    // 美國日期格式: M/D/YYYY
    const dateMatch = str.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (dateMatch) {
      const month = parseInt(dateMatch[1]);
      const year = parseInt(dateMatch[3]);
      return {
        year,
        month,
        quarter: Math.ceil(month / 3),
      };
    }

    // 季度格式
    const quarterMatch = str.match(/Q([1-4])\s+(\d{4})/);
    if (quarterMatch) {
      return {
        year: parseInt(quarterMatch[2]),
        quarter: parseInt(quarterMatch[1]),
      };
    }

    return { year: new Date().getFullYear() };
  },

  /**
   * 解析美國財務日期陣列
   */
  parseUSFinancialDatesArray: (content: string | string[]): string[] => {
    console.log('[US Dates Array] 📅 處理美國財務日期陣列...');
    const contentArray = Array.isArray(content) ? content : [content];
    const dates: string[] = [];

    for (const item of contentArray) {
      if (!item || typeof item !== 'string') continue;

      const str = item.toString().trim();

      // 美國財務日期格式: M/D/YYYY
      const dateMatch = str.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
      if (dateMatch) {
        const [, month, day, year] = dateMatch;
        // 轉換為標準格式 YYYY-MM-DD
        const standardDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        dates.push(standardDate);
        console.log(`[US Dates Array] ✅ 轉換日期: "${str}" -> "${standardDate}"`);
      } else {
        // 如果無法解析，使用當前日期
        const fallbackDate = new Date().toISOString().split('T')[0];
        dates.push(fallbackDate);
        console.log(`[US Dates Array] ⚠️ 無法解析日期: "${str}"，使用默認: "${fallbackDate}"`);
      }
    }

    console.log(`[US Dates Array] ✅ 成功處理 ${dates.length} 個日期:`, dates);
    return dates;
  },

  /**
   * 組合美國財務數據
   * 將個別提取的數據組合成統一的 UnifiedFinancialData 格式
   */
  combineUSFinancialData: (content: any, context?: any): UnifiedFinancialData[] => {
    console.log('[US Combine] 🔗 開始組合美國財務數據...', context?.variables || {});

    if (!context) return [];

    const results: UnifiedFinancialData[] = [];
    const symbolCode = context.variables?.symbolCode || context.symbolCode || 'UNKNOWN';
    const vars = context.variables || {};

    // 獲取期間陣列 - 正確對應配置檔案中的欄位名稱
    const periodsArray = vars.fiscalPeriodsArray || vars.periodsArray || [];

    // 檢查是否為現金流數據 - 正確對應配置檔案中的欄位名稱
    const operatingCashFlowArray = vars.operatingCashFlowValues || vars.operatingCashflowValues || [];
    const investingCashFlowArray = vars.investingCashFlowValues || vars.investingCashflowValues || [];
    const financingCashFlowArray = vars.financingCashFlowValues || vars.financingCashflowValues || [];
    const freeCashFlowArray = vars.freeCashFlowValues || vars.freeCashflowValues || [];

    // 檢查是否為損益表數據 - 正確對應配置檔案中的欄位名稱
    const revenueArray = vars.totalRevenueValues || vars.revenueValues || [];
    const netIncomeArray = vars.netIncomeCommonStockholdersValues || vars.netIncomeValues || [];
    const epsArray = vars.basicEPSValues || vars.epsValues || [];
    const dilutedEpsArray = vars.dilutedEPSValues || [];

    // 檢查是否為資產負債表數據 - 正確對應配置檔案中的欄位名稱
    const totalAssetsArray = vars.totalAssetsValues || [];
    const totalLiabilitiesArray = vars.totalLiabilitiesValues || [];

    // 獲取財務更新日期陣列
    const financialUpdateDatesArray = vars.financialUpdateDates || [];

    // 找出最大陣列長度（但先過濾掉 TTM）
    const nonTTMCount = periodsArray.filter((p: any) =>
      !(p && typeof p === 'object' && p.isTTM),
    ).length;

    const maxLength = nonTTMCount > 0 ? nonTTMCount : Math.max(
      periodsArray.length,
      operatingCashFlowArray.length,
      revenueArray.length,
      totalAssetsArray.length,
      1, // 至少處理一筆
    );

    console.log(`[US Combine] 📊 檢測到最大陣列長度: ${maxLength} (排除TTM後)`);

    // 為每個期間創建記錄 (跳過 TTM 數據)
    let dataIndex = 0; // 用於追蹤實際數據陣列的索引
    for (let i = 0; i < periodsArray.length; i++) {
      // 檢查是否為 TTM 數據，如果是則跳過
      if (periodsArray[i] && typeof periodsArray[i] === 'object' && periodsArray[i].isTTM) {
        console.log(`[US Combine] ⏭️ 跳過 TTM 數據 (索引 ${i})`);
        continue;
      }

      // 基本的 UnifiedFinancialData 結構
      const financialData: UnifiedFinancialData = {
        symbolCode: symbolCode, // 美國股票不需要去除後綴
        exchangeArea: MarketRegion.US,
        reportDate: '', // 會在處理期間信息時設定
        fiscalYear: 0, // 會在處理期間信息時設定
        fiscalMonth: 12, // 美國財年通常結束於12月，會在處理期間信息時更新
        reportType: FiscalReportType.ANNUAL,
        dataSource: 'yahoo-finance-us',
        lastUpdated: new Date().toISOString(),
      };

      // 根據數據類型添加相應欄位
      // 檢查現金流相關欄位
      if (operatingCashFlowArray[0] !== undefined || freeCashFlowArray[0] !== undefined) {
        // Yahoo Finance US 現金流數據單位為千，需要乘以 UNIT_MULTIPLIERS.THOUSAND_USD
        financialData.operatingCashFlow = (operatingCashFlowArray[i] || 0) * UNIT_MULTIPLIERS.THOUSAND_USD;
        financialData.investingCashFlow = (investingCashFlowArray[i] || 0) * UNIT_MULTIPLIERS.THOUSAND_USD;
        financialData.financingCashFlow = (financingCashFlowArray[i] || 0) * UNIT_MULTIPLIERS.THOUSAND_USD;
        financialData.freeCashFlow = (freeCashFlowArray[i] || 0) * UNIT_MULTIPLIERS.THOUSAND_USD;

        // 資本支出和其他現金流項目 - 修正變數名稱映射
        financialData.capex = ((vars.capitalExpenditureValues || [])[i] || 0) * UNIT_MULTIPLIERS.THOUSAND_USD;
        financialData.debtIssuance = ((vars.issuanceOfDebtValues || [])[i] || 0) * UNIT_MULTIPLIERS.THOUSAND_USD;
        financialData.debtRepayment = ((vars.repaymentOfDebtValues || [])[i] || 0) * UNIT_MULTIPLIERS.THOUSAND_USD;
      }
      // 檢查損益表相關欄位
      else if (revenueArray[0] !== undefined || netIncomeArray[0] !== undefined) {
        // Yahoo Finance US 財務數據單位為千，需要乘以 UNIT_MULTIPLIERS.THOUSAND_USD
        financialData.revenue = (revenueArray[i] || 0) * UNIT_MULTIPLIERS.THOUSAND_USD;
        financialData.costOfGoodsSold = ((vars.costOfRevenueValues || [])[i] || 0) * UNIT_MULTIPLIERS.THOUSAND_USD;
        financialData.grossProfit = ((vars.grossProfitValues || [])[i] || 0) * UNIT_MULTIPLIERS.THOUSAND_USD;
        financialData.operatingIncome = ((vars.operatingIncomeValues || [])[i] || 0) * UNIT_MULTIPLIERS.THOUSAND_USD;
        financialData.netIncome = (netIncomeArray[i] || 0) * UNIT_MULTIPLIERS.THOUSAND_USD;
        financialData.ebitda = ((vars.ebitdaValues || [])[i] || 0) * UNIT_MULTIPLIERS.THOUSAND_USD;

        // EPS 不需轉換
        financialData.eps = epsArray[i] || 0;
        financialData.dilutedEPS = dilutedEpsArray[i] || 0;

        // 美國特有欄位放入 regionalData
        financialData.regionalData = {
          basicAverageShares: (vars.basicAverageSharesValues || [])[i] || 0,
          dilutedAverageShares: (vars.dilutedAverageSharesValues || [])[i] || 0,
          pretaxIncome: ((vars.pretaxIncomeValues || [])[i] || 0) * UNIT_MULTIPLIERS.THOUSAND_USD,
          taxProvision: ((vars.taxProvisionValues || [])[i] || 0) * UNIT_MULTIPLIERS.THOUSAND_USD,
          interestIncome: ((vars.interestIncomeValues || [])[i] || 0) * UNIT_MULTIPLIERS.THOUSAND_USD,
          interestExpense: ((vars.interestExpenseValues || [])[i] || 0) * UNIT_MULTIPLIERS.THOUSAND_USD,
        };
      }
      // 檢查資產負債表相關欄位
      else if (totalAssetsArray[0] !== undefined || totalLiabilitiesArray[0] !== undefined) {
        // Yahoo Finance US 資產負債表數據單位為千，需要乘以 UNIT_MULTIPLIERS.THOUSAND_USD
        financialData.totalAssets = (totalAssetsArray[i] || 0) * UNIT_MULTIPLIERS.THOUSAND_USD;
        financialData.totalLiabilities = (totalLiabilitiesArray[i] || 0) * UNIT_MULTIPLIERS.THOUSAND_USD;
        financialData.shareholdersEquity = ((vars.totalEquityValues || [])[i] || 0) * UNIT_MULTIPLIERS.THOUSAND_USD;
        financialData.workingCapital = ((vars.workingCapitalValues || [])[i] || 0) * UNIT_MULTIPLIERS.THOUSAND_USD;
        financialData.totalDebt = ((vars.totalDebtValues || [])[i] || 0) * UNIT_MULTIPLIERS.THOUSAND_USD;
        financialData.cashAndEquivalents = ((vars.cashAndEquivalentsValues || [])[i] || 0) * UNIT_MULTIPLIERS.THOUSAND_USD;

        // 修正流通股數映射 - 使用實際可用的數據欄位
        financialData.sharesOutstanding = (vars.shareIssuedValues || vars.ordinarySharesNumberValues || [])[i] || 0;

        // 計算每股淨值 = 股東權益 ÷ 流通股數
        const shareholdersEquity = ((vars.totalEquityValues || [])[i] || 0);
        const sharesOutstanding = financialData.sharesOutstanding || 0;
        financialData.bookValuePerShare = sharesOutstanding > 0 ? shareholdersEquity / sharesOutstanding : 0;

        // 美國特有欄位放入 regionalData
        financialData.regionalData = {
          totalCapitalization: ((vars.totalCapitalizationValues || [])[i] || 0) * UNIT_MULTIPLIERS.THOUSAND_USD,
          commonStockEquity: ((vars.commonStockEquityValues || [])[i] || 0) * UNIT_MULTIPLIERS.THOUSAND_USD,
          netTangibleAssets: ((vars.netTangibleAssetsValues || [])[i] || 0) * UNIT_MULTIPLIERS.THOUSAND_USD,
          netDebt: ((vars.netDebtValues || [])[i] || 0) * UNIT_MULTIPLIERS.THOUSAND_USD,
        };
      }

      // 處理期間信息 - 使用實際的期間數據，不推算
      if (periodsArray[i]) {
        const parsed = typeof periodsArray[i] === 'object'
          ? periodsArray[i]
          : yahooFinanceUSTransforms.parseUnifiedFiscalPeriod(periodsArray[i]);

        // 使用實際解析出的年份
        financialData.fiscalYear = parsed.year;

        // 如果有具體日期（M/D/YYYY 格式）
        if (parsed.day && parsed.month) {
          financialData.fiscalMonth = parsed.month;
          financialData.reportDate = `${parsed.year}-${parsed.month.toString().padStart(2, '0')}-${parsed.day.toString().padStart(2, '0')}`;
        }
        // 如果是季度格式
        else if (parsed.quarter) {
          const quarterEndMonths = [3, 6, 9, 12];
          const quarterEndDays = [31, 30, 30, 31];
          financialData.fiscalMonth = quarterEndMonths[parsed.quarter - 1];
          financialData.reportDate = `${parsed.year}-${quarterEndMonths[parsed.quarter - 1].toString().padStart(2, '0')}-${quarterEndDays[parsed.quarter - 1]}`;
          financialData.reportType = FiscalReportType.QUARTERLY;
        }
        // 如果只有年份
        else {
          financialData.fiscalMonth = 12; // 預設為年底
          financialData.reportDate = `${parsed.year}-12-31`;
        }
      } else {
        // 如果沒有期間資料，使用財務更新日期或預設值
        if (financialUpdateDatesArray[i]) {
          financialData.reportDate = financialUpdateDatesArray[i];
          // 從日期解析年月
          const dateMatch = financialUpdateDatesArray[i].match(/(\d{4})-(\d{2})-(\d{2})/);
          if (dateMatch) {
            financialData.fiscalYear = parseInt(dateMatch[1]);
            financialData.fiscalMonth = parseInt(dateMatch[2]);
          }
        } else {
          // 最後的備用方案
          console.warn(`[US Combine] ⚠️ 索引 ${i} 缺少期間資料，使用預設值`);
          const fallbackYear = new Date().getFullYear() - dataIndex;
          financialData.fiscalYear = fallbackYear;
          financialData.fiscalMonth = 12;
          financialData.reportDate = `${fallbackYear}-12-31`;
        }
      }

      results.push(financialData);
      dataIndex++; // 增加實際數據索引
    }

    console.log(`[US Combine] ✅ 成功組合 ${results.length} 筆美國財務數據`);
    return results;
  },

  /**
   * 解析美國日期陣列 (歷史股價專用)
   * 處理美國格式: "Aug 14, 2025" -> "2025-08-14"
   */
  parseUSDateArray: (content: string | string[]): string[] => {
    console.log('[US Date Array] 📅 處理美國歷史日期陣列...');
    const contentArray = Array.isArray(content) ? content : [content];
    const dates: string[] = [];

    for (const item of contentArray) {
      if (!item || typeof item !== 'string') continue;

      const str = item.toString().trim();

      // 美國日期格式: "Aug 14, 2025"
      const dateMatch = str.match(/(\w{3})\s+(\d{1,2}),\s+(\d{4})/);
      if (dateMatch) {
        const [, monthStr, day, year] = dateMatch;
        
        // 月份映射
        const monthMap: { [key: string]: string } = {
          'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04',
          'May': '05', 'Jun': '06', 'Jul': '07', 'Aug': '08',
          'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
        };
        
        const month = monthMap[monthStr] || '01';
        const standardDate = `${year}-${month}-${day.padStart(2, '0')}`;
        dates.push(standardDate);
        console.log(`[US Date Array] ✅ 轉換日期: "${str}" -> "${standardDate}"`);
      } else {
        // 如果無法解析，使用當前日期
        const fallbackDate = new Date().toISOString().split('T')[0];
        dates.push(fallbackDate);
        console.log(`[US Date Array] ⚠️ 無法解析日期: "${str}"，使用默認: "${fallbackDate}"`);
      }
    }

    console.log(`[US Date Array] ✅ 成功處理 ${dates.length} 個日期:`, dates);
    return dates;
  },

  /**
   * 解析美國股價陣列 (歷史股價專用)
   * 處理美國格式: "2.2900" -> 2.29
   */
  parseUSStockPriceArray: (content: string | string[]): number[] => {
    console.log('[US Stock Price Array] 💰 處理美國股價陣列...');
    const contentArray = Array.isArray(content) ? content : [content];
    const prices: number[] = [];

    for (const item of contentArray) {
      if (!item || typeof item !== 'string') continue;

      const str = item.toString().trim();

      // 移除千分位逗號
      const cleanValue = str.replace(/,/g, '');
      const price = parseFloat(cleanValue);

      if (isNaN(price)) {
        console.log(`[US Stock Price Array] ⚠️ 無法解析價格: "${str}" -> 0`);
        prices.push(0);
      } else {
        prices.push(price);
        console.log(`[US Stock Price Array] ✅ 解析價格: "${str}" -> ${price}`);
      }
    }

    console.log(`[US Stock Price Array] ✅ 成功處理 ${prices.length} 個價格:`, prices);
    return prices;
  },

  /**
   * 解析美國成交量陣列 (歷史股價專用)
   * 處理美國格式: "320,244,000" -> 320244000
   */
  parseUSVolumeArray: (content: string | string[]): number[] => {
    console.log('[US Volume Array] 📊 處理美國成交量陣列...');
    const contentArray = Array.isArray(content) ? content : [content];
    const volumes: number[] = [];

    for (const item of contentArray) {
      if (!item || typeof item !== 'string') continue;

      const str = item.toString().trim();

      // 移除千分位逗號
      const cleanValue = str.replace(/,/g, '');
      const volume = parseInt(cleanValue);

      if (isNaN(volume)) {
        console.log(`[US Volume Array] ⚠️ 無法解析成交量: "${str}" -> 0`);
        volumes.push(0);
      } else {
        volumes.push(volume);
        console.log(`[US Volume Array] ✅ 解析成交量: "${str}" -> ${volume}`);
      }
    }

    console.log(`[US Volume Array] ✅ 成功處理 ${volumes.length} 個成交量:`, volumes);
    return volumes;
  },

  /**
   * 組合美國歷史股價數據
   * 將個別提取的數據組合成統一的 HistoricalStockPrice 格式，符合 OhlcvDaysEntity 要求
   */
  combineUSHistoricalData: (content: any, context?: any): HistoricalStockPrice[] => {
    console.log('[US History Combine] 🔗 開始組合美國歷史股價數據...', context?.variables || {});

    if (!context) return [];

    const results: HistoricalStockPrice[] = [];
    const symbolCode = context.variables?.symbolCode || context.symbolCode || 'UNKNOWN';
    const vars = context.variables || {};

    // 獲取各類數據陣列
    const datesArray = vars.historicalDates || [];
    const openPricesArray = vars.openPrices || [];
    const highPricesArray = vars.highPrices || [];
    const lowPricesArray = vars.lowPrices || [];
    const closePricesArray = vars.closePrices || [];
    const volumesArray = vars.volumes || [];
    const adjustedClosePricesArray = vars.adjustedClosePrices || [];

    // 找出最大陣列長度
    const maxLength = Math.max(
      datesArray.length,
      openPricesArray.length,
      highPricesArray.length,
      lowPricesArray.length,
      closePricesArray.length,
      volumesArray.length,
      adjustedClosePricesArray.length,
    );

    console.log(`[US History Combine] 📊 偵測到最大陣列長度: ${maxLength}`);

    // 為每個歷史記錄創建對象
    for (let i = 0; i < maxLength; i++) {
      const historicalData: HistoricalStockPrice = {
        date: datesArray[i] || new Date().toISOString().split('T')[0],
        open: openPricesArray[i] || 0,
        high: highPricesArray[i] || 0,
        low: lowPricesArray[i] || 0,
        close: closePricesArray[i] || 0,
        volume: volumesArray[i] || 0,
        adjustedClose: adjustedClosePricesArray[i] || undefined,
        symbolCode: symbolCode, // 美國股票代碼保持原樣
      };

      results.push(historicalData);

      console.log(`[US History Combine] ✅ 記錄 ${i + 1}: ${historicalData.date} | O:${historicalData.open} H:${historicalData.high} L:${historicalData.low} C:${historicalData.close} V:${historicalData.volume}`);
    }

    console.log(`[US History Combine] ✅ 成功組合 ${results.length} 筆美國歷史股價數據`);
    return results;
  },
};

/**
 * 註冊 Yahoo Finance US 轉換函數
 * 與 index.ts 中的引用保持兼容
 */
export function registerYahooFinanceUSTransforms(): YahooFinanceUSTransforms {
  return yahooFinanceUSTransforms;
}
