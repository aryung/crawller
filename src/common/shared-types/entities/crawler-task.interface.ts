import { CrawlerWorkerEntity } from '../entities/crawler-worker.interface';
import { CrawlerHistoryEntity } from '../entities/crawler-history.interface';
import { CrawlerFailureEntity } from '../entities/crawler-failure.interface';
import { TaskStatus, ScheduleType, DataType } from '..';
import { MarketRegion } from '..';

export interface CrawlerTaskEntity {
  id: string;
  symbol_code: string;
  exchange_area: MarketRegion;
  data_type: DataType;
  schedule_type: ScheduleType;
  cron_expression: string;
  priority: number;
  status: TaskStatus;
  is_active: boolean;
  retry_count: number;
  max_retries: number;
  timeout_seconds: number;
  start_date: Date;
  end_date: Date;
  last_crawled_date: Date;
  assigned_to: string;
  assigned_at: Date;
  started_at: Date;
  completed_at: Date;
  config_file_path: string;
  config_override: Record<string, unknown>;
  required_config_version?: string;
  config_identifier?: string;
  parameters?: Record<string, unknown>;
  version_constraints?: {
    min_version?: string;
    max_version?: string;
    preferred_versions?: string[];
    blacklist_versions?: string[];
  };
  created_at: Date;
  updated_at: Date;
  next_run_at: Date;
  assignedWorker: CrawlerWorkerEntity;
  history: CrawlerHistoryEntity[];
  failures: CrawlerFailureEntity[];
}
