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
import { IndicatorCategoryEntity } from './indicator-category.entity';
import { IndicatorParameterEntity } from './indicator-parameter.entity';
import { IndicatorTemplateEntity } from './indicator-template.entity';
import { EntityLabelEntity } from './entity-label.entity';
import { LabelEntity } from './label.entity';

@Entity('indicators')
@Index('IDX_indicators_type', ['type'], { unique: true })
@Index('IDX_indicators_category_id', ['categoryId'])
@Index('IDX_indicators_match_signature', ['matchSignature'])
@Index('IDX_indicators_display_order', ['displayOrder'])
export class IndicatorEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'type', type: 'varchar', length: 100, unique: true })
  type!: string;

  @Column({ name: 'name', type: 'varchar', length: 200 })
  name!: string;

  @Column({ name: 'description', type: 'text', nullable: true })
  description?: string;

  @Column({ name: 'icon', type: 'varchar', length: 10, nullable: true })
  icon?: string;

  @Column({ name: 'category_id', type: 'integer' })
  categoryId!: number;

  @Column({
    name: 'context_modes',
    type: 'varchar',
    array: true,
    default: '{}',
  })
  contextModes!: string[];

  @Column({
    name: 'match_signature',
    type: 'varchar',
    length: 200,
    nullable: true,
  })
  matchSignature?: string;

  @Column({
    name: 'signature_template',
    type: 'varchar',
    length: 200,
    nullable: true,
  })
  signatureTemplate?: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ name: 'display_order', type: 'integer', default: 0 })
  displayOrder!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  // 關聯：所屬分類
  @ManyToOne(() => IndicatorCategoryEntity, (category) => category.indicators)
  @JoinColumn({
    name: 'category_id',
    foreignKeyConstraintName: 'FK_indicators_category_id',
  })
  category!: IndicatorCategoryEntity;

  // 關聯：指標參數
  @OneToMany(() => IndicatorParameterEntity, (parameter) => parameter.indicator)
  parameters!: IndicatorParameterEntity[];

  // 關聯：指標模板
  @OneToMany(() => IndicatorTemplateEntity, (template) => template.indicator)
  templates!: IndicatorTemplateEntity[];

  // 標籤關聯 (虛擬關聯)
  @OneToMany(() => EntityLabelEntity, (entityLabel) => entityLabel.entityId, {
    createForeignKeyConstraints: false,
  })
  entityLabels?: EntityLabelEntity[];

  // 便利方法：獲取實際標籤 (需要手動 join)
  labels?: LabelEntity[];
}
