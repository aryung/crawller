import { LabelEntity } from '.';
import { EntityType } from '..';

export interface EntityLabelEntity {
  id: string;
  labelId: string;
  label: LabelEntity;
  entityId: string;
  entityType: EntityType;
  taggedAt: Date;
}
