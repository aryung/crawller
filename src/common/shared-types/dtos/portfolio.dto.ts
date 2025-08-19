import { RiskParameters, AssetAllocation, StrategyBaseParameters, StrategyType, AssetAllocationParameters, FiveLineParameters, GridTradingParameters } from '..';

export interface CreatePortfolioDto {
  name: string;
  assetAllocation?: AssetAllocation;
  cashBalance?: number;
  riskParameters?: RiskParameters;
  userId?: string;
  strategyId?: string;
  strategyName?: string;
  strategyType?: StrategyType;
  strategyParameters?: StrategyBaseParameters;
}

export interface UpdatePortfolioDto {
  name?: string;
  assetAllocation?: AssetAllocation;
  cashBalance?: number;
  totalValue?: number;
  riskParameters?: RiskParameters;
  strategyId?: string;
  strategyParameters?: | AssetAllocationParameters | FiveLineParameters | GridTradingParameters;
}

