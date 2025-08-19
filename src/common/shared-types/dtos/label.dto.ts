import { LabelType, MarketRegion } from '..';

export interface CreateLabelDto {
  name: string;
  type?: LabelType;
  color?: string;
  description?: string;
}

export interface UpdateLabelDto {
  name?: string;
  color?: string;
  description?: string;
  isActive?: boolean;
}

export interface LabelResponseDto {
  id: string;
  name: string;
  displayName?: string;
  categoryName?: string;
  fullDisplayName?: string;
  type: LabelType;
  color?: string;
  description?: string;
  isActive: boolean;
  usageCount: number;
  createdAt: Date;
  updatedAt: Date;
  metadata?: {
    market?: string;
    category?: string;
    subcategory?: string;
    categoryGroup?: string;
    displayName?: string;
    [key: string]: string | number | undefined;
  };
}

export interface LabelSearchDto {
  query?: string;
  type?: LabelType;
  isActiveOnly?: boolean;
  limit?: number;
}

export interface BatchLabelOperationDto {
  labelIds: string[];
}

export interface AssignLabelsToSymbolDto {
  symbolCode: string;
  exchangeArea?: MarketRegion;
}

export interface LabelStatsDto {
  totalLabels: number;
  activeLabels: number;
  systemLabels: number;
  userLabels: number;
  totalUsage: number;
}

export interface PopularLabelsDto {
  limit?: number;
  type?: LabelType;
}

