/**
 * 認證相關的介面定義
 * 包含用戶綁定和 OAuth 認證相關的介面
 */

/**
 * 綁定結果接口
 */
export interface BindingResult {
  success: boolean;
  user: unknown;
  userTypeInfo: unknown;
  message: string;
  accessToken?: string;
  refreshToken?: string;
}

/**
 * 用戶綁定狀態檢查結果
 */
export interface BindingStatusResult {
  canBind: boolean;
  // currentStatus: string;
  requiresIdentifier: boolean;
  userTypeInfo: unknown;
  message: string;
}
