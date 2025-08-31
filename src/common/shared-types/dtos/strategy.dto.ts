import { AggregatedStrategyParameters, AssetType, ConditionGroup, MarketRegion, StrategyStatus, StrategyType } from '..';

export interface CreateStrategyDto {
  name: string;
  description?: string;
  type: StrategyType;
  status: StrategyStatus;
  parameters: AggregatedStrategyParameters;
  userId: string;
  portfolioIds: string[];
}

export interface UpdateStrategyDto {
  name?: string;
  parameters?: AggregatedStrategyParameters;
  portfolioIds?: string[];
}

