import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { IndicatorEntity } from './indicator.entity';

@Entity('indicator_categories')
export class IndicatorCategoryEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'name', type: 'varchar', length: 100 })
  name: string;

  @Column({ name: 'type', type: 'varchar', length: 50 })
  type: string;

  @Column({ name: 'description', type: 'text', nullable: true })
  description?: string;

  @Column({ name: 'parent_id', type: 'integer', nullable: true })
  parentId?: number;

  @Column({ name: 'display_order', type: 'integer', default: 0 })
  displayOrder: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // 關聯：父分類
  @ManyToOne(() => IndicatorCategoryEntity, { nullable: true })
  @JoinColumn({
    name: 'parent_id',
    foreignKeyConstraintName: 'FK_indicator_categories_parent_id',
  })
  parent?: IndicatorCategoryEntity;

  // 關聯：子分類
  @OneToMany(() => IndicatorCategoryEntity, (category) => category.parent)
  children: IndicatorCategoryEntity[];

  // 關聯：該分類下的指標
  @OneToMany(() => IndicatorEntity, (indicator) => indicator.category)
  indicators: IndicatorEntity[];
}
