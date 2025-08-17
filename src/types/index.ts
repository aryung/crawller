// 重新匯出增強型別
export * from './enhanced';

export interface CrawlerConfig {
  url: string;
  selectors?: SelectorConfig;
  excludeSelectors?: string[];
  headers?: Record<string, string>;
  cookies?: CookieConfig;
  options?: CrawlerOptions;
}

export interface SelectorConfig {
  [key: string]: string | SelectorItem;
}

export interface SelectorItem {
  selector: string;
  attribute?: string;
  transform?: string | ((value: string) => unknown);
  multiple?: boolean; // Add enhanced properties as optional
  extract?: Record<string, unknown>; // Simplified extract for compatibility
}

export interface CookieConfig {
  enabled?: boolean;
  domain?: string;
  cookieString?: string;
  loginUrl?: string;
  loginSelectors?: {
    username: string;
    password: string;
    submit: string;
  };
  credentials?: {
    username: string;
    password: string;
  };
}

export interface CrawlerOptions {
  waitFor?: number;
  timeout?: number;
  retries?: number;
  userAgent?: string;
  headless?: boolean;
  screenshot?: boolean;
  delay?: number;
  domainDelay?: number; // 對同一網域的請求間隔時間（毫秒），預防 DDoS 誤判
  encoding?: string; // 支援指定編碼：utf-8, big5, gb2312 等
  waitForNetworkIdle?: boolean; // 是否等待網路閒置，false 時使用 domcontentloaded
  viewport?: {
    width: number;
    height: number;
  };
}

export interface CrawlerResult {
  url: string;
  data: Record<string, unknown>;
  timestamp: Date;
  success: boolean;
  error?: string;
  screenshot?: Buffer;
}

export interface ExportOptions {
  format: 'json' | 'csv' | 'xlsx';
  filename?: string;
  path?: string;
  configName?: string;
}

