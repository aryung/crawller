/**
 * Yahoo Finance Taiwan 網站特定的轉換函數
 * 包含針對 Yahoo Finance Taiwan 網站結構和資料格式的特殊處理邏輯
 */

import { 
  YAHOO_FINANCE_TW_DIVIDEND_HEADERS,
  TW_DIVIDEND_DATA_FIELD_MAPPING,
  TW_FINANCIAL_UNITS
} from '../../const/finance.js';

export interface YahooFinanceTWTransforms {
  cleanStockSymbol: (value: string) => string;
  parseTWFinancialValue: (value: string) => number | string | null;
  parseTWPercentage: (value: string) => number | string | null;
  extractFiscalPeriod: (value: string) => string | null;
  parseTWDate: (value: string) => string | null;
  cleanFinancialText: (value: string) => string;
  structureTWDividendDataFromCells: (cells: string[] | string, context?: any) => TWDividendData[];
}

// 台灣股利數據介面
export interface TWDividendData {
  fiscalPeriod: string | null;           // 發放期間 (年度)
  cashDividend?: number | null;          // 現金股利 (元)
  stockDividend?: number | null;         // 股票股利
  cashYield?: number | null;             // 現金殖利率 (小數)
  exDividendDate?: string | null;        // 除息日期
  exRightsDate?: string | null;          // 除權日期  
  paymentDate?: string | null;           // 股利發放日期
}

// 台灣股利數據介面陣列
export interface TWDividendDataArray extends Array<TWDividendData> {}

/**
 * Yahoo Finance Taiwan 轉換函數實現
 */
