import { ConditionGroup } from './condition.interface';
import { MarketRegion } from './market-data.interface';

export enum AlertType {
  CONDITION_TRIGGERED = 'condition_triggered',
  PRICE_ALERT = 'price_alert',
  STRATEGY_SIGNAL = 'strategy_signal',
  SYSTEM_ALERT = 'system_alert',
}

export enum AlertStatus {
  PENDING = 'pending',
  SENT = 'sent',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export enum AlertChannel {
  TELEGRAM = 'telegram',
  EMAIL = 'email',
  PUSH = 'push',
  SMS = 'sms',
}

export interface AlertPreference {
  channel: AlertChannel;
  enabled: boolean;
  settings?: Record<string, unknown>;
}

export interface UserAlert {
  id: string;
  userId: string;
  name: string;
  symbolCode: string;
  conditions: ConditionGroup;
  region?: MarketRegion;
  isActive: boolean;
  notificationChannels: AlertChannel[];
  lastTriggered?: Date;
  notificationCooldown?: number; // 通知冷卻時間(分鐘)
  lastNotificationSent?: Date; // 上次發送通知的時間
  createdAt: Date;
  updatedAt: Date;
}

export interface AlertMessage {
  id: string;
  userId: string;
  alertId?: string;
  type: AlertType;
  channel: AlertChannel;
  title: string;
  content: string;
  metadata?: Record<string, unknown>;
  status: AlertStatus;
  scheduledAt?: Date;
  sentAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface TelegramConfig {
  botToken: string;
  enabled: boolean;
}

export interface AlertTrigger {
  alertId: string;
  symbolCode: string;
  triggeredConditions: string[];
  marketData: Record<string, unknown>;
  calculatedIndicators: Record<string, number>;
  timestamp: Date;
}

// export interface CreateUserAlertDto {
//   name: string;
//   symbolCode: string;
//   conditions: ConditionGroup;
//   region?: MarketRegion;
//   notificationChannels: AlertChannel[];
//   notificationSettings?: NotificationSettings; // 新版：完整通知設定
//   notificationCooldown?: number; // 通知冷卻時間(分鐘)
// }

// export interface UpdateUserAlertDto {
//   name?: string;
//   conditions?: ConditionGroup;
//   isActive?: boolean;
//   notificationChannels?: AlertChannel[];
//   notificationCooldown?: number; // 通知冷卻時間(分鐘)
// }

export interface AlertStats {
  totalAlerts: number;
  activeAlerts: number;
  triggeredToday: number;
  sentToday: number;
  failedToday: number;
}
