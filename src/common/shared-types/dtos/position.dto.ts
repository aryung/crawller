import { AssetType, MarketRegion } from '..';

export interface CreatePositionDto {
  portfolioId: string;
  symbolCode: string;
  exchange_area?: MarketRegion;
  assetType?: AssetType;
  quantity: number;
  costBasis: number;
  purchaseDate?: string;
  closeDate?: string | null;
}

export interface UpdatePositionDto {
  symbolCode: string;
  exchange_area?: MarketRegion;
  assetType?: AssetType;
  quantity: number;
  costBasis: number;
  purchaseDate?: string;
  closeDate?: string | null;
}

