import { ErrorCode } from './error.interface';
import { ConditionGroup } from './condition.interface';
import { AssetType } from './position.interface';
import { StopLossType } from './enums.interface';

// enum 定義
export enum StrategyType {
  FIVE_LINE = 'FIVE_LINE',
  GRID_TRADING = 'GRID_TRADING',
  ASSET_ALLOCATION = 'ASSET_ALLOCATION',
  INDICATOR_SIGNAL = 'INDICATOR_SIGNAL',
}

export enum TradeRecommendationPositionAction {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
}

export enum PositionSizingMethod {
  PERCENT = 'PERCENT',
  FIXED = 'FIXED',
  KELLY = 'KELLY',
}

export enum PositionAction {
  BUY = 'BUY',
  SELL = 'SELL',
}

export enum Frequency {
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
  QUARTERLY = 'QUARTERLY',
  HALF_YEARLY = 'HALF_YEARLY',
  YEARLY = 'YEARLY',
}

export enum StrategyStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  TESTING = 'TESTING',
  ERROR = 'ERROR',
  LIVE = 'LIVE',
  PAUSED = 'PAUSED',
  ARCHIVED = 'ARCHIVED',
}

// interface 定義
/**
 * 策略接口
 */
export interface IStrategy {
  execute(payload: {
    strategy: any; // StrategyEntity; // 暫時使用 any 避免循環依賴
    options: {
      userId: string;
    } & StrategyExecuteOptions;
  }): Promise<StrategyRunResult>;
}

export interface StrategyRunResult {
  ok: boolean;
  errorCode?: ErrorCode;
  strategyId: string;
  recommendations: Array<TradeRecommendation> | null;
  timestamp: Date;
  // message?: string;
  performance: Record<string, PerformanceDimension> | null;
}

export interface RecommandationStrategy {
  id: string;
  name: string;
  parameters: AggregatedStrategyParameters;
}

export interface RecommandationPortfolio {
  id: string;
  name: string;
  cashBalance: number;
  positions: RecommandationPosition[] | null;
}

export interface RecommandationOhlcv {
  id: string;
  symbolCode: string;
  date: Date;
  close: number;
}

export interface RecommandationPosition {
  id: string;
  symbolCode: string;
  costBasis: number;
  quantity: number;
  assetType: AssetType;
}

export interface TradeRecommendation {
  portfolio: RecommandationPortfolio; // 投資組合ID
  position: RecommandationPosition; // 原始持倉
  ohlcv: RecommandationOhlcv; // 原始持倉
  action: PositionAction; // 交易動作
  tradeQuantity: number;
  cashImpact: number;
  message?: string; // 建議原因
  metadata?: Record<string, unknown>; // 其他元數據
}

export interface AssetAllocation {
  equity: number;
  fixedIncome: number;
  cash: number;
  others: number;
}

export enum StopLossOrTakeProfitType {
  PERCENTAGE = 'PERCENTAGE',
  // ATR = 'ATR',
  // FIXED_PRICE = 'FIXED_PRICE',
  // RISK_REWARD = 'RISK_REWARD',
}

export interface RiskParameters {
  maxDrawdown: number;
  maxPositionSize: number;
  minCashReserve: number;
  cashThreshold: number;
  stopLoss: {
    type: StopLossOrTakeProfitType; // default percentage
    enabled: boolean; // 是否啟用止損
    value: number; // 止損百分比 (0-1)
  };
  takeProfit: {
    type: StopLossOrTakeProfitType; // default percentage
    enabled: boolean; // 是否啟用止盈
    value: number; // 止盈百分比 (0-1)
  };
  // 移動停損
  trailingStop?: {
    type: StopLossType; // default percentage
    enabled: boolean;
    value: number;
    activationProfit?: number; // 獲利多少後開始移動停損
  };
}

