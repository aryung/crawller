export interface EnhancedCrawlerConfig {
  url: string;
  selectors?: EnhancedSelectorConfig;
  headers?: Record<string, string>;
  cookies?: CookieConfig;
  options?: CrawlerOptions;
  export?: ExportConfig;
  transforms?: Record<string, string>;
  inherits?: string;  // 繼承其他配置
  variables?: Record<string, any>;  // 配置變數
  dataDriven?: DataDrivenConfig; // 數據驅動配置
}

export interface DataDrivenConfig {
  source: string;
  jsonPath: string;
  variable: string;
}

export interface EnhancedSelectorConfig {
  [key: string]: string | EnhancedSelectorItem;
}

export interface EnhancedSelectorItem {
  selector: string;
  attribute?: string;
  transform?: string | TransformFunction;
  extract?: ExtractConfig;
  multiple?: boolean;
  waitFor?: number;
  optional?: boolean;
}

export interface ExtractConfig {
  [key: string]: string | {
    attribute?: string;
    transform?: string | TransformFunction;
  };
}

export interface ExportConfig {
  formats: ('json' | 'csv' | 'xlsx')[];
  filename?: string;
  path?: string;
  separate?: boolean;  // 每個格式分別匯出
}

export interface TransformFunction {
  (value: any, context?: TransformContext): any;
}

export interface TransformContext {
  url: string;
  selector: string;
  element?: any;
  page?: any;
  config?: EnhancedCrawlerConfig;
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
  waitAfterLogin?: number;
}

export interface CrawlerOptions {
  waitFor?: number;
  timeout?: number;
  retries?: number;
  userAgent?: string;
  headless?: boolean;
  screenshot?: boolean;
  delay?: number;
  viewport?: {
    width: number;
    height: number;
  };
}