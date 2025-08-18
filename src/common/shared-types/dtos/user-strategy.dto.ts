import { RiskParameters, StrategyType } from '..';
import { IndicatorType } from '..';
import { IndicatorParameter } from '..';
import { ComparisonOperator, ConditionType, CrossoverType, LogicalOperator } from '..';

export interface CreateUserStrategyDto {
  name: string;
  description?: string;
  type: StrategyType;
  entryRules: UserConditionDto[];
  exitRules?: UserConditionDto[];
  riskManagements?: RiskParameters;
  enabled?: boolean;
}

export interface UserConditionDto {
  type: ConditionType;
  indicator1: IndicatorSelectDto;
  operator: ComparisonOperator | CrossoverType;
  compareWith: IndicatorSelectDto | number;
  logicOperator?: LogicalOperator;
  group?: number;
  min?: number;
  max?: number;
  changePercent?: number;
  changePeriod?: number;
}

export interface IndicatorSelectDto {
  type: IndicatorType;
  params?: IndicatorParameter;
  offset?: number;
}

export interface YoyoDto {
  type: string;
}

