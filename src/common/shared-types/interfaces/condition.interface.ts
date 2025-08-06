import { IndicatorType, IndicatorParameter } from './indicator.interface';
import { ConditionType, ComparisonOperator } from './enums.interface';

// 邏輯運算符
export enum LogicalOperator {
  AND = 'AND',
  OR = 'OR',
  NOT = 'NOT',
}

// 交叉類型
export enum CrossoverType {
  CROSS_ABOVE = 'CROSS_ABOVE', // 向上穿越
  CROSS_BELOW = 'CROSS_BELOW', // 向下穿越
  CROSS_ANY = 'CROSS_ANY',
}

export enum ScopeType {
  SYMBOL_SPECIFIC = 'SYMBOL_SPECIFIC',
  SYMBOL_LIST = 'SYMBOL_LIST',
  MARKET_WIDE = 'MARKET_WIDE',
}

// 指標參考
export interface IndicatorReference {
  name: IndicatorType; // 指標名稱：'SMA', 'RSI', 'MACD', 'BOLLINGER', 'CLOSE', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY'
  params?: IndicatorParameter; // 參數：{ period: 20 }
  offset?: number; // 時間偏移：0=當前，-1=前一個
}

// 單一條件
export interface SingleCondition {
  id: string;
  type: ConditionType;
  left: IndicatorReference | number;
  operator?: ComparisonOperator | CrossoverType;
  right?: IndicatorReference | number;
  // 用於 RANGE 類型
  min?: number;
  max?: number;
  // 用於 CHANGE 類型
  changePercent?: number;
  changePeriod?: number;
  // 用於 CONSECUTIVE 類型
  consecutivePeriods?: number; // 連續幾天/週期
  baseCondition?: SingleCondition; // 要連續滿足的基礎條件
  // 用於 CROSSOVER 類型
  lookbackDays?: number; // 穿越檢測回溯天數（當 type === 'CROSSOVER' 時為必填）
}

// 條件組（支援嵌套）

export interface ConditionGroup {
  id: string;
  operator: LogicalOperator;
  conditions: (SingleCondition | ConditionGroup)[];
}

// 完整策略定義

export interface StrategyDefinition {
  id: string;
  name: string;
  description?: string;
  entryConditions: ConditionGroup;
  exitConditions?: ConditionGroup;
  stopLoss?: number; // 止損百分比
  takeProfit?: number; // 止盈百分比
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}
