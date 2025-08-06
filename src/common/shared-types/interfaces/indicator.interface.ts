import { MAPositionScoringType } from './enums.interface';

export enum IndicatorType {
  // 技術分析指標
  SMA = 'SMA', // 簡單移動平均線
  EMA = 'EMA', // 指數移動平均線
  RSI = 'RSI', // 相對強弱指標
  MACD = 'MACD', // 移動平均收斂散度
  BOLLINGER = 'BOLLINGER', // 布林帶
  CLOSE = 'CLOSE', // 收盤價
  VOLUME = 'VOLUME', // 成交量
  WEEKLY = 'WEEKLY', // 週線
  MONTHLY = 'MONTHLY', // 月線
  QUARTERLY = 'QUARTERLY', // 季線
  YEARLY = 'YEARLY', // 年線
  PERIOD_CHANGE = 'PERIOD_CHANGE', // 週期變化率 (參數化: 1=日, 5=週, 20=月)
  DEVIATION_RATE = 'DEVIATION_RATE', // 乖離率 (價格相對於移動平均線的乖離程度)
  MA_POSITION = 'MA_POSITION', // 移動平均位置判斷 (價格相對於多條移動平均線的位置)

  // 基本面指標 - 估值指標
  PE_RATIO = 'PE_RATIO', // 本益比 (Price-to-Earnings Ratio)
  PB_RATIO = 'PB_RATIO', // 股價淨值比 (Price-to-Book Ratio)
  PS_RATIO = 'PS_RATIO', // 股價營收比 (Price-to-Sales Ratio)
  PEG_RATIO = 'PEG_RATIO', // PEG比率 (PE/Growth Ratio)
  EV_EBITDA = 'EV_EBITDA', // 企業價值倍數
  DIVIDEND_YIELD = 'DIVIDEND_YIELD', // 股息殖利率

  // 基本面指標 - 獲利能力指標
  ROE = 'ROE', // 股東權益報酬率 (Return on Equity)
  ROA = 'ROA', // 資產報酬率 (Return on Assets)
  GROSS_MARGIN = 'GROSS_MARGIN', // 毛利率
  OPERATING_MARGIN = 'OPERATING_MARGIN', // 營業利益率
  NET_MARGIN = 'NET_MARGIN', // 淨利率
  EPS = 'EPS', // 每股盈餘

  // 基本面指標 - 財務結構指標
  DEBT_TO_EQUITY = 'DEBT_TO_EQUITY', // 負債權益比
  CURRENT_RATIO = 'CURRENT_RATIO', // 流動比率
  QUICK_RATIO = 'QUICK_RATIO', // 速動比率
  DEBT_RATIO = 'DEBT_RATIO', // 負債比率
  INTEREST_COVERAGE = 'INTEREST_COVERAGE', // 利息保障倍數

  // 基本面指標 - 成長性指標
  REVENUE_GROWTH = 'REVENUE_GROWTH', // 營收成長率
  EPS_GROWTH = 'EPS_GROWTH', // 每股盈餘成長率
  NET_INCOME_GROWTH = 'NET_INCOME_GROWTH', // 淨利成長率
  BOOK_VALUE_GROWTH = 'BOOK_VALUE_GROWTH', // 每股淨值成長率
  DIVIDEND_GROWTH = 'DIVIDEND_GROWTH', // 股利成長率

  // 基本面指標 - 股利相關指標
  DIVIDEND_PAYOUT_RATIO = 'DIVIDEND_PAYOUT_RATIO', // 股利發放率

  // 基本面指標 - 現金流指標
  FREE_CASH_FLOW = 'FREE_CASH_FLOW', // 自由現金流
  OPERATING_CASH_FLOW = 'OPERATING_CASH_FLOW', // 營運現金流
  FCF_YIELD = 'FCF_YIELD', // 自由現金流殖利率

  // 基本面指標 - 周轉率指標
  INVENTORY_TURNOVER = 'INVENTORY_TURNOVER', // 存貨周轉率
  RECEIVABLES_TURNOVER = 'RECEIVABLES_TURNOVER', // 應收帳款周轉率
  ASSET_TURNOVER = 'ASSET_TURNOVER', // 資產周轉率
  EQUITY_TURNOVER = 'EQUITY_TURNOVER', // 權益周轉率

