import { PortfolioEntity } from '../entities/portfolio.interface';
import { AssetType } from '..';
import { UserEntity } from '../entities/user.interface';
import { SymbolEntity } from '../entities/symbol.interface';
import { EntityLabelEntity } from '../entities/entity-label.interface';
import { LabelEntity } from '../entities/label.interface';

export interface PositionEntity {
  id: string;
  assetType: AssetType;
  costBasis: number;
  quantity: number;
  purchaseDate: Date;
  closeDate: Date;
  createdAt?: Date;
  updatedAt: Date;
  portfolio: PortfolioEntity;
  user: UserEntity;
  symbol: SymbolEntity;
  entityLabels?: EntityLabelEntity[];
  labels?: LabelEntity[];
}
