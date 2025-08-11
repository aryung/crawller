/**
 * 台灣財務數據處理工具函數
 */

// 台灣財務數據處理常數
const TW_DATA_PROCESSING = {
  DEFAULT_DATE: '2024-01-01',
  MONTH_DAY_DEFAULT: '01',
  SORT_ORDER: {
    DESC: 'desc' as const,
    ASC: 'asc' as const
  }
};

/**
 * 解析台灣財務期間為可比較的日期對象
 * 支援 YYYY/MM 格式，自動補全為完整日期
 */
export function parseTWFiscalPeriod(fiscalPeriod: string | null | undefined): Date {
  if (!fiscalPeriod) {
    return new Date(TW_DATA_PROCESSING.DEFAULT_DATE);
  }
  
  // 支援 YYYY/MM 格式
  if (fiscalPeriod.match(/^\d{4}\/\d{1,2}$/)) {
    const completeDateString = fiscalPeriod + `/${TW_DATA_PROCESSING.MONTH_DAY_DEFAULT}`;
    return new Date(completeDateString);
  }
  
  // 支援完整日期格式
  const parsedDate = new Date(fiscalPeriod);
  if (!isNaN(parsedDate.getTime())) {
    return parsedDate;
  }
  
  // 回退到默認日期
  return new Date(TW_DATA_PROCESSING.DEFAULT_DATE);
}

/**
 * 通用的台灣財務數據排序函數
 * @param data 要排序的數據陣列
 * @param order 排序順序：'desc' 最新在前，'asc' 最舊在前
 * @returns 排序後的數據陣列
 */
export function sortTWFinancialDataByPeriod<T extends { fiscalPeriod: string | null }>(
  data: T[], 
  order: 'desc' | 'asc' = TW_DATA_PROCESSING.SORT_ORDER.DESC
): T[] {
  return data.sort((a, b) => {
    const aDate = parseTWFiscalPeriod(a.fiscalPeriod);
    const bDate = parseTWFiscalPeriod(b.fiscalPeriod);
    
    const timeDiff = bDate.getTime() - aDate.getTime();
    return order === TW_DATA_PROCESSING.SORT_ORDER.DESC ? timeDiff : -timeDiff;
  });
}