import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { LabelEntity } from '.';
import { EntityType } from '../../common/shared-types';

@Entity('entity_labels')
@Unique('UQ_entity_labels_unique', ['labelId', 'entityId', 'entityType'])
@Index('IDX_entity_labels_entity_lookup', ['entityId', 'entityType'])
@Index('IDX_entity_labels_label_id', ['labelId'])
@Index('IDX_entity_labels_entity_type', ['entityType'])
export class EntityLabelEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'label_id', comment: '標籤ID' })
  labelId!: string;

  @ManyToOne(() => LabelEntity, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'label_id',
    foreignKeyConstraintName: 'FK_entity_labels_label_id',
  })
  label!: LabelEntity;

  @Column({ name: 'entity_id', comment: '實體ID (UUID)' })
  entityId!: string;

  @Column({
    name: 'entity_type',
    type: 'varchar',
    length: 30,
    comment: '實體類型：symbol, user_alert, condition',
  })
  entityType!: EntityType;

  @CreateDateColumn({ name: 'tagged_at', comment: '標籤添加時間' })
  taggedAt!: Date;
}
