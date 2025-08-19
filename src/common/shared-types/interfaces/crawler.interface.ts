// ============= 爬蟲系統共享類型定義 =============

import { ExecutionResultDto } from '../dtos';
import { MarketRegion } from './market-data.interface';

// === Task 相關 Enum ===

export enum TaskStatus {
  PENDING = 'pending',
  ASSIGNED = 'assigned',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  TIMEOUT = 'timeout',
  CANCELLED = 'cancelled',
}

export enum ScheduleType {
  ONCE = 'once',
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  INTERVAL = 'interval',
  CUSTOM = 'custom',
}

// Note: 移除 ExchangeArea，統一使用 MarketRegion
// 請使用 '../market-data.interface' 中的 MarketRegion 代替

export enum DataType {
  DAILY = 'daily',
  QUARTERLY = 'quarterly',
  BALANCE_SHEET = 'balance-sheet',
  INCOME_STATEMENT = 'income-statement',
  CASH_FLOW_STATEMENT = 'cash-flow-statement',
  METADATA = 'metadata',
  EARNINGS = 'earnings',
  DIVIDENDS = 'dividends',
}

// === Worker 相關 Enum ===

export enum WorkerStatus {
  ACTIVE = 'active',
  BUSY = 'busy',
  OFFLINE = 'offline',
  ERROR = 'error',
}

// === History 相關 Enum ===

export enum HistoryStatus {
  SUCCESS = 'success',
  FAILED = 'failed',
  TIMEOUT = 'timeout',
  PARTIAL = 'partial',
  CANCELLED = 'cancelled',
}

export enum ErrorType {
  NETWORK = 'network',
  PARSING = 'parsing',
  VALIDATION = 'validation',
  TIMEOUT = 'timeout',
  SYSTEM = 'system',
}

// === Failure 相關 Enum ===

export enum FailureCategory {
  NETWORK = 'network',
  PARSING = 'parsing',
  VALIDATION = 'validation',
  TIMEOUT = 'timeout',
  SYSTEM = 'system',
  RATE_LIMIT = 'rate_limit',
  AUTH = 'auth',
  SELECTOR = 'selector',
}

export enum FailureReason {
  EMPTY_DATA = 'empty_data',
  CONNECTION_REFUSED = 'connection_refused',
  CONNECTION_TIMEOUT = 'connection_timeout',
  DNS_ERROR = 'dns_error',
  SSL_ERROR = 'ssl_error',
  HTTP_ERROR = 'http_error',
  SELECTOR_FAILED = 'selector_failed',
  PARSING_ERROR = 'parsing_error',
  VALIDATION_ERROR = 'validation_error',
  RATE_LIMITED = 'rate_limited',
  CAPTCHA_REQUIRED = 'captcha_required',
  ACCESS_DENIED = 'access_denied',
  MEMORY_ERROR = 'memory_error',
  DISK_FULL = 'disk_full',
  UNKNOWN = 'unknown',
}

export enum ResolutionType {
  RETRIED = 'retried',
  IGNORED = 'ignored',
  FIXED = 'fixed',
  ESCALATED = 'escalated',
  CONFIGURATION_UPDATED = 'configuration_updated',
}

// ============= Task 執行和回報相關 Interface =============

/**
 * Worker 執行任務時的 payload
 */
export interface TaskExecutionPayload {
  task_id: string;
  symbol_code: string;
  exchange_area: MarketRegion;
  data_type: DataType;
  config_file_path?: string;
  config_override?: Record<string, unknown>;
  start_date?: Date;
  end_date?: Date;
  timeout_seconds?: number;
}

/**
 * Worker 回報任務結果的 payload
 */
export interface TaskReportPayload {
  // 基本任務資訊
  task_id: string;
  symbol_code: string;
  exchange_area: MarketRegion;
  data_type: DataType;

  // 執行狀態
  status: HistoryStatus;

  // 執行時間資訊
  started_at: Date;
  completed_at?: Date;
  execution_time_ms?: number;

  // 數據範圍和統計
  crawled_from?: Date;
  crawled_to?: Date;
  records_fetched?: number;
  records_saved?: number;
  data_quality_score?: number;

  // 系統資源使用
  memory_usage_mb?: number;
  network_requests?: number;

  // 輸出檔案
  output_file_path?: string;

  // 回應摘要
  response_summary?: Record<string, unknown>;

  // 錯誤資訊（失敗時）
  error?: TaskFailureInfo;

  // 可選：爬取的數據（根據配置決定是否包含）
  crawled_data?: unknown[];
}

/**
 * 任務失敗資訊
 */
