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
  validateDividendData: (year: string, dividend: number, yieldRate?: number, allData?: any[]) => boolean;
  calculateDividendStatistics: (values: number[]) => { mean: number, stdDev: number, min: number, max: number, median: number };
  extractPreciseNumbers: (numberString: string) => number[];
  detectTableFormat: (textContent: string) => string;
  parseHTMLTable: (content: string, context?: any) => TWDividendData[];
  parseTextPatterns: (textContent: string, format: 'rich' | 'simple' | 'mixed' | 'unknown') => TWDividendData[];
  structureTWDividendDataFromCells: (cells: string[] | string, context?: any) => TWDividendData[];
  parseYahooFinanceDividendTable: (textContent: string) => TWDividendData[];
  parseQuarterlyData: (textContent: string, processedPeriods: Set<string>) => TWDividendData[];
  parseAnnualData: (textContent: string, processedPeriods: Set<string>) => TWDividendData[];
  parseHistoricalData: (textContent: string, processedPeriods: Set<string>) => TWDividendData[];
  parseSimpleAnnualData: (textContent: string, processedPeriods: Set<string>) => TWDividendData[];
  parseFallbackPatterns: (textContent: string, processedPeriods: Set<string>) => TWDividendData[];
  parseHistoricalAnnualData: (textContent: string) => TWDividendData[];
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
   * 基於統計和模式的智能數據驗證 - 完全避免硬編碼，支援動態異常檢測
   */
  validateDividendData: (year: string, dividend: number, yieldRate?: number, allData?: any[]): boolean => {
    // 基本格式檢查
    if (!year.match(/^(19|20)\d{2}$/)) {
      console.log(`[TW Validation] Invalid year format: ${year}`);
      return false;
    }
    
    const yearNum = parseInt(year);
    const currentYear = new Date().getFullYear();
    
    // 基本時間範圍檢查 - 只檢查明顯不合理的年份
    if (yearNum < 1900 || yearNum > currentYear + 5) {
      console.log(`[TW Validation] Year out of reasonable range: ${yearNum}`);
      return false;
    }
    
    // 基本股利合理性 - 負數明顯不合理
    if (dividend < 0) {
      console.log(`[TW Validation] Negative dividend: ${dividend}`);
      return false;
    }
    
    // 零股利的合理性檢查
    if (dividend === 0) {
      // 如果同時有正殖利率，這是矛盾的
      if (yieldRate && yieldRate > 0) {
        console.log(`[TW Validation] Zero dividend with positive yield rate: ${yieldRate}`);
        return false;
      }
      // 零股利本身是可能的（公司可能不發股利）
      return true;
    }
    
    // 基本殖利率檢查
    if (yieldRate !== undefined && yieldRate < 0) {
      console.log(`[TW Validation] Negative yield rate: ${yieldRate}`);
      return false;
    }
    
    // 增強的相對驗證系統
    if (allData && allData.length > 0) {
      // 現金股利統計分析
      const otherCashDividends = allData
        .filter(item => item.cashDividend && item.cashDividend > 0)
        .map(item => item.cashDividend);
      
      // 股票股利統計分析  
      const otherStockDividends = allData
        .filter(item => item.stockDividend && item.stockDividend > 0)
        .map(item => item.stockDividend);
        
      // 智能判斷當前數值是現金股利還是股票股利
      let isLikelyCashDividend = true;
      let isLikelyStockDividend = true;
      
      if (otherCashDividends.length > 0) {
        const cashStats = yahooFinanceTWTransforms.calculateDividendStatistics(otherCashDividends);
        const cashZScore = Math.abs((dividend - cashStats.mean) / (cashStats.stdDev || 1));
        
        // 如果偏離現金股利統計太遠，可能不是現金股利
        if (cashZScore > 3 && dividend > cashStats.max * 2) {
          isLikelyCashDividend = false;
          console.log(`[TW Validation] Value ${dividend} unlikely to be cash dividend (z-score: ${cashZScore.toFixed(2)})`);
        }
      }
      
      if (otherStockDividends.length > 0) {
        const stockStats = yahooFinanceTWTransforms.calculateDividendStatistics(otherStockDividends);
        const stockZScore = Math.abs((dividend - stockStats.mean) / (stockStats.stdDev || 1));
        
        // 如果偏離股票股利統計太遠，可能不是股票股利
        if (stockZScore > 3 && dividend > stockStats.max * 2) {
          isLikelyStockDividend = false;
          console.log(`[TW Validation] Value ${dividend} unlikely to be stock dividend (z-score: ${stockZScore.toFixed(2)})`);
        }
      }
      
      // 如果兩種股利類型都不太可能，則拒絕
      if (!isLikelyCashDividend && !isLikelyStockDividend) {
        console.log(`[TW Validation] Value ${dividend} doesn't fit either dividend type pattern`);
        return false;
      }
      
      // 殖利率相對驗證
      if (yieldRate !== undefined) {
        const otherYields = allData
          .filter(item => item.cashYield && item.cashYield > 0)
          .map(item => item.cashYield);
        
        if (otherYields.length > 0) {
          const yieldStats = yahooFinanceTWTransforms.calculateDividendStatistics(otherYields);
          const yieldZScore = Math.abs((yieldRate - yieldStats.mean) / (yieldStats.stdDev || 1));
          
          // 如果殖利率偏離太遠，可能是解析錯誤
          if (yieldZScore > 4) {
            console.log(`[TW Validation] Yield rate ${yieldRate} is statistical outlier (z-score: ${yieldZScore.toFixed(2)})`);
            return false;
          }
        }
      }
    }
    
    // 股利與殖利率的一致性檢查
    if (yieldRate && yieldRate > 0 && dividend > 0) {
      // 殖利率 = 股利 / 股價，合理的股價範圍檢查
      const impliedPrice = dividend / yieldRate;
      
      // 動態股價合理性檢查（基於台股一般範圍）
      if (impliedPrice < 1 || impliedPrice > 10000) {
        console.log(`[TW Validation] Unreasonable implied stock price: ${impliedPrice.toFixed(2)} (dividend: ${dividend}, yield: ${yieldRate})`);
        return false;
      }
    }
    
    console.log(`[TW Validation] Value ${dividend} passed validation for year ${year}`);
    return true;
  },

  /**
   * 計算股利數據的統計特徵
   */
  calculateDividendStatistics: (values: number[]): { mean: number, stdDev: number, min: number, max: number, median: number } => {
    if (values.length === 0) {
      return { mean: 0, stdDev: 0, min: 0, max: 0, median: 0 };
    }
    
    const sorted = [...values].sort((a, b) => a - b);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);
    const median = sorted.length % 2 === 0 
      ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
      : sorted[Math.floor(sorted.length / 2)];
      
    return {
      mean,
      stdDev,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      median
    };
  },

  /**
   * 精確數字分離函數 - 從連接字符串中識別所有有效數字
   */
  extractPreciseNumbers: (numberString: string): number[] => {
    if (!numberString || typeof numberString !== 'string') {
      return [];
    }
    
    console.log(`[TW Number Extractor] Processing: "${numberString}"`);
    
    // 移除無關字符，保留數字和小數點
    const cleanString = numberString.replace(/[^0-9\.]/g, '');
    
    // 多種策略識別數字邊界
    const numbers: number[] = [];
    
    // 策略1: 基於小數點位置分離
    // 例如: "2.99990.05" -> ["2.9999", "0.05"]
    const decimalPattern = /(\d+\.\d+)/g;
    let match;
    while ((match = decimalPattern.exec(cleanString)) !== null) {
      const num = parseFloat(match[1]);
      if (!isNaN(num) && num > 0) {
        numbers.push(num);
      }
    }
    
    // 如果策略1失敗，使用策略2: 分析數字長度模式
    if (numbers.length < 2 && cleanString.length > 3) {
      console.log(`[TW Number Extractor] Trying pattern-based separation for: "${cleanString}"`);
      
      // 策略2a: 尋找常見的股利數字模式
      // 現金股利通常是 X.XXXX 格式 (1-2位整數 + 2-4位小數)
      // 股票股利通常是 X.XX 或 X.XXXX 格式 (1位整數 + 2-4位小數)
      
      const patterns = [
        // Pattern: 1-2位數.2-4位數 + 1位數.2-4位數
        /^(\d{1,2}\.\d{2,4})(\d{1}\.\d{2,4})$/,
        // Pattern: 1-2位數.3-4位數 + 1-2位數.1-3位數  
        /^(\d{1,2}\.\d{3,4})(\d{1,2}\.\d{1,3})$/,
        // Pattern: 1位數.3-4位數 + 1位數.2-3位數
        /^(\d{1}\.\d{3,4})(\d{1}\.\d{2,3})$/
      ];
      
      for (const pattern of patterns) {
        const patternMatch = cleanString.match(pattern);
        if (patternMatch) {
          const num1 = parseFloat(patternMatch[1]);
          const num2 = parseFloat(patternMatch[2]);
          if (!isNaN(num1) && !isNaN(num2) && num1 > 0 && num2 > 0) {
            console.log(`[TW Number Extractor] Pattern match: ${patternMatch[1]} + ${patternMatch[2]}`);
            return [num1, num2];
          }
        }
      }
      
      // 策略2b: 基於已知長度切分
      if (cleanString.length >= 6) {
        // 嘗試不同的切分點
        for (let i = 2; i <= cleanString.length - 2; i++) {
          const part1 = cleanString.substring(0, i);
          const part2 = cleanString.substring(i);
          
          if (part1.includes('.') && part2.includes('.')) {
            const num1 = parseFloat(part1);
            const num2 = parseFloat(part2);
            if (!isNaN(num1) && !isNaN(num2) && num1 > 0 && num2 > 0) {
              console.log(`[TW Number Extractor] Split at position ${i}: ${part1} + ${part2}`);
              return [num1, num2];
            }
          }
        }
      }
    }
    
    console.log(`[TW Number Extractor] Extracted numbers: ${JSON.stringify(numbers)}`);
    return numbers.filter(n => n > 0); // 只返回正數
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
      if (typeof globalThis === 'undefined' || typeof (globalThis as any).window === 'undefined') {
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
      
      // 新增：專門解析Yahoo Finance股利表格格式
      results = yahooFinanceTWTransforms.parseYahooFinanceDividendTable(textContent);
      
      if (results.length === 0) {
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
          results = yahooFinanceTWTransforms.parseTextPatterns(textContent, format as 'rich' | 'simple' | 'mixed' | 'unknown');
        }
      }

    } catch (error) {
      console.error('[TW Dividend Parser] Error parsing dividend data:', error);
    }

    console.log(`[TW Dividend Parser] Extracted ${results.length} dividend records`);
    return results.sort((a, b) => {
      const aYear = parseInt(a.fiscalPeriod?.substring(0, 4) || '0');
      const bYear = parseInt(b.fiscalPeriod?.substring(0, 4) || '0');
      return bYear - aYear; // 最新年份在前
    });
  },

  /**
   * 專門解析Yahoo Finance股利表格的新方法
   */
  parseYahooFinanceDividendTable: (textContent: string): TWDividendData[] => {
    const results: TWDividendData[] = [];
    console.log('[TW Yahoo Finance Table Parser] Starting specialized table parsing...');
    
    // 多種方式提取股利表格區域的內容
    let tableContent = '';
    
    // 方法1：尋找包含股利表格標題的區域
    const tableMatch1 = textContent.match(/發放期間所屬期間現金股利.*?填息天數/s);
    if (tableMatch1) {
      tableContent = tableMatch1[0];
      console.log('[TW Yahoo Finance Table Parser] Found dividend table via method 1, length:', tableContent.length);
    }
    
    // 方法2：如果方法1失敗，尋找包含年度股利數據的大範圍區域
    if (tableContent.length < 100) {
      const tableMatch2 = textContent.match(/已連.*?年發放股利.*?近.*?年平均現金殖利率.*?(\d{4}H\d|\d{4}\d+\.?\d*).*?(\d{4}\/\d{2}\/\d{2})/s);
      if (tableMatch2) {
        tableContent = tableMatch2[0];
        console.log('[TW Yahoo Finance Table Parser] Found dividend table via method 2, length:', tableContent.length);
      }
    }
    
    // 方法3：如果還是太短，使用包含大量年度數字的區域
    if (tableContent.length < 200) {
      const years = (textContent.match(/20\d{2}/g) || []);
      if (years.length > 10) {
        // 找到第一個年度和最後一個年度之間的內容
        const firstYearIndex = textContent.indexOf(years[0] || '');
        const lastYearIndex = textContent.lastIndexOf(years[years.length - 1] || '');
        if (lastYearIndex > firstYearIndex) {
          tableContent = textContent.substring(firstYearIndex, lastYearIndex + 2000);
          console.log('[TW Yahoo Finance Table Parser] Found dividend table via method 3, length:', tableContent.length);
        }
      }
    }
    
    // 最後的備用方法：使用整個內容
    if (tableContent.length < 100) {
      tableContent = textContent;
      console.log('[TW Yahoo Finance Table Parser] Using full content as fallback, length:', tableContent.length);
    }
    
    // Pattern 1: 半年度股利格式 2025H128.00-1.2%2,3402025/08/14-2025/09/11--
    const semiAnnualPattern = /(\d{4})(H[12])(\d+\.?\d*)-(\d+\.?\d*)%(\d+,?\d*)(\d{4}\/\d{2}\/\d{2})-(\d{4}\/\d{2}\/\d{2})/g;
    let match;
    
    console.log('[TW Yahoo Finance Table Parser] Trying semi-annual pattern...');
    while ((match = semiAnnualPattern.exec(tableContent)) !== null) {
      const year = match[1];
      const period = match[2]; // H1 或 H2
      const cashDividend = parseFloat(match[3]);
      const yieldRate = parseFloat(match[4]) / 100; // 轉換為小數
      const exDividendDate = match[6];
      const paymentDate = match[7];
      
      results.push({
        fiscalPeriod: `${year}-${period}`,
        cashDividend: cashDividend,
        stockDividend: null,
        cashYield: yieldRate,
        exDividendDate: exDividendDate,
        exRightsDate: null,
        paymentDate: paymentDate
      });
      
      console.log(`[TW Yahoo Finance Table Parser] Found semi-annual: ${year}-${period} = ${cashDividend} (${yieldRate * 100}%)`);
    }
    
    // Pattern 2: 年度股利格式 202091.50-3.24%2,8202021/08/10-2021/09/03--
    const annualPattern = /(\d{4})(\d+\.?\d*)-(\d+\.?\d*)%(\d+,?\d*)(\d{4}\/\d{2}\/\d{2})-(\d{4}\/\d{2}\/\d{2})/g;
    
    console.log('[TW Yahoo Finance Table Parser] Trying annual pattern...');
    while ((match = annualPattern.exec(tableContent)) !== null) {
      const year = match[1];
      const cashDividend = parseFloat(match[2]);
      const yieldRate = parseFloat(match[3]) / 100;
      const exDividendDate = match[5];
      const paymentDate = match[6];
      
      // 避免與半年度資料重複
      const yearPeriod = `${year}-Y`;
      const hasExisting = results.some(r => r.fiscalPeriod?.startsWith(year));
      
      if (!hasExisting && cashDividend < 1000) { // 避免錯誤解析大數字
        results.push({
          fiscalPeriod: yearPeriod,
          cashDividend: cashDividend,
          stockDividend: null,
          cashYield: yieldRate,
          exDividendDate: exDividendDate,
          exRightsDate: null,
          paymentDate: paymentDate
        });
        
        console.log(`[TW Yahoo Finance Table Parser] Found annual: ${yearPeriod} = ${cashDividend} (${yieldRate * 100}%)`);
      }
    }
    
    // Pattern 3: 歷史股利格式 (含股票股利) - 改進的智能數字分離
    // 原始格式: 20092008X.XXYYY--2009/MM/DD...
    // 智能分離: 年度1 年度2 現金股利 股票股利 的數字組合
    const historicalPattern = /(\d{4})(\d{4})([0-9\.]+)([0-9\.]+)--(\d{4}\/\d{2}\/\d{2})(\d{4}\/\d{2}\/\d{2})(\d{4}\/\d{2}\/\d{2})(\d{4}\/\d{2}\/\d{2})/g;
    
    console.log('[TW Yahoo Finance Table Parser] Trying historical pattern...');
    console.log(`[TW Yahoo Finance Table Parser] Table content length: ${tableContent.length}, preview: "${tableContent.substring(0, 200)}"`);
    
    while ((match = historicalPattern.exec(tableContent)) !== null) {
      const currentYear = match[1];
      const previousYear = match[2];
      const cashDividendStr = match[3];
      const stockDividendStr = match[4];
      const exDividendDate = match[5];
      const exRightsDate = match[6];
      const cashPaymentDate = match[7];
      
      console.log(`[TW Historical Pattern Debug] Raw match found:`);
      console.log(`  - Payment Year: ${currentYear}`);
      console.log(`  - Fiscal Year: ${previousYear}`);
      console.log(`  - Cash Dividend String: "${cashDividendStr}"`);
      console.log(`  - Stock Dividend String: "${stockDividendStr}"`);
      console.log(`  - Ex-Dividend Date: ${exDividendDate}`);
      console.log(`  - Ex-Rights Date: ${exRightsDate}`);
      
      // 使用動態精確數字分離 - 完全避免硬編碼
      let cashDividend = null;
      let stockDividend = null;
      
      // 嘗試解析組合字串（如: "2.9997.00" 或 "0.60371.4087"）
      const combinedStr = cashDividendStr + stockDividendStr;
      console.log(`[TW Historical Pattern Debug] Combined string for analysis: "${combinedStr}"`);
      
      // 使用精確數字分離函數
      const extractedNumbers = yahooFinanceTWTransforms.extractPreciseNumbers(combinedStr);
      console.log(`[TW Historical Pattern Debug] Extracted numbers: ${JSON.stringify(extractedNumbers)}`);
      
      if (extractedNumbers.length >= 2) {
        // 有兩個數字 - 需要判斷哪個是現金股利，哪個是股票股利
        // 根據Yahoo Finance Taiwan的表格結構，通常第一個是現金股利，第二個是股票股利
        cashDividend = extractedNumbers[0];
        stockDividend = extractedNumbers[1];
        
        console.log(`[TW Historical Pattern Debug] Two numbers found: cash=${cashDividend}, stock=${stockDividend}`);
      } else if (extractedNumbers.length === 1) {
        // 只有一個數字 - 需要從原始字串位置判斷類型
        const singleNumber = extractedNumbers[0];
        
        // 分析原始字串結構來判斷是現金股利還是股票股利
        const originalCashStr = cashDividendStr.replace(/[^0-9\.]/g, '');
        const originalStockStr = stockDividendStr.replace(/[^0-9\.]/g, '');
        
        // 如果現金股利字串包含這個數字，那就是現金股利
        if (originalCashStr.includes(singleNumber.toString()) || 
            parseFloat(originalCashStr) === singleNumber) {
          cashDividend = singleNumber;
          stockDividend = null;
          console.log(`[TW Historical Pattern Debug] Single number is cash dividend: ${cashDividend}`);
        } else {
          cashDividend = null;
          stockDividend = singleNumber;
          console.log(`[TW Historical Pattern Debug] Single number is stock dividend: ${stockDividend}`);
        }
      } else {
        // 無法解析 - 嘗試單獨解析每個字串
        const cashNum = parseFloat(cashDividendStr);
        const stockNum = parseFloat(stockDividendStr);
        
        if (!isNaN(cashNum) && cashNum > 0) cashDividend = cashNum;
        if (!isNaN(stockNum) && stockNum > 0) stockDividend = stockNum;
        
        console.log(`[TW Historical Pattern Debug] Fallback individual parsing: cash=${cashDividend}, stock=${stockDividend}`);
      }
      
      // 使用前一年作為財務年度 (更符合股利發放邏輯)
      const fiscalYear = previousYear;
      const yearPeriod = `${fiscalYear}-Y`;
      
      // 改進的動態驗證 - 支援現金股利或股票股利
      const hasCashDividend = cashDividend !== null && cashDividend > 0;
      const hasStockDividend = stockDividend !== null && stockDividend > 0;
      
      if (hasCashDividend || hasStockDividend) {
        // 驗證主要股利類型
        const primaryValue = hasCashDividend ? cashDividend : stockDividend;
        if (yahooFinanceTWTransforms.validateDividendData(fiscalYear, primaryValue || 0)) {
          const exists = results.some(r => r.fiscalPeriod === yearPeriod);
          if (!exists) {
            results.push({
              fiscalPeriod: yearPeriod,
              cashDividend: hasCashDividend ? cashDividend : null,
              stockDividend: hasStockDividend ? stockDividend : null,
              cashYield: null,
              exDividendDate: exDividendDate,
              exRightsDate: hasStockDividend ? exRightsDate : null,
              paymentDate: cashPaymentDate
            });
            
            const dividendInfo = [
              hasCashDividend ? `cash=${cashDividend}` : '',
              hasStockDividend ? `stock=${stockDividend}` : ''
            ].filter(s => s).join(', ');
            
            console.log(`[TW Yahoo Finance Table Parser] Found historical: ${yearPeriod} (${dividendInfo})`);
          }
        }
      }
    }
    
    // Pattern 4: 簡單年度格式 (僅現金股利) 2015201451.00--2,9602015/08/17-2015/09/10-
    const simpleAnnualPattern = /(\d{4})(\d{4})(\d+\.?\d*)---(\d+,?\d*)(\d{4}\/\d{2}\/\d{2})-(\d{4}\/\d{2}\/\d{2})/g;
    
    console.log('[TW Yahoo Finance Table Parser] Trying simple annual pattern...');
    while ((match = simpleAnnualPattern.exec(tableContent)) !== null) {
      const currentYear = match[1];
      const previousYear = match[2];
      const cashDividend = parseFloat(match[3]);
      const exDividendDate = match[5];
      const paymentDate = match[6];
      
      const fiscalYear = previousYear;
      const yearPeriod = `${fiscalYear}-Y`;
      
      // 使用動態驗證取代硬編碼檢查
      if (yahooFinanceTWTransforms.validateDividendData(fiscalYear, cashDividend)) {
        const exists = results.some(r => r.fiscalPeriod === yearPeriod);
        if (!exists) {
          results.push({
            fiscalPeriod: yearPeriod,
            cashDividend: cashDividend,
            stockDividend: null,
            cashYield: null,
            exDividendDate: exDividendDate,
            exRightsDate: null,
            paymentDate: paymentDate
          });
          
          console.log(`[TW Yahoo Finance Table Parser] Found simple annual: ${yearPeriod} = ${cashDividend}`);
        }
      }
    }
    
    console.log(`[TW Yahoo Finance Table Parser] Total found: ${results.length} records`);
    
    // 去重：根據財務期間去重
    const uniqueMap = new Map<string, TWDividendData>();
    results.forEach(item => {
      if (item.fiscalPeriod) {
        const key = item.fiscalPeriod;
        if (!uniqueMap.has(key) || (uniqueMap.get(key)?.cashDividend || 0) < (item.cashDividend || 0)) {
          uniqueMap.set(key, item);
        }
      }
    });
    
    const uniqueResults = Array.from(uniqueMap.values());
    console.log(`[TW Yahoo Finance Table Parser] After deduplication: ${uniqueResults.length} records`);
    
    // 最後清理和驗證 - 支援現金股利或股票股利任一有值的記錄
    const cleanResults = uniqueResults.filter((item, index, array) => {
      // 基本必要欄位檢查
      if (!item.fiscalPeriod) return false;
      
      // 至少要有現金股利或股票股利其中一個有值
      const hasCashDividend = item.cashDividend !== null && item.cashDividend !== undefined && item.cashDividend > 0;
      const hasStockDividend = item.stockDividend !== null && item.stockDividend !== undefined && item.stockDividend > 0;
      
      if (!hasCashDividend && !hasStockDividend) {
        return false; // 兩種股利都沒有，跳過
      }
      
      const year = item.fiscalPeriod.substring(0, 4);
      
      // 對有現金股利的記錄進行驗證
      if (hasCashDividend) {
        return yahooFinanceTWTransforms.validateDividendData(
          year, 
          item.cashDividend || 0, 
          item.cashYield || undefined,
          array
        );
      }
      
      // 對只有股票股利的記錄，簡化驗證（主要檢查年份合理性）
      if (hasStockDividend) {
        return yahooFinanceTWTransforms.validateDividendData(
          year, 
          item.stockDividend || 0, // 用股票股利數值進行基本驗證
          undefined,
          array
        );
      }
      
      return false;
    });
    
    // Pattern 5: 新增歷史年度表格格式解析 (1997-2020年)
    const historicalAnnualResults = yahooFinanceTWTransforms.parseHistoricalAnnualData(tableContent);
    if (historicalAnnualResults.length > 0) {
      console.log(`[TW Yahoo Finance Table Parser] Found historical annual data: ${historicalAnnualResults.length} records`);
      cleanResults.push(...historicalAnnualResults);
    }
    
    console.log(`[TW Yahoo Finance Table Parser] Clean results: ${cleanResults.length} records`);
    return cleanResults;
  },

  /**
   * 解析年度數據 (豐富格式)
   */
  parseAnnualData: (textContent: string, processedPeriods: Set<string>): TWDividendData[] => {
    const results: TWDividendData[] = [];
    
    // Pattern 1: 智能年度股利解析 - 防止年度與股利數字錯誤連接
    const yearlyPattern = /(20\d{2})(\d+\.?\d+)/g;
    let yearlyMatch;
    
    while ((yearlyMatch = yearlyPattern.exec(textContent)) !== null) {
      const year = yearlyMatch[1];
      let total = parseFloat(yearlyMatch[2]);
      const originalTotalStr = yearlyMatch[2];
      
      console.log(`[TW Annual Parser Debug] Raw match: year=${year}, dividend="${originalTotalStr}" (${total})`);
      
      // 智能數字分離 - 處理年度與股利連接的情況
      if (originalTotalStr.length >= 5 && total > 1000) {
        // 案例: "20154.4999" -> 年度"2015" + 股利"4.4999"
        const yearDividendMatch = originalTotalStr.match(/^(\d{4})(.+)$/);
        if (yearDividendMatch) {
          const embeddedYear = yearDividendMatch[1];
          const dividendPart = parseFloat(yearDividendMatch[2]);
          
          // 驗證嵌入的年度是否與解析的年度一致或相近
          const embeddedYearNum = parseInt(embeddedYear);
          const currentYearNum = parseInt(year);
          
          if (Math.abs(embeddedYearNum - currentYearNum) <= 1 && dividendPart > 0 && dividendPart < 500) {
            console.log(`[TW Annual Parser Debug] Separated "${originalTotalStr}" into embedded_year=${embeddedYear} + dividend=${dividendPart}`);
            total = dividendPart;
          }
        }
        
        // 如果還是異常大，可能是其他格式錯誤
        if (total > 1000) {
          console.log(`[TW Annual Parser Debug] Skipping abnormally large dividend: ${total}`);
          continue;
        }
      }
      
      // 嘗試尋找對應的殖利率 (在年度數據附近)
      const yieldPattern = new RegExp(`${year}[\\s\\S]{0,100}?(\\d+\\.\\d+)%`, 'g');
      const yieldMatch = yieldPattern.exec(textContent);
      const yieldRate = yieldMatch ? parseFloat(yieldMatch[1]) : null;
      
      // 使用智能數據驗證和全域去重
      const yearPeriod = `${year}-Y`;
      if (yahooFinanceTWTransforms.validateDividendData(year, total, yieldRate || undefined) && !processedPeriods.has(yearPeriod)) {
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
  },

  /**
   * 專門解析歷史年度股利數據 (1997-2020年表格格式)
   */
  parseHistoricalAnnualData: (textContent: string): TWDividendData[] => {
    const results: TWDividendData[] = [];
    console.log('[TW Historical Annual Parser] Starting enhanced historical annual data parsing...');
    
    // Debug: 查找包含歷史年份的內容區段
    const year1997Index = textContent.indexOf('1997');
    const year2000Index = textContent.indexOf('2000');
    const year2005Index = textContent.indexOf('2005');
    
    console.log(`[TW Historical Annual Parser Debug] Found years in content: 1997 at ${year1997Index}, 2000 at ${year2000Index}, 2005 at ${year2005Index}`);
    
    if (year1997Index > -1) {
      const contextStart = Math.max(0, year1997Index - 200);
      const contextEnd = Math.min(textContent.length, year1997Index + 500);
      const context = textContent.substring(contextStart, contextEnd);
      console.log(`[TW Historical Annual Parser Debug] Context around 1997: "${context.replace(/\s+/g, ' ')}"`);
    }
    
    // Enhanced Pattern 1: 標準表格行格式 (適用大部分歷史數據)
    // 格式: 2008 2007 3.0251 0.0504 - - - 2008/07/16 2008/07/16 2008/08/
    const standardTablePattern = /(199[0-9]|20[0-2][0-9])\s+(199[0-9]|20[0-2][0-9])\s+([0-9]+\.?[0-9]*|\-)\s+([0-9]+\.?[0-9]*|\-)\s+[\-\s]*\s+(199[0-9]|20[0-2][0-9])\/[0-9]{2}\/[0-9]{2}/g;
    
    let match;
    while ((match = standardTablePattern.exec(textContent)) !== null) {
      const paymentYear = match[1];
      const fiscalYear = match[2];
      const cashDividendStr = match[3];
      const stockDividendStr = match[4];
      const exDate = match[5];
      
      console.log(`[TW Historical Annual Parser] Standard table match: payment=${paymentYear} fiscal=${fiscalYear} cash="${cashDividendStr}" stock="${stockDividendStr}" exDate="${exDate}"`);
      
      // 解析現金股利
      let cashDividend = null;
      if (cashDividendStr !== '-' && cashDividendStr !== '') {
        const cashVal = parseFloat(cashDividendStr);
        if (!isNaN(cashVal) && cashVal >= 0.01 && cashVal < 500) {
          cashDividend = cashVal;
        }
      }
      
      // 解析股票股利
      let stockDividend = null;
      if (stockDividendStr !== '-' && stockDividendStr !== '') {
        const stockVal = parseFloat(stockDividendStr);
        if (!isNaN(stockVal) && stockVal >= 0.01 && stockVal < 100) {
          stockDividend = stockVal;
        }
      }
      
      // 確保至少有一種股利
      if (cashDividend !== null || stockDividend !== null) {
        const yearNum = parseInt(fiscalYear);
        if (yearNum >= 1990 && yearNum <= 2025) {
          
          // 檢查是否已存在相同年度的記錄
          const existingRecord = results.find(r => r.fiscalPeriod === `${fiscalYear}-Y`);
          if (!existingRecord) {
            results.push({
              fiscalPeriod: `${fiscalYear}-Y`,
              cashDividend: cashDividend,
              stockDividend: stockDividend,
              cashYield: null,
              exDividendDate: `${exDate}`,
              exRightsDate: stockDividend ? `${exDate}` : null,
              paymentDate: null
            });
            
            console.log(`[TW Historical Annual Parser] Found standard historical: ${fiscalYear}-Y, cash=${cashDividend}, stock=${stockDividend}, date=${exDate}`);
          }
        }
      }
    }
    
    // Enhanced Pattern 2: 純現金股利格式
    // 格式: 2015 2014 51.00 - - 2.960 2015/08/17 - 2015/09/
    const cashOnlyPattern = /(199[0-9]|20[0-2][0-9])\s+(199[0-9]|20[0-2][0-9])\s+([0-9]+\.?[0-9]*)\s+\-\s+\-[\s\d\.]*\s+(199[0-9]|20[0-2][0-9])\/[0-9]{2}\/[0-9]{2}/g;
    
    while ((match = cashOnlyPattern.exec(textContent)) !== null) {
      const paymentYear = match[1];
      const fiscalYear = match[2];
      const cashDividendStr = match[3];
      const exDate = match[4];
      
      console.log(`[TW Historical Annual Parser] Cash-only match: payment=${paymentYear} fiscal=${fiscalYear} cash="${cashDividendStr}" exDate="${exDate}"`);
      
      const cashDividend = parseFloat(cashDividendStr);
      if (!isNaN(cashDividend) && cashDividend >= 0.01 && cashDividend < 500) {
        const yearNum = parseInt(fiscalYear);
        if (yearNum >= 1990 && yearNum <= 2025) {
          
          // 檢查是否已存在相同年度的記錄
          const existingRecord = results.find(r => r.fiscalPeriod === `${fiscalYear}-Y`);
          if (!existingRecord) {
            results.push({
              fiscalPeriod: `${fiscalYear}-Y`,
              cashDividend: cashDividend,
              stockDividend: null,
              cashYield: null,
              exDividendDate: `${exDate}`,
              exRightsDate: null,
              paymentDate: null
            });
            
            console.log(`[TW Historical Annual Parser] Found cash-only historical: ${fiscalYear}-Y, cash=${cashDividend}, date=${exDate}`);
          }
        }
      }
    }
    
    // Enhanced Pattern 3: 純股票股利格式
    // 格式: 2001 2000 - 7.00 - - - 2001/09/30
    const stockOnlyPattern = /(199[0-9]|20[0-2][0-9])\s+(199[0-9]|20[0-2][0-9])\s+\-\s+([0-9]+\.?[0-9]*)\s+[\-\s]*\s+(199[0-9]|20[0-2][0-9])\/[0-9]{2}\/[0-9]{2}/g;
    
    while ((match = stockOnlyPattern.exec(textContent)) !== null) {
      const paymentYear = match[1];
      const fiscalYear = match[2];
      const stockDividendStr = match[3];
      const exDate = match[4];
      
      console.log(`[TW Historical Annual Parser] Stock-only match: payment=${paymentYear} fiscal=${fiscalYear} stock="${stockDividendStr}" exDate="${exDate}"`);
      
      const stockDividend = parseFloat(stockDividendStr);
      if (!isNaN(stockDividend) && stockDividend >= 0.01 && stockDividend < 100) {
        const yearNum = parseInt(fiscalYear);
        if (yearNum >= 1990 && yearNum <= 2025) {
          
          // 檢查是否已存在相同年度的記錄
          const existingRecord = results.find(r => r.fiscalPeriod === `${fiscalYear}-Y`);
          if (!existingRecord) {
            results.push({
              fiscalPeriod: `${fiscalYear}-Y`,
              cashDividend: null,
              stockDividend: stockDividend,
              cashYield: null,
              exDividendDate: null,
              exRightsDate: `${exDate}`,
              paymentDate: null
            });
            
            console.log(`[TW Historical Annual Parser] Found stock-only historical: ${fiscalYear}-Y, stock=${stockDividend}, date=${exDate}`);
          }
        }
      }
    }
    
    // Enhanced Pattern 4: 精確表格行格式 (基於Yahoo Finance台灣版的實際欄位順序)
    // 完整格式: "發放年度 財務年度 現金股利 股票股利 填息天數 股價 除息日 除權日 發放日期"
    // 範例: "2009 2008 2.9999 0.05 - - 2009/07/15 2009/07/15 2009/08/"
    const preciseTableRowPattern = /(19\d{2}|20\d{2})\s+(19\d{2}|20\d{2})\s+([0-9]+\.[0-9]+)\s+([0-9]+\.[0-9]+)\s+[\-\s]*[\-\s]*\s+(19\d{2}|20\d{2})\/[0-9]{2}\/[0-9]{2}\s+(19\d{2}|20\d{2})\/[0-9]{2}\/[0-9]{2}/g;
    
    while ((match = preciseTableRowPattern.exec(textContent)) !== null) {
      const paymentYear = match[1];
      const fiscalYear = match[2];
      const cashDividendStr = match[3];  // 第3個位置固定是現金股利
      const stockDividendStr = match[4]; // 第4個位置固定是股票股利
      const exDividendDate = match[5];
      const exRightsDate = match[6];
      
      console.log(`[TW Historical Annual Parser] Precise table row: payment=${paymentYear} fiscal=${fiscalYear} cash="${cashDividendStr}" stock="${stockDividendStr}"`);
      
      // 基於欄位位置直接分配，不需要智能判斷
      const cashDividend = parseFloat(cashDividendStr);
      const stockDividend = parseFloat(stockDividendStr);
      
      // 驗證數值合理性
      if (!isNaN(cashDividend) && !isNaN(stockDividend) && 
          cashDividend > 0 && stockDividend > 0) {
        
        console.log(`[TW Historical Annual Parser] Position-based assignment: cash=${cashDividend}, stock=${stockDividend}`);
        
        // 使用動態驗證確保年份和數值合理性
        if (yahooFinanceTWTransforms.validateDividendData(fiscalYear, cashDividend)) {
          const existingRecord = results.find(r => r.fiscalPeriod === `${fiscalYear}-Y`);
          if (!existingRecord) {
            results.push({
              fiscalPeriod: `${fiscalYear}-Y`,
              cashDividend: cashDividend,
              stockDividend: stockDividend,
              cashYield: null,
              exDividendDate: exDividendDate,
              exRightsDate: exRightsDate,
              paymentDate: null
            });
            
            console.log(`[TW Historical Annual Parser] Found precise table row: ${fiscalYear}-Y, cash=${cashDividend}, stock=${stockDividend}`);
          }
        }
      }
    }
    
    // Enhanced Pattern 5: 精確數字分離的緊密格式解析
    // 策略：先識別數字邊界，再根據上下文分配角色
    const compactPattern = /(19\d{2}|20\d{2})(19\d{2}|20\d{2})([0-9\.\-]+)(\-{2,})((19\d{2}|20\d{2})\/\d{2}\/\d{2})?/g;
    
    while ((match = compactPattern.exec(textContent)) !== null) {
      const paymentYear = match[1];
      const fiscalYear = match[2];
      const numberString = match[3]; // 包含連接數字的字符串
      const dateStr = match[5];
      
      console.log(`[TW Historical Annual Parser] Compact match: payment=${paymentYear} fiscal=${fiscalYear} numbers="${numberString}" date="${dateStr}"`);
      
      // 精確數字分離 - 識別所有數字邊界
      const numbers = yahooFinanceTWTransforms.extractPreciseNumbers(numberString);
      
      if (numbers.length >= 1) {
        console.log(`[TW Historical Annual Parser] Extracted numbers: ${JSON.stringify(numbers)}`);
        
        // 基於數字特徵和位置進行智能分配
        let cashDividend: number | null = null;
        let stockDividend: number | null = null;
        
        if (numbers.length === 1) {
          // 單一數字 - 使用已有數據的統計特徵進行動態判斷
          const singleNumber = numbers[0];
          console.log(`[TW Historical Annual Parser] Single number found: ${singleNumber}`);
          
          // 基於已解析數據動態判斷數字類型
          const existingCash = results.filter(r => r.cashDividend && r.cashDividend > 0).map(r => r.cashDividend!);
          const existingStock = results.filter(r => r.stockDividend && r.stockDividend > 0).map(r => r.stockDividend!);
          
          let assignedAsCash = false;
          let assignedAsStock = false;
          
          // 策略1: 如果有現金股利統計數據，檢查是否符合現金股利模式
          if (existingCash.length > 0) {
            const cashStats = yahooFinanceTWTransforms.calculateDividendStatistics(existingCash);
            const cashRange = {
              min: Math.max(0.01, cashStats.min * 0.1),
              max: Math.min(100, cashStats.max * 10)
            };
            
            if (singleNumber >= cashRange.min && singleNumber <= cashRange.max) {
              cashDividend = singleNumber;
              stockDividend = null;
              assignedAsCash = true;
              console.log(`[TW Historical Annual Parser] Assigned as cash dividend (statistical match): ${singleNumber}`);
            }
          }
          
          // 策略2: 如果沒有被分配為現金股利，檢查股票股利模式
          if (!assignedAsCash && existingStock.length > 0) {
            const stockStats = yahooFinanceTWTransforms.calculateDividendStatistics(existingStock);
            const stockRange = {
              min: Math.max(0.01, stockStats.min * 0.1),
              max: Math.min(100, stockStats.max * 10)
            };
            
            if (singleNumber >= stockRange.min && singleNumber <= stockRange.max) {
              cashDividend = null;
              stockDividend = singleNumber;
              assignedAsStock = true;
              console.log(`[TW Historical Annual Parser] Assigned as stock dividend (statistical match): ${singleNumber}`);
            }
          }
          
          // 策略3: 如果沒有統計數據或都不匹配，採用通用判斷（現金股利更常見）
          if (!assignedAsCash && !assignedAsStock) {
            // 基於數值特徵：小數位數較多的通常是現金股利，整數或小數位少的可能是股票股利
            const decimalPlaces = (singleNumber.toString().split('.')[1] || '').length;
            
            if (decimalPlaces >= 2) {
              cashDividend = singleNumber;
              stockDividend = null;
              console.log(`[TW Historical Annual Parser] Assigned as cash dividend (decimal precision): ${singleNumber}`);
            } else {
              cashDividend = null;
              stockDividend = singleNumber;
              console.log(`[TW Historical Annual Parser] Assigned as stock dividend (lower precision): ${singleNumber}`);
            }
          }
        } else if (numbers.length === 2) {
          // 策略：較大或精度高的數字通常是現金股利，較小的是股票股利
          const [num1, num2] = numbers;
          
          // 動態範圍檢查 - 基於已解析數據確定合理範圍
          const existingCash = results.filter(r => r.cashDividend && r.cashDividend > 0).map(r => r.cashDividend!);
          const existingStock = results.filter(r => r.stockDividend && r.stockDividend > 0).map(r => r.stockDividend!);
          
          let cashRange = { min: 0.1, max: 50 }; // 默認範圍
          let stockRange = { min: 0.01, max: 100 }; // 默認範圍
          
          if (existingCash.length > 0) {
            const cashStats = yahooFinanceTWTransforms.calculateDividendStatistics(existingCash);
            cashRange = {
              min: Math.max(0.1, cashStats.min * 0.1),
              max: Math.min(50, cashStats.max * 10)
            };
          }
          
          if (existingStock.length > 0) {
            const stockStats = yahooFinanceTWTransforms.calculateDividendStatistics(existingStock);
            stockRange = {
              min: Math.max(0.01, stockStats.min * 0.1),
              max: Math.min(100, stockStats.max * 10)
            };
          }
          
          const num1InCashRange = num1 >= cashRange.min && num1 <= cashRange.max;
          const num2InCashRange = num2 >= cashRange.min && num2 <= cashRange.max;
          const num1InStockRange = num1 >= stockRange.min && num1 <= stockRange.max;
          const num2InStockRange = num2 >= stockRange.min && num2 <= stockRange.max;
          
          if (num1InCashRange && num2InStockRange) {
            cashDividend = num1;
            stockDividend = num2;
          } else if (num2InCashRange && num1InStockRange) {
            cashDividend = num2;
            stockDividend = num1;
          } else if (num1InCashRange) {
            cashDividend = num1;
            stockDividend = num2InStockRange ? num2 : null;
          } else if (num2InCashRange) {
            cashDividend = num2;
            stockDividend = num1InStockRange ? num1 : null;
          } else {
            // 都不在預期範圍，使用大小判斷
            if (num1 > num2) {
              cashDividend = num1;
              stockDividend = num2;
            } else {
              cashDividend = num2;
              stockDividend = num1;
            }
          }
        } else if (numbers.length > 2) {
          // 多個數字，選擇最合理的兩個（使用動態範圍）
          const existingCash = results.filter(r => r.cashDividend && r.cashDividend > 0).map(r => r.cashDividend!);
          const existingStock = results.filter(r => r.stockDividend && r.stockDividend > 0).map(r => r.stockDividend!);
          
          let cashRange = { min: 0.1, max: 50 };
          let stockRange = { min: 0.01, max: 100 };
          
          if (existingCash.length > 0) {
            const cashStats = yahooFinanceTWTransforms.calculateDividendStatistics(existingCash);
            cashRange = {
              min: Math.max(0.1, cashStats.min * 0.1),
              max: Math.min(50, cashStats.max * 10)
            };
          }
          
          if (existingStock.length > 0) {
            const stockStats = yahooFinanceTWTransforms.calculateDividendStatistics(existingStock);
            stockRange = {
              min: Math.max(0.01, stockStats.min * 0.1),
              max: Math.min(100, stockStats.max * 10)
            };
          }
          
          const cashCandidates = numbers.filter(n => n >= cashRange.min && n <= cashRange.max);
          const stockCandidates = numbers.filter(n => n >= stockRange.min && n <= stockRange.max);
          
          if (cashCandidates.length > 0) {
            cashDividend = cashCandidates[0]; // 選擇第一個合理的現金股利
          }
          if (stockCandidates.length > 0) {
            // 選擇不是現金股利的股票股利候選
            stockDividend = stockCandidates.find(n => n !== cashDividend) || null;
          }
        }
        
        console.log(`[TW Historical Annual Parser] Precise assignment: cash=${cashDividend}, stock=${stockDividend}`);
        
        // 動態驗證解析結果
        if (cashDividend !== null || stockDividend !== null) {
          const primaryValue = cashDividend || stockDividend || 0;
          if (primaryValue > 0 && yahooFinanceTWTransforms.validateDividendData(fiscalYear, primaryValue)) {
            const existingRecord = results.find(r => r.fiscalPeriod === `${fiscalYear}-Y`);
            if (!existingRecord) {
              results.push({
                fiscalPeriod: `${fiscalYear}-Y`,
                cashDividend: cashDividend,
                stockDividend: stockDividend,
                cashYield: null,
                exDividendDate: dateStr || null,
                exRightsDate: stockDividend ? dateStr : null,
                paymentDate: null
              });
              
              console.log(`[TW Historical Annual Parser] Found precise compact: ${fiscalYear}-Y, cash=${cashDividend}, stock=${stockDividend}`);
            }
          }
        }
      }
    }
    
    // Pattern 2: 簡化表格格式 - 僅現金股利，無股票股利
    // 範例: 2015 2014 4.4999 - - 146.0 2015/06/29 - 2015/07/...
    const simpleCashPattern = /(19|20)\d{2}\s+(19|20)\d{2}\s+(\d+\.\d+)\s+\-\s+\-\s+(\d+\.\d+)\s+(19|20)\d{2}\/\d{2}\/\d{2}/g;
    
    while ((match = simpleCashPattern.exec(textContent)) !== null) {
      const paymentYear = match[1];
      const fiscalYear = match[2];
      const cashDividend = parseFloat(match[3]);
      const stockPrice = parseFloat(match[4]);
      const exDividendDate = match[5];
      
      console.log(`[TW Historical Annual Parser] Simple cash match: ${paymentYear} ${fiscalYear} ${cashDividend}`);
      
      // 計算殖利率 (股利/股價)
      const cashYield = stockPrice > 0 ? cashDividend / stockPrice : null;
      
      if (yahooFinanceTWTransforms.validateDividendData(fiscalYear, cashDividend)) {
        results.push({
          fiscalPeriod: `${fiscalYear}-Y`,
          cashDividend: cashDividend,
          stockDividend: null,
          cashYield: cashYield,
          exDividendDate: exDividendDate,
          exRightsDate: null,
          paymentDate: null
        });
        
        console.log(`[TW Historical Annual Parser] Found simple cash: ${fiscalYear}-Y = ${cashDividend}`);
      }
    }
    
    // Pattern 3: 純股票股利格式 - 無現金股利，僅股票股利
    // 範例: 2001 2000 - 7.00 - - - 2001/09/30
    const legacyStockOnlyPattern = /(19|20)\d{2}\s+(19|20)\d{2}\s+\-\s+(\d+\.\d+)\s+\-\s+\-\s+\-\s+(19|20)\d{2}\/\d{2}\/\d{2}/g;
    
    while ((match = legacyStockOnlyPattern.exec(textContent)) !== null) {
      const paymentYear = match[1];
      const fiscalYear = match[2];
      const stockDividend = parseFloat(match[3]);
      const paymentDate = match[4];
      
      console.log(`[TW Historical Annual Parser] Stock-only match: ${paymentYear} ${fiscalYear} stock=${stockDividend}`);
      
      if (yahooFinanceTWTransforms.validateDividendData(fiscalYear, stockDividend)) {
        results.push({
          fiscalPeriod: `${fiscalYear}-Y`,
          cashDividend: null,
          stockDividend: stockDividend,
          cashYield: null,
          exDividendDate: null,
          exRightsDate: paymentDate,
          paymentDate: paymentDate
        });
        
        console.log(`[TW Historical Annual Parser] Found stock-only: ${fiscalYear}-Y, stock=${stockDividend}`);
      }
    }
    
    // Pattern 4: 專門針對純股票股利的歷史記錄
    // 格式: 2001 2000 - 7.00 - - - 2001/09/30 (只有股票股利)
    const stockOnlyHistoricalPattern = /(199[7-9]|20[0-2]\d)\s+(199[6-9]|20[0-2]\d)\s+\-\s+(\d{1,2}\.\d{1,3})\s+\-\s+\-\s+\-\s+(199[7-9]|20[0-2]\d)\/\d{2}\/\d{2}/g;
    
    while ((match = stockOnlyHistoricalPattern.exec(textContent)) !== null) {
      const paymentYear = match[1];
      const fiscalYear = match[2];
      const stockDividendStr = match[3];
      const paymentDate = match[4];
      
      console.log(`[TW Historical Annual Parser] Stock-only historical match: ${paymentYear} ${fiscalYear} stock=${stockDividendStr}`);
      
      const stockDividend = parseFloat(stockDividendStr);
      if (!isNaN(stockDividend) && stockDividend > 0 && stockDividend < 50) {
        const yearNum = parseInt(fiscalYear);
        if (yearNum >= 1997 && yearNum <= 2025) {
          
          // 檢查是否已存在相同年度的記錄
          const existingRecord = results.find(r => r.fiscalPeriod === `${fiscalYear}-Y`);
          if (!existingRecord) {
            results.push({
              fiscalPeriod: `${fiscalYear}-Y`,
              cashDividend: null,
              stockDividend: stockDividend,
              cashYield: null,
              exDividendDate: null,
              exRightsDate: paymentDate,
              paymentDate: paymentDate
            });
            
            console.log(`[TW Historical Annual Parser] Found stock-only historical: ${fiscalYear}-Y, stock=${stockDividend}`);
          }
        }
      }
    }
    
    console.log(`[TW Historical Annual Parser] Total historical records found: ${results.length}`);
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