import { AssetType, MarketRegion } from '..';
import { PositionEntity } from '../entities/position.interface';
import { FundamentalDataEntity } from '../entities/fundamental-data.interface';
import { OhlcvDaysEntity } from '../entities/ohlcv-days.interface';
import { EntityLabelEntity } from '../entities/entity-label.interface';
import { LabelEntity } from '../entities/label.interface';

export interface SymbolEntity {
  id: string;
  symbolCode: string;
  name: string;
  assetType: AssetType;
  exchangeArea: MarketRegion;
  regionalData?: {
    exchangeType?: 'TAI' | 'TWO';
    marketSegment?: string;
    [key: string]: string | number | undefined;
  };
  createdAt?: Date;
  updatedAt?: Date;
  positions: PositionEntity[];
  fundamentalDatas: FundamentalDataEntity[];
  ohlcvDays: OhlcvDaysEntity[];
  entityLabels?: EntityLabelEntity[];
  labels?: LabelEntity[];
}