export interface TaskFailureInfo {
  category: FailureCategory;
  reason: FailureReason;
  message: string;
  error_code?: string;
  request_url?: string;
  response_status?: number;
  response_headers?: Record<string, unknown>;
  selector_used?: string;
  page_content_sample?: string;
  stack_trace?: string;
}

/**
 * Worker 狀態回報
 */
export interface WorkerStatusReport {
  worker_id: string;
  status: WorkerStatus;
  current_load: number;
  memory_usage_mb?: number;
  cpu_usage_percent?: number;
  last_heartbeat: Date;
  active_tasks?: string[]; // task_id 列表
}

/**
 * 任務建立請求
 */
export interface TaskCreationRequest {
  symbol_code: string;
  exchange_area: MarketRegion;
  data_type: DataType;
  schedule_type: ScheduleType;
  priority?: number;
  cron_expression?: string;
  start_date?: Date;
  end_date?: Date;
  config_file_path?: string;
  config_override?: Record<string, unknown>;
  timeout_seconds?: number;
  max_retries?: number;
}

/**
 * 批次任務建立請求
 */
export interface BatchTaskCreationRequest {
  tasks: TaskCreationRequest[];
  default_schedule_type?: ScheduleType;
  default_priority?: number;
}

/**
 * 任務查詢過濾器
 */
export interface TaskQueryFilter {
  status?: TaskStatus[];
  exchange_area?: MarketRegion[];
  data_type?: DataType[];
  symbol_code?: string;
  assigned_to?: string;
  created_after?: Date;
  created_before?: Date;
  next_run_before?: Date; // 需要執行的任務
}

/**
 * Worker 註冊資訊
 */
export interface WorkerRegistrationInfo {
  id: string;
  name: string;
  supported_regions: MarketRegion[];
  supported_data_types: DataType[];
  max_concurrent_tasks?: number;
  host_info?: Record<string, unknown>;
  version?: string;
}

// ============= Task Generator 相關 Interface =============

/**
 * 股票任務配置
 */
export interface StockTaskConfig {
  symbol_code: string;
  exchange_area: MarketRegion;
  data_type: DataType;
  priority?: number;
  schedule_type?: ScheduleType;
  config_version?: string;
  custom_config?: Record<string, unknown>;
}

/**
 * 股票任務生成器選項
 */
export interface StockTaskGeneratorOptions {
  defaultPriority: number;
  defaultConfigVersion: string;
  priorityStrategy: 'fixed' | 'marketCap' | 'volume' | 'random';
  scheduleStrategy: 'manual' | 'cron' | 'adaptive';
  validateSymbols: boolean;
  generateConfigs: boolean;
}

// ============= Fundamental Data 相關 Interface =============

/**
 * 爬蟲原始數據接口 - 從各網站爬取的原始數據格式
 */
export interface CrawlerRawData {
  // 基本識別信息
  symbolCode: string;
  exchangeArea: MarketRegion;
  reportDate: string;
  fiscalYear: string;
  fiscalMonth?: string;
  reportType?: string;
  dataSource?: string;
  lastUpdated?: string;

  // Income Statement 損益表
  revenue?: number;
  costOfGoodsSold?: number;
  grossProfit?: number;
  operatingExpenses?: number;
  operatingIncome?: number;
  netIncome?: number;
  ebitda?: number;
  eps?: number;
  dilutedEPS?: number;

  // Balance Sheet 資產負債表
  totalAssets?: number;
  currentAssets?: number;
  totalLiabilities?: number;
  currentLiabilities?: number;
  shareholdersEquity?: number;
  totalDebt?: number;
  longTermDebt?: number;
  shortTermDebt?: number;
  cashAndEquivalents?: number;
  bookValuePerShare?: number;
  sharesOutstanding?: number;

  // Cash Flow 現金流量表
  operatingCashFlow?: number;
  investingCashFlow?: number;
  financingCashFlow?: number;
  freeCashFlow?: number;
  capex?: number;
  debtIssuance?: number;
  debtRepayment?: number;
  dividendPayments?: number;

  // US 市場特有欄位
  netTangibleAssets?: number;
  totalCapitalization?: number;
  commonStockEquity?: number;
  netDebt?: number;
  basicAverageShares?: number;
  dilutedAverageShares?: number;
  pretaxIncome?: number;
  taxProvision?: number;
  interestIncome?: number;
  interestExpense?: number;

  // TW 市場特有欄位
  monthlyRevenue?: number;
  yoyGrowth?: number;
  momGrowth?: number;

  // JP 市場特有欄位
  operatingProfit?: number;
  ordinaryProfit?: number;