  // 基本面指標 - 市場數據
  MARKET_CAP = 'MARKET_CAP', // 市值
  BOOK_VALUE_PER_SHARE = 'BOOK_VALUE_PER_SHARE', // 每股淨值

  // 基本面指標 - 快捷鍵專用 (0-4分評分)
  REVENUE_GROWTH_SCORE = 'REVENUE_GROWTH_SCORE', // 營收年增率分數
  OPERATING_MARGIN_SCORE = 'OPERATING_MARGIN_SCORE', // 營業利益率分數
  NET_MARGIN_SCORE = 'NET_MARGIN_SCORE', // 稅後淨利率分數
  EPS_GROWTH_SCORE = 'EPS_GROWTH_SCORE', // EPS年增率分數
  INVENTORY_TURNOVER_SCORE = 'INVENTORY_TURNOVER_SCORE', // 存貨周轉率分數
  FREE_CASH_FLOW_SCORE = 'FREE_CASH_FLOW_SCORE', // 自由現金流量分數

  // 動能指標 (Momentum Indicators)
  KD_STOCHASTIC = 'KD_STOCHASTIC', // KD 隨機指標
  WILLIAMS_R = 'WILLIAMS_R', // 威廉指標 (%R)
  CCI = 'CCI', // 商品通道指數 (Commodity Channel Index)
  OBV = 'OBV', // 能量潮指標 (On-Balance Volume)
  AD_LINE = 'AD_LINE', // 累積/派發線 (Accumulation/Distribution Line)
  MFI = 'MFI', // 資金流量指標 (Money Flow Index)

  // 波動性指標 (Volatility Indicators)
  HV = 'HV', // 歷史波動率 (Historical Volatility)

  // 一目均衡表指標 (Ichimoku Kinko Hyo)
  ICHIMOKU_CLOUD = 'ICHIMOKU_CLOUD', // 一目均衡表雲帶

  // 風險指標 (Risk Indicators)
  BETA = 'BETA', // β值 (Beta)

  // 配當指標 (Dividend Indicators)
  DIVIDEND_AMOUNT = 'DIVIDEND_AMOUNT', // 配當金額

  // 複合趨勢指標 (Composite Trend Indicators)
  TREND_ALIGNMENT_BULLISH = 'TREND_ALIGNMENT_BULLISH', // 多均線看漲排列
  TREND_ALIGNMENT_BEARISH = 'TREND_ALIGNMENT_BEARISH', // 多均線看跌排列
  MOMENTUM_TREND_BULLISH = 'MOMENTUM_TREND_BULLISH', // 動量確認上升趨勢
  MOMENTUM_TREND_BEARISH = 'MOMENTUM_TREND_BEARISH', // 動量確認下降趨勢
  MULTI_TIMEFRAME_BULLISH = 'MULTI_TIMEFRAME_BULLISH', // 多時間框架看漲
  MULTI_TIMEFRAME_BEARISH = 'MULTI_TIMEFRAME_BEARISH', // 多時間框架看跌
}

export enum SignalIndicatorType {
  // SMA 相關信號
  SMA_GOLDEN_CROSS_20_50 = 'SMA_GOLDEN_CROSS_20_50',
  SMA_DEATH_CROSS_20_50 = 'SMA_DEATH_CROSS_20_50',
  SMA_GOLDEN_CROSS_50_200 = 'SMA_GOLDEN_CROSS_50_200',
  SMA_DEATH_CROSS_50_200 = 'SMA_DEATH_CROSS_50_200',

  // EMA 相關信號
  EMA_GOLDEN_CROSS_9_21 = 'EMA_GOLDEN_CROSS_9_21',
  EMA_DEATH_CROSS_9_21 = 'EMA_DEATH_CROSS_9_21',

  // MACD 相關信號
  MACD_HISTOGRAM_POSITIVE = 'MACD_HISTOGRAM_POSITIVE',
  MACD_HISTOGRAM_NEGATIVE = 'MACD_HISTOGRAM_NEGATIVE',

  // RSI 相關信號
  RSI_OVERBOUGHT = 'RSI_OVERBOUGHT',
  RSI_OVERSOLD = 'RSI_OVERSOLD',

