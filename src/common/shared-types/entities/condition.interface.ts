import { MarketRegion, ConditionGroup, ScopeType } from '..';
import { EntityLabelEntity } from '../entities/entity-label.interface';
import { LabelEntity } from '../entities/label.interface';

export interface ConditionEntity {
  id: string;
  name: string;
  description: string;
  conditionGroup: ConditionGroup;
  category: string;
  marketRegion: MarketRegion;
  applicableSymbols: string[] | null;
  excludedSymbols: string[] | null;
  scopeType: ScopeType;
  isActive: boolean;
  isPublic: boolean;
  createdBy: string | null;
  usageCount: number;
  createdAt: Date;
  updatedAt: Date;
  entityLabels?: EntityLabelEntity[];
  labels?: LabelEntity[];
}