  // 其他地區特定數據
  regionalData?: RegionalData;

  // 允許其他未定義的欄位
  [key: string]: unknown;
}

/**
 * 台灣市場特有欄位
 */
export interface TWRegionalData {
  monthlyRevenue?: number;
  yoyGrowth?: number;
  momGrowth?: number;
  [key: string]: unknown;
}

/**
 * 美國市場特有欄位
 */
export interface USRegionalData {
  basicAverageShares?: number;
  dilutedAverageShares?: number;
  pretaxIncome?: number;
  taxProvision?: number;
  interestIncome?: number;
  interestExpense?: number;
  netTangibleAssets?: number;
  totalCapitalization?: number;
  commonStockEquity?: number;
  netDebt?: number;
  [key: string]: unknown;
}

/**
 * 日本市場特有欄位
 */
export interface JPRegionalData {
  operatingProfit?: number;
  ordinaryProfit?: number;
  [key: string]: unknown;
}

/**
 * 聯合 RegionalData 類型
 */
export type RegionalData =
  | TWRegionalData
  | USRegionalData
  | JPRegionalData
  | Record<string, unknown>;

/**
 * API 格式數據接口 - 傳送到後端 API 的標準格式
 */
export interface FundamentalApiData {
  // 基本識別信息
  symbolCode: string;
  exchangeArea: MarketRegion;
  reportDate: string;
  fiscalYear: string;
  fiscalMonth?: string;
  reportType: string;
  dataSource?: string;
  lastUpdated?: string;

  // Income Statement 損益表
  revenue?: number;
  costOfGoodsSold?: number;
  grossProfit?: number;
  operatingExpenses?: number;
  operatingIncome?: number;
  netIncome?: number;
  ebitda?: number;
  eps?: number;
  dilutedEPS?: number;

  // Balance Sheet 資產負債表
  totalAssets?: number;
  currentAssets?: number;
  totalLiabilities?: number;
  currentLiabilities?: number;
  shareholdersEquity?: number;
  totalDebt?: number;
  longTermDebt?: number;
  shortTermDebt?: number;
  cashAndEquivalents?: number;
  bookValuePerShare?: number;
  sharesOutstanding?: number;

  // Cash Flow 現金流量表
  operatingCashFlow?: number;
  investingCashFlow?: number;
  financingCashFlow?: number;
  freeCashFlow?: number;
  capex?: number;
  debtIssuance?: number;
  debtRepayment?: number;
  dividendPayments?: number;

  // 地區特定數據統一放入 regionalData
  regionalData?: RegionalData;
}

/**
 * 數據轉換結果類型
 */
export interface ConvertedFundamentalData {
  data: FundamentalApiData;
  warnings?: string[];
  errors?: string[];
}

// ============= Worker 配置介面 =============

export interface WorkerConfig {
  /** Worker 唯一標識符 */
  workerId: string;
  /** Worker 顯示名稱 */
  workerName: string;
  /** Server API URL */
  serverUrl: string;
  /** API 認證金鑰 */
  apiKey?: string;
  /** 是否啟用自動版本切換 */
  autoVersionSwitch?: boolean;
  /** 優先使用 Git 版本而非 package.json */
  preferGitVersion?: boolean;
  /** 版本快取目錄 */
  versionCacheDir?: string;
  /** 支援的市場地區 */
  supportedRegions: MarketRegion[];
  /** 支援的數據類型 */
  supportedDataTypes: DataType[];
  /** 最大並發任務數 */
  maxConcurrentTasks?: number;
  /** 任務請求間隔（毫秒） */
  pollingInterval?: number;
  /** 心跳間隔（毫秒） */
  heartbeatInterval?: number;
  /** 版本檢查超時（毫秒） */
  versionCheckTimeout?: number;
  /** 錯誤時自動重啟 */
  autoRestartOnError?: boolean;
  /** 最大錯誤重試次數 */
  maxErrorRetries?: number;
  /** GitHub Token for private repo access */
  githubToken?: string;
}

// ============= 擴展的任務介面 =============