  // 動能指標信號
  KD_GOLDEN_CROSS = 'KD_GOLDEN_CROSS', // KD指標黃金交叉
  KD_DEATH_CROSS = 'KD_DEATH_CROSS', // KD指標死亡交叉
  KD_OVERBOUGHT = 'KD_OVERBOUGHT', // KD指標超買
  KD_OVERSOLD = 'KD_OVERSOLD', // KD指標超賣
  WILLIAMS_R_OVERBOUGHT = 'WILLIAMS_R_OVERBOUGHT', // 威廉指標超買
  WILLIAMS_R_OVERSOLD = 'WILLIAMS_R_OVERSOLD', // 威廉指標超賣
  CCI_OVERBOUGHT = 'CCI_OVERBOUGHT', // CCI超買
  CCI_OVERSOLD = 'CCI_OVERSOLD', // CCI超賣
  OBV_DIVERGENCE_POSITIVE = 'OBV_DIVERGENCE_POSITIVE', // OBV正背離
  OBV_DIVERGENCE_NEGATIVE = 'OBV_DIVERGENCE_NEGATIVE', // OBV負背離
  MFI_OVERBOUGHT = 'MFI_OVERBOUGHT', // MFI超買
  MFI_OVERSOLD = 'MFI_OVERSOLD', // MFI超賣

  // 不同時間框架的交叉信號
  // 日線與周線
  DAILY_WEEKLY_GOLDEN_CROSS = 'DAILY_WEEKLY_GOLDEN_CROSS',
  DAILY_WEEKLY_DEATH_CROSS = 'DAILY_WEEKLY_DEATH_CROSS',

  // 周線與雙周線
  WEEKLY_BIWEEKLY_GOLDEN_CROSS = 'WEEKLY_BIWEEKLY_GOLDEN_CROSS',
  WEEKLY_BIWEEKLY_DEATH_CROSS = 'WEEKLY_BIWEEKLY_DEATH_CROSS',

  // 雙周線與月線
  BIWEEKLY_MONTHLY_GOLDEN_CROSS = 'BIWEEKLY_MONTHLY_GOLDEN_CROSS',
  BIWEEKLY_MONTHLY_DEATH_CROSS = 'BIWEEKLY_MONTHLY_DEATH_CROSS',

  // 周線與月線
  WEEKLY_MONTHLY_GOLDEN_CROSS = 'WEEKLY_MONTHLY_GOLDEN_CROSS',
  WEEKLY_MONTHLY_DEATH_CROSS = 'WEEKLY_MONTHLY_DEATH_CROSS',

  // 日線與月線
  DAILY_MONTHLY_GOLDEN_CROSS = 'DAILY_MONTHLY_GOLDEN_CROSS',
  DAILY_MONTHLY_DEATH_CROSS = 'DAILY_MONTHLY_DEATH_CROSS',

  // 月線與季線
  MONTHLY_QUARTERLY_GOLDEN_CROSS = 'MONTHLY_QUARTERLY_GOLDEN_CROSS',
  MONTHLY_QUARTERLY_DEATH_CROSS = 'MONTHLY_QUARTERLY_DEATH_CROSS',

  // 季線與年線
  QUARTERLY_YEARLY_GOLDEN_CROSS = 'QUARTERLY_YEARLY_GOLDEN_CROSS',
  QUARTERLY_YEARLY_DEATH_CROSS = 'QUARTERLY_YEARLY_DEATH_CROSS',
}

export interface IndicatorParameter {
  period?: number; // 週期
  targetPrice?: number; // 目標價格
  stdDev?: number; // 標準差倍數
  upperBound?: number; // 上界
  lowerBound?: number; // 下界
  increasePercentage?: number; // 上漲百分比
  decreasePercentage?: number; // 下跌百分比
  fastPeriod?: number; // 快速週期
  slowPeriod?: number; // 慢速週期
  signalPeriod?: number; // 信號週期
  line?: string; // 線型
  band?: string; // 通道
  multiplier?: number; // 倍數
  kPeriod?: number; // K線週期
  dPeriod?: number; // D線週期
  jPeriod?: number; // J線週期
  rsiPeriod?: number; // RSI週期
  macdPeriod?: number; // MACD週期
  macdFastPeriod?: number; // MACD快速週期
  macdSlowPeriod?: number; // MACD慢速週期
  indicatorParameter?: number; // 原本的 indicatorParameter 欄位
  lineIndex?: number; // 五線譜中的線索引 (0-4)
  priceType?: string; // 價格類型 (close, volume, high, low) - 用於 PERIOD_CHANGE

