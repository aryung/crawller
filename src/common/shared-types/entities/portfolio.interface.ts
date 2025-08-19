import { UserEntity } from '../entities/user.interface';
import { PositionEntity } from '../entities/position.interface';
import { StrategyEntity } from '../entities/strategy.interface';
import { EntityLabelEntity } from '../entities/entity-label.interface';
import { LabelEntity } from '../entities/label.interface';

export interface PortfolioEntity {
  id: string;
  name: string;
  cashBalance: number;
  createdAt?: Date;
  updatedAt: Date;
  user: UserEntity;
  positions: PositionEntity[];
  strategy: StrategyEntity;
  entityLabels?: EntityLabelEntity[];
  labels?: LabelEntity[];
}
