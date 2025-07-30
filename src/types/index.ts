export interface CrawlerConfig {
  url: string;
  selectors?: SelectorConfig;
  headers?: Record<string, string>;
  cookies?: CookieConfig;
  options?: CrawlerOptions;
}

// 重新匯出增強型別
export * from './enhanced';

export interface SelectorConfig {
  [key: string]: string | SelectorItem;
}

export interface SelectorItem {
  selector: string;
  attribute?: string;
  transform?: (value: string) => any;
}

export interface CookieConfig {
  enabled: boolean;
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
  encoding?: string; // 支援指定編碼：utf-8, big5, gb2312 等
  viewport?: {
    width: number;
    height: number;
  };
}

export interface CrawlerResult {
  url: string;
  data: Record<string, any>;
  timestamp: Date;
  success: boolean;
  error?: string;
  screenshot?: Buffer;
}

export interface ExportOptions {
  format: 'json' | 'csv' | 'xlsx';
  filename?: string;
  path?: string;
}