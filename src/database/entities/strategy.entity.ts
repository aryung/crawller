import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserEntity } from './user.entity';
import { PortfolioEntity } from './portfolio.entity';
import { EntityLabelEntity } from './entity-label.entity';
import { LabelEntity } from './label.entity';
import {
  AggregatedStrategyParameters,
  StrategyStatus,
  StrategyType,
  TradeRecommendation,
} from '../../common/shared-types';

@Entity({ name: 'strategies' })
export class StrategyEntity {
  @PrimaryColumn({
    type: 'uuid',
    default: () => 'uuid_generate_v4()', // 明確指定資料庫使用此函數作為預設值
  })
  id!: string;

  @Column()
  name!: string;

  @Column({
    type: 'varchar',
    name: 'type',
  })
  type!: StrategyType;

  @Column('jsonb', { nullable: true, name: 'parameters' })
  parameters!: AggregatedStrategyParameters;

  /**
   * 執行歷史摘要
   * 記錄策略的執行情況統計
   */
  @Column('jsonb', { nullable: true, name: 'execution_history_summary' })
  executionHistorySummary?: {
    totalExecutions: number;
    successCount: number;
    failureCount: number;
    lastSuccessTime?: Date;
    lastFailureTime?: Date;
    rebalanceCount: number;
    performanceSummary?: {
      winRate: number;
      averageReturn: number;
      maxDrawdown: number;
    };
  };

  @Column({
    type: 'varchar',
    enum: StrategyStatus,
    default: StrategyStatus.INACTIVE,
    name: 'status',
  })
  status!: StrategyStatus;

  @Column({ type: 'timestamptz', nullable: true, name: 'last_execution_time' })
  lastExecutionTime?: Date;

  @Column('jsonb', { nullable: true, name: 'execution_results' })
  executionResults!: {
    success: boolean;
    recommendations?: TradeRecommendation[];
    message?: string;
    timestamp: Date;
  }[];

  @CreateDateColumn({
    type: 'timestamptz',
  })
  createdAt?: Date;

  @UpdateDateColumn({
    type: 'timestamptz',
  })
  updatedAt!: Date;

  @ManyToOne(() => UserEntity)
  @JoinColumn({ name: 'user_id' })
  user!: UserEntity;

  @OneToMany(() => PortfolioEntity, (portfolio) => portfolio.strategy, {
    nullable: true,
  })
  portfolios?: PortfolioEntity[];

  // 標籤關聯 (虛擬關聯)
  @OneToMany(() => EntityLabelEntity, (entityLabel) => entityLabel.entityId, {
    createForeignKeyConstraints: false,
  })
  entityLabels?: EntityLabelEntity[];

  // 便利方法：獲取實際標籤 (需要手動 join)
  labels?: LabelEntity[];
}

// 策略預設參數已移至 ../constants/strategy-defaults.ts
// 請使用以下 import 引入：
// import {
//   DEFAULT_GRID_TRADING_PARAMETERS,
//   DEFAULT_ASSET_ALLOCATION_PARAMETERS,
//   DEFAULT_FIVE_LINE_PARAMETERS,
//   DEFAULT_INDICATOR_SIGNAL_PARAMETERS
// } from '../constants/strategy-defaults';
