import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserEntity } from './user.entity';
import { SymbolEntity } from './symbol.entity';
import { ConditionEntity } from './condition.entity';
import { EntityLabelEntity } from './entity-label.entity';
import { LabelEntity } from './label.entity';
import {
  ConditionGroup,
  MarketRegion,
  NotificationChannel,
  NotificationSettings,
  AlertConditionType,
} from '../shared-types';

@Entity('user_alerts')
@Index('IDX_user_alerts_user_id', ['userId'])
@Index('IDX_user_alerts_symbol_id', ['symbolId'])
@Index('IDX_user_alerts_condition_id', ['conditionId'])
@Index('IDX_user_alerts_condition_type', ['conditionType'])
@Index('IDX_user_alerts_is_active', ['isActive'])
@Index('IDX_user_alerts_user_symbol', ['userId', 'symbolId'])
@Index('IDX_user_alerts_user_condition', ['userId', 'conditionId'])
export class UserAlertEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => UserEntity, { eager: false })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;

  @Column({
    name: 'symbol_id',
    type: 'uuid',
    nullable: true,
    comment: 'Symbol UUID（單一股票警報時使用）',
  })
  symbolId: string | null;

  @ManyToOne(() => SymbolEntity, { eager: false, nullable: true })
  @JoinColumn({
    name: 'symbol_id',
    foreignKeyConstraintName: 'FK_user_alerts_symbol_id',
  })
  symbol: SymbolEntity | null;

  @Column({
    name: 'condition_type',
    type: 'varchar',
    length: 20,
    default: 'INLINE',
    comment: '條件類型：INLINE(內聯JSON), REFERENCE(外連Condition實體)',
  })
  conditionType: AlertConditionType;

  @Column({ name: 'condition_id', type: 'uuid', nullable: true })
  conditionId: string | null;

  @ManyToOne(() => ConditionEntity, { eager: false, nullable: true })
  @JoinColumn({
    name: 'condition_id',
    foreignKeyConstraintName: 'FK_user_alerts_condition_id',
  })
  condition: ConditionEntity | null;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({
    type: 'json',
    nullable: true,
    comment: '內聯條件組（當 conditionType = INLINE 時使用）',
    transformer: {
      to: (value: ConditionGroup) => value,
      from: (value: any) => value,
    },
  })
  conditions: ConditionGroup | null;

  @Column({
    name: 'regions',
    type: 'text',
    array: true,
    nullable: true,
    comment: '市場區域陣列（市場掃描器時使用）',
  })
  regions: MarketRegion[] | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({
    name: 'notification_channels',
    type: 'json',
  })
  notificationChannels: NotificationChannel[];

  @Column({ name: 'last_triggered', type: 'timestamp', nullable: true })
  lastTriggered: Date;

  @Column({
    name: 'last_notification_sent',
    type: 'timestamp',
    nullable: true,
    comment: '上次發送通知的時間',
  })
  lastNotificationSent: Date;

  @Column({
    name: 'notification_settings',
    type: 'jsonb',
    nullable: true,
    comment: '新版通知設定 - 支援模式選擇、頻率控制、時段管理',
    transformer: {
      to: (value: NotificationSettings) => value,
      from: (value: any) => value,
    },
  })
  notificationSettings: NotificationSettings;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // 標籤關聯 (虛擬關聯)
  @OneToMany(() => EntityLabelEntity, (entityLabel) => entityLabel.entityId, {
    createForeignKeyConstraints: false,
  })
  entityLabels?: EntityLabelEntity[];

  // 便利方法：獲取實際標籤 (需要手動 join)
  labels?: LabelEntity[];
}
