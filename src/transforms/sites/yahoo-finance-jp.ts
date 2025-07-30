/**
 * Yahoo Finance Japan 網站特定的轉換函數
 * 包含針對 Yahoo Finance Japan 網站結構和資料格式的特殊處理邏輯
 */

import { 
  YAHOO_FINANCE_JP_HEADER_ORDER, 
  PERFORMANCE_DATA_FIELD_MAPPING,
  getUnitMultiplier,
  isAmountHeader,
  isPercentageHeader,
  isDateHeader
} from '../../const/finance';

export interface YahooFinanceJPTransforms {
  cleanStockSymbol: (value: string) => string;
  parseJapaneseFinancialValue: (value: string) => number | string | null;
  parseJapanesePercentage: (value: string) => number | string | null;
  extractFiscalPeriod: (value: string) => string | null;
  parseJapaneseDate: (value: string) => string | null;
  cleanAccountingMethod: (value: string) => string;
  cleanFinancialText: (value: string) => string;
  parsePerformanceTable: (value: string) => any[];
  extractTableHeaders: (tableText: string) => string[];
  structureFinancialData: (tableText: string) => PerformanceData[];
  structureFinancialDataFromCells: (cells: string[]) => PerformanceData[];
  structureFinancialDataFromAllTableCells: (cells: string[]) => PerformanceData[];
}

export interface PerformanceData {
  fiscalPeriod: string | null;
  revenue: number | null;
  grossProfit: number | null;
  grossMargin: number | null;
  operatingProfit: number | null;
  operatingMargin: number | null;
  ordinaryProfit: number | null;
  ordinaryMargin: number | null;
  netProfit: number | null;
  accountingMethod: string | null;
  updateDate: string | null;
}

/**
 * Yahoo Finance Japan 特定轉換函數
 */