export interface PerformanceDimension {
  totalReturn: number;
  annualizedReturn: number;
  volatility: number;
  sharpeRatio: number;
  maxDrawdown: number;
}

export interface StrategyExecuteOptionsDto {
  startDate?: string | null;
  endDate: string;
  // dryRun: boolean;
  portfolioIds?: string[] | null;
}

/**
 * Strategy execute 方法的選項
 */
export type StrategyExecuteOptions = {
  userId: string;
} & StrategyExecuteOptionsDto & {
    frequency: Frequency;
  };

// export type Expression = ConditionExpression | GroupExpression;

// export interface IndicatorInfo {
//   type: IndicatorType; // 指标类型
//   period?: number; // 周期参数
//   parameters?: number[]; // 其他可能的参数（如MACD可能有多个参数）
//   original: string; // 原始字符串表示
// }

// 條件表達式類型
// export interface BaseExpression {
//   type: 'condition' | 'group';
// }

// 單一條件表達式(如 SMA_20 > 1)
// export interface ConditionExpression extends BaseExpression {
//   type: 'condition';
//   indicator: IndicatorInfo; // 指標名稱，如 "SMA_20", "RSI_10"
//   operator: ComparisonOperator;
//   value: number; // 比較值
// }

// 組合表達式(如 AND, OR)
// export interface GroupExpression extends BaseExpression {
//   type: 'group';
//   operator: 'AND' | 'OR';
//   expressions: Expression[]; // 子表達式數組
// }

export enum BuySellCashType {
  PERCENTAGE = 'PERCENTAGE',
  FIXED = 'FIXED',
}

/**
 * 策略參數基礎介面
 */
export interface StrategyBaseParameters {
  commission?: number; // 交易佣金費率
  slippage?: number; // 滑價設置
  rebalancingFrequency: Frequency; // 再平衡頻率
  riskParameters: RiskParameters;
  buySellCashAmount: {
    type: BuySellCashType; // 買賣現金類型
    buy: number; // 買入現金百分比 (0-1) 或固定一筆錢買入(數字)
    sell: number; // 賣出現金百分比 (0-1) 或固定一筆錢賣出(數字)
  };
}

// 更新 IndicatorSignalParameters 接口
export interface IndicatorSignalParameters extends StrategyBaseParameters {
  // 新版結構化條件支援
  structuredConditions: {
    entry: ConditionGroup;
    exit?: ConditionGroup;
  };
}

// 資產配置策略參數 (沒有 buySellCashAmout 的設定)
export interface AssetAllocationParameters extends StrategyBaseParameters {
  // extends Omit<StrategyBaseParameters, 'buySellCashAmount'> {
  // 目標資產配置比例
  targetAllocation: {
    equity: number; // 股票比例 (0-1)
    fixedIncome: number; // 債券比例 (0-1)
    cash: number; // 現金比例 (0-1)
    others: number; // 其他資產比例 (0-1)
  };
}

export enum FiveLineSignalLine {
  VERY_PESSIMISTIC = 'VERY_PESSIMISTIC',
  PESSIMISTIC = 'PESSIMISTIC',
  TREND = 'TREND',
  OPTIMISTIC = 'OPTIMISTIC',
  VERY_OPTIMISTIC = 'VERY_OPTIMISTIC',
}

// 五線譜策略參數
export interface FiveLineParameters extends StrategyBaseParameters {
  // 指標設定
  period: number; // 計算週期 (例如: 120天)
  smoothing: number; // 平滑係數 (0-1)
}

// 網格交易策略參數
export interface GridTradingParameters extends StrategyBaseParameters {
  // 網格設定
  gridCount: number; // 網格數量
  upperLimit: number; // 上限價格
  lowerLimit: number; // 下限價格
  autoAdjustGrid: boolean; // 是否自動調整網格
}

export type AggregatedStrategyParameters =
  | AssetAllocationParameters
  | FiveLineParameters
  | GridTradingParameters
  | IndicatorSignalParameters;
