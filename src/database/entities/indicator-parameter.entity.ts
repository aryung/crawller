import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { IndicatorEntity } from './indicator.entity';

@Entity('indicator_parameters')
@Index('IDX_indicator_parameters_indicator_id', ['indicatorId'])
@Index('IDX_indicator_parameters_parameter_id', ['parameterId'])
@Index('IDX_indicator_parameters_display_order', ['displayOrder'])
export class IndicatorParameterEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'indicator_id', type: 'integer' })
  indicatorId: number;

  @Column({ name: 'parameter_id', type: 'varchar', length: 100 })
  parameterId: string;

  @Column({ name: 'name', type: 'varchar', length: 200 })
  name: string;

  @Column({ name: 'description', type: 'text', nullable: true })
  description?: string;

  @Column({ name: 'parameter_type', type: 'varchar', length: 50 })
  parameterType: string;

  @Column({
    name: 'min_value',
    type: 'decimal',
    precision: 10,
    scale: 4,
    nullable: true,
  })
  minValue?: number;

  @Column({
    name: 'max_value',
    type: 'decimal',
    precision: 10,
    scale: 4,
    nullable: true,
  })
  maxValue?: number;

  @Column({
    name: 'step_value',
    type: 'decimal',
    precision: 10,
    scale: 4,
    nullable: true,
  })
  stepValue?: number;

  @Column({
    name: 'default_value',
    type: 'decimal',
    precision: 10,
    scale: 4,
    nullable: true,
  })
  defaultValue?: number;

  @Column({ name: 'unit', type: 'varchar', length: 20, nullable: true })
  unit?: string;

  @Column({
    name: 'suggested_values',
    type: 'decimal',
    precision: 10,
    scale: 4,
    array: true,
    default: '{}',
  })
  suggestedValues: number[];

  @Column({ name: 'impact_type', type: 'varchar', length: 50 })
  impactType: string;

  @Column({ name: 'display_order', type: 'integer', default: 0 })
  displayOrder: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  // 關聯：所屬指標
  @ManyToOne(() => IndicatorEntity, (indicator) => indicator.parameters)
  @JoinColumn({
    name: 'indicator_id',
    foreignKeyConstraintName: 'FK_indicator_parameters_indicator_id',
  })
  indicator: IndicatorEntity;
}