export const yahooFinanceJPTransforms: YahooFinanceJPTransforms = {
  /**
   * 清理股票代碼和公司名稱
   * 例如：從 "143A - エフピコ" 提取 "143A"
   */
  cleanStockSymbol: (value: string): string => {
    if (!value) return '';
    const cleaned = value.toString().trim();
    // 移除多餘的空白和特殊字符
    return cleaned.replace(/\s+/g, ' ').replace(/[\r\n\t]/g, '');
  },

  /**
   * 解析日文財務數值
   * 處理百万円、千円等單位，以及 "---" 或 "—" 等缺失值
   * 例如：從 "1,534百万円" 提取 1534，從 "---" 返回 null
   */
  parseJapaneseFinancialValue: (value: string): number | string | null => {
    if (!value) return null;
    
    const str = value.toString().trim();
    
    // 處理缺失值
    if (str === '---' || str === '—' || str === '--' || str === '') {
      return null;
    }
    
    // 移除逗號和空白
    let cleaned = str.replace(/[,\s]/g, '');
    
    // 處理百万円單位 (百万 = million)
    if (cleaned.includes('百万円')) {
      const match = cleaned.match(/([\d.-]+)百万円?/);
      if (match) {
        const num = parseFloat(match[1]);
        return isNaN(num) ? str : num; // 回傳 million 為單位的數值
      }
    }
    
    // 處理千円單位 (千 = thousand)
    if (cleaned.includes('千円')) {
      const match = cleaned.match(/([\d.-]+)千円?/);
      if (match) {
        const num = parseFloat(match[1]);
        return isNaN(num) ? str : num / 1000; // 轉換為 million 為單位
      }
    }
    
    // 處理一般數值
    const match = cleaned.match(/([\d.-]+)/);
    if (match) {
      const num = parseFloat(match[1]);
      return isNaN(num) ? str : num;
    }
    
    return str; // 如果無法解析，返回原始字串
  },

  /**
   * 解析日文百分比
   * 例如：從 "17.59%" 提取 17.59，從 "---" 返回 null
   */
  parseJapanesePercentage: (value: string): number | string | null => {
    if (!value) return null;
    
    const str = value.toString().trim();
    
    // 處理缺失值
    if (str === '---' || str === '—' || str === '--' || str === '') {
      return null;
    }
    
    // 提取百分比數值
    const match = str.match(/([\d.-]+)%?/);
    if (match) {
      const num = parseFloat(match[1]);
      return isNaN(num) ? str : num;
    }
    
    return str;
  },

  /**
   * 提取會計年度期間
   * 例如：從 "2026年3月期" 提取 "2026年3月期"
   */
  extractFiscalPeriod: (value: string): string | null => {
    if (!value) return null;
    
    const str = value.toString().trim();
    
    // 匹配日文會計年度格式
    const match = str.match(/(\d{4})年(\d{1,2})月期/);
    if (match) {
      return `${match[1]}年${match[2]}月期`;
    }
    
    // 如果包含"年"和"期"但格式不同
    if (str.includes('年') && str.includes('期')) {
      return str;
    }
    
    return null;
  },

  /**
   * 解析日文日期格式
   * 例如：從 "2025/6/24" 提取標準化日期
   */
  parseJapaneseDate: (value: string): string | null => {
    if (!value) return null;
    
    const str = value.toString().trim();
    
    // 處理 YYYY/M/D 格式
    const match = str.match(/(\d{4})\/(\d{1,2})\/(\d{1,2})/);
    if (match) {
      const year = match[1];
      const month = match[2].padStart(2, '0');
      const day = match[3].padStart(2, '0');
      return `${year}/${month}/${day}`;
    }
    
    return str;
  },

  /**
   * 清理會計方式
   * 例如：標準化 "日本会計基準"、"IFRS" 等
   */
  cleanAccountingMethod: (value: string): string => {
    if (!value) return '';
    
    const str = value.toString().trim();
    
    // 標準化常見會計方式
    if (str.includes('日本会計基準') || str.includes('日本会計')) {
      return '日本会計基準';
    }
    if (str.includes('IFRS')) {
      return 'IFRS';
    }
    if (str.includes('米国会計基準') || str.includes('US GAAP')) {
      return '米国会計基準';
    }
    
    return str;
  },

  /**
   * 清理財務文字數據
   * 移除多餘空白、換行符和特殊字符
   */
  cleanFinancialText: (value: string): string => {
    if (!value) return '';
    
    return value.toString()
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/[\r\n\t]/g, '')
      .replace(/　/g, ' '); // 替換全形空白為半形空白
  },

  /**
   * 解析財務績效表格
   * 從表格文字中提取結構化數據
   */
  parsePerformanceTable: (value: string): any[] => {
    if (!value) return [];
    
    try {
      const structuredData = yahooFinanceJPTransforms.structureFinancialData(value);
      return structuredData;
    } catch (error) {
      console.warn('Failed to parse performance table:', error);
      return [];
    }
  },

  /**
   * 提取表格標題
   * 從表格文字中識別並提取欄位標題
   */
  extractTableHeaders: (tableText: string): string[] => {
    if (!tableText) return [];
    
    const headers = [
      '売上高（百万円）', '売上総利益（百万円）', '粗利率',
      '営業利益（百万円）', '営業利益率', '経常利益（百万円）', 
      '経常利益率', '純利益（百万円）', '会計方式', '財務数値更新日'
    ];
    
    return headers.filter(header => tableText.includes(header));
  },

  /**
   * 結構化財務數據
   * 將表格文字轉換為結構化的財務數據陣列
   */
  structureFinancialData: (tableText: string): PerformanceData[] => {
    if (!tableText) return [];
    
    try {
      const results: PerformanceData[] = [];
      
      // 尋找財務年度模式
      const fiscalPeriodRegex = /(\d{4}年\d{1,2}月期[^）]*(?:）)?)/g;
      const fiscalPeriods = tableText.match(fiscalPeriodRegex) || [];
      
      // 為每個財務年度提取數據
      for (const period of fiscalPeriods) {
        const cleanPeriod = yahooFinanceJPTransforms.extractFiscalPeriod(period);
        if (!cleanPeriod) continue;
        
        // 尋找該年度對應的數據區段
        const periodIndex = tableText.indexOf(period);
        const currentPeriodIdx = fiscalPeriods.findIndex(p => p === period);
        const nextPeriod = currentPeriodIdx < fiscalPeriods.length - 1 ? fiscalPeriods[currentPeriodIdx + 1] : null;
        const nextPeriodIndex = nextPeriod ? tableText.indexOf(nextPeriod) : tableText.length;
        
        const dataSection = tableText.substring(periodIndex, nextPeriodIndex);
        
        // 提取各項財務數據
        const performanceData: PerformanceData = {
          fiscalPeriod: cleanPeriod,
          revenue: extractFinancialValue(dataSection, /(\d{1,3}(?:,\d{3})*(?:\.\d+)?)(?=.*売上高|(?:\d{1,3}(?:,\d{3})*){0}.*売上)/),
          grossProfit: extractFinancialValue(dataSection, /(\d{1,3}(?:,\d{3})*(?:\.\d+)?)(?=.*売上総利益|(?:\d{1,3}(?:,\d{3})*){1}.*売上総)/),
          grossMargin: extractPercentageValue(dataSection, /(\d{1,2}(?:\.\d{2})?)%(?=.*粗利率)/),
          operatingProfit: extractFinancialValue(dataSection, /(\d{1,3}(?:,\d{3})*(?:\.\d+)?)(?=.*営業利益)/),
          operatingMargin: extractPercentageValue(dataSection, /(\d{1,2}(?:\.\d{2})?)%(?=.*営業利益率)/),
          ordinaryProfit: extractFinancialValue(dataSection, /(\d{1,3}(?:,\d{3})*(?:\.\d+)?)(?=.*経常利益)/),
          ordinaryMargin: extractPercentageValue(dataSection, /(\d{1,2}(?:\.\d{2})?)%(?=.*経常利益率)/),
          netProfit: extractFinancialValue(dataSection, /(\d{1,3}(?:,\d{3})*(?:\.\d+)?)(?=.*純利益)/),
          accountingMethod: extractAccountingMethod(dataSection),
          updateDate: extractUpdateDate(dataSection)
        };
        
        results.push(performanceData);
      }
      
      return results.length > 0 ? results : parseAlternativeFormat(tableText);
      
    } catch (error) {
      console.warn('Failed to structure financial data:', error);
      return [];
    }
  },

  /**
   * 從表格單元格陣列中結構化財務數據
   * 使用基於位置的解析方式，更穩定準確
   */
  structureFinancialDataFromCells: (cells: string[]): PerformanceData[] => {
    if (!cells || !Array.isArray(cells) || cells.length === 0) return [];
    
    try {
      const results: PerformanceData[] = [];
      const cleanCells = cells.map(cell => yahooFinanceJPTransforms.cleanFinancialText(cell)).filter(cell => cell.trim() !== '');
      
      // 找出表格標題行的索引
      const headerIndicators = [
        '売上高（百万円）', '売上総利益（百万円）', '粗利率', 
        '営業利益（百万円）', '営業利益率', '経常利益（百万円）', 
        '経常利益率', '純利益（百万円）', '会計方式', '財務数値更新日'
      ];
      
      let headerStartIndex = -1;
      for (let i = 0; i < cleanCells.length; i++) {
        if (headerIndicators.some(header => cleanCells[i].includes(header))) {
          headerStartIndex = i;
          break;
        }
      }
      
      if (headerStartIndex === -1) {
        console.warn('Could not find table headers');
        return [];
      }
      
      // 確定表格結構 - 假設有10個欄位
      const columnCount = 10;
      const dataStartIndex = headerStartIndex + columnCount;
      
      // 解析數據行
      for (let i = dataStartIndex; i < cleanCells.length; i += columnCount) {
        const rowCells = cleanCells.slice(i, i + columnCount);
        
        if (rowCells.length < columnCount) break;
        
        // 檢查這是否是數據行（第一個單元格包含年份）
        const firstCell = rowCells[0];
        const fiscalPeriod = yahooFinanceJPTransforms.extractFiscalPeriod(firstCell);
        
        if (fiscalPeriod) {
          const performanceData: PerformanceData = {
            fiscalPeriod: fiscalPeriod,
            revenue: parseFinancialNumber(rowCells[1]),
            grossProfit: parseFinancialNumber(rowCells[2]),
            grossMargin: parsePercentNumber(rowCells[3]),
            operatingProfit: parseFinancialNumber(rowCells[4]),
            operatingMargin: parsePercentNumber(rowCells[5]),
            ordinaryProfit: parseFinancialNumber(rowCells[6]),
            ordinaryMargin: parsePercentNumber(rowCells[7]),
            netProfit: parseFinancialNumber(rowCells[8]),
            accountingMethod: yahooFinanceJPTransforms.cleanAccountingMethod(rowCells[9] || ''),
            updateDate: yahooFinanceJPTransforms.parseJapaneseDate(rowCells[10] || '')
          };
          
          // 避免重複記錄
          const exists = results.some(existing => 
            existing.fiscalPeriod === performanceData.fiscalPeriod &&
            existing.revenue === performanceData.revenue &&
            existing.operatingProfit === performanceData.operatingProfit
          );
          
          if (!exists) {
            results.push(performanceData);
          }
        }
      }
      
      return results;
      
    } catch (error) {
      console.warn('Failed to structure financial data from cells:', error);
      return [];
    }
  },

  /**
   * 從 allTableCells 字符串中解析結構化財務數據
   * 使用實際的表格標題作為解析依據，但輸出標準化的 PerformanceData 結構
   */
  structureFinancialDataFromAllTableCells: (cells: string[]): PerformanceData[] => {
    if (!cells || !Array.isArray(cells) || cells.length === 0) return [];
    
    try {
      const results: PerformanceData[] = [];
      
      // 找到包含完整數據的字符串
      let dataString = '';
      
      // 尋找包含表格標題的 cell
      for (const cell of cells) {
        if (typeof cell === 'string' && cell.includes('売上高（百万円）')) {
          // 確保這個 cell 包含實際數據，而不只是標題
          if (cell.includes('年3月期') || cell.includes('年度')) {
            dataString = cell;
            break;
          }
        }
      }
      
      if (!dataString) {
        // 備用方案：組合所有 cells
        const combined = cells.join(',');
        if (combined.includes('売上高（百万円）')) {
          dataString = combined;
        }
      }
      
      if (!dataString) {
        console.warn('Could not find financial data string');
        return [];
      }
      
      // 分割數據為陣列
      const cellArray = dataString.split(',').map(cell => cell.trim()).filter(cell => cell !== '');
      
      // 找到表格標題的起始位置
      const headerStartIndex = cellArray.findIndex(cell => cell === '売上高（百万円）');
      if (headerStartIndex === -1) {
        console.warn('Could not find table headers');
        return [];
      }
      
      // 使用常數定義的標題順序
      const headers = [];
      let headerIndex = headerStartIndex;
      
      // 按順序收集實際存在的標題
      for (const expectedHeader of YAHOO_FINANCE_JP_HEADER_ORDER) {
        if (headerIndex < cellArray.length && cellArray[headerIndex] === expectedHeader) {
          headers.push(expectedHeader);
          headerIndex++;
        } else {
          // 嘗試找到下一個預期的標題
          const foundIndex = cellArray.indexOf(expectedHeader, headerIndex);
          if (foundIndex !== -1 && foundIndex < headerIndex + 3) { // 允許一些偏移
            headers.push(expectedHeader);
            headerIndex = foundIndex + 1;
          } else {
            console.warn(`Header not found: ${expectedHeader}`);
            break;
          }
        }
      }
      
      
      // 從標題後開始解析數據行
      let currentIndex = headerStartIndex + headers.length;
      
      while (currentIndex < cellArray.length) {
        const cell = cellArray[currentIndex];
        const fiscalPeriod = yahooFinanceJPTransforms.extractFiscalPeriod(cell);
        
        if (fiscalPeriod) {
          // 找到年度資料，開始收集該行數據
          const rowStartIndex = currentIndex + 1;
          const rowData = [];
          
          // 收集數值，直到遇到下一個年度或數據結束
          let collectIndex = rowStartIndex;
          let numberCollected = 0;
          
          while (collectIndex < cellArray.length && numberCollected < headers.length) {
            const nextCell = cellArray[collectIndex];
            
            // 如果遇到下一個年度，停止收集
            if (yahooFinanceJPTransforms.extractFiscalPeriod(nextCell)) {
              break;
            }
            
            rowData.push(nextCell);
            collectIndex++;
            numberCollected++;
          }
          
          // 確保我們有足夠的數據
          if (rowData.length >= Math.min(headers.length - 2, 8)) {
            // 重組被逗號分割的大數字
            const restructuredData = restructureNumericDataForHeaders(rowData);
            
            // 使用表格標題順序來正確映射數據到標準化結構
            const headerValueMap: { [key: string]: any } = {};
            
            // 將重組後的數據與標題配對
            headers.forEach((header, index) => {
              if (index < restructuredData.length) {
                let value = restructuredData[index];
                
                // 使用智能轉換函數根據標題類型解析數據
                if (isAmountHeader(header) || isPercentageHeader(header)) {
                  value = parseValueByHeader(value, header);
                } else if (header.includes('会計方式')) {
                  value = yahooFinanceJPTransforms.cleanAccountingMethod(value || '');
                } else if (isDateHeader(header)) {
                  value = yahooFinanceJPTransforms.parseJapaneseDate(value || '');
                }
                
                headerValueMap[header] = value;
              }
            });
            
            // 使用映射常數映射到標準化的 PerformanceData 結構
            const performanceData: PerformanceData = {
              fiscalPeriod: fiscalPeriod,
              revenue: headerValueMap[PERFORMANCE_DATA_FIELD_MAPPING.revenue] || null,
              grossProfit: headerValueMap[PERFORMANCE_DATA_FIELD_MAPPING.grossProfit] || null,
              grossMargin: headerValueMap[PERFORMANCE_DATA_FIELD_MAPPING.grossMargin] || null,
              operatingProfit: headerValueMap[PERFORMANCE_DATA_FIELD_MAPPING.operatingProfit] || null,
              operatingMargin: headerValueMap[PERFORMANCE_DATA_FIELD_MAPPING.operatingMargin] || null,
              ordinaryProfit: headerValueMap[PERFORMANCE_DATA_FIELD_MAPPING.ordinaryProfit] || null,
              ordinaryMargin: headerValueMap[PERFORMANCE_DATA_FIELD_MAPPING.ordinaryMargin] || null,
              netProfit: headerValueMap[PERFORMANCE_DATA_FIELD_MAPPING.netProfit] || null,
              accountingMethod: headerValueMap[PERFORMANCE_DATA_FIELD_MAPPING.accountingMethod] || null,
              updateDate: headerValueMap[PERFORMANCE_DATA_FIELD_MAPPING.updateDate] || null
            };
            
            // 更嚴格的重複檢測 - 只允許每個會計年度有一條記錄
            const isDuplicate = results.some(existing => 
              existing.fiscalPeriod === performanceData.fiscalPeriod
            );
            
            if (!isDuplicate) {
              results.push(performanceData);
            }
          }
          
          currentIndex = collectIndex;
        } else {
          currentIndex++;
        }
      }
      
      return results;
      
    } catch (error) {
      console.warn('Failed to structure financial data from all table cells:', error);
      return [];
    }
  }
};