export const yahooFinanceTWTransforms: YahooFinanceTWTransforms = {
  
  /**
   * 清理股票代碼，移除多餘的文字和符號
   */
  cleanStockSymbol: (text: string): string => {
    if (!text || typeof text !== 'string') return '';
    
    // 移除常見的前綴文字
    let cleaned = text
      .replace(/股票代號[：:]\s*/g, '')
      .replace(/代號[：:]\s*/g, '')
      .replace(/股票[：:]\s*/g, '')
      .replace(/^[：:]\s*/g, '')
      .trim();
    
    // 提取股票代碼 (格式: 1101.TW 或 2330.TWO)
    const stockCodeMatch = cleaned.match(/(\d{4})\.TW[O]?/);
    if (stockCodeMatch) {
      return stockCodeMatch[0];
    }
    
    // 如果沒有找到標準格式，嘗試提取數字部分
    const numberMatch = cleaned.match(/\d{4}/);
    if (numberMatch) {
      return numberMatch[0] + '.TW';
    }
    
    return cleaned;
  },

  /**
   * 解析台灣財務數值 (處理新台幣格式和千分位符號)
   */
  parseTWFinancialValue: (value: string): number | null => {
    if (!value || value === '--' || value === '-' || value === '---') return null;
    
    // 清理格式：移除逗號、空格和新台幣符號
    const cleanValue = value
      .replace(/[,\s元]/g, '')
      .replace(/^NT\$/, '')
      .replace(/^\$/, '')
      .trim();
    
    const num = parseFloat(cleanValue);
    return isNaN(num) ? null : num;
  },

  /**
   * 解析台灣百分比數值
   */
  parseTWPercentage: (value: string): number | null => {
    if (!value || value === '--' || value === '-' || value === '---') return null;
    
    // 清理格式並轉換百分比為小數
    const cleanValue = value.replace('%', '').replace(/[,\s]/g, '').trim();
    const num = parseFloat(cleanValue);
    
    if (isNaN(num)) return null;
    
    // 轉換百分比為小數 (例: 3.82% → 0.0382)
    return num / 100;
  },

  /**
   * 提取會計年度資訊
   */
  extractFiscalPeriod: (text: string): string | null => {
    if (!text || typeof text !== 'string') return null;
    
    // 匹配年度格式: 2025, 2024, 2023 等
    const yearMatch = text.match(/\b(20\d{2})\b/);
    if (yearMatch) {
      return yearMatch[1];
    }
    
    // 匹配民國年格式: 114年, 113年等 (民國年 + 1911 = 西元年)
    const rocYearMatch = text.match(/\b(1\d{2})年/);
    if (rocYearMatch) {
      const rocYear = parseInt(rocYearMatch[1]);
      const westernYear = rocYear + 1911;
      return westernYear.toString();
    }
    
    return null;
  },

  /**
   * 解析台灣日期格式
   */
  parseTWDate: (value: string): string | null => {
    if (!value || value === '--' || value === '-' || value === '---') return null;
    
    // 匹配日期格式: YYYY/MM/DD, YYYY-MM-DD, MM/DD/YYYY
    const dateFormats = [
      /\b(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})\b/,  // YYYY/MM/DD 或 YYYY-MM-DD
      /\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\b/   // MM/DD/YYYY
    ];
    
    for (const format of dateFormats) {
      const match = value.match(format);
      if (match) {
        if (match[3] && match[3].length === 4) {
          // MM/DD/YYYY 格式
          const [, month, day, year] = match;
          return `${year}/${month.padStart(2, '0')}/${day.padStart(2, '0')}`;
        } else {
          // YYYY/MM/DD 格式
          const [, year, month, day] = match;
          return `${year}/${month.padStart(2, '0')}/${day.padStart(2, '0')}`;
        }
      }
    }
    
    return null;
  },

  /**
   * 清理財務文字內容
   */
  cleanFinancialText: (text: string): string => {
    if (!text || typeof text !== 'string') return '';
    
    return text
      .replace(/\s+/g, ' ')           // 合併多個空格
      .replace(/[\r\n\t]/g, ' ')      // 移除換行和Tab
      .trim();
  },

  /**
   * 智能數據驗證函數 - 取代硬編碼年份檢查
   */
  validateDividendData: (year: string, dividend: number, yieldRate?: number): boolean => {
    // 年份格式檢查 (支援1900-2099)
    if (!year.match(/^(19|20)\d{2}$/)) {
      return false;
    }
    
    // 年份合理性檢查 (上市公司不可能在未來或太早的年份發股利)
    const yearNum = parseInt(year);
    const currentYear = new Date().getFullYear();
    if (yearNum < 1980 || yearNum > currentYear + 1) {
      return false;
    }
    
    // 股利金額合理性檢查 (避免解析到錯誤數據，如價格)
    if (dividend < 0 || dividend > 50) {
      return false;
    }
    
    // 過濾掉明顯錯誤的零股利 (除非有合理的殖利率)
    if (dividend === 0 && (!yieldRate || yieldRate === 0)) {
      return false;
    }
    
    // 殖利率合理性檢查 (可選，0-15%範圍，超過15%通常是異常數據)
    if (yieldRate !== undefined && (yieldRate < 0 || yieldRate > 15)) {
      return false;
    }
    
    return true;
  },

  /**
   * 檢測股利數據表格格式類型
   */
  detectTableFormat: (textContent: string): 'rich' | 'simple' | 'mixed' | 'unknown' => {
    const quarterlyCount = (textContent.match(/20\d{2}Q[1-4]/g) || []).length;
    const annualCount = (textContent.match(/20\d{2}(?!Q)/g) || []).length;
    
    console.log(`[TW Format Detection] Quarterly patterns: ${quarterlyCount}, Annual patterns: ${annualCount}`);
    
    if (quarterlyCount > 10 && annualCount > 5) {
      return 'rich';        // 如TSMC：豐富的季度+年度數據
    } else if (quarterlyCount === 0 && annualCount > 0) {
      return 'simple';      // 如國泰金：僅年度數據
    } else if (quarterlyCount > 0 && annualCount > 0) {
      return 'mixed';       // 部分季度+年度數據
    } else {
      return 'unknown';     // 無法識別格式
    }
  },

  /**
   * 使用Cheerio解析HTML表格結構
   */
  parseHTMLTable: (content: string, context?: any): TWDividendData[] => {
    const results: TWDividendData[] = [];
    
    try {
      // 動態導入cheerio (如果在HTTP模式下可用)
      if (typeof window === 'undefined') {
        // Node.js環境 - 但這裡我們在transform中，無法直接使用cheerio
        // 將使用文本解析作為替代
        console.log('[TW HTML Parser] Cheerio not available in transform context, using text parsing');
        return [];
      }
    } catch (error) {
      console.warn('[TW HTML Parser] Cheerio parsing failed, falling back to text parsing');
      return [];
    }
    
    return results;
  },

  /**
   * 通用文本模式匹配解析
   */
  parseTextPatterns: (textContent: string, format: 'rich' | 'simple' | 'mixed' | 'unknown'): TWDividendData[] => {
    const results: TWDividendData[] = [];
    const allProcessedPeriods = new Set<string>();
    
    console.log(`[TW Text Parser] Using ${format} format parsing strategy`);
    
    // 根據格式類型使用不同的策略
    switch (format) {
      case 'rich':
        // 豐富格式：先季度後年度
        results.push(...yahooFinanceTWTransforms.parseQuarterlyData(textContent, allProcessedPeriods));
        results.push(...yahooFinanceTWTransforms.parseAnnualData(textContent, allProcessedPeriods));
        results.push(...yahooFinanceTWTransforms.parseHistoricalData(textContent, allProcessedPeriods));
        break;
        
      case 'simple':
        // 簡單格式：僅年度，使用更寬鬆的模式
        results.push(...yahooFinanceTWTransforms.parseSimpleAnnualData(textContent, allProcessedPeriods));
        break;
        
      case 'mixed':
        // 混合格式：嘗試所有模式
        results.push(...yahooFinanceTWTransforms.parseAnnualData(textContent, allProcessedPeriods));
        results.push(...yahooFinanceTWTransforms.parseQuarterlyData(textContent, allProcessedPeriods));
        results.push(...yahooFinanceTWTransforms.parseHistoricalData(textContent, allProcessedPeriods));
        break;
        
      default:
        // 未知格式：使用通用備用解析
        results.push(...yahooFinanceTWTransforms.parseFallbackPatterns(textContent, allProcessedPeriods));
        break;
    }
    
    return results;
  },

  /**
   * 從網頁內容中解析台灣股利數據 - 通用化版本
   */
  structureTWDividendDataFromCells: (content: string | string[], context?: any): TWDividendData[] => {
    // 處理不同的輸入格式
    let textContent: string;
    if (Array.isArray(content)) {
      if (content.length === 0) {
        console.warn('[TW Dividend Parser] Empty content array');
        return [];
      }
      textContent = content.join(' ');
    } else if (typeof content === 'string') {
      textContent = content;
    } else {
      console.warn('[TW Dividend Parser] Invalid content input:', typeof content);
      return [];
    }

    let results: TWDividendData[] = [];
    
    try {
      console.log('[TW Dividend Parser] Content length:', textContent.length);
      console.log('[TW Dividend Parser] Content preview:', textContent.substring(0, 500));
      
      // 檢查內容中是否包含股利相關關鍵字
      const dividendKeywords = ['現金股利', '殖利率', '除息日', '股利', '配息', '配股'];
      const hasKeywords = dividendKeywords.some(keyword => textContent.includes(keyword));
      if (!hasKeywords) {
        console.warn('[TW Dividend Parser] No dividend keywords found in content');
        return [];
      }
      
      // 第一步：檢測表格格式類型
      const format = yahooFinanceTWTransforms.detectTableFormat(textContent);
      console.log(`[TW Dividend Parser] Detected format: ${format}`);
      
      // 第二步：嘗試HTML表格解析 (如果可用)
      const htmlResults = yahooFinanceTWTransforms.parseHTMLTable(textContent, context);
      if (htmlResults.length > 0) {
        console.log(`[TW Dividend Parser] HTML table parsing successful: ${htmlResults.length} records`);
        results = htmlResults;
      } else {
        // 第三步：使用文本模式匹配解析
        console.log('[TW Dividend Parser] Falling back to text pattern parsing');
        results = yahooFinanceTWTransforms.parseTextPatterns(textContent, format);
      }

    } catch (error) {
      console.error('[TW Dividend Parser] Error parsing dividend data:', error);
    }

    console.log(`[TW Dividend Parser] Extracted ${results.length} dividend records`);
    return results.sort((a, b) => {
      const aYear = parseInt(a.fiscalPeriod.substring(0, 4));
      const bYear = parseInt(b.fiscalPeriod.substring(0, 4));
      return bYear - aYear; // 最新年份在前
    });
  },

  /**
   * 解析年度數據 (豐富格式)
   */
  parseAnnualData: (textContent: string, processedPeriods: Set<string>): TWDividendData[] => {
    const results: TWDividendData[] = [];
    
    // Pattern 1: 連續格式 "202517.9997" 然後尋找對應的殖利率
    const yearlyPattern = /(20\d{2})(\d+\.?\d+)/g;
    let yearlyMatch;
    
    while ((yearlyMatch = yearlyPattern.exec(textContent)) !== null) {
      const year = yearlyMatch[1];
      const total = parseFloat(yearlyMatch[2]);
      
      // 嘗試尋找對應的殖利率 (在年度數據附近)
      const yieldPattern = new RegExp(`${year}[\\s\\S]{0,100}?(\\d+\\.\\d+)%`, 'g');
      const yieldMatch = yieldPattern.exec(textContent);
      const yieldRate = yieldMatch ? parseFloat(yieldMatch[1]) : null;
      
      // 使用智能數據驗證和全域去重
      const yearPeriod = `${year}-Y`;
      if (yahooFinanceTWTransforms.validateDividendData(year, total, yieldRate) && !processedPeriods.has(yearPeriod)) {
        processedPeriods.add(yearPeriod);
        
        results.push({
          fiscalPeriod: `${year}-Y`,
          cashDividend: total,
          stockDividend: null,
          cashYield: yieldRate,
          exDividendDate: null,
          exRightsDate: null,
          paymentDate: null
        });
        console.log(`[TW Annual Parser] Found yearly total: ${year}-Y = ${total} (${yieldRate ? yieldRate + '%' : 'no yield'})`);
      }
    }
    
    return results;
  },

  /**
   * 解析季度數據 (豐富格式)
   */
  parseQuarterlyData: (textContent: string, processedPeriods: Set<string>): TWDividendData[] => {
    const results: TWDividendData[] = [];
    
    // Pattern: "2025Q15.00" 然後尋找相關信息
    const quarterlyPattern = /(20\d{2}Q[1-4])(\d+\.?\d+)/g;
    let quarterlyMatch;
    
    while ((quarterlyMatch = quarterlyPattern.exec(textContent)) !== null) {
      const quarter = quarterlyMatch[1];
      const cashDividend = parseFloat(quarterlyMatch[2]);
      
      if (cashDividend >= 0 && cashDividend <= 20 && !processedPeriods.has(quarter)) {
        processedPeriods.add(quarter);
        
        // 嘗試尋找對應的殖利率和日期信息
        const contextPattern = new RegExp(`${quarter.replace(/[()[\]{}*+?^$|#.,\\]/g, '\\$&')}[\\s\\S]{0,200}?(\\d+\\.\\d+)%[\\s\\S]{0,100}?(\\d+\\.\\d+)[\\s\\S]{0,50}?(20\\d{2}/\\d{2}/\\d{2})`, 'g');
        const contextMatch = contextPattern.exec(textContent);
        
        const cashYield = contextMatch ? parseFloat(contextMatch[1]) : null;
        const exDivDate = contextMatch ? contextMatch[3] : null;
        
        // 嘗試尋找發放日期
        let payDate = null;
        if (exDivDate) {
          const payDatePattern = new RegExp(`${exDivDate}[\\s\\S]{0,50}?(20\\d{2}/\\d{2}/\\d{2})`, 'g');
          const payDateMatch = payDatePattern.exec(textContent);
          payDate = payDateMatch ? payDateMatch[1] : null;
        }
        
        results.push({
          fiscalPeriod: quarter,
          cashDividend: cashDividend,
          stockDividend: null,
          cashYield: cashYield,
          exDividendDate: exDivDate,
          exRightsDate: null,
          paymentDate: payDate
        });
        console.log(`[TW Quarterly Parser] Found quarterly data: ${quarter} = ${cashDividend} (${cashYield ? cashYield + '%' : 'no yield'})`);
      }
    }
    
    return results;
  },

  /**
   * 解析歷史數據 (特殊格式)
   */
  parseHistoricalData: (textContent: string, processedPeriods: Set<string>): TWDividendData[] => {
    const results: TWDividendData[] = [];
    
    // Format: "2017: 7.00 - 3.23% 217.0 2017/06/26"
    const historicalPattern = /((19|20)\d{2}):\s*(\d+\.?\d+)\s*-\s*(\d+\.?\d+)%\s*(\d+\.?\d+)\s*((19|20)\d{2}\/\d{2}\/\d{2})/g;
    let historicalMatch;
    
    while ((historicalMatch = historicalPattern.exec(textContent)) !== null) {
      const year = historicalMatch[1];
      const dividend = parseFloat(historicalMatch[3]);
      const yieldRate = parseFloat(historicalMatch[4]);
      const exDivDate = historicalMatch[6];
      
      const yearPeriod = `${year}-Y`;
      if (yahooFinanceTWTransforms.validateDividendData(year, dividend, yieldRate) && !processedPeriods.has(yearPeriod)) {
        processedPeriods.add(yearPeriod);
        
        results.push({
          fiscalPeriod: `${year}-Y`,
          cashDividend: dividend,
          stockDividend: null,
          cashYield: yieldRate,
          exDividendDate: exDivDate,
          exRightsDate: null,
          paymentDate: null
        });
        console.log(`[TW Historical Parser] Found historical data: ${year}-Y = ${dividend} (${yieldRate}%)`);
      }
    }
    
    return results;
  },

  /**
   * 解析簡單年度數據 (適用於格式簡單的公司)
   */
  parseSimpleAnnualData: (textContent: string, processedPeriods: Set<string>): TWDividendData[] => {
    const results: TWDividendData[] = [];
    
    // Pattern 1: Table-based patterns for simple annual data based on actual screenshot
    // Table structure: 發放年度 前期年度 現金股利 - 現金殖利率 股價 除息日 - 發放日
    const tablePattern = /(20\d{2})\s+(20\d{2})\s+(\d+\.?\d*)\s+-\s+(\d+\.\d+)%\s+(\d+\.?\d*)\s+(20\d{2}\/\d{2}\/\d{2})\s+-\s+(20\d{2}\/\d{2}\/\d{2})/g;
    let tableMatch;
    
    while ((tableMatch = tablePattern.exec(textContent)) !== null) {
      const currentYear = tableMatch[1];   // 發放年度
      const prevYear = parseInt(tableMatch[2]);      // 前期年度  
      const dividend = parseFloat(tableMatch[3]);    // 現金股利
      const yieldRate = parseFloat(tableMatch[4]);   // 現金殖利率
      const stockPrice = parseFloat(tableMatch[5]);  // 股價
      const exDivDate = tableMatch[6];               // 除息日
      const payDate = tableMatch[7];                 // 發放日
      
      // 使用前期年度作為財務年度 (比較合理)
      const fiscalYear = prevYear.toString();
      
      const yearPeriod = `${fiscalYear}-Y`;
      if (yahooFinanceTWTransforms.validateDividendData(fiscalYear, dividend, yieldRate) && !processedPeriods.has(yearPeriod)) {
        processedPeriods.add(yearPeriod);
        
        results.push({
          fiscalPeriod: `${fiscalYear}-Y`,
          cashDividend: dividend,
          stockDividend: null,
          cashYield: yieldRate,
          exDividendDate: exDivDate,
          exRightsDate: null,
          paymentDate: payDate
        });
        console.log(`[TW Simple Annual Parser] Found table data: ${fiscalYear}-Y = ${dividend} (${yieldRate}%), ex-div: ${exDivDate}`);
      }
    }
    
    // Pattern 2: Debug and flexible fallback patterns
    if (results.length === 0) {
      console.log('[TW Simple Annual Parser] Table pattern failed, trying flexible patterns');
      
      // Debug: Look for dividend-related sections
      const dividendSections = textContent.match(/發放年度[\s\S]{0,2000}?除息日[\s\S]{0,1000}/g);
      if (dividendSections) {
        console.log(`[TW Simple Annual Parser] Found ${dividendSections.length} dividend sections`);
        console.log(`[TW Simple Annual Parser] First section preview: ${dividendSections[0].substring(0, 500)}`);
      }
      
      // Pattern 2a: Very flexible table row pattern
      const flexiblePattern = /(20\d{2})\s+(20\d{2})\s+(\d+\.?\d*)\s+[\-\s]*(\d+\.\d+)[\%\s]*(\d+\.?\d*)\s+(20\d{2}\/\d{2}\/\d{2})/g;
      let flexibleMatch;
      
      while ((flexibleMatch = flexiblePattern.exec(textContent)) !== null) {
        const currentYear = flexibleMatch[1];
        const prevYear = parseInt(flexibleMatch[2]);
        const dividend = parseFloat(flexibleMatch[3]);
        const yieldRate = parseFloat(flexibleMatch[4]);
        const exDivDate = flexibleMatch[6];
        
        const fiscalYear = prevYear.toString();
        const yearPeriod = `${fiscalYear}-Y`;
        
        if (yahooFinanceTWTransforms.validateDividendData(fiscalYear, dividend, yieldRate) && !processedPeriods.has(yearPeriod)) {
          processedPeriods.add(yearPeriod);
          
          results.push({
            fiscalPeriod: `${fiscalYear}-Y`,
            cashDividend: dividend,
            stockDividend: null,
            cashYield: yieldRate,
            exDividendDate: exDivDate,
            exRightsDate: null,
            paymentDate: null
          });
          console.log(`[TW Simple Annual Parser] Found flexible data: ${fiscalYear}-Y = ${dividend} (${yieldRate}%)`);
        }
      }
      
      // Pattern 2b: Basic year-dividend matching (last resort)
      if (results.length === 0) {
        console.log('[TW Simple Annual Parser] Trying basic year-dividend matching');
        
        const basicPattern = /(20\d{2})\s+(?:20\d{2}\s+)?(\d+\.?\d*)\s*[\-\s]*(\d+\.\d+)%/g;
        let basicMatch;
        let matchCount = 0;
        
        while ((basicMatch = basicPattern.exec(textContent)) !== null && matchCount < 10) {
          matchCount++;
          const year = basicMatch[1];
          const dividend = parseFloat(basicMatch[2]);
          const yieldRate = parseFloat(basicMatch[3]);
          
          // 使用前一年作為財務年度
          const fiscalYear = (parseInt(year) - 1).toString();
          const yearPeriod = `${fiscalYear}-Y`;
          
          if (yahooFinanceTWTransforms.validateDividendData(fiscalYear, dividend, yieldRate) && !processedPeriods.has(yearPeriod)) {
            processedPeriods.add(yearPeriod);
            
            results.push({
              fiscalPeriod: `${fiscalYear}-Y`,
              cashDividend: dividend,
              stockDividend: null,
              cashYield: yieldRate,
              exDividendDate: null,
              exRightsDate: null,
              paymentDate: null
            });
            console.log(`[TW Simple Annual Parser] Found basic data: ${fiscalYear}-Y = ${dividend} (${yieldRate}%)`);
          }
        }
      }
    }
    
    return results;
  },

  /**
   * 通用備用解析模式
   */
  parseFallbackPatterns: (textContent: string, processedPeriods: Set<string>): TWDividendData[] => {
    const results: TWDividendData[] = [];
    
    console.warn('[TW Fallback Parser] Using fallback parsing patterns');
    
    // Pattern 1: Basic year-number matching
    const basicPattern = /(20\d{2})\s*.*?(\d+\.?\d+)/g;
    let basicMatch;
    let matchCount = 0;
    
    while ((basicMatch = basicPattern.exec(textContent)) !== null && matchCount < 20) {
      matchCount++;
      const year = basicMatch[1];
      const value = parseFloat(basicMatch[2]);
      
      const yearPeriod = `${year}-Y`;
      if (yahooFinanceTWTransforms.validateDividendData(year, value) && !processedPeriods.has(yearPeriod)) {
        processedPeriods.add(yearPeriod);
        
        results.push({
          fiscalPeriod: `${year}-Y`,
          cashDividend: value,
          stockDividend: null,
          cashYield: null,
          exDividendDate: null,
          exRightsDate: null,
          paymentDate: null
        });
        console.log(`[TW Fallback Parser] Found basic data: ${year}-Y = ${value}`);
      }
    }
    
    // Pattern 2: If still no results, create debug placeholders
    if (results.length === 0) {
      const dividendKeywords = ['股利', '配息', '配股', '殖利率', '除息', '除權'];
      const containsDividendInfo = dividendKeywords.some(keyword => textContent.includes(keyword));
      
      if (containsDividendInfo) {
        console.warn('[TW Fallback Parser] Found dividend keywords but no parseable data - creating debug placeholders');
        
        const yearMatches = textContent.match(/\b(20\d{2})\b/g);
        if (yearMatches && yearMatches.length > 0) {
          const validYears = [...new Set(yearMatches)]
            .filter(year => year.match(/^(19|20)\d{2}$/))
            .sort((a, b) => parseInt(b) - parseInt(a))
            .slice(0, 3);
          
          validYears.forEach(year => {
            results.push({
              fiscalPeriod: year,
              cashDividend: null,
              stockDividend: null,
              cashYield: null,
              exDividendDate: null,
              exRightsDate: null,
              paymentDate: null
            });
          });
          
          console.log(`[TW Fallback Parser] Created debug placeholders for years: ${validYears.join(', ')}`);
        }
      }
    }
    
    return results;
  }
};

