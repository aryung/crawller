import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserEntity } from '.';
import { LabelType } from '../shared-types';

@Entity('labels')
@Index('IDX_labels_name', ['name'], { unique: true })
@Index('IDX_labels_type', ['type'])
@Index('IDX_labels_is_active', ['isActive'])
export class LabelEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 100 })
  name: string;

  @Column({
    type: 'varchar',
    length: 20,
    default: 'USER_CUSTOM',
    comment: '標籤類型：SYSTEM_DEFINED(系統預設), USER_CUSTOM(用戶自定義)',
  })
  type: LabelType;

  @Column({ length: 7, nullable: true, comment: '標籤顏色 #HEX 格式' })
  color?: string;

  @Column({ type: 'text', nullable: true, comment: '標籤描述' })
  description?: string;

  @Column({
    name: 'created_by',
    nullable: true,
    comment: '創建者ID，null表示系統標籤',
  })
  createdBy?: string;

  @ManyToOne(() => UserEntity, { nullable: true })
  @JoinColumn({
    name: 'created_by',
    foreignKeyConstraintName: 'FK_labels_created_by',
  })
  creator?: UserEntity;

  @Column({ name: 'is_active', default: true, comment: '是否啟用' })
  isActive: boolean;

  @Column({
    name: 'usage_count',
    default: 0,
    comment: '使用次數統計',
  })
  usageCount: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
