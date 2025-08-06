import { ConditionGroup } from './condition.interface';
import { MarketRegion } from './market-data.interface';
import { AssetType } from './position.interface';
import { NotificationChannel } from './notification.interface';
import { NotificationSettings } from './notification-settings.interface';

/**
 * 分享篩選條件介面
 */
export interface SharedScreen {
  id: string;
  shareId: string;
  title: string;
  description?: string;
  conditionGroup: ConditionGroup;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  isPublic: boolean;
  viewCount: number;
  useCount: number;
  tags?: string[];
}

/**
 * 創建分享篩選條件請求
 */
export interface CreateSharedScreenDto {
  title: string;
  description?: string;
  conditionGroup: ConditionGroup;
  isPublic: boolean;
  tags?: string[];
}

/**
 * 條件轉監控請求
 */
export interface ConditionToAlertRequest {
  conditionGroup: ConditionGroup;
  alertSettings: {
    name: string;
    description?: string;
    notificationChannels: NotificationChannel[];
    isActive: boolean;
    notificationSettings: NotificationSettings;
  };
  regions: MarketRegion[];
  assetTypes: AssetType[];
}

/**
 * 條件轉策略請求
 */
export interface ConditionToStrategyRequest {
  screenCondition: ConditionGroup;
  entryConditions: ConditionGroup;
  exitConditions?: ConditionGroup;
  stopLoss?: number;
  takeProfit?: number;
  strategySettings: {
    name: string;
    description?: string;
    enabled: boolean;
  };
}

/**
 * 分享篩選條件回應
 */
export interface SharedScreenResponse {
  id: string;
  shareId: string;
  title: string;
  description?: string;
  shareUrl?: string;
  viewCount: number;
  useCount: number;
  tags?: string[];
}
