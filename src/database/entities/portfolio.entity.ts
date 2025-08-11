import {
  Entity,
  ManyToOne,
  OneToMany,
  Column,
  JoinColumn,
  UpdateDateColumn,
  CreateDateColumn,
  PrimaryColumn,
} from 'typeorm';
import { UserEntity } from './user.entity';
import { PositionEntity } from './position.entity';
import { StrategyEntity } from './strategy.entity';
import { EntityLabelEntity } from './entity-label.entity';
import { LabelEntity } from './label.entity';

@Entity('portfolios')
export class PortfolioEntity {
  @PrimaryColumn({
    type: 'uuid',
    default: () => 'uuid_generate_v4()', // 明確指定資料庫使用此函數作為預設值
  })
  id!: string;

  @Column({
    type: 'varchar',
    nullable: false,
  })
  name!: string;

  // parameters 欄位已移除，配置參數現在存儲在關聯的 Strategy 中

  @Column({
    name: 'cash_balance',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
    nullable: true,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => Number(value),
    },
  })
  cashBalance!: number;

  @CreateDateColumn({
    type: 'timestamptz',
  })
  createdAt?: Date;

  @UpdateDateColumn({
    type: 'timestamptz',
  })
  updatedAt!: Date;

  @ManyToOne(() => UserEntity, (user) => user.portfolios)
  @JoinColumn({ name: 'user_id' })
  user!: UserEntity;

  // 所有持倉
  @OneToMany(() => PositionEntity, (position) => position.portfolio, {
    nullable: true,
  })
  positions!: PositionEntity[];

  // 關聯的策略，可為空
  @ManyToOne(() => StrategyEntity, {
    nullable: true,
  })
  @JoinColumn({ name: 'strategy_id' })
  strategy!: StrategyEntity;

  // 標籤關聯 (虛擬關聯)
  @OneToMany(() => EntityLabelEntity, (entityLabel) => entityLabel.entityId, {
    createForeignKeyConstraints: false,
  })
  entityLabels?: EntityLabelEntity[];

  // 便利方法：獲取實際標籤 (需要手動 join)
  labels?: LabelEntity[];
}
