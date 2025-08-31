import { ConditionGroup, NotificationChannel, NotificationSettings, MarketRegion, AlertConditionType } from '..';

export interface CreateUserAlertDto {
  name: string;
  symbolCode?: string;
  regions?: MarketRegion[];
  conditions: ConditionGroup;
  notificationChannels: NotificationChannel[];
  notificationSettings?: NotificationSettings;
  labels?: string[];
}

export interface UpdateUserAlertDto {
  name?: string;
  symbolCode?: string;
  regions?: MarketRegion[];
  conditions?: ConditionGroup;
  isActive?: boolean;
  notificationChannels?: NotificationChannel[];
  notificationSettings?: NotificationSettings;
  labels?: string[];
}

export interface UserAlertResponseDto {
  id: string;
  userId: string;
  name: string;
  symbolCode?: string;
  regions?: MarketRegion[];
  conditionType: AlertConditionType;
  conditionId?: string;
  conditions?: ConditionGroup;
  isActive: boolean;
  notificationChannels: NotificationChannel[];
  lastTriggered?: Date;
  lastNotificationSent?: Date;
  notificationSettings?: NotificationSettings;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserAlertQueryDto {
  symbolCode?: string;
  isActive?: boolean;
  regions?: MarketRegion[];
  conditionType?: AlertConditionType;
  page?: number;
  limit?: number;
}

export interface UserAlertListResponseDto {
  alerts: UserAlertResponseDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface UserAlertTestDto {
  alertId: string;
}

export interface UserAlertTestResponseDto {
  success: boolean;
  message: string;
  details?: Record<string, unknown>;
}