/**
 * 輔助函數：提取財務數值
 */
function extractFinancialValue(text: string, regex: RegExp): number | null {
  const match = text.match(regex);
  if (match && match[1]) {
    const cleanValue = match[1].replace(/,/g, '');
    const num = parseFloat(cleanValue);
    return isNaN(num) ? null : num;
  }
  return null;
}

/**
 * 輔助函數：提取百分比數值
 */
function extractPercentageValue(text: string, regex: RegExp): number | null {
  const match = text.match(regex);
  if (match && match[1]) {
    const num = parseFloat(match[1]);
    return isNaN(num) ? null : num;
  }
  return null;
}

/**
 * 輔助函數：提取會計方式
 */
function extractAccountingMethod(text: string): string | null {
  if (text.includes('IFRS')) return 'IFRS';
  if (text.includes('日本会計基準') || text.includes('日本会計')) return '日本会計基準';
  if (text.includes('米国会計基準') || text.includes('US GAAP')) return '米国会計基準';
  return null;
}

/**
 * 輔助函數：提取更新日期
 */
function extractUpdateDate(text: string): string | null {
  const dateMatch = text.match(/(\d{4})\/(\d{1,2})\/(\d{1,2})/);
  if (dateMatch) {
    const year = dateMatch[1];
    const month = dateMatch[2].padStart(2, '0');
    const day = dateMatch[3].padStart(2, '0');
    return `${year}/${month}/${day}`;
  }
  return null;
}

