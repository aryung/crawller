import {
  Entity,
  Column,
  ManyToOne,
  OneToMany,
  UpdateDateColumn,
  CreateDateColumn,
  JoinColumn,
  PrimaryColumn,
} from 'typeorm';
import { PortfolioEntity } from './portfolio.entity';
import { AssetType } from '../shared-types';
import { UserEntity } from './user.entity';
import { SymbolEntity } from './symbol.entity';
import { EntityLabelEntity } from './entity-label.entity';
import { LabelEntity } from './label.entity';

@Entity('positions')
export class PositionEntity {
  @PrimaryColumn({
    type: 'uuid',
    default: () => 'uuid_generate_v4()', // 明確指定資料庫使用此函數作為預設值
  })
  id: string;

  @Column({
    name: 'asset_type',
    type: 'varchar',
    nullable: true,
  })
  assetType: AssetType;

  @Column({
    name: 'cost_basis',
    type: 'decimal',
    nullable: false,
    precision: 10,
    scale: 2,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => Number(value),
    },
  })
  costBasis: number;

  // 持有數量
  @Column({
    name: 'quantity',
    type: 'decimal',
    nullable: false,
    precision: 10,
    scale: 2,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => Number(value),
    },
  })
  quantity: number;

  @Column({
    name: 'purchase_date',
    type: 'timestamptz',
    nullable: false,
  })
  purchaseDate: Date;

  // 持倉結束時間
  @Column({
    name: 'close_date',
    type: 'timestamptz',
    nullable: true,
  })
  closeDate: Date;

  @CreateDateColumn({
    type: 'timestamptz',
  })
  createdAt?: Date;

  @UpdateDateColumn({
    type: 'timestamptz',
  })
  updatedAt: Date;

  @ManyToOne(() => PortfolioEntity, { nullable: true })
  @JoinColumn({ name: 'portfolio_id' })
  portfolio: PortfolioEntity;

  @ManyToOne(() => UserEntity, (user) => user.positions, { nullable: false })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;

  @ManyToOne(() => SymbolEntity, (symbol) => symbol.positions)
  @JoinColumn({ name: 'symbol_id' })
  symbol: SymbolEntity;

  // 標籤關聯 (虛擬關聯)
  @OneToMany(() => EntityLabelEntity, (entityLabel) => entityLabel.entityId, {
    createForeignKeyConstraints: false,
  })
  entityLabels?: EntityLabelEntity[];

  // 便利方法：獲取實際標籤 (需要手動 join)
  labels?: LabelEntity[];
}
