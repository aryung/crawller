import { MarketRegion } from '..';

export interface GetIndustriesDto {
  marketRegions?: MarketRegion[];
  includeSymbolCount?: boolean;
  includeMetadata?: boolean;
}

export interface IndustryInfoDto {
  id: string;
  name: string;
  symbolCount?: number;
  metadata?: Record<string, unknown>;
}

export interface GetIndustriesResponseDto {
  success: boolean;
  data: Record<string, IndustryInfoDto[]>;
}

export interface SymbolFiltersDto {
  industries?: string[];
  marketRegions?: MarketRegion[];
  marketSegments?: string[];
}

export interface PaginationDto {
  page?: number;
  limit?: number;
}

export interface SortDto {
  field?: string;
  order?: 'asc' | 'desc';
}

export interface SearchSymbolsDto {
  filters: SymbolFiltersDto;
  pagination?: PaginationDto;
  sort?: SortDto;
}

export interface SymbolInfoDto {
  id: string;
  symbolCode: string;
  name: string;
  exchangeArea: MarketRegion;
  marketSegment?: string | null;
  industries?: string[];
}

export interface SearchSymbolsResponseDto {
  success: boolean;
  data: {
    symbols: SymbolInfoDto[];
    pagination: {
      total: number;
      page: number;
      totalPages: number;
    };
  };
}

export interface GetIndustryStatsDto {
  marketRegions?: MarketRegion[];
  groupBy?: 'marketRegion' | 'industry';
  includeDetails?: boolean;
}

export interface IndustryStatsResponseDto {
  success: boolean;
  data: Record<string, unknown>;
}

export interface CategorySymbolDto {
  symbolCode: string;
  name: string;
}

export interface CategoryMappingDto {
  category: string;
  categoryId: string;
  symbols: CategorySymbolDto[];
}

export interface BulkSyncOptionsDto {
  strategy?: 'replace' | 'merge';
  createMissingSymbols?: boolean;
  updateExistingRelations?: boolean;
  chunkSize?: number;
  enableProgressReport?: boolean;
}

export interface BulkSyncMappingsDto {
  TPE?: CategoryMappingDto[];
  US?: CategoryMappingDto[];
  JP?: CategoryMappingDto[];
  options?: BulkSyncOptionsDto;
}

export interface BulkSyncStatsDto {
  labelsCreated: number;
  labelsReactivated: number;
  symbolsCreated: number;
  symbolsUpdated: number;
  relationsCreated: number;
  relationsRemoved: number;
  chunksProcessed?: number;
  totalProcessingTime?: number;
  chunkDetails?: Record<
    string,
    {
      chunks: number;
      mappings: number;
      time: number;
    }
  >;
}

export interface BulkSyncResponseDto {
  success: boolean;
  data: BulkSyncStatsDto;
  errors?: string[];
  message?: string;
}

export interface CreateSymbolDto {
  symbolCode: string;
  name: string;
  exchangeArea?: MarketRegion;
  assetType?: string;
  regionalData?: Record<string, unknown>;
}

export interface BulkCreateSymbolsDto {
  symbols: CreateSymbolDto[];
  updateExisting?: boolean;
}

export interface BulkCreateSymbolsResponseDto {
  success: boolean;
  data: {
    created: number;
    updated: number;
    skipped: number;
    total: number;
  };
  errors?: string[];
  message?: string;
}

