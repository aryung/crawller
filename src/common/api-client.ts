#!/usr/bin/env tsx
/**
 * 統一的後端 API 客戶端
 * 整合所有與 finance-strategy 後端的 HTTP API 通訊
 * 
 * 功能：
 * - 統一的認證處理
 * - 錯誤處理和重試機制
 * - 支援 symbols, fundamental, labels 等所有 API 端點
 * - 批次處理和進度監控
 */

import 'dotenv/config';
import axios, { AxiosInstance, AxiosError } from 'axios';
import chalk from 'chalk';
import ora from 'ora';

// 預設配置
const DEFAULT_API_URL = process.env.BACKEND_API_URL || 'http://localhost:3000';
const DEFAULT_API_TOKEN = process.env.BACKEND_API_TOKEN || '';

export interface ApiClientConfig {
  apiUrl: string;
  apiToken?: string;
  timeout?: number;
  maxRetries?: number;
  retryDelay?: number;
  enableAuth?: boolean;
}

export interface ProgressCallback {
  (current: number, total: number, message: string): void;
}

/**
 * 統一的 API 客戶端類
 */
export class ApiClient {
  private client: AxiosInstance;
  private config: Required<ApiClientConfig>;
  private spinner: any;

  constructor(config: Partial<ApiClientConfig> = {}) {
    this.config = {
      apiUrl: config.apiUrl || DEFAULT_API_URL,
      apiToken: config.apiToken || DEFAULT_API_TOKEN,
      timeout: config.timeout || 30000,
      maxRetries: config.maxRetries || 3,
      retryDelay: config.retryDelay || 1000,
      enableAuth: config.enableAuth !== false,
    };

    this.client = this.createHttpClient();
  }

  /**
   * 創建 HTTP 客戶端
   */
  private createHttpClient(): AxiosInstance {
    const headers: any = {
      'Content-Type': 'application/json',
    };

    if (this.config.enableAuth && this.config.apiToken) {
      headers['Authorization'] = `Bearer ${this.config.apiToken}`;
    }

    return axios.create({
      baseURL: this.config.apiUrl,
      headers,
      timeout: this.config.timeout,
    });
  }

  /**
   * 自動登入獲取 token
   */
  async autoLogin(): Promise<string | null> {
    if (!this.config.apiUrl.includes('localhost')) {
      return null;
    }

    try {
      console.log(chalk.yellow('🔐 嘗試自動登入...'));
      const response = await this.client.post('/auth/auto-login', {
        email: 'aryung@gmail.com',
        name: 'Test User',
      });

      const token = response.data.accessToken;
      if (token) {
        this.config.apiToken = token;
        // 重新創建客戶端以使用新 token
        this.client = this.createHttpClient();
        console.log(chalk.green('✅ 自動登入成功'));
        return token;
      }
    } catch (error) {
      console.log(chalk.red('❌ 自動登入失敗'));
    }

    return null;
  }

  /**
   * 帶重試機制的請求
   */
  private async requestWithRetry<T>(
    requestFn: () => Promise<T>,
    retries = this.config.maxRetries
  ): Promise<T> {
    try {
      return await requestFn();
    } catch (error) {
      if (retries <= 0) {
        throw error;
      }

      const axiosError = error as AxiosError;
      if (axiosError.response?.status === 401 && this.config.enableAuth) {
        // 嘗試自動登入
        const token = await this.autoLogin();
        if (token) {
          return this.requestWithRetry(requestFn, retries - 1);
        }
      }

      // 對於可重試的錯誤，等待後重試
      if (this.isRetryableError(axiosError)) {
        console.log(chalk.yellow(`⚠️ 請求失敗，${this.config.retryDelay}ms 後重試... (剩餘 ${retries - 1} 次)`));
        await this.delay(this.config.retryDelay);
        return this.requestWithRetry(requestFn, retries - 1);
      }

      throw error;
    }
  }

  /**
   * 判斷是否為可重試的錯誤
   */
  private isRetryableError(error: AxiosError): boolean {
    if (!error.response) {
      return true; // 網路錯誤
    }

    const status = error.response.status;
    return status >= 500 || status === 429; // 伺服器錯誤或限流
  }

