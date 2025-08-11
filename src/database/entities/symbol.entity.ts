import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { AssetType, MarketRegion } from '../../common/shared-types';
import { PositionEntity } from './position.entity';
import { FundamentalDataEntity } from './fundamental-data.entity';
import { OhlcvDaysEntity } from './ohlcv-days.entity';
import { EntityLabelEntity } from './entity-label.entity';
import { LabelEntity } from './label.entity';

@Entity('symbols')
@Index('UIDX_symbol_code_exchange_area', ['symbolCode', 'exchangeArea'], {
  unique: true,
})
export class SymbolEntity {
  @PrimaryColumn({
    type: 'uuid',
    default: () => 'uuid_generate_v4()',
  })
  id!: string;

  @Column({ name: 'symbol_code' })
  symbolCode!: string;

  @Column()
  @Index()
  name!: string;

  @Column({
    name: 'asset_type',
    type: 'varchar',
    default: AssetType.EQUITY,
  })
  assetType!: AssetType;

  @Column({
    name: 'exchange_area',
    nullable: false,
  })
  exchangeArea!: MarketRegion;

  @CreateDateColumn({
    type: 'timestamptz',
    name: 'created_at',
    nullable: true,
  })
  createdAt?: Date;

  @UpdateDateColumn({
    type: 'timestamptz',
    name: 'updated_at',
    nullable: true,
  })
  updatedAt?: Date;

  @OneToMany(() => PositionEntity, (position) => position.symbol)
  positions!: PositionEntity[];

  @OneToMany(
    () => FundamentalDataEntity,
    (fundamentalData) => fundamentalData.symbolId
  )
  fundamentalDatas!: FundamentalDataEntity[];

  @OneToMany(() => OhlcvDaysEntity, (ohlcvDays) => ohlcvDays.symbol)
  ohlcvDays!: OhlcvDaysEntity[];

  // 標籤關聯 (虛擬關聯)
  @OneToMany(() => EntityLabelEntity, (entityLabel) => entityLabel.entityId, {
    createForeignKeyConstraints: false,
  })
  entityLabels?: EntityLabelEntity[];

  // 便利方法：獲取實際標籤 (需要手動 join)
  labels?: LabelEntity[];
}
