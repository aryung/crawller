import { UserEntity } from '../entities/user.interface';
import { UserAlertEntity } from '../entities/user-alert.interface';
import { NotificationChannel, NotificationStatus, NotificationType } from '..';

export interface NotificationMessageEntity {
  id: string;
  userId: string;
  user: UserEntity;
  alertId: string;
  alert: UserAlertEntity;
  type: NotificationType;
  channel: NotificationChannel;
  title: string;
  content: string;
  metadata: Record<string, unknown>;
  status: NotificationStatus;
  scheduledAt: Date;
  sentAt: Date;
  errorMessage: string;
  createdAt: Date;
  updatedAt: Date;
}