  /**
   * 延遲工具函數
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 股票代碼批量匯入
   */
  async importSymbols(symbols: any[], progressCallback?: ProgressCallback): Promise<any> {
    // 嘗試多個可能的端點
    const possibleEndpoints = [
      '/symbols/bulk',
      '/symbols/bulk-create',
      '/symbols/batch-create',
      '/symbols'
    ];
    
    let lastError: any = null;
    
    for (const endpoint of possibleEndpoints) {
      try {
        return await this.requestWithRetry(async () => {
          if (progressCallback) {
            progressCallback(0, symbols.length, `嘗試端點: ${endpoint}...`);
          }

          const response = await this.client.post(endpoint, {
            symbols: symbols,
            updateExisting: true,
          });

          if (progressCallback) {
            progressCallback(symbols.length, symbols.length, '股票代碼匯入完成');
          }

          return response.data;
        });
      } catch (error: any) {
        lastError = error;
        if (error.response?.status !== 404) {
          // 如果不是 404，直接拋出錯誤
          throw error;
        }
        // 404 的話繼續嘗試下一個端點
        console.log(chalk.yellow(`端點 ${endpoint} 不存在，嘗試下一個...`));
      }
    }
    
    // 所有端點都失敗了
    throw lastError || new Error('無法找到有效的股票匯入 API 端點');
  }

  /**
   * 基本面資料批量匯入
   */
  async importFundamental(data: any[], progressCallback?: ProgressCallback): Promise<any> {
    const endpoint = '/fundamental-data/bulk-create';
    
    return this.requestWithRetry(async () => {
      if (progressCallback) {
        progressCallback(0, data.length, '開始匯入基本面資料...');
      }

      const response = await this.client.post(endpoint, {
        data: data,
        updateExisting: true,
      });

      if (progressCallback) {
        progressCallback(data.length, data.length, '基本面資料匯入完成');
      }

      return response.data;
    });
  }

  /**
   * 標籤同步
   */
  async syncLabels(mappings: any, options?: any): Promise<any> {
    const endpoint = '/label-industry/bulk-sync-mappings';
    
    return this.requestWithRetry(async () => {
      const response = await this.client.post(endpoint, {
        ...mappings,
        options: {
          strategy: 'merge',
          createMissingSymbols: false,
          updateExistingRelations: true,
          ...options,
        },
      });

      return response.data;
    });
  }

  /**
   * 清除標籤
   */
  async clearLabels(options: {
    market?: string;
    pattern?: string;
    forceHardDelete?: boolean;
  } = {}): Promise<any> {
    // 首先獲取要刪除的標籤列表
    const labelsResponse = await this.requestWithRetry(async () => {
      return this.client.get('/label-industry/labels/all-including-inactive');
    });

    let labels = labelsResponse.data?.data || labelsResponse.data || [];
    
    // 過濾標籤
    if (options.market || options.pattern) {
      labels = labels.filter((label: any) => {
        // 這裡可以加入市場和模式過濾邏輯
        return true; // 簡化版，實際實現需要解碼邏輯
      });
    }

    // 批量刪除
    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[]
    };

    for (const label of labels) {
      try {
        const deleteEndpoint = options.forceHardDelete
          ? `/label-industry/labels/${label.id}/force-delete?hard=true`
          : `/label-industry/labels/${label.id}/force-delete`;

        await this.requestWithRetry(async () => {
          return this.client.delete(deleteEndpoint);
        });

        results.success++;
      } catch (error) {
        results.failed++;
        results.errors.push(`刪除標籤 ${label.name} 失敗: ${(error as Error).message}`);
      }
    }

    return results;
  }

  /**
   * 獲取統計資訊
   */
  async getStatistics(): Promise<any> {
    return this.requestWithRetry(async () => {
      const response = await this.client.get('/statistics');
      return response.data;
    });
  }

  /**
   * 通用 GET 請求
   */
  async get<T = any>(endpoint: string, params?: any): Promise<T> {
    return this.requestWithRetry(async () => {
      const response = await this.client.get(endpoint, { params });
      return response.data;
    });
  }

  /**
   * 通用 POST 請求
   */
  async post<T = any>(endpoint: string, data?: any): Promise<T> {
    return this.requestWithRetry(async () => {
      const response = await this.client.post(endpoint, data);
      return response.data;
    });
  }

  /**
   * 通用 PUT 請求
   */
  async put<T = any>(endpoint: string, data?: any): Promise<T> {
    return this.requestWithRetry(async () => {
      const response = await this.client.put(endpoint, data);
      return response.data;
    });
  }

  /**
   * 通用 DELETE 請求
   */
  async delete<T = any>(endpoint: string): Promise<T> {
    return this.requestWithRetry(async () => {
      const response = await this.client.delete(endpoint);
      return response.data;
    });
  }
}

/**
 * 創建 API 客戶端實例的工廠函數
 */
export function createApiClient(config: Partial<ApiClientConfig> = {}): ApiClient {
  return new ApiClient(config);
}

/**
 * 預設 API 客戶端實例
 */
export const defaultApiClient = createApiClient();