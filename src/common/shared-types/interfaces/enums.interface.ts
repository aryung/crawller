export enum TrendDirection {
  UP = 'UP',
  DOWN = 'DOWN',
  FLAT = 'FLAT',
}

export enum SignalReason {
  TAKE_PROFIT = 'TAKE_PROFIT',
  STOP_LOSS = 'STOP_LOSS',
  BUY_SIGNAL = 'BUY_SIGNAL',
  SELL_SIGNAL = 'SELL_SIGNAL',
}

// 條件類型枚舉
export enum ConditionType {
  COMPARISON = 'COMPARISON', // 比較：>, <, =, >=, <=
  CROSSOVER = 'CROSSOVER', // 交叉：向上穿越、向下穿越
  RANGE = 'RANGE', // 區間：在某範圍內
  CHANGE = 'CHANGE', // 變化：漲跌幅
  CONSECUTIVE = 'CONSECUTIVE', // 連續：連續N天滿足條件
}

// 比較運算符枚舉
export enum ComparisonOperator {
  GT = '>', // 大於
  GTE = '>=', // 大於等於
  LT = '<', // 小於
  LTE = '<=', // 小於等於
  EQ = '==', // 等於
  NEQ = '!=', // 不等於
}

// 用戶角色枚舉
export enum UserRole {
  GUEST = 'GUEST',
  USER = 'USER',
  ADMIN = 'ADMIN',
  SUPER_ADMIN = 'SUPER_ADMIN',
}

// 價格類型枚舉
export enum PriceType {
  CLOSE = 'close',
  OPEN = 'open',
  HIGH = 'high',
  LOW = 'low',
  VOLUME = 'volume',
}

// 通道類型枚舉
export enum BandType {
  UPPER = 'upper',
  MIDDLE = 'middle',
  LOWER = 'lower',
}

// 線型枚舉
export enum LineType {
  MAIN = 'main',
  SIGNAL = 'signal',
  HISTOGRAM = 'histogram',
}

// 條件類型枚舉 (Alert 相關)
export enum AlertConditionType {
  INLINE = 'INLINE',
  REFERENCE = 'REFERENCE',
}

// 系統狀態枚舉
export enum SystemHealthStatus {
  HEALTHY = 'healthy',
  WARNING = 'warning',
  ERROR = 'error',
}

// 快速條件參數類型枚舉
export enum QuickConditionParameterType {
  PERIOD = 'period',
  THRESHOLD = 'threshold',
  RATIO = 'ratio',
  PERCENTAGE = 'percentage',
  DIRECTION = 'direction',
  SCORE = 'score',
}

// 止損止盈類型枚舉
export enum StopLossType {
  PERCENTAGE = 'percentage',
  ATR = 'atr',
}

// MA 評分方式枚舉
export enum MAPositionScoringType {
  BINARY = 'BINARY',
  WEIGHTED = 'WEIGHTED',
}

// 通知位置枚舉
export enum ToastPosition {
  TOP_END = 'top-end',
  TOP_CENTER = 'top-center',
  BOTTOM_END = 'bottom-end',
  BOTTOM_CENTER = 'bottom-center',
}
