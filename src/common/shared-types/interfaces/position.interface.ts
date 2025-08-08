export interface PositionPerformance {
  positionId: string;
  symbol: string;
  assetType: AssetType;
  quantity: number;
  purchaseDate: Date;
  costBasis: number;
  currentPrice: number;
  marketValue: number;
  totalReturn: number;
  annualizedReturn: number;
  volatility: number;
  dailyReturns?: number[];
  dailyPerformance?: {
    date: Date;
    price: number;
    percentChange: number;
  }[];
  maxDrawdown?: number;
  unrealizedPnL?: number;
  lastUpdated?: Date;
}

export enum AssetType {
  EQUITY = 'EQUITY', // 股票類
  ETF = 'ETF', // ETF
  FUND = 'FUND', // 基金
  BOND = 'BOND', // 債券
  FIXED_INCOME = 'FIXED_INCOME', // 固定收益類
  COMMODITY = 'COMMODITY', // 商品類
  CASH = 'CASH', // 現金類
  MONEY_MARKET = 'MONEY_MARKET', // 貨幣市場類
  MIXED = 'MIXED', // 混合類
  CRYPTOCURRENCY = 'CRYPTOCURRENCY', // 加密貨幣類
  OTHER = 'OTHER',
}
