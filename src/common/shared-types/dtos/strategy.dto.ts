import { AggregatedStrategyParameters, AssetType, ConditionGroup, MarketRegion, StrategyStatus, StrategyType } from '..';
import { UserEntity } from '../entities/user.interface';

export interface CreateStrategyDto {
  name: string;
  description?: string;
  type: StrategyType;
  status: StrategyStatus;
  parameters: AggregatedStrategyParameters;
  user: UserEntity;
  portfolioIds: string[];
}

export interface UpdateStrategyDto {
  name?: string;
  parameters?: AggregatedStrategyParameters;
  portfolioIds?: string[];
}

export interface SymbolScreenRequestDto {
  conditions: ConditionGroup;
  regions?: MarketRegion[];
  assetTypes?: AssetType[];
  screenDate?: string;
  limit?: number;
  labels?: string[];
}

export interface ScreenedSymbolDto {
  symbolCode: string;
  name: string;
  assetType: AssetType;
  region: MarketRegion;
  latestPrice: number;
  priceData: {
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    date: string;
  };
  matchedConditions: string[];
  calculatedIndicators: Record<string, number>;
}

export interface SymbolScreenResponseDto {
  id: string;
  ok: boolean;
  shareId?: string | null;
  symbols: ScreenedSymbolDto[];
  totalCount: number;
  hasMore: boolean;
  membershipInfo: {
    isMember: boolean;
    displayedCount: number; // 實際顯示筆數
    totalCount: number; // 總符合筆數
    remainingCredits?: number; // 剩餘點數（會員功能）
  };
  screenStats: {
    totalSymbols: number; // 總共處理的候選標的數量
    processedSymbols: number; // 實際處理完成的標的數量
    matchedSymbols: number; // 符合條件的標的數量
    errorSymbols: number; // 處理失敗的標的數量
    successRate: string; // 處理成功率（百分比字串）
    matchRate: string; // 符合條件比率（百分比字串）
  };
  executionTime: number;
  screenParams: {
    conditions: ConditionGroup;
    regions?: MarketRegion[];
    assetTypes?: string[];
    screenDate: string;
    labels?: string[];
  };
  timestamp: Date;
  message?: string;
}

