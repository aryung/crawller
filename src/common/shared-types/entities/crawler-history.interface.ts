import { CrawlerTaskEntity } from '../entities/crawler-task.interface';
import { CrawlerWorkerEntity } from '../entities/crawler-worker.interface';
import { HistoryStatus, ErrorType } from '..';

export interface CrawlerHistoryEntity {
  id: string;
  task_id: string;
  worker_id: string;
  started_at: Date;
  completed_at: Date;
  status: HistoryStatus;
  crawled_from: Date;
  crawled_to: Date;
  records_fetched: number;
  records_saved: number;
  data_quality_score: number;
  execution_time_ms: number;
  memory_usage_mb: number;
  network_requests: number;
  error_type: ErrorType;
  error_message: string;
  error_stack: string;
  output_file_path: string;
  response_summary: Record<string, unknown>;
  created_at: Date;
  task: CrawlerTaskEntity;
  worker: CrawlerWorkerEntity;
}
