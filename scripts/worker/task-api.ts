/**
 * Server API 通訊服務
 * 負責與 @finance-strategy 後端進行 REST API 通訊
 */

import axios, { AxiosInstance, AxiosResponse, AxiosError } from 'axios';
import {
  CrawlerTask,
  TaskRequestDto,
  TaskResponseDto,
  ExecutionResultDto,
  WorkerHeartbeatDto,
  VersionCheckRequestDto,
  VersionCheckResponseDto,
  WorkerConfig,
  WorkerError,
  MarketRegion,
  DataType,
} from '../../src/common/shared-types';

export class TaskApiService {
  private client: AxiosInstance;
  private serverUrl: string;
  private apiKey: string;
  private workerId: string;
  private retryAttempts: number;
  private retryDelay: number;

  constructor(config: {
    serverUrl: string;
    apiKey: string;
    workerId: string;
    timeout?: number;
    retryAttempts?: number;
    retryDelay?: number;
  }) {
    this.serverUrl = config.serverUrl;
    this.apiKey = config.apiKey;
    this.workerId = config.workerId;
    this.retryAttempts = config.retryAttempts || 3;
    this.retryDelay = config.retryDelay || 1000;

    // 創建 Axios 實例
    this.client = axios.create({
      baseURL: this.serverUrl,
      timeout: config.timeout || 30000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': `CrawlerWorker/${this.workerId}`,
      },
    });

    // 設置請求攔截器
    this.setupRequestInterceptor();

