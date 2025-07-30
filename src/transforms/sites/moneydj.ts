/**
 * MoneyDJ 網站特定的轉換函數
 * 包含針對 MoneyDJ 網站結構和資料格式的特殊處理邏輯
 */

export interface MoneyDJTransforms {
  extractIndustryCode: (value: string) => string | null;
  extractIndustryCategory: (value: string) => string;
  cleanIndustryName: (value: string) => string;
}

/**
 * MoneyDJ 特定轉換函數
 */
export const moneydjTransforms: MoneyDJTransforms = {
  /**
   * 從 MoneyDJ URL 中提取產業代碼
   * 例如：從 "?a=C011010" 提取 "C011010"
   */
  extractIndustryCode: (value: string): string | null => {
    const match = value?.toString().match(/[?&]a=([^&]+)/);
    return match ? match[1] : null;
  },

  /**
   * 根據 MoneyDJ 產業代碼分類
   * 根據 zh{code}.djhtm 格式中的代碼判斷產業類別
   */
  extractIndustryCategory: (value: string): string => {
    const match = value?.toString().match(/zh(\d+)\.djhtm/);
    if (!match) return '其他';
    
    const code = match[1];
    
    // MoneyDJ 產業分類邏輯
    if (code.startsWith('01')) return '原物料';
    if (code.startsWith('02')) return '電子';
    if (code.startsWith('03')) return '通訊';
    if (code.startsWith('04')) return '半導體';
    if (code.startsWith('05')) return '光電';
    if (code.startsWith('06')) return '生技';
    
    return '其他';
  },

  /**
   * 清理 MoneyDJ 產業名稱格式
   * 移除多餘空白和換行符
   */
  cleanIndustryName: (value: string): string => {
    return value?.toString().trim().replace(/\s+/g, ' ').replace(/[\r\n]/g, '');
  }
};

/**
 * 註冊 MoneyDJ 轉換函數到全域轉換註冊表
 */
export function registerMoneyDJTransforms(registry: any): void {
  Object.entries(moneydjTransforms).forEach(([name, fn]) => {
    registry[name] = fn;
  });
}

/**
 * 獲取 MoneyDJ 特定轉換函數
 */
export function getMoneyDJTransform(name: keyof MoneyDJTransforms): Function | null {
  return moneydjTransforms[name] || null;
}

/**
 * 列出所有 MoneyDJ 轉換函數名稱
 */
export function listMoneyDJTransforms(): string[] {
  return Object.keys(moneydjTransforms);
}