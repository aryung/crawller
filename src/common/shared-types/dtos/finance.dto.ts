import { StrategyBaseParameters } from '..';

export interface BacktestDto {
  strategyId: string;
  startDate: Date;
  endDate: Date;
  initialCapital: number;
  parameters?: StrategyBaseParameters;
}

export interface CreateUserDto {
  username: string;
  email: string;
  password?: string;
}

export interface OptimizationDto {
  // 預留給未來的參數
  readonly [key: string]: unknown;
}

export interface SimpleUserDto {
  name: string;
  email: string;
  chatId?: string;
}

