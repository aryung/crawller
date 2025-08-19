import { UserEntity } from '../entities/user.interface';
import { PortfolioEntity } from '../entities/portfolio.interface';
import { EntityLabelEntity } from '../entities/entity-label.interface';
import { LabelEntity } from '../entities/label.interface';
import { AggregatedStrategyParameters, StrategyStatus, StrategyType, TradeRecommendation } from '..';

export interface StrategyEntity {
  id: string;
  name: string;
  type: StrategyType;
  parameters: AggregatedStrategyParameters;
  executionHistorySummary?: {
    totalExecutions: number;
    successCount: number;
    failureCount: number;
    lastSuccessTime?: Date;
    lastFailureTime?: Date;
    rebalanceCount: number;
    performanceSummary?: {
      winRate: number;
      averageReturn: number;
      maxDrawdown: number;
    };
  };
  status: StrategyStatus;
  lastExecutionTime: Date;
  executionResults: {
    success: boolean;
    recommendations?: TradeRecommendation[];
    message?: string;
    timestamp: Date;
  }[];
  createdAt?: Date;
  updatedAt: Date;
  user: UserEntity;
  portfolios?: PortfolioEntity[];
  entityLabels?: EntityLabelEntity[];
  labels?: LabelEntity[];
}
