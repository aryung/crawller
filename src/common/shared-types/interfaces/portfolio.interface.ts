import { AssetAllocation, PerformanceDimension } from './strategy.interface';

export interface PortfolioParameters {
  assetAllocation: AssetAllocation;
}

export interface PortfolioPerformance {
  strategyId: string;
  portfolioId: string;
  name?: string;
  period: {
    start: Date;
    end: Date;
  };
  performance: PerformanceDimension;
  dailyValues?: Array<{
    date: Date;
    value: number;
  }>;
  lastUpdated: Date;
}
