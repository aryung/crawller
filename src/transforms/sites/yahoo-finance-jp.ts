/**
 * Yahoo Finance Japan 網站特定的轉換函數 (簡化版本)
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
 * Yahoo Finance JP 轉換函數接口 (簡化版本)
 * 只保留模板中實際使用的函數
 */
export interface YahooFinanceJPTransforms {
  cleanStockSymbol: (value: string) => string;
  parseJapaneseFinancialValue: (value: string) => number;
  parseJapaneseFinancialValuesArray: (content: string | string[]) => number[];
  parseJapaneseFinancialDatesArray: (content: string | string[]) => string[];
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
  combineJapaneseFinancialData: (
    content: any,
    context?: any,
  ) => UnifiedFinancialData[];
  // 歷史股價數據轉換函數
  parseJapaneseDateArray: (content: string | string[]) => string[];
  parseJapaneseStockPriceArray: (content: string | string[]) => number[];
  parseJapaneseVolumeArray: (content: string | string[]) => number[];
  combineJapaneseHistoricalData: (
    content: any,
    context?: any,
  ) => HistoricalStockPrice[];
  // 調試函數
  debugFieldExtraction: (content: string | string[]) => string[];
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

    // 加強缺失值檢測 - 支援更多日文網站常見格式，包括 --- 連續破折號
    const missingValueRegex =
      /^[-—－\-*・\s　]*$|^(N\/A|n\/a|NA|該当なし|なし|---)$/;
    if (missingValueRegex.test(str)) {
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

      // 加強缺失值檢測 - 支援更多日文網站常見格式，包括 --- 連續破折號
      const missingValueRegex =
        /^[-—－\-*・\s　]*$|^(N\/A|n\/a|NA|該当なし|なし|---)$/;
      if (missingValueRegex.test(str)) {
        console.log(`[JP Values Array] 🔍 檢測到缺失值: "${str}" -> 轉換為 0`);
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

    console.log(
      `[JP Values Array] ✅ 成功處理 ${values.length} 個數值:`,
      values,
    );
    return values;
  },

  /**
   * 解析統一的會計年度期間
   */
  parseUnifiedFiscalPeriod: (
    value: string,
  ): {
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
          quarter: parseInt(quarterMatch[1]),
        };
      }

      // 檢查是否有月份信息
      const monthMatch = str.match(/(\d{1,2})月/);
      if (monthMatch) {
        return {
          year,
          month: parseInt(monthMatch[1]),
        };
      }

