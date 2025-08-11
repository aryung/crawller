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

@Entity('indicator_templates')
@Index('IDX_indicator_templates_indicator_id', ['indicatorId'])
@Index('IDX_indicator_templates_template_type', ['templateType'])
@Index(
  'UQ_indicator_templates_indicator_type',
  ['indicatorId', 'templateType'],
  { unique: true }
)
export class IndicatorTemplateEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'indicator_id', type: 'integer' })
  indicatorId!: number;

  @Column({ name: 'template_type', type: 'varchar', length: 50 })
  templateType!: string;

  @Column({ name: 'template_values', type: 'jsonb' })
  templateValues!: Record<string, any>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  // 關聯：所屬指標
  @ManyToOne(() => IndicatorEntity, (indicator) => indicator.templates)
  @JoinColumn({
    name: 'indicator_id',
    foreignKeyConstraintName: 'FK_indicator_templates_indicator_id',
  })
  indicator!: IndicatorEntity;
}
