import { UserEntity } from '../entities/user.interface';
import { SymbolEntity } from '../entities/symbol.interface';
import { ConditionEntity } from '../entities/condition.interface';
import { EntityLabelEntity } from '../entities/entity-label.interface';
import { LabelEntity } from '../entities/label.interface';
import { ConditionGroup, MarketRegion, NotificationChannel, NotificationSettings, AlertConditionType } from '..';

export interface UserAlertEntity {
  id: string;
  userId: string;
  user: UserEntity;
  symbolId: string | null;
  symbol: SymbolEntity | null;
  conditionType: AlertConditionType;
  conditionId: string | null;
  condition: ConditionEntity | null;
  name: string;
  conditions: ConditionGroup | null;
  regions: MarketRegion[] | null;
  isActive: boolean;
  notificationChannels: NotificationChannel[];
  lastTriggered: Date;
  lastNotificationSent: Date;
  notificationSettings: NotificationSettings;
  createdAt: Date;
  updatedAt: Date;
  entityLabels?: EntityLabelEntity[];
  labels?: LabelEntity[];
}