export interface CrawlerTask {
  /** 任務唯一標識符 */
  id: string;
  /** 股票代碼 */
  symbol_code: string;
  /** 交易地區 */
  exchange_area: MarketRegion;
  /** 數據類型 */
  data_type: DataType;
  /** 任務狀態 */
  status: TaskStatus;
  /** 任務優先級 (1-10) */
  priority: number;
  /** 分配的 Worker ID */
  assigned_to?: string;
  /** 配置文件路徑 */
  config_file_path?: string;
  /** 配置覆蓋參數 */
  config_override?: Record<string, unknown>;
  /** 要求的配置版本 */
  required_config_version?: string;
  /** 配置模板識別碼 */
  config_identifier?: string;
  /** 動態參數 */
  parameters?: Record<string, unknown>;
  /** 版本約束條件 */
  version_constraints?: {
    min_version?: string;
    max_version?: string;
    preferred_versions?: string[];
    blacklist_versions?: string[];
  };
  /** 任務創建時間 */
  created_at?: Date;
  /** 下次執行時間 */
  next_run_at?: Date;
  /** 爬取開始日期 */
  start_date?: Date;
  /** 爬取結束日期 */
  end_date?: Date;
}

// ============= 版本管理介面 =============

export interface VersionInfo {
  /** 當前版本 */
  current: string;
  /** Git 標籤版本 */
  gitTag?: string;
  /** package.json 版本 */
  packageVersion?: string;
  /** 版本來源 */
  source: 'git' | 'package' | 'unknown';
  /** 是否一致 */
  consistent: boolean;
}

export interface VersionCheckResult {
  /** 版本是否相容 */
  compatible: boolean;
  /** 當前版本 */
  currentVersion: string;
  /** 要求版本 */
  requiredVersion?: string;
  /** 建議動作 */
  action?: 'upgrade' | 'downgrade' | 'switch';
  /** 不相容原因 */
  reason?: string;
  /** 詳細資訊 */
  details?: Record<string, unknown>;
}

// ============= 配置解析介面 =============

export interface ConfigTemplate {
  /** 爬蟲設定 */
  crawlerSettings: {
    url: string;
    waitTime?: number;
    timeout?: number;
    retries?: number;
    headers?: Record<string, string>;
  };
  /** CSS 選擇器 */
  selectors: Record<
    string,
    {
      selector: string;
      transform?: string;
      multiple?: boolean;
      required?: boolean;
    }
  >;
  /** 排除選擇器 */
  excludeSelectors?: string[];
  /** 輸出設定 */
  outputSettings?: {
    format: 'json' | 'csv' | 'xlsx';
    filename?: string;
    fields?: string[];
  };
  /** 轉換設定 */
  transforms?: Record<string, unknown>;
  /** 驗證規則 */
  validation?: Record<string, unknown>;
}

export interface ResolvedConfig extends ConfigTemplate {
  /** 解析後的參數 */
  resolvedParameters: Record<string, unknown>;
  /** 配置來源 */
  source: {
    template: string;
    version: string;
    resolvedAt: Date;
  };
}

// ============= 錯誤處理介面 =============

export interface WorkerError {
  /** 錯誤代碼 */
  code: string;
  /** 錯誤訊息 */
  message: string;
  /** 錯誤詳情 */
  details?: unknown;
  /** 錯誤時間 */
  timestamp: Date;
  /** 錯誤來源 */
  source: 'version' | 'config' | 'network' | 'task' | 'system';
  /** 是否可重試 */
  retryable: boolean;
}

// ============= 統計資訊介面 =============

export interface WorkerStats {
  /** Worker 基本資訊 */
  worker: {
    id: string;
    name: string;
    version: string;
    uptime: number;
    status: WorkerStatus;
  };
  /** 任務統計 */
  tasks: {
    total: number;
    completed: number;
    failed: number;
    running: number;
    average_execution_time: number;
  };
  /** 系統資源 */
  system: {
    memory_usage_mb: number;
    cpu_usage_percent: number;
    disk_usage_mb: number;
  };
  /** 版本資訊 */
  version: {
    current: string;
    switches: number;
    last_switch?: Date;
  };
  /** 錯誤統計 */
  errors: {
    total: number;
    by_type: Record<string, number>;
    recent: WorkerError[];
  };
}

// ============= 事件介面 =============

export interface WorkerEvent {
  /** 事件類型 */
  type:
    | 'task_assigned'
    | 'task_completed'
    | 'task_failed'
    | 'version_switched'
    | 'error'
    | 'heartbeat';
  /** 事件時間 */
  timestamp: Date;
  /** 事件數據 */
  data: unknown;
  /** 事件來源 */
  source: string;
}

// ============= 回調函數類型 =============

export type TaskCompletionCallback = (
  task: CrawlerTask,
  result: ExecutionResultDto
) => Promise<void>;
export type ErrorCallback = (error: WorkerError) => Promise<void>;
export type VersionSwitchCallback = (
  oldVersion: string,
  newVersion: string
) => Promise<void>;
export type HeartbeatCallback = (stats: WorkerStats) => Promise<void>;