/**
 * 輔助函數：解析替代格式
 * 當正規表達式無法匹配時的備用解析方法
 */
function parseAlternativeFormat(tableText: string): PerformanceData[] {
  const results: PerformanceData[] = [];
  
  // 簡化的行分割解析
  const lines = tableText.split(/[\r\n]+/).filter(line => line.trim());
  const dataLines = lines.filter(line => 
    /\d{4}年\d{1,2}月期/.test(line) || 
    /\d{1,3}(?:,\d{3})*/.test(line)
  );
  
  // 如果有找到數據行，嘗試基本解析
  if (dataLines.length > 0) {
    const data: PerformanceData = {
      fiscalPeriod: yahooFinanceJPTransforms.extractFiscalPeriod(tableText),
      revenue: null,
      grossProfit: null,
      grossMargin: null,
      operatingProfit: null,
      operatingMargin: null,
      ordinaryProfit: null,
      ordinaryMargin: null,
      netProfit: null,
      accountingMethod: extractAccountingMethod(tableText),
      updateDate: extractUpdateDate(tableText)
    };
    
    results.push(data);
  }
  
  return results;
}

/**
 * 輔助函數：解析財務數字（支援逗號分隔的大數）
 */
function parseFinancialNumber(value: string): number | null {
  if (!value || value === '---' || value === '--' || value.trim() === '') {
    return null;
  }
  
  const cleanValue = value.replace(/[,\s]/g, '');
  const num = parseFloat(cleanValue);
  return isNaN(num) ? null : num;
}

