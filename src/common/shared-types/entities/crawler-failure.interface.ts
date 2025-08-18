import { CrawlerTaskEntity } from '../entities/crawler-task.interface';
import { CrawlerHistoryEntity } from '../entities/crawler-history.interface';
import { CrawlerWorkerEntity } from '../entities/crawler-worker.interface';
import { FailureCategory, FailureReason, ResolutionType } from '..';

export interface CrawlerFailureEntity {
  id: string;
  task_id: string;
  history_id: string;
  worker_id: string;
  failure_category: FailureCategory;
  failure_reason: FailureReason;
  error_code: string;
  error_message: string;
  retry_attempt: number;
  should_retry: boolean;
  next_retry_at: Date;
  retry_delay_ms: number;
  request_url: string;
  response_status: number;
  response_headers: Record<string, unknown>;
  selector_used: string;
  page_content_sample: string;
  created_at: Date;
  resolved_at: Date;
  resolution: ResolutionType;
  resolution_notes: string;
  task: CrawlerTaskEntity;
  history: CrawlerHistoryEntity;
  worker: CrawlerWorkerEntity;
}