/**
 * 從表格儲存格中提取特定指標在特定期間的數值
 */
function extractDividendMetricValue(cells: string[], metric: string, period: string): number | string | null {
  // 在包含該指標名稱和期間的行中尋找數值
  for (const cell of cells) {
    if (!cell || typeof cell !== 'string') continue;
    
    // 檢查這一行是否包含目標指標
    if (!cell.includes(metric)) continue;
    
    // 檢查這一行是否包含目標期間
    if (!cell.includes(period)) continue;
    
    // 嘗試從這一行提取數值
    let value: number | string | null = null;
    
    // 根據指標類型進行不同的解析
    if (metric.includes('股利')) {
      // 現金股利或股票股利：解析數值
      value = yahooFinanceTWTransforms.parseTWFinancialValue(cell);
    } else if (metric.includes('殖利率')) {
      // 現金殖利率：解析百分比
      value = yahooFinanceTWTransforms.parseTWPercentage(cell);
    } else if (metric.includes('日') || metric.includes('除息') || metric.includes('除權')) {
      // 日期欄位：解析日期
      value = yahooFinanceTWTransforms.parseTWDate(cell);
    } else {
      // 其他欄位：嘗試解析為文字或數值
      const numValue = yahooFinanceTWTransforms.parseTWFinancialValue(cell);
      value = numValue !== null ? numValue : yahooFinanceTWTransforms.cleanFinancialText(cell);
    }
    
    if (value !== null) {
      return value;
    }
  }
  
  return null;
}

export default yahooFinanceTWTransforms;