/**
 * 輔助函數：解析百分比數字
 */
function parsePercentNumber(value: string): number | null {
  if (!value || value === '---' || value === '--' || value.trim() === '') {
    return null;
  }
  
  const cleanValue = value.replace(/[%\s]/g, '');
  const num = parseFloat(cleanValue);
  return isNaN(num) ? null : num;
}

/**
 * 智能數值解析函數 - 根據表格標題進行單位轉換
 */
function parseValueByHeader(value: string, header: string): number | null {
  if (!value || value === '---' || value === '--' || value.trim() === '') {
    return null;
  }
  
  // 清理數值字符串
  const cleanValue = value.replace(/[,\s]/g, '');
  const numValue = parseFloat(cleanValue);
  
  if (isNaN(numValue)) {
    return null;
  }
  
  // 根據標題類型進行單位轉換
  const multiplier = getUnitMultiplier(header);
  return numValue * multiplier;
}

/**
 * 輔助函數：重組被逗號分割的數字數據（基於標題）
 * 更智能地處理數據重組，基於上下文而不是硬編碼位置
 */
function restructureNumericDataForHeaders(rowData: string[]): string[] {
  const result: string[] = [];
  let currentIndex = 0;
  
  while (currentIndex < rowData.length) {
    const currentValue = rowData[currentIndex];
    
    // 如果是 "---" 或包含特殊字符的值，直接使用
    if (currentValue === '---' || currentValue.includes('%') || 
        currentValue.includes('IFRS') || currentValue.includes('日本会計') ||
        currentValue.includes('/') || currentValue.includes('年') ||
        currentValue.includes('月')) {
      result.push(currentValue);
      currentIndex++;
    } else if (/^\d+$/.test(currentValue)) {
      // 處理純數字，檢查是否需要重組
      let reconstructedNumber = currentValue;
      let combinedCount = 0;
      
      // 檢查下一個元素是否是數字的一部分
      while (currentIndex + 1 < rowData.length && combinedCount < 3) { // 最多重組3次
        const nextValue = rowData[currentIndex + 1];
        
        // 如果下一個值是數字（1-3位），可能需要重組
        if (/^\d{1,3}$/.test(nextValue)) {
          // 更智能的重組決策
          let shouldCombine = false;
          
          if (currentIndex + 2 < rowData.length) {
            const valueAfterNext = rowData[currentIndex + 2];
            
            // 如果後面是特殊值或我們已經有合理的數字長度，則重組
            if (valueAfterNext.includes('%') || 
                valueAfterNext.includes('IFRS') || 
                valueAfterNext.includes('日本会計') ||
                valueAfterNext.includes('/') ||
                valueAfterNext === '---' ||
                (nextValue.length === 3 && reconstructedNumber.length >= 1)) { // 千位分隔符邏輯
              shouldCombine = true;
            }
          } else {
            // 如果這是最後兩個元素，也重組
            shouldCombine = true;
          }
          
          if (shouldCombine) {
            reconstructedNumber = reconstructedNumber + ',' + nextValue;
            currentIndex++;
            combinedCount++;
          } else {
            break;
          }
        } else {
          break;
        }
      }
      
      result.push(reconstructedNumber);
      currentIndex++;
    } else {
      // 其他情況直接使用
      result.push(currentValue);
      currentIndex++;
    }
  }
  
  return result;
}

