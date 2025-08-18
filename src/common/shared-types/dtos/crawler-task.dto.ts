import { TaskStatus, ScheduleType, DataType, WorkerStatus, HistoryStatus, FailureCategory, FailureReason } from '..';
import { MarketRegion } from '..';

export interface WorkerRegistrationDto {
  id: string;
  name: string;
  supported_regions: MarketRegion[];
  supported_data_types: DataType[];
  max_concurrent_tasks?: number;
  host_info?: Record<string, unknown>;
}

export interface WorkerHeartbeatDto {
  current_load?: number;
  memory_usage_mb?: number;
  cpu_usage_percent?: number;
}

export interface TaskRequestDto {
  supported_regions: MarketRegion[];
  supported_data_types: DataType[];
  worker_version: string;
  limit?: number;
}

export interface CreateTaskDto {
  symbol_code: string;
  exchange_area: MarketRegion;
  data_type: DataType;
  schedule_type: ScheduleType;
  cron_expression?: string;
  priority?: number;
  start_date?: Date;
  end_date?: Date;
  config_file_path?: string;
  config_override?: Record<string, unknown>;
  required_config_version?: string;
  config_identifier?: string;
  parameters?: Record<string, unknown>;
  version_constraints?: {
    min_version?: string;
    max_version?: string;
    preferred_versions?: string[];
    blacklist_versions?: string[];
  };
}

export interface UpdateTaskStatusDto {
  status: TaskStatus;
  message?: string;
}

export interface BatchCreateTaskDto {
  tasks: CreateTaskDto[];
}

export interface FailureReportDto {
  category: FailureCategory;
  reason: FailureReason;
  message: string;
  error_code?: string;
  request_url?: string;
  response_status?: number;
  response_headers?: Record<string, unknown>;
  selector_used?: string;
  page_content_sample?: string;
}

export interface ExecutionResultDto {
  task_id: string;
  status: HistoryStatus;
  crawled_from?: Date;
  crawled_to?: Date;
  records_fetched?: number;
  records_saved?: number;
  data_quality_score?: number;
  execution_time_ms?: number;
  memory_usage_mb?: number;
  network_requests?: number;
  output_file_path?: string;
  response_summary?: Record<string, unknown>;
  error?: FailureReportDto;
}

export interface TaskQueryDto {
  status?: TaskStatus[];
  exchange_area?: MarketRegion[];
  data_type?: DataType[];
  symbol_code?: string;
  assigned_to?: string;
  page?: number;
  limit?: number;
  sort_by?: string;
  sort_order?: 'ASC' | 'DESC';
}

export interface WorkerQueryDto {
  status?: WorkerStatus[];
  supported_regions?: MarketRegion[];
  supported_data_types?: DataType[];
}

export interface TaskResponseDto {
  id: string;
  symbol_code: string;
  exchange_area: MarketRegion;
  data_type: DataType;
  status: TaskStatus;
  priority: number;
  assigned_to?: string;
  last_crawled_date?: Date;
  created_at: Date;
  updated_at?: Date;
  next_run_at?: Date;
}

export interface WorkerResponseDto {
  id: string;
  name: string;
  status: WorkerStatus;
  supported_regions: MarketRegion[];
  supported_data_types: DataType[];
  max_concurrent_tasks: number;
  current_load: number;
  last_heartbeat: Date;
  cpu_usage_percent?: number;
  memory_usage_mb?: number;
}

export interface StatisticsResponseDto {
  tasks: {
    total: number;
    pending: number;
    running: number;
    completed: number;
    failed: number;
    byMarketRegion: Record<MarketRegion, number>;
    byDataType: Record<DataType, number>;
  };
  workers: {
    total: number;
    online: number;
    offline: number;
    busy: number;
    idle: number;
    avgLoad: number;
    totalCapacity: number;
    usedCapacity: number;
    currentLoad: number;
    byRegion: Record<MarketRegion, number>;
    byDataType: Record<DataType, number>;
  };
}

export interface VersionCheckRequestDto {
  task_id: string;
  worker_version: string;
}

export interface VersionCheckResponseDto {
  compatible: boolean;
  current_version: string;
  required_version?: string;
  action?: 'upgrade' | 'downgrade' | 'switch';
  reason?: string;
}

export interface EnhancedExecutionResultDto {
  worker_version: string;
  config_version_used?: string;
  crawled_data?: unknown;
  version_error?: {
    code: 'VERSION_MISMATCH' | 'CONFIG_NOT_FOUND' | 'VERSION_BLACKLISTED';
    message: string;
    details?: Record<string, unknown>;
  };
}

