import { EntityType, MarketRegion } from '..';

export interface LinkEntityLabelDto {
  entityId: string;
  entityType: EntityType;
  labelName: string;
}

export interface LinkSymbolLabelDto {
  symbolCode: string;
  exchangeArea: MarketRegion;
  labelName: string;
}

export interface UnlinkEntityLabelDto {
  entityId: string;
  entityType: EntityType;
  labelName: string;
}

export interface GetEntityLabelsDto {
  entityId: string;
  entityType: EntityType;
}

export interface GetLabelEntitiesDto {
  labelName: string;
  entityType?: EntityType;
}

export interface EntityLabelResponseDto {
  success: boolean;
  entityLabelId: string;
  isNewLabel: boolean;
  isNewEntityLabel: boolean;
  message: string;
}