  // 動能指標專用參數
  kdKPeriod?: number; // KD指標 K線週期
  kdDPeriod?: number; // KD指標 D線週期
  kdSlowKPeriod?: number; // KD指標 SlowK週期
  williamsRPeriod?: number; // 威廉指標週期
  cciPeriod?: number; // CCI指標週期
  mfiPeriod?: number; // MFI指標週期
  typicalPricePeriod?: number; // 典型價格週期

  // 基本面指標專用參數
  fiscalPeriod?: string; // 財務報告期間 ('quarterly', 'annual')
  lookbackPeriods?: number; // 回溯期間數 (用於計算成長率等)

  // 營收年增率分數參數
  revenueGrowthThresholds?: [number, number, number, number]; // [1分, 2分, 3分, 4分] 門檻值 (如 [0.05, 0.10, 0.15, 0.20])

  // 營業利益率分數參數
  operatingMarginThresholds?: [number, number, number, number]; // [1分, 2分, 3分, 4分] 門檻值

  // 淨利率分數參數
  netMarginThresholds?: [number, number, number, number]; // [1分, 2分, 3分, 4分] 門檻值

  // EPS年增率分數參數
  epsGrowthThresholds?: [number, number, number, number]; // [1分, 2分, 3分, 4分] 門檻值

  // 存貨周轉率分數參數
  inventoryTurnoverThresholds?: [number, number, number, number]; // [1分, 2分, 3分, 4分] 門檻值

  // 自由現金流量分數參數 (相對於營收的比例)
  freeCashFlowThresholds?: [number, number, number, number]; // [1分, 2分, 3分, 4分] 門檻值

  // HV (歷史波動率) 指標專用參數
  hvPeriod?: number; // HV計算期間 (預設20日)
  hvAnnualized?: boolean; // 是否年化處理 (預設true)
  tradingDaysPerYear?: number; // 每年交易日數 (預設252日)

  // 一目均衡表 (Ichimoku) 指標專用參數
  ichimokuTenkanPeriod?: number; // 轉換線期間 (預設9日)
  ichimokuKijunPeriod?: number; // 基準線期間 (預設26日)
  ichimokuSenkouBPeriod?: number; // 先行帶B期間 (預設52日)
  ichimokuChikouDisplacement?: number; // 遲行帶位移 (預設26日)
  ichimokuSenkouDisplacement?: number; // 先行帶位移 (預設26日)
  ichimokuCloudComponent?: string; // 雲帶組件 ('senkou_a', 'senkou_b', 'cloud_top', 'cloud_bottom')

  // β值 (Beta) 指標專用參數
  betaPeriod?: number; // β值計算週期 (預設252日，約一年)
  betaBenchmark?: string; // 基準指數代碼 (預設使用大盤指數)
  betaRiskFreeRate?: number; // 無風險利率 (預設0，可選)

  // 配當金額 (Dividend Amount) 指標專用參數
  dividendPeriod?: string; // 配當期間 ('quarterly', 'annual', 'latest')
  dividendType?: string; // 配當類型 ('cash', 'stock', 'total')

  // 複合趨勢指標專用參數
  trendMaShort?: number; // 短期均線期間 (預設20日)
  trendMaMedium?: number; // 中期均線期間 (預設50日)
  trendMaLong?: number; // 長期均線期間 (預設200日)
  trendEmaFast?: number; // 快速EMA期間 (預設12日)
  trendEmaSlow?: number; // 慢速EMA期間 (預設26日)
  trendRsiPeriod?: number; // 趨勢RSI期間 (預設14日)
  trendAdxPeriod?: number; // 趨勢ADX期間 (預設14日)
  trendAdxThreshold?: number; // ADX強度閾值 (預設25)
  trendMomentumThreshold?: number; // 動量閾值 (預設50)

  // 乖離率 (Deviation Rate) 指標專用參數
  deviationMaType?: IndicatorType.SMA | IndicatorType.EMA; // 移動平均類型 (預設SMA)
  deviationMaPeriod?: number; // 移動平均期間 (預設20日)
  deviationAbsolute?: boolean; // 是否使用絕對值 (預設false)

  // 移動平均位置判斷 (MA Position) 指標專用參數
  maPositionPeriods?: number[]; // 移動平均期間陣列 (預設[5, 10, 20, 60])
  maPositionType?: IndicatorType.SMA | IndicatorType.EMA; // 移動平均類型 (預設SMA)
  maPositionScoring?: MAPositionScoringType; // 評分方式 (預設BINARY)
}
