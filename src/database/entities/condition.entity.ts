import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { MarketRegion, ConditionGroup, ScopeType } from '../shared-types';
import { EntityLabelEntity } from './entity-label.entity';
import { LabelEntity } from './label.entity';

@Entity('conditions')
@Index('IDX_conditions_name', ['name'])
@Index('IDX_conditions_category', ['category'])
@Index('IDX_conditions_is_active', ['isActive'])
@Index('IDX_conditions_market_region', ['marketRegion'])
export class ConditionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({
    type: 'json',
    transformer: {
      to: (value: ConditionGroup) => value,
      from: (value: any) => value,
    },
  })
  conditionGroup: ConditionGroup;

  @Column({
    type: 'varchar',
    length: 50,
    default: 'GENERAL',
    comment: '條件分類：TECHNICAL, FUNDAMENTAL, SENTIMENT, VOLUME, GENERAL',
  })
  category: string;

  @Column({
    type: 'varchar',
    length: 10,
    nullable: true,
    comment: '適用市場區域：TW, US, HK, CN 等',
  })
  marketRegion: MarketRegion;

  @Column({
    type: 'json',
    nullable: true,
    comment: '適用股票代碼列表，null 表示適用所有股票',
  })
  applicableSymbols: string[] | null;

  @Column({
    type: 'json',
    nullable: true,
    comment: '排除股票代碼列表',
  })
  excludedSymbols: string[] | null;

  @Column({
    type: 'varchar',
    length: 20,
    default: 'SYMBOL_SPECIFIC',
    comment:
      '條件範圍類型：SYMBOL_SPECIFIC(單一股票), SYMBOL_LIST(股票清單), MARKET_WIDE(市場範圍)',
  })
  scopeType: ScopeType;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({
    name: 'is_public',
    type: 'boolean',
    default: false,
    comment: '是否為公開條件（可被其他用戶使用）',
  })
  isPublic: boolean;

  @Column({
    name: 'created_by',
    type: 'varchar',
    length: 255,
    nullable: true,
    comment: '創建者ID，null表示系統預設條件',
  })
  createdBy: string | null;

  @Column({
    name: 'usage_count',
    type: 'integer',
    default: 0,
    comment: '使用次數統計',
  })
  usageCount: number;

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
