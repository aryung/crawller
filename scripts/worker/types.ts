/**
 * Worker Scripts 類型定義
 * 與 @finance-strategy 的爬蟲任務系統整合
 */

// ============= 基礎枚舉類型 =============

export enum WorkerStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  BUSY = 'busy',
  ERROR = 'error',
}

export enum TaskStatus {
  PENDING = 'pending',
  ASSIGNED = 'assigned',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  TIMEOUT = 'timeout',
  CANCELLED = 'cancelled',
}

export enum ExchangeArea {
  TW = 'TW',
  US = 'US',
  JP = 'JP',
  CN = 'CN',
  HK = 'HK',
  KR = 'KR',
  UK = 'UK',
  EU = 'EU',
  AU = 'AU',
  SG = 'SG',
}

export enum DataType {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  YEARLY = 'yearly',
  BALANCE_SHEET = 'balance_sheet',
  INCOME_STATEMENT = 'income_statement',
  CASH_FLOW_STATEMENT = 'cash_flow_statement',
  EPS = 'eps',
  DIVIDEND = 'dividend',
  PRICE_HISTORY = 'price_history',
  TECHNICAL_INDICATORS = 'technical_indicators',
  NEWS = 'news',
  SENTIMENT = 'sentiment',
}

export enum HistoryStatus {
  SUCCESS = 'success',
  FAILED = 'failed',
  PARTIAL = 'partial',
  EMPTY = 'empty',
  TIMEOUT = 'timeout',
  REJECTED = 'rejected',
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
  apiKey: string;
  /** 是否啟用自動版本切換 */
  autoVersionSwitch: boolean;
  /** 優先使用 Git 版本而非 package.json */
  preferGitVersion: boolean;
  /** 版本快取目錄 */
  versionCacheDir: string;
  /** 支援的市場地區 */
  supportedRegions: ExchangeArea[];
  /** 支援的數據類型 */
  supportedDataTypes: DataType[];
  /** 最大並發任務數 */
  maxConcurrent: number;
  /** 任務請求間隔（毫秒） */
  taskRequestInterval: number;
  /** 心跳間隔（毫秒） */
  heartbeatInterval: number;
  /** 版本檢查超時（毫秒） */
  versionCheckTimeout: number;
  /** 錯誤時自動重啟 */
  autoRestartOnError: boolean;
  /** 最大錯誤重試次數 */
  maxErrorRetries: number;
  /** GitHub Token for private repo access */
  githubToken?: string;
}

// ============= 任務相關介面 =============

export interface CrawlerTask {
  /** 任務唯一標識符 */
  id: string;
  /** 股票代碼 */
  symbol_code: string;
  /** 交易地區 */
  exchange_area: ExchangeArea;
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

// ============= API 通訊介面 =============

export interface TaskRequestDto {
  /** Worker ID */
  worker_id: string;
  /** 支援的地區 */
  supported_regions: ExchangeArea[];
  /** 支援的數據類型 */
  supported_data_types: DataType[];
  /** Worker 當前版本 */
  worker_version: string;
  /** 請求任務數量限制 */
  limit?: number;
}

export interface TaskResponseDto {
  /** 是否成功 */
  success: boolean;
  /** 任務列表 */
  tasks?: CrawlerTask[];
  /** 錯誤訊息 */
  error?: string;
  /** 詳細訊息 */
  message?: string;
}

export interface ExecutionResultDto {
  /** 任務 ID */
  task_id: string;
  /** 執行狀態 */
  status: HistoryStatus;
  /** Worker 版本 */
  worker_version: string;
  /** 使用的配置版本 */
  config_version_used?: string;
  /** 爬取數據的起始日期 */
  crawled_from?: Date;
  /** 爬取數據的結束日期 */
  crawled_to?: Date;
  /** 抓取的記錄數 */
  records_fetched?: number;
  /** 成功保存的記錄數 */
  records_saved?: number;
  /** 數據品質分數 (0-1) */
  data_quality_score?: number;
  /** 執行時間（毫秒） */
  execution_time_ms?: number;
  /** 記憶體使用量（MB） */
  memory_usage_mb?: number;
  /** 網路請求次數 */
  network_requests?: number;
  /** 輸出檔案路徑 */
  output_file_path?: string;
  /** 回應摘要資訊 */
  response_summary?: Record<string, unknown>;
  /** 實際爬取的數據 */
  crawled_data?: unknown;
  /** 錯誤資訊 */
  error?: {
    code: 'VERSION_MISMATCH' | 'CONFIG_NOT_FOUND' | 'EXECUTION_ERROR' | 'TIMEOUT' | 'NETWORK_ERROR';
    message: string;
    details?: Record<string, unknown>;
  };
  /** 版本相關錯誤 */
  version_error?: {
    code: 'VERSION_MISMATCH' | 'CONFIG_NOT_FOUND' | 'VERSION_BLACKLISTED';
    message: string;
    details?: Record<string, unknown>;
  };
}

export interface WorkerHeartbeatDto {
  /** 當前負載（正在執行的任務數） */
  current_load?: number;
  /** 記憶體使用量（MB） */
  memory_usage_mb?: number;
  /** CPU 使用率（百分比） */
  cpu_usage_percent?: number;
  /** Worker 狀態 */
  status?: WorkerStatus;
  /** 額外資訊 */
  metadata?: Record<string, unknown>;
}

export interface VersionCheckRequestDto {
  /** 任務 ID */
  task_id: string;
  /** Worker 當前版本 */
  worker_version: string;
}

export interface VersionCheckResponseDto {
  /** 版本相容性 */
  compatible: boolean;
  /** Worker 當前版本 */
  current_version: string;
  /** 任務要求版本 */
  required_version?: string;
  /** 建議動作 */
  action?: 'upgrade' | 'downgrade' | 'switch';
  /** 不相容原因 */
  reason?: string;
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
  selectors: Record<string, {
    selector: string;
    transform?: string;
    multiple?: boolean;
    required?: boolean;
  }>;
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
  type: 'task_assigned' | 'task_completed' | 'task_failed' | 'version_switched' | 'error' | 'heartbeat';
  /** 事件時間 */
  timestamp: Date;
  /** 事件數據 */
  data: unknown;
  /** 事件來源 */
  source: string;
}

// ============= 回調函數類型 =============

export type TaskCompletionCallback = (task: CrawlerTask, result: ExecutionResultDto) => Promise<void>;
export type ErrorCallback = (error: WorkerError) => Promise<void>;
export type VersionSwitchCallback = (oldVersion: string, newVersion: string) => Promise<void>;
export type HeartbeatCallback = (stats: WorkerStats) => Promise<void>;

// ============= 導出所有類型 =============

export * from './types';