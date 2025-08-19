import { CrawlerTaskEntity } from '../entities/crawler-task.interface';
import { CrawlerHistoryEntity } from '../entities/crawler-history.interface';
import { CrawlerFailureEntity } from '../entities/crawler-failure.interface';
import { WorkerStatus } from '..';

export interface CrawlerWorkerEntity {
  id: string;
  name: string;
  supported_regions: string[];
  supported_data_types: string[];
  max_concurrent_tasks: number;
  status: WorkerStatus;
  current_load: number;
  last_heartbeat: Date;
  ip_address: string;
  version: string;
  total_tasks_completed: number;
  total_tasks_failed: number;
  average_execution_time: number;
  created_at: Date;
  updated_at: Date;
  assigned_tasks: CrawlerTaskEntity[];
  history: CrawlerHistoryEntity[];
  failures: CrawlerFailureEntity[];
}
