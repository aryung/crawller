import { UserRole } from './enums.interface';

export enum OAuthProvider {
  GOOGLE = 'google',
  FACEBOOK = 'facebook',
  LINE = 'line',
  LOCAL = 'local', // 本地註冊（原有的 email/password 方式）
}

export enum UserRegistrationStatus {
  GUEST = 'guest', // Guest 用戶，還未註冊
  COMPLETED = 'completed', // 已註冊且已綁定 chat_id
  EMAIL_ONLY = 'email_only', // 已註冊但未綁定 chat_id
  UNKNOWN = 'unknown',
}

export enum UserRegistrationStep {
  REGISTER = 'register',
  BIND_CHAT_ID = 'bind_chat_id',
  COMPLETE = 'complete',
  UNKNOWN = 'unknown',
}

export interface LocalStorageUser {
  id: string;
  email: string;
  username: string;
  role: UserRole;
  chatId: string;
  telegramConnected: boolean;
  identifier: string;
  emailVerified: boolean;
  userTypeInfo: UserTypeInfo;
  isGuestUser: boolean;
  needsChatIdBinding: boolean;
}

// OAuth Callback 回傳的完整用戶資訊介面
export interface OAuthCallbackUser {
  id: string;
  email: string;
  username: string;
  role: UserRole;
  chatId?: string | number | null;
  telegramConnected: boolean;
  identifier: string;
  emailVerified: boolean;
  userTypeInfo: UserTypeInfo;
  isGuestUser: boolean;
  needsChatIdBinding: boolean;
}

export interface UserData {
  id: string;
  identifier?: string;
  chat_id?: number | null;
  username: string;
  role: UserRole;
  email: string;
  telegramConnected?: boolean;
  accessToken?: string;
  refreshToken?: string;
  trackedStocks?: string[];
  updated_at?: string;
  created_at?: string;
  registration_date?: string;
  // 新增的用戶類型信息
  userTypeInfo?: {
    isGuest: boolean;
    isRegistered: boolean;
    hasChatId: boolean;
    registrationStatus: UserRegistrationStatus;
  };
  isGuestUser?: boolean;
  needsChatIdBinding?: boolean;
}

/**
 * 用戶類型信息接口
 */
export interface UserTypeInfo {
  isGuest: boolean;
  isRegistered: boolean;
  hasChatId: boolean;
  registrationStatus: UserRegistrationStatus;
}
