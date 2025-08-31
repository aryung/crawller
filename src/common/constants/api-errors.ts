/**
 * API 錯誤類型常數
 */
export enum ApiErrorType {
  CONNECTION_REFUSED = 'CONNECTION_REFUSED',   // 後端未啟動
  NETWORK_ERROR = 'NETWORK_ERROR',            // 網路錯誤
  SERVER_ERROR = 'SERVER_ERROR',              // 伺服器錯誤 (5xx)
  CLIENT_ERROR = 'CLIENT_ERROR',              // 客戶端錯誤 (4xx)
  EMPTY_DATA = 'EMPTY_DATA',                  // 空數據
  VALIDATION_ERROR = 'VALIDATION_ERROR',      // 數據驗證失敗
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',            // 連接超時
  AUTH_ERROR = 'AUTH_ERROR'                   // 認證錯誤
}

/**
 * 錯誤圖示對應
 */
export const ERROR_ICONS: Record<ApiErrorType, string> = {
  [ApiErrorType.CONNECTION_REFUSED]: '🔌',
  [ApiErrorType.NETWORK_ERROR]: '🌐',
  [ApiErrorType.SERVER_ERROR]: '🔥',
  [ApiErrorType.CLIENT_ERROR]: '⚠️',
  [ApiErrorType.EMPTY_DATA]: '📭',
  [ApiErrorType.VALIDATION_ERROR]: '❓',
  [ApiErrorType.TIMEOUT_ERROR]: '⏱️',
  [ApiErrorType.AUTH_ERROR]: '🔐'
};

/**
 * 錯誤訊息模板
 */
export const ERROR_MESSAGES = {
  CONNECTION_REFUSED: '後端服務未啟動',
  API_HEALTH_CHECK_TIP: '💡 提示: 請執行 cd finance-strategy && npm run start:dev 啟動後端服務',
  EMPTY_DATA_INFO: '數據為空（可能是 ETF 或無財務數據的標的）',
  TIMEOUT_MESSAGE: 'API 連接超時',
  AUTH_FAILED: '認證失敗，請檢查 API Token',
  NETWORK_ISSUE: '網路連接問題',
  SERVER_ISSUE: '伺服器內部錯誤',
  CLIENT_ISSUE: '請求參數錯誤',
  VALIDATION_FAILED: '數據驗證失敗'
};