/**
 * 輔助函數：重組被逗號分割的數字數據
 * 處理像 ["1", "534", "---", "---", "30", "1.96%"] 這樣的數據
 */
function restructureNumericData(rowData: string[]): {
  revenue: string;
  grossProfit: string;
  grossMargin: string;
  operatingProfit: string;
  operatingMargin: string;
  ordinaryProfit: string;
  ordinaryMargin: string;
  netProfit: string;
  accountingMethod: string;
  updateDate: string;
} {
  const result = {
    revenue: '',
    grossProfit: '',
    grossMargin: '',
    operatingProfit: '',
    operatingMargin: '',
    ordinaryProfit: '',
    ordinaryMargin: '',
    netProfit: '',
    accountingMethod: '',
    updateDate: ''
  };
  
  // 重組數字的策略：尋找連續的數字片段並重組
  let currentIndex = 0;
  const fields = ['revenue', 'grossProfit', 'grossMargin', 'operatingProfit', 'operatingMargin', 
                  'ordinaryProfit', 'ordinaryMargin', 'netProfit', 'accountingMethod', 'updateDate'];
  
  for (const field of fields) {
    if (currentIndex >= rowData.length) break;
    
    const currentValue = rowData[currentIndex];
    
    // 如果是 "---" 或包含 % 的值，直接使用
    if (currentValue === '---' || currentValue.includes('%') || 
        currentValue.includes('IFRS') || currentValue.includes('日本会計') ||
        currentValue.includes('/')) {
      result[field as keyof typeof result] = currentValue;
      currentIndex++;
    } else {
      // 嘗試重組數字（處理被逗號分割的情況）
      let reconstructedNumber = currentValue;
      
      // 檢查下一個元素是否是數字的一部分
      if (currentIndex + 1 < rowData.length) {
        const nextValue = rowData[currentIndex + 1];
        
        // 如果下一個值是 3 位數字，可能是千位分隔符的一部分
        if (/^\d{3}$/.test(nextValue)) {
          reconstructedNumber = currentValue + ',' + nextValue;
          currentIndex++;
          
          // 繼續檢查是否還有更多數字部分
          if (currentIndex + 1 < rowData.length) {
            const thirdValue = rowData[currentIndex + 1];
            if (/^\d{3}$/.test(thirdValue)) {
              reconstructedNumber = reconstructedNumber + ',' + thirdValue;
              currentIndex++;
            }
          }
        }
      }
      
      result[field as keyof typeof result] = reconstructedNumber;
      currentIndex++;
    }
  }
  
  return result;
}

/**
 * 註冊 Yahoo Finance Japan 轉換函數到全域轉換註冊表
 */
export function registerYahooFinanceJPTransforms(registry: any): void {
  Object.entries(yahooFinanceJPTransforms).forEach(([name, fn]) => {
    registry[name] = fn;
  });
}

/**
 * 獲取 Yahoo Finance Japan 特定轉換函數
 */
export function getYahooFinanceJPTransform(name: keyof YahooFinanceJPTransforms): Function | null {
  return yahooFinanceJPTransforms[name] || null;
}

/**
 * 列出所有 Yahoo Finance Japan 轉換函數名稱
 */
export function listYahooFinanceJPTransforms(): string[] {
  return Object.keys(yahooFinanceJPTransforms);
}