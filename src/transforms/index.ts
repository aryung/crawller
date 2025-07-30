export interface TransformRegistry {
  [key: string]: (value: any, context?: any) => any;
}

// 內建轉換函式
export const builtinTransforms: TransformRegistry = {
  // 文字處理
  trim: (value: string) => value?.toString().trim(),
  toLowerCase: (value: string) => value?.toString().toLowerCase(),
  toUpperCase: (value: string) => value?.toString().toUpperCase(),
  
  // 數字處理
  parseInt: (value: string) => parseInt(value?.toString().replace(/\D/g, '') || '0'),
  parseFloat: (value: string) => parseFloat(value?.toString().replace(/[^\d.-]/g, '') || '0'),
  
  // 日期處理
  parseDate: (value: string) => new Date(value),
  formatDate: (value: string) => new Date(value).toLocaleDateString('zh-TW'),
  isoDate: (value: string) => new Date(value).toISOString(),
  timestamp: (value: string) => new Date(value).getTime(),
  
  // URL 處理
  extractDomain: (value: string) => {
    try {
      return new URL(value).hostname;
    } catch {
      return value;
    }
  },
  
  extractPath: (value: string) => {
    try {
      return new URL(value).pathname;
    } catch {
      return value;
    }
  },
  
  absoluteUrl: (value: string, context?: any) => {
    try {
      return new URL(value, context?.url || context?.baseUrl).href;
    } catch {
      return value;
    }
  },
  
  // 特殊提取函式
  extractNumbers: (value: string) => {
    const numbers = value?.toString().match(/\d+/g);
    return numbers ? numbers.map(n => parseInt(n)) : [];
  },
  
  extractEmails: (value: string) => {
    const emails = value?.toString().match(/[\w.-]+@[\w.-]+\.\w+/g);
    return emails || [];
  },
  
  extractPhones: (value: string) => {
    const phones = value?.toString().match(/[\d-()+ ]{8,}/g);
    return phones ? phones.map(p => p.trim()) : [];
  },
  
  // 陣列處理
  joinArray: (value: any[], separator: string = ',') => {
    return Array.isArray(value) ? value.join(separator) : value;
  },
  
  uniqueArray: (value: any[]) => {
    return Array.isArray(value) ? [...new Set(value)] : value;
  },
  
  filterEmpty: (value: any[]) => {
    return Array.isArray(value) ? value.filter(item => item && item.toString().trim()) : value;
  },
  
  // HTML 處理
  stripHtml: (value: string) => {
    return value?.toString().replace(/<[^>]*>/g, '').trim();
  },
  
  extractText: (value: string) => {
    return value?.toString().replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  },
  
  // 專用轉換函式
  extractIndustryCode: (value: string) => {
    const match = value?.toString().match(/[?&]a=([^&]+)/);
    return match ? match[1] : null;
  },
  
  extractStockCode: (value: string) => {
    const match = value?.toString().match(/(\d{4,6})/);
    return match ? match[1] : null;
  },
  
  parsePrice: (value: string) => {
    const cleaned = value?.toString().replace(/[^\d.-]/g, '');
    return parseFloat(cleaned) || 0;
  },
  
  parsePercentage: (value: string) => {
    const match = value?.toString().match(/([-+]?\d*\.?\d+)%/);
    return match ? parseFloat(match[1]) : 0;
  },
  
  parseVolume: (value: string) => {
    const str = value?.toString().replace(/,/g, '');
    const match = str.match(/([\d.]+)([萬億千百十]?)/);
    if (!match) return 0;
    
    const num = parseFloat(match[1]);
    const unit = match[2];
    
    const multipliers: Record<string, number> = {
      '十': 10,
      '百': 100,
      '千': 1000,
      '萬': 10000,
      '億': 100000000
    };
    
    return num * (multipliers[unit] || 1);
  },
  
  // 財經相關
  formatCurrency: (value: number, currency: string = 'TWD') => {
    const formatter = new Intl.NumberFormat('zh-TW', {
      style: 'currency',
      currency: currency
    });
    return formatter.format(value);
  },
  
  calculateChange: (current: number, previous: number) => {
    if (!previous) return 0;
    return ((current - previous) / previous * 100);
  },
  
  // 條件轉換
  conditional: (value: any, condition: string, trueValue: any, falseValue: any) => {
    // 簡單的條件判斷，可以擴展
    switch (condition) {
      case 'exists':
        return value ? trueValue : falseValue;
      case 'positive':
        return parseFloat(value) > 0 ? trueValue : falseValue;
      case 'negative':
        return parseFloat(value) < 0 ? trueValue : falseValue;
      default:
        return value;
    }
  },
  
  // 進階文字處理
  extractBetween: (value: string, start: string, end: string) => {
    const str = value?.toString();
    const startIndex = str.indexOf(start);
    if (startIndex === -1) return '';
    
    const endIndex = str.indexOf(end, startIndex + start.length);
    if (endIndex === -1) return str.substring(startIndex + start.length);
    
    return str.substring(startIndex + start.length, endIndex);
  },
  
  replaceAll: (value: string, search: string, replace: string) => {
    return value?.toString().split(search).join(replace);
  },
  
  matchRegex: (value: string, pattern: string, flags?: string) => {
    try {
      const regex = new RegExp(pattern, flags);
      const matches = value?.toString().match(regex);
      return matches || [];
    } catch {
      return [];
    }
  }
};

// 獲取轉換函式
export function getTransformFunction(name: string): Function | null {
  return builtinTransforms[name] || null;
}

// 註冊自定義轉換函式
export function registerTransform(name: string, fn: Function): void {
  builtinTransforms[name] = fn;
}

// 列出所有可用的轉換函式
export function listTransforms(): string[] {
  return Object.keys(builtinTransforms);
}

// 複合轉換函式（鏈式調用）
export function chainTransforms(value: any, transforms: string[]): any {
  let result = value;
  
  for (const transform of transforms) {
    const fn = getTransformFunction(transform);
    if (fn) {
      result = fn(result);
    }
  }
  
  return result;
}

// 條件轉換函式
export function conditionalTransform(
  value: any,
  condition: (val: any) => boolean,
  transform: string
): any {
  if (condition(value)) {
    const fn = getTransformFunction(transform);
    return fn ? fn(value) : value;
  }
  return value;
}