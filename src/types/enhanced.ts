import { CrawlerConfig, SelectorItem } from './index';

export interface EnhancedCrawlerConfig extends Omit<CrawlerConfig, 'selectors'> {
  selectors?: EnhancedSelectorConfig;
  export?: ExportConfig;
  transforms?: Record<string, string>;
  inherits?: string;  // 繼承其他配置
  variables?: Record<string, unknown>;  // 配置變數
  dataDriven?: DataDrivenConfig; // 數據驅動配置
  actions?: ActionItem[]; // 動態操作序列
}

export interface DataDrivenConfig {
  // 新版格式
  enabled?: boolean;
  sourceConfig?: string;
  sourceSelector?: string;
  urlTemplate?: string;
  templateVars?: Record<string, string>;

  // 舊版格式（向後兼容）
  source?: string;
  jsonPath?: string;
  variable?: string;
}

export interface EnhancedSelectorConfig {
  [key: string]: string | EnhancedSelectorItem | SelectorItem;
}

export interface EnhancedSelectorItem {
  selector: string;
  attribute?: string;
  transform?: string | TransformFunction | ((value: string) => unknown);
  extract?: ExtractConfig;
  multiple?: boolean;
  waitFor?: number;
  optional?: boolean;
}

export interface ActionItem {
  type: 'click' | 'type' | 'wait' | 'scroll' | 'select';
  selector?: string;
  value?: string;
  timeout?: number;
  description?: string;
}

export interface ExtractConfig {
  [key: string]: string | {
    attribute?: string;
    transform?: string | TransformFunction | ((value: string) => unknown);
  };
}

export interface ExportConfig {
  formats: ('json' | 'csv' | 'xlsx')[];
  filename?: string;
  path?: string;
  separate?: boolean;  // 每個格式分別匯出
}

export interface TransformFunction {
  (value: unknown, context?: TransformContext): unknown;
}

export interface TransformContext {
  url: string;
  selector: string;
  element?: unknown;
  page?: unknown;
  config?: EnhancedCrawlerConfig;
}