      return { year };
    }

    return { year: new Date().getFullYear() };
  },

  /**
   * 解析日文財務日期陣列
   * 處理 "2025/7/23" 格式轉換為標準日期格式
   */
  parseJapaneseFinancialDatesArray: (content: string | string[]): string[] => {
    console.log('[JP Dates Array] 📅 處理日文財務日期陣列...');
    const contentArray = Array.isArray(content) ? content : [content];
    const dates: string[] = [];

    for (const item of contentArray) {
      if (!item || typeof item !== 'string') continue;

      const str = item.toString().trim();

      // 日文財務日期格式: 2025/7/23
      const dateMatch = str.match(/(\d{4})\/(\d{1,2})\/(\d{1,2})/);
      if (dateMatch) {
        const [, year, month, day] = dateMatch;
        // 轉換為標準格式 YYYY-MM-DD
        const standardDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        dates.push(standardDate);
        console.log(
          `[JP Dates Array] ✅ 轉換日期: "${str}" -> "${standardDate}"`,
        );
      } else {
        // 如果無法解析，使用當前日期
        const fallbackDate = new Date().toISOString().split('T')[0];
        dates.push(fallbackDate);
        console.log(
          `[JP Dates Array] ⚠️ 無法解析日期: "${str}"，使用預設: "${fallbackDate}"`,
        );
      }
    }

    console.log(`[JP Dates Array] ✅ 成功處理 ${dates.length} 個日期:`, dates);
    return dates;
  },

  /**
   * 解析統一的會計年度期間陣列
   */
  parseUnifiedFiscalPeriodsArray: (
    content: string | string[],
  ): Array<{
    year: number;
    quarter?: number;
    month?: number;
  }> => {
    console.log('[JP Periods Array] 📅 處理日文期間陣列...');
    const contentArray = Array.isArray(content) ? content : [content];
    const periods: Array<{ year: number; quarter?: number; month?: number }> =
      [];

    for (const item of contentArray) {
      if (!item || typeof item !== 'string') continue;

      const parsed = yahooFinanceJPTransforms.parseUnifiedFiscalPeriod(item);
      periods.push(parsed);
    }

    console.log(
      `[JP Periods Array] ✅ 成功處理 ${periods.length} 個期間:`,
      periods,
    );
    return periods;
  },

  /**
   * 組合日本財務數據
   * 將個別提取的數據組合成統一的 UnifiedFinancialData 格式
   */
  combineJapaneseFinancialData: (
    content: any,
    context?: any,
  ): UnifiedFinancialData[] => {
    console.log(
      '[JP Combine] 🔗 開始組合日本財務數據...',
      context?.variables || {},
    );

    if (!context) return [];

    const results: UnifiedFinancialData[] = [];
    const symbolCode =
      context.variables?.symbolCode || context.symbolCode || '0000';
    const vars = context.variables || {};

    // 獲取期間陣列 - 支援新的陣列提取函數
    const periodsArray =
      vars.periodsArray ||
      (Array.isArray(vars.period) ? vars.period : [vars.period]);

    // 檢查是否為陣列數據 (cashflow 相關)
    const freeCashflowArray =
      vars.freeCashflowValues ||
      (Array.isArray(vars.freeCashflow)
        ? vars.freeCashflow
        : [vars.freeCashflow]);
    const operatingCashflowArray =
      vars.operatingCashflowValues ||
      (Array.isArray(vars.operatingCashflow)
        ? vars.operatingCashflow
        : [vars.operatingCashflow]);
    const investingCashflowArray =
      vars.investingCashflowValues ||
      (Array.isArray(vars.investingCashflow)
        ? vars.investingCashflow
        : [vars.investingCashflow]);
    const financingCashflowArray =
      vars.financingCashflowValues ||
      (Array.isArray(vars.financingCashflow)
        ? vars.financingCashflow
        : [vars.financingCashflow]);

    // 檢查是否為陣列數據 (performance 相關)
    const revenueArray =
      vars.revenueValues ||
      (Array.isArray(vars.revenue) ? vars.revenue : [vars.revenue]);
    const operationProfitArray =
      vars.operationProfitValues ||
      (Array.isArray(vars.operationProfit)
        ? vars.operationProfit
        : [vars.operationProfit]);

    // 獲取財務更新日期陣列
    const financialUpdateDatesArray = vars.financialUpdateDates || [];

    // 檢查是否為陣列數據 (financials 相關)
    const epsArray =
      vars.epsValues || (Array.isArray(vars.eps) ? vars.eps : [vars.eps]);
    const bpsArray =
      vars.bpsValues || (Array.isArray(vars.bps) ? vars.bps : [vars.bps]);

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
      bpsArray.length,
      financialUpdateDatesArray.length,
    );

    // 如果所有陣列都是單一值，則預設為 1
    if (maxLength === 0) maxLength = 1;

    console.log(`[JP Combine] 📊 偵測到最大陣列長度: ${maxLength}`);

    // 為每個期間創建記錄
    for (let i = 0; i < maxLength; i++) {
      const currentYear = new Date().getFullYear();

      // 使用實際的財務更新日期，如果有的話
      const actualReportDate =
        financialUpdateDatesArray[i] || `${currentYear - i}-03-31`;

      // 保留完整 symbolCode 包含交易所後綴 (.T/.S)
      const cleanSymbolCode = symbolCode;
      console.log(`[JP SymbolCode] 日本股票代碼: ${symbolCode}`);

      // 基本的 UnifiedFinancialData 結構
      const financialData: UnifiedFinancialData = {
        symbolCode: cleanSymbolCode, // 使用清理後的代碼
        exchangeArea: MarketRegion.JP,
        reportDate: actualReportDate,
        fiscalYear: currentYear - i,
        fiscalMonth: 3, // 日本財年通常結束於3月
        reportType: FiscalReportType.ANNUAL,
        dataSource: 'yahoo-finance-jp',
        lastUpdated: new Date().toISOString(),
      };

      // 根據數據類型添加相應欄位
      // 檢查 cashflow 相關欄位
      if (
        freeCashflowArray[0] !== undefined ||
        operatingCashflowArray[0] !== undefined
      ) {
        // Yahoo Finance JP 現金流數據單位為百萬円，需要乘以 1000000
        financialData.freeCashFlow =
          (freeCashflowArray[i] || 0) * UNIT_MULTIPLIERS.MILLION_YEN;
        financialData.operatingCashFlow =
          (operatingCashflowArray[i] || 0) * UNIT_MULTIPLIERS.MILLION_YEN;
        financialData.investingCashFlow =
          (investingCashflowArray[i] || 0) * UNIT_MULTIPLIERS.MILLION_YEN;
        financialData.financingCashFlow =
          (financingCashflowArray[i] || 0) * UNIT_MULTIPLIERS.MILLION_YEN;
      }
      // 檢查 performance 相關欄位
      else if (
        revenueArray[0] !== undefined ||
        operationProfitArray[0] !== undefined
      ) {
        // 標準欄位 - Yahoo Finance JP 財務數據單位為百萬円，需要乘以 1000000
        financialData.revenue =
          (revenueArray[i] || 0) * UNIT_MULTIPLIERS.MILLION_YEN;
        financialData.grossProfit =
          ((vars.grossProfitValues || [])[i] || vars.grossProfit || 0) *
          UNIT_MULTIPLIERS.MILLION_YEN;
        financialData.operatingIncome =
          (operationProfitArray[i] || 0) * UNIT_MULTIPLIERS.MILLION_YEN;
        financialData.netIncome =
          ((vars.netProfitValues || [])[i] || vars.netProfit || 0) *
          UNIT_MULTIPLIERS.MILLION_YEN;

        // 比率欄位 (小數格式)
        financialData.grossMargin =
          ((vars.grossProfitMarginValues || [])[i] ||
            vars.grossProfitMargin ||
            0) * UNIT_MULTIPLIERS.PERCENTAGE;
        financialData.operatingMargin =
          ((vars.operationProfitMarginValues || [])[i] ||
            vars.operationProfitMargin ||
            0) * UNIT_MULTIPLIERS.PERCENTAGE;

        // 日本特有欄位放入 regionalData
        financialData.regionalData = {
          ordinaryProfit:
            ((vars.ordinaryProfitValues || [])[i] || vars.ordinaryProfit || 0) *
            UNIT_MULTIPLIERS.MILLION_YEN,
          ordinaryMargin:
            ((vars.ordinaryProfitMarginValues || [])[i] ||
              vars.ordinaryProfitMargin ||
              0) * UNIT_MULTIPLIERS.PERCENTAGE,
        };
      }
      // 檢查 financials 相關欄位
      else if (epsArray[0] !== undefined || bpsArray[0] !== undefined) {
        // 標準欄位
        financialData.eps = epsArray[i] || 0; // EPS 單位為円，不需轉換
        financialData.bookValuePerShare = bpsArray[i] || 0; // BPS 單位為円，不需轉換
        financialData.totalAssets =
          ((vars.totalAssetsValues || [])[i] || vars.totalAssets || 0) *
          UNIT_MULTIPLIERS.MILLION_YEN;

        // 標準比率欄位 (小數格式)
        financialData.roa =
          ((vars.roaValues || [])[i] || vars.roa || 0) *
          UNIT_MULTIPLIERS.PERCENTAGE;
        financialData.roe =
          ((vars.roeValues || [])[i] || vars.roe || 0) *
          UNIT_MULTIPLIERS.PERCENTAGE;
        financialData.sharesOutstanding =
          (vars.totalSharesValues || [])[i] || vars.totalShares || 0;

        // 日本特有欄位放入 regionalData
        financialData.regionalData = {
          equityRatio:
            ((vars.equityRatioValues || [])[i] || vars.equityRatio || 0) *
            UNIT_MULTIPLIERS.PERCENTAGE,
          capital:
            ((vars.shareCapitalValues || [])[i] || vars.shareCapital || 0) *
            UNIT_MULTIPLIERS.MILLION_YEN,
          interestBearingDebt:
            ((vars.interestBearingDebtValues || [])[i] ||
              vars.interestBearingDebt ||
              0) * UNIT_MULTIPLIERS.MILLION_YEN,
          currentReceivables:
            ((vars.currentReceivablesValues || [])[i] ||
              vars.currentReceivables ||
              0) * UNIT_MULTIPLIERS.MILLION_YEN,
        };
      }

      // 處理期間信息
      if (periodsArray[i]) {
        const parsed =
          typeof periodsArray[i] === 'object'
            ? periodsArray[i]
            : yahooFinanceJPTransforms.parseUnifiedFiscalPeriod(
              periodsArray[i],
            );

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
  },

  /**
   * 解析日文日期陣列 (歷史股價專用)
   * 從混合數據中提取日期: "2025年8月12日267267267267500267" -> "2025-08-12"
   */
  parseJapaneseDateArray: (content: string | string[]): string[] => {
    console.log('[JP History Dates] 📅 處理日本股價歷史日期陣列...');
    const contentArray = Array.isArray(content) ? content : [content];
    const dates: string[] = [];

    for (const item of contentArray) {
      if (!item || typeof item !== 'string') continue;

      const str = item.toString().trim();

      // 從混合數據中提取日期格式: "2025年8月12日267267267267500267"
      const dateMatch = str.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
      if (dateMatch) {
        const [, year, month, day] = dateMatch;
        // 轉換為標準格式 YYYY-MM-DD
        const standardDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        dates.push(standardDate);
        console.log(
          `[JP History Dates] ✅ 從混合數據提取日期: "${str.substring(0, 30)}..." -> "${standardDate}"`,
        );
      } else {
        console.log(
          `[JP History Dates] ⚠️ 無法從混合數據提取日期: "${str.substring(0, 30)}..."`
        );
      }
    }

    console.log(`[JP History Dates] ✅ 成功處理 ${dates.length} 個日期:`, dates);
    return dates;
  },

  /**
   * 解析日本股價數值陣列
   * 處理股價數值（包含逗號分隔等格式）
   */
  parseJapaneseStockPriceArray: (content: string | string[]): number[] => {
    console.log('[JP Stock Prices] 💰 處理日本股價數值陣列...');
    const contentArray = Array.isArray(content) ? content : [content];
    const prices: number[] = [];

    for (const item of contentArray) {
      if (!item || typeof item !== 'string') continue;

      const str = item.toString().trim();

      // 檢查缺失值 (---、空白等)
      const missingValueRegex = /^[-—－\-*・\s　]*$|^(N\/A|n\/a|NA|該当なし|なし|---)$/;
      if (missingValueRegex.test(str)) {
        console.log(`[JP Stock Prices] 🔍 檢測到缺失值: "${str}" -> 轉換為 0`);
        prices.push(0);
        continue;
      }

      // 移除逗號和空白
      let cleaned = str.replace(/[,\s]/g, '');

      // 解析數值
      const match = cleaned.match(/([\d.-]+)/);
      if (match) {
        const num = parseFloat(match[1]);
        prices.push(isNaN(num) ? 0 : num);
        console.log(`[JP Stock Prices] ✅ 解析股價: "${str}" -> ${num}`);
      } else {
        prices.push(0);
        console.log(`[JP Stock Prices] ⚠️ 無法解析股價: "${str}" -> 0`);
      }
    }

    console.log(
      `[JP Stock Prices] ✅ 成功處理 ${prices.length} 個股價:`,
      prices,
    );
    return prices;
  },

  /**
   * 解析日本成交量陣列
   * 處理成交量數值（可能包含千、萬等單位）
   */
  parseJapaneseVolumeArray: (content: string | string[]): number[] => {
    console.log('[JP Volume] 📊 處理日本成交量陣列...');
    const contentArray = Array.isArray(content) ? content : [content];
    const volumes: number[] = [];

    for (const item of contentArray) {
      if (!item || typeof item !== 'string') continue;

      const str = item.toString().trim();

      // 檢查缺失值
      const missingValueRegex = /^[-—－\-*・\s　]*$|^(N\/A|n\/a|NA|該当なし|なし|---)$/;
      if (missingValueRegex.test(str)) {
        console.log(`[JP Volume] 🔍 檢測到缺失值: "${str}" -> 轉換為 0`);
        volumes.push(0);
        continue;
      }

      // 移除逗號和空白
      let cleaned = str.replace(/[,\s]/g, '');

      // 解析數值
      const match = cleaned.match(/([\d.-]+)/);
      if (match) {
        const num = parseFloat(match[1]);
        volumes.push(isNaN(num) ? 0 : num);
        console.log(`[JP Volume] ✅ 解析成交量: "${str}" -> ${num}`);
      } else {
        volumes.push(0);
        console.log(`[JP Volume] ⚠️ 無法解析成交量: "${str}" -> 0`);
      }
    }

    console.log(
      `[JP Volume] ✅ 成功處理 ${volumes.length} 個成交量:`,
      volumes,
    );
    return volumes;
  },

  /**
   * 組合日本歷史股價數據
   * 將個別提取的數據組合成統一的 HistoricalStockPrice 格式
   */
  combineJapaneseHistoricalData: (
    content: any,
    context?: any,
  ): HistoricalStockPrice[] => {
    console.log(
      '[JP History Combine] 🔗 開始組合日本歷史股價數據...',
      context?.variables || {},
    );

    if (!context) return [];

    const results: HistoricalStockPrice[] = [];
    const symbolCode =
      context.variables?.symbolCode || context.symbolCode || '0000.T';
    const vars = context.variables || {};

    // 保留完整 symbolCode 包含交易所後綴 (.T/.S)
    const cleanSymbolCode = symbolCode;

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

    console.log(`[JP History Combine] 📊 偵測到最大陣列長度: ${maxLength}`);

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
        symbolCode: cleanSymbolCode,
      };

      results.push(historicalData);
    }

    console.log(`[JP History Combine] ✅ 成功組合 ${results.length} 筆歷史股價數據`);
    return results;
  },

  /**
   * 調試字段提取函數
   * 用於檢查選擇器是否正確匹配元素
   */
  debugFieldExtraction: (content: string | string[]): string[] => {
    console.log('[JP Debug] 🔍 開始調試字段提取...');
    const contentArray = Array.isArray(content) ? content : [content];
    const results: string[] = [];

    for (let i = 0; i < Math.min(contentArray.length, 50); i++) {
      const item = contentArray[i];
      if (!item || typeof item !== 'string') continue;

      const str = item.toString().trim();
      if (str.length > 0) {
        results.push(str);
        console.log(`[JP Debug] ${i + 1}. "${str.substring(0, 100)}${str.length > 100 ? '...' : ''}"`);
      }
    }

    console.log(`[JP Debug] ✅ 找到 ${results.length} 個元素`);
    return results;
  },

};

/**
 * 註冊 Yahoo Finance JP 轉換函數
 * 與 index.ts 中的引用保持兼容
 */
export function registerYahooFinanceJPTransforms(): YahooFinanceJPTransforms {
  return yahooFinanceJPTransforms;
}

