// NOTE: ConditionGroup, MarketRegion, and NotificationSettings imports
// are no longer needed here as the DTOs have been moved to dtos/user-alert.dto.ts

export enum NotificationType {
  CONDITION_TRIGGERED = 'condition_triggered',
  PRICE_ALERT = 'price_alert',
  STRATEGY_SIGNAL = 'strategy_signal',
  SYSTEM_ALERT = 'system_alert',
}

export enum NotificationStatus {
  PENDING = 'pending',
  SENT = 'sent',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export enum NotificationChannel {
  TELEGRAM = 'telegram',
  EMAIL = 'email',
  PUSH = 'push',
  SMS = 'sms',
}

export interface NotificationTrigger {
  alertId: string;
  symbolCode: string;
  triggeredConditions: string[];
  marketData: Record<string, unknown>;
  calculatedIndicators: Record<string, number>;
  timestamp: Date;
}

// NOTE: CreateUserAlertDto and UpdateUserAlertDto have been moved to dtos/user-alert.dto.ts
// These are now class-based DTOs with validation decorators for better type safety

export interface NotificationStats {
  totalAlerts: number;
  activeAlerts: number;
  triggeredToday: number;
  sentToday: number;
  failedToday: number;
}

export interface BatchCheckRequest {
  offset?: number;
  limit?: number;
  symbolCode?: string; // 可選：只檢查特定股票的 alerts
}

export interface BatchCheckResult {
  success: boolean;
  message: string;
  startTime: Date;
  endTime: Date;
  processingTimeMs: number;
  statistics: {
    totalActiveAlerts: number;
    alertsProcessed: number;
    alertsTriggered: number;
    alertsSkipped: number;
    notificationsSent: number;
    notificationsFailed: number;
    alertsByStatus: {
      processed: number;
      triggered: number;
      skippedCooldown: number;
      skippedSchedule: number;
      skippedNoData: number;
      error: number;
    };
    symbolBreakdown: Record<
      string,
      {
        processed: number;
        triggered: number;
      }
    >;
  };
  errors: string[];
  nextOffset?: number; // 下一批的起始位置
  hasMore: boolean; // 是否還有更多數據
}

export interface QueueProcessRequest {
  batchSize?: number; // 每批處理多少筆，預設 500
  maxBatches?: number; // 最大批次數，防止無限循環，預設 10
  symbolCode?: string; // 可選：只處理特定股票
  delayBetweenBatches?: number; // 批次間延遲(ms)，預設 1000
}

export interface QueueProcessResult {
  success: boolean;
  message: string;
  startTime: Date;
  endTime: Date;
  totalProcessingTimeMs: number;
  batchesProcessed: number;
  statistics: {
    totalActiveAlerts: number;
    alertsProcessed: number;
    alertsTriggered: number;
    alertsSkipped: number;
    notificationsSent: number;
    notificationsFailed: number;
    alertsByStatus: {
      processed: number;
      triggered: number;
      skippedCooldown: number;
      skippedSchedule: number;
      skippedNoData: number;
      error: number;
    };
    symbolBreakdown: Record<
      string,
      {
        processed: number;
        triggered: number;
      }
    >;
  };
  batchResults: Array<{
    batchNumber: number;
    processed: number;
    triggered: number;
    processingTimeMs: number;
    offset: number;
  }>;
  errors: string[];
  completedReason:
    | 'all_processed'
    | 'max_batches_reached'
    | 'error'
    | 'no_alerts';
}
