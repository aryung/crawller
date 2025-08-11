import { Column, Entity, PrimaryColumn } from 'typeorm';
import { InvestmentRelationshipChangeType } from '../../common/shared-types';

@Entity('investment_relationship_changes')
export class InvestmentRelationshipChangeEntity {
  @PrimaryColumn({
    type: 'uuid',
    default: () => 'uuid_generate_v4()', // 明確指定資料庫使用此函數作為預設值
  })
  id!: string;

  @Column('uuid')
  strategyId!: string;

  @Column('uuid')
  portfolioId!: string;

  @Column({
    name: 'change_type',
    type: 'varchar',
  })
  changeType!: InvestmentRelationshipChangeType;

  @Column('timestamptz')
  changeTime!: Date;

  @Column('jsonb', { nullable: true })
  previousParameters!: object;

  @Column('jsonb', { nullable: true })
  newParameters!: object;
}