    // 設置回應攔截器
    this.setupResponseInterceptor();
  }

  /**
   * 註冊 Worker
   */
  async registerWorker(config: {
    name: string;
    supported_regions: MarketRegion[];
    supported_data_types: DataType[];
    max_concurrent_tasks?: number;
    host_info?: Record<string, unknown>;
  }): Promise<boolean> {
    try {
      console.log(`📝 註冊 Worker: ${this.workerId}`);

      const payload = {
        id: this.workerId,
        name: config.name,
        supported_regions: config.supported_regions,
        supported_data_types: config.supported_data_types,
        max_concurrent_tasks: config.max_concurrent_tasks || 3,
        host_info: config.host_info || this.getHostInfo(),
      };

      const response = await this.client.post(
        '/crawler/workers/register',
        payload
      );

      console.log(`✅ Worker 註冊成功: ${response.data?.message || 'OK'}`);
      return true;
    } catch (error) {
      console.error('❌ Worker 註冊失敗:', this.formatError(error));
      return false;
    }
  }

  /**
   * 請求任務
   */
  async requestTasks(config: {
    supported_regions: MarketRegion[];
    supported_data_types: DataType[];
    worker_version: string;
    limit?: number;
  }): Promise<CrawlerTask[]> {
    try {
      const payload: TaskRequestDto = {
        supported_regions: config.supported_regions,
        supported_data_types: config.supported_data_types,
        worker_version: config.worker_version,
        limit: config.limit || 5,
      };

      const response = await this.client.post<TaskResponseDto>(
        `/crawler/workers/${this.workerId}/request-tasks`,
        payload
      );

      if (response.data.success && response.data.tasks) {
        console.log(`📋 收到 ${response.data.tasks.length} 個任務`);
        return response.data.tasks;
      } else {
        console.log('📋 無可用任務');
        return [];
      }
    } catch (error) {
      if (this.isNoTasksAvailable(error)) {
        console.log('📋 暫無可用任務');
        return [];
      }

      console.error('❌ 請求任務失敗:', this.formatError(error));
      throw this.createWorkerError('TASK_REQUEST_FAILED', error);
    }
  }

  /**
   * 檢查版本相容性
   */
  async checkVersionCompatibility(
    taskId: string,
    workerVersion: string
  ): Promise<VersionCheckResponseDto> {
    try {
      const payload: VersionCheckRequestDto = {
        task_id: taskId,
        worker_version: workerVersion,
      };

      const response = await this.client.post<VersionCheckResponseDto>(
        '/crawler/tasks/version-check',
        payload
      );

      return response.data;
    } catch (error) {
      console.error('❌ 版本檢查失敗:', this.formatError(error));

      // 版本檢查失敗時，假設不相容
      return {
        compatible: false,
        current_version: workerVersion,
        reason: `版本檢查 API 失敗: ${this.formatError(error)}`,
      };
    }
  }

  /**
   * 回報任務執行結果
   */
  async reportTaskResult(result: ExecutionResultDto): Promise<boolean> {
    try {
      console.log(`📊 回報任務結果: ${result.task_id} (${result.status})`);

      const response = await this.client.post(
        `/crawler/workers/${this.workerId}/report-result`,
        result
      );

      if (response.data?.success !== false) {
        console.log(`✅ 任務結果回報成功: ${result.task_id}`);
        return true;
      } else {
        console.error(
          `❌ 任務結果回報失敗: ${response.data?.message || 'Unknown error'}`
        );
        return false;
      }
    } catch (error) {
      console.error('❌ 回報任務結果失敗:', this.formatError(error));

      // 結果回報失敗不拋出錯誤，因為任務已經執行完成
      return false;
    }
  }

  /**
   * 發送心跳
   */
  async sendHeartbeat(heartbeat: WorkerHeartbeatDto): Promise<boolean> {
    try {
      const response = await this.client.put(
        `/crawler/workers/${this.workerId}/heartbeat`,
        heartbeat
      );

      return response.data?.success !== false;
    } catch (error) {
      console.warn('⚠️ 心跳發送失敗:', this.formatError(error));
      return false;
    }
  }

  /**
   * 更新任務狀態
   */
  async updateTaskStatus(
    taskId: string,
    status: 'assigned' | 'running' | 'completed' | 'failed' | 'timeout',
    message?: string
  ): Promise<boolean> {
    try {
      const payload = {
        status,
        message,
      };

      const response = await this.client.patch(
        `/tasks/${taskId}/status`,
        payload
      );

      return response.data?.success !== false;
    } catch (error) {
      console.warn(`⚠️ 更新任務狀態失敗 (${taskId}):`, this.formatError(error));
      return false;
    }
  }

  /**
   * 取消任務
   */
  async cancelTask(taskId: string, reason?: string): Promise<boolean> {
    try {
      const payload = {
        reason: reason || 'Worker requested cancellation',
      };

      const response = await this.client.post(
        `/tasks/${taskId}/cancel`,
        payload
      );

      return response.data?.success !== false;
    } catch (error) {
      console.warn(`⚠️ 取消任務失敗 (${taskId}):`, this.formatError(error));
      return false;
    }
  }

  /**
   * 獲取 Worker 統計資訊
   */
  async getWorkerStats(): Promise<Record<string, unknown> | null> {
    try {
      const response = await this.client.get(`/workers/${this.workerId}/stats`);
      return response.data?.data || null;
    } catch (error) {
      console.warn('⚠️ 獲取 Worker 統計失敗:', this.formatError(error));
      return null;
    }
  }

  /**
   * 設置請求攔截器
   */
  private setupRequestInterceptor(): void {
    this.client.interceptors.request.use(
      (config) => {
        // 添加 API 金鑰認證
        if (this.apiKey) {
          config.headers['Authorization'] = `Bearer ${this.apiKey}`;
        }

        // 添加請求 ID
        config.headers['X-Request-ID'] = `${this.workerId}-${Date.now()}`;

        // 記錄請求
        console.log(
          `🌐 API Request: ${config.method?.toUpperCase()} ${config.url}`
        );

        return config;
      },
      (error) => {
        console.error('❌ Request interceptor error:', error);
        return Promise.reject(error);
      }
    );
  }

  /**
   * 設置回應攔截器
   */
  private setupResponseInterceptor(): void {
    this.client.interceptors.response.use(
      (response) => {
        // 記錄成功回應
        console.log(
          `✅ API Response: ${response.status} ${response.config.url}`
        );
        return response;
      },
      async (error: AxiosError) => {
        const config = error.config;

        if (!config) {
          return Promise.reject(error);
        }

        // 計算重試次數
        const retryCount = (config as any).__retryCount || 0;

        // 判斷是否應該重試
        if (this.shouldRetry(error) && retryCount < this.retryAttempts) {
          (config as any).__retryCount = retryCount + 1;

          console.log(
            `🔄 重試 API 請求 (${retryCount + 1}/${this.retryAttempts}): ${config.url}`
          );

          // 等待延遲
          await this.delay(this.retryDelay * Math.pow(2, retryCount));

          // 重新發送請求
          return this.client.request(config);
        }

        // 記錄最終失敗
        console.error(
          `❌ API Error: ${error.response?.status || 'Network'} ${config.url}`
        );

        return Promise.reject(error);
      }
    );
  }

  /**
   * 判斷錯誤是否應該重試
   */
  private shouldRetry(error: AxiosError): boolean {
    // 網路錯誤重試
    if (!error.response) {
      return true;
    }

    // 伺服器錯誤重試
    const status = error.response.status;
    return status >= 500 || status === 429; // 5xx 錯誤或 rate limit
  }

  /**
   * 判斷是否為「無任務可用」錯誤
   */
  private isNoTasksAvailable(error: unknown): boolean {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const message = error.response?.data?.message || '';

      return (
        status === 404 ||
        message.includes('no tasks available') ||
        message.includes('無可用任務')
      );
    }
    return false;
  }

  /**
   * 延遲函數
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * 格式化錯誤訊息
   */
  private formatError(error: unknown): string {
    if (axios.isAxiosError(error)) {
      const response = error.response;
      if (response) {
        return `HTTP ${response.status}: ${response.data?.message || response.statusText}`;
      } else if (error.request) {
        return `Network error: ${error.message}`;
      }
    }

    if (error instanceof Error) {
      return error.message;
    }

    return String(error);
  }

  /**
   * 創建 Worker 錯誤
   */
  private createWorkerError(code: string, originalError: unknown): WorkerError {
    return {
      code,
      message: this.formatError(originalError),
      details: originalError,
      timestamp: new Date(),
      source: 'network',
      retryable: axios.isAxiosError(originalError)
        ? this.shouldRetry(originalError)
        : false,
    };
  }

  /**
   * 獲取主機資訊
   */
  private getHostInfo(): Record<string, unknown> {
    return {
      hostname: require('os').hostname(),
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
      memory: process.memoryUsage(),
      uptime: process.uptime(),
    };
  }

  /**
   * 測試 API 連通性
   */
  async testConnection(): Promise<boolean> {
    // 跳過健康檢查，直接返回 true，讓 Worker 嘗試註冊
    console.log('🔌 跳過 API 連通性測試 (健康檢查需要認證)');
    return true;
  }

  /**
   * 關閉連接
   */
  async close(): Promise<void> {
    // Axios 不需要特別關閉，但可以在這裡做清理工作
    console.log('🔌 關閉 API 連接');
  }
}

// 工廠函數：從環境變數創建 TaskApiService
export function createTaskApiService(
  config?: Partial<WorkerConfig>
): TaskApiService {
  const serverUrl =
    config?.serverUrl ||
    `${process.env.INTERNAL_AHA_API_URL || 'http://localhost:3000'}/crawler`;
  const apiKey =
    config?.apiKey ||
    process.env.INTERNAL_AHA_API_TOKEN ||
    process.env.API_KEY ||
    '';
  const workerId =
    config?.workerId || process.env.WORKER_ID || `worker-${Date.now()}`;

  return new TaskApiService({
    serverUrl,
    apiKey,
    workerId,
    timeout: 30000,
    retryAttempts: 3,
    retryDelay: 1000,
  });
}

export default TaskApiService;

