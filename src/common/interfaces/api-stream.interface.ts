import { ApiErrorType } from '../constants/api-errors';

/**
 * API 串流服務配置選項
 */
export interface ApiStreamOptions {
  apiUrl?: string;
  apiToken?: string;
  enabled?: boolean;
  retryAttempts?: number;
  retryDelayMs?: number;
  sendEmptyNotification?: boolean;    // 是否通知空數據
  treatEmptyAsSuccess?: boolean;      // 空數據是否視為成功
  checkConnectionFirst?: boolean;     // 是否先檢查連接
}

/**
 * API 發送結果
 */
export interface ApiSendResult {
  success: boolean;
  count: number;
  error?: ApiError;
}

/**
 * API 錯誤詳情
 */
export interface ApiError {
  type: ApiErrorType;
  message: string;
  data?: any;
  timestamp?: Date;
}

/**
 * API 發送統計
 */
export interface ApiStreamStats {
  totalSent: number;
  totalFailed: number;
  totalEmpty: number;
  totalSkipped: number;
  errors: ApiError[];
  startTime: Date;
  endTime: Date;
}

/**
 * 空數據通知
 */
export interface EmptyDataNotification {
  symbolCode: string;
  dataType: string;
  reportType: string;
  timestamp: string;
  url?: string;
}