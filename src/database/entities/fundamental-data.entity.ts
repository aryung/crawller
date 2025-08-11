import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { SymbolEntity } from './symbol.entity';
import { FiscalReportType } from '../../common/shared-types';

@Entity('fundamental_data')
@Index('IDX_fundamental_data_symbol_exchange', ['symbolCode', 'exchangeArea'])
@Index('IDX_fundamental_data_fiscal_period', [
  'symbolCode',
  'fiscalYear',
  'fiscalMonth',
  'reportType',
])
@Index(
  'IDX_fundamental_data_monthly',
  ['symbolCode', 'fiscalYear', 'fiscalMonth'],
  {
    where: "report_type = 'monthly'",
  }
)
export class FundamentalDataEntity {
  @PrimaryColumn({
    type: 'uuid',
    default: () => 'uuid_generate_v4()', // 明確指定資料庫使用此函數作為預設值
  })
  id!: string;

  @Column({
    name: 'symbol_code',
    type: 'varchar',
    nullable: false,
  })
  @Index()
  symbolCode!: string;

  @Column({
    name: 'exchange_area',
    type: 'varchar',
    nullable: false,
  })
  @Index()
  exchangeArea!: string;

  @Column({
    name: 'report_date',
    type: 'date',
  })
  @Index()
  reportDate!: Date;

  @Column({
    name: 'fiscal_year',
    type: 'integer',
  })
  @Index()
  fiscalYear!: number;

  @Column({
    name: 'fiscal_month',
    type: 'integer',
    nullable: true,
    comment:
      '財務月份: quarterly(1-4表示Q1-Q4), monthly(1-12), annual(12), half-yearly(2或4)',
  })
  @Index()
  fiscalMonth?:number;

  @Column({
    name: 'report_type',
    type: 'varchar',
    default: FiscalReportType.MONTHLY,
  })
  @Index()
  reportType!: FiscalReportType;

  // === 損益表指標 (Income Statement) ===
  @Column({
    name: 'revenue',
    type: 'decimal',
    precision: 15,
    scale: 2,
    nullable: true,
  })
  revenue?: number; // 營業收入

  @Column({
    name: 'cost_of_goods_sold',
    type: 'decimal',
    precision: 15,
    scale: 2,
    nullable: true,
  })
  costOfGoodsSold?: number; // 銷貨成本

  @Column({
    name: 'gross_profit',
    type: 'decimal',
    precision: 15,
    scale: 2,
    nullable: true,
  })
  grossProfit?: number; // 毛利

  @Column({
    name: 'operating_expenses',
    type: 'decimal',
    precision: 15,
    scale: 2,
    nullable: true,
  })
  operatingExpenses?: number; // 營業費用

  @Column({
    name: 'operating_income',
    type: 'decimal',
    precision: 15,
    scale: 2,
    nullable: true,
  })
  operatingIncome?: number; // 營業利益

  @Column({
    name: 'interest_expense',
    type: 'decimal',
    precision: 15,
    scale: 2,
    nullable: true,
  })
  interestExpense?: number; // 利息費用

  @Column({
    name: 'tax_expense',
    type: 'decimal',
    precision: 15,
    scale: 2,
    nullable: true,
  })
  taxExpense?: number; // 所得稅費用

  @Column({
    name: 'income_before_tax',
    type: 'decimal',
    precision: 15,
    scale: 2,
    nullable: true,
  })
  incomeBeforeTax?: number; // 稅前淨利

  @Column({
    name: 'income_tax',
    type: 'decimal',
    precision: 15,
    scale: 2,
    nullable: true,
  })
  incomeTax?: number; // 所得稅

  @Column({
    name: 'net_income',
    type: 'decimal',
    precision: 15,
    scale: 2,
    nullable: true,
  })
  netIncome?: number; // 淨利

  @Column({
    name: 'ebitda',
    type: 'decimal',
    precision: 15,
    scale: 2,
    nullable: true,
  })
  ebitda?: number; // 稅息折舊及攤銷前利潤

  @Column({
    name: 'eps',
    type: 'decimal',
    precision: 10,
    scale: 4,
    nullable: true,
  })
  eps?: number; // 每股盈餘

  @Column({
    name: 'diluted_eps',
    type: 'decimal',
    precision: 10,
    scale: 4,
    nullable: true,
  })
  dilutedEPS?: number; // 稀釋每股盈餘

  // === 資產負債表指標 (Balance Sheet) ===
  @Column({
    name: 'total_assets',
    type: 'decimal',
    precision: 15,
    scale: 2,
    nullable: true,
  })
  totalAssets?: number; // 總資產

  @Column({
    name: 'current_assets',
    type: 'decimal',
    precision: 15,
    scale: 2,
    nullable: true,
  })
  currentAssets?: number; // 流動資產

  @Column({
    name: 'inventory',
    type: 'decimal',
    precision: 15,
    scale: 2,
    nullable: true,
  })
  inventory?: number; // 存貨

  @Column({
    name: 'accounts_receivable',
    type: 'decimal',
    precision: 15,
    scale: 2,
    nullable: true,
  })
  accountsReceivable?: number; // 應收帳款

  @Column({
    name: 'total_liabilities',
    type: 'decimal',
    precision: 15,
    scale: 2,
    nullable: true,
  })
  totalLiabilities?: number; // 總負債

  @Column({
    name: 'current_liabilities',
    type: 'decimal',
    precision: 15,
    scale: 2,
    nullable: true,
  })
  currentLiabilities?: number; // 流動負債

  @Column({
    name: 'accounts_payable',
    type: 'decimal',
    precision: 15,
    scale: 2,
    nullable: true,
  })
  accountsPayable?: number; // 應付帳款

  @Column({
    name: 'shareholders_equity',
    type: 'decimal',
    precision: 15,
    scale: 2,
    nullable: true,
  })
  shareholdersEquity?: number; // 股東權益

  @Column({
    name: 'total_debt',
    type: 'decimal',
    precision: 15,
    scale: 2,
    nullable: true,
  })
  totalDebt?: number; // 總債務

  @Column({
    name: 'long_term_debt',
    type: 'decimal',
    precision: 15,
    scale: 2,
    nullable: true,
  })
  longTermDebt?: number; // 長期負債

  @Column({
    name: 'short_term_debt',
    type: 'decimal',
    precision: 15,
    scale: 2,
    nullable: true,
  })
  shortTermDebt?: number; // 短期負債

  @Column({
    name: 'cash_and_equivalents',
    type: 'decimal',
    precision: 15,
    scale: 2,
    nullable: true,
  })
  cashAndEquivalents?: number; // 現金及約當現金

  @Column({
    name: 'working_capital',
    type: 'decimal',
    precision: 15,
    scale: 2,
    nullable: true,
  })
  workingCapital?: number; // 營運資金

  @Column({
    name: 'book_value_per_share',
    type: 'decimal',
    precision: 10,
    scale: 4,
    nullable: true,
  })
  bookValuePerShare?: number; // 每股淨值

  @Column({
    name: 'property_plant_equipment',
    type: 'decimal',
    precision: 15,
    scale: 2,
    nullable: true,
  })
  propertyPlantEquipment?: number; // 不動產、廠房及設備

  @Column({
    name: 'intangible_assets',
    type: 'decimal',
    precision: 15,
    scale: 2,
    nullable: true,
  })
  intangibleAssets?: number; // 無形資產

  @Column({
    name: 'retained_earnings',
    type: 'decimal',
    precision: 15,
    scale: 2,
    nullable: true,
  })
  retainedEarnings?: number; // 保留盈餘

  // === 現金流量表指標 (Cash Flow Statement) ===
  @Column({
    name: 'operating_cash_flow',
    type: 'decimal',
    precision: 15,
    scale: 2,
    nullable: true,
  })
  operatingCashFlow?: number; // 營運現金流

  @Column({
    name: 'investing_cash_flow',
    type: 'decimal',
    precision: 15,
    scale: 2,
    nullable: true,
  })
  investingCashFlow?: number; // 投資現金流

  @Column({
    name: 'financing_cash_flow',
    type: 'decimal',
    precision: 15,
    scale: 2,
    nullable: true,
  })
  financingCashFlow?: number; // 融資現金流

  @Column({
    name: 'net_cash_flow',
    type: 'decimal',
    precision: 15,
    scale: 2,
    nullable: true,
  })
  netCashFlow?: number; // 淨現金流

  @Column({
    name: 'free_cash_flow',
    type: 'decimal',
    precision: 15,
    scale: 2,
    nullable: true,
  })
  freeCashFlow?: number; // 自由現金流

  @Column({
    name: 'capex',
    type: 'decimal',
    precision: 15,
    scale: 2,
    nullable: true,
  })
  capex?: number; // 資本支出

  @Column({
    name: 'debt_issuance',
    type: 'decimal',
    precision: 15,
    scale: 2,
    nullable: true,
  })
  debtIssuance?: number; // 債務發行

  @Column({
    name: 'debt_repayment',
    type: 'decimal',
    precision: 15,
    scale: 2,
    nullable: true,
  })
  debtRepayment?: number; // 債務償還

  @Column({
    name: 'dividend_payments',
    type: 'decimal',
    precision: 15,
    scale: 2,
    nullable: true,
  })
  dividendPayments?: number; // 股利支付

  // === 市場資料 ===
  @Column({
    name: 'shares_outstanding',
    type: 'bigint',
    nullable: true,
  })
  sharesOutstanding?: number; // 流通股數

  @Column({
    name: 'market_cap',
    type: 'decimal',
    precision: 15,
    scale: 2,
    nullable: true,
  })
  marketCap?: number; // 市值

  @Column({
    name: 'dividend_per_share',
    type: 'decimal',
    precision: 10,
    scale: 4,
    nullable: true,
  })
  dividendPerShare?: number; // 每股股利

  // === 計算指標 (由程式計算) ===
  @Column({
    name: 'pe_ratio',
    type: 'decimal',
    precision: 10,
    scale: 4,
    nullable: true,
  })
  peRatio?: number; // 本益比

  @Column({
    name: 'pb_ratio',
    type: 'decimal',
    precision: 10,
    scale: 4,
    nullable: true,
  })
  pbRatio?: number; // 股價淨值比

  @Column({
    name: 'roe',
    type: 'decimal',
    precision: 10,
    scale: 4,
    nullable: true,
    comment: '股東權益報酬率，以小數格式儲存 (0.15 = 15%)',
  })
  roe?: number; // 股東權益報酬率，小數格式 (0.15 = 15%)

  @Column({
    name: 'roa',
    type: 'decimal',
    precision: 10,
    scale: 4,
    nullable: true,
    comment: '資產報酬率，以小數格式儲存 (0.05 = 5%)',
  })
  roa?: number; // 資產報酬率，小數格式 (0.05 = 5%)

  @Column({
    name: 'debt_to_equity',
    type: 'decimal',
    precision: 10,
    scale: 4,
    nullable: true,
  })
  debtToEquity?: number; // 負債權益比

  @Column({
    name: 'current_ratio',
    type: 'decimal',
    precision: 10,
    scale: 4,
    nullable: true,
  })
  currentRatio?: number; // 流動比率

  @Column({
    name: 'gross_margin',
    type: 'decimal',
    precision: 10,
    scale: 4,
    nullable: true,
    comment: '毛利率，以小數格式儲存 (0.25 = 25%)',
  })
  grossMargin?: number; // 毛利率，小數格式 (0.25 = 25%)

  @Column({
    name: 'operating_margin',
    type: 'decimal',
    precision: 10,
    scale: 4,
    nullable: true,
    comment: '營業利益率，以小數格式儲存 (0.30 = 30%)',
  })
  operatingMargin?: number; // 營業利益率，小數格式 (0.30 = 30%)

  @Column({
    name: 'net_margin',
    type: 'decimal',
    precision: 10,
    scale: 4,
    nullable: true,
    comment: '淨利率，以小數格式儲存 (0.25 = 25%)',
  })
  netMargin?: number; // 淨利率，小數格式 (0.25 = 25%)

  @Column({
    name: 'dividend_yield',
    type: 'decimal',
    precision: 10,
    scale: 4,
    nullable: true,
    comment: '股息殖利率，以小數格式儲存 (0.035 = 3.5%)',
  })
  dividendYield?: number; // 股息殖利率，小數格式 (0.035 = 3.5%)

  // === 周轉率指標 (Turnover Ratios) ===
  @Column({
    name: 'inventory_turnover',
    type: 'decimal',
    precision: 10,
    scale: 4,
    nullable: true,
  })
  inventoryTurnover?: number; // 存貨周轉率

  @Column({
    name: 'receivables_turnover',
    type: 'decimal',
    precision: 10,
    scale: 4,
    nullable: true,
  })
  receivablesTurnover?: number; // 應收帳款周轉率

  @Column({
    name: 'asset_turnover',
    type: 'decimal',
    precision: 10,
    scale: 4,
    nullable: true,
  })
  assetTurnover?: number; // 資產周轉率

  @Column({
    name: 'equity_turnover',
    type: 'decimal',
    precision: 10,
    scale: 4,
    nullable: true,
  })
  equityTurnover?: number; // 權益周轉率

  // === 流動性指標 (Liquidity Ratios) ===
  @Column({
    name: 'quick_ratio',
    type: 'decimal',
    precision: 10,
    scale: 4,
    nullable: true,
  })
  quickRatio?: number; // 速動比率

  @Column({
    name: 'cash_ratio',
    type: 'decimal',
    precision: 10,
    scale: 4,
    nullable: true,
  })
  cashRatio?: number; // 現金比率

  // === 成長率指標 ===
  @Column({
    name: 'revenue_growth_yoy',
    type: 'decimal',
    precision: 10,
    scale: 4,
    nullable: true,
    comment: '營收年增率，以小數格式儲存 (0.12 = 12%)',
  })
  revenueGrowthYoy?: number; // 營收年增率，小數格式 (0.12 = 12%)

  @Column({
    name: 'net_income_growth_yoy',
    type: 'decimal',
    precision: 10,
    scale: 4,
    nullable: true,
    comment: '淨利年增率，以小數格式儲存 (0.08 = 8%)',
  })
  netIncomeGrowthYoy?: number; // 淨利年增率，小數格式 (0.08 = 8%)

  @Column({
    name: 'eps_growth_yoy',
    type: 'decimal',
    precision: 10,
    scale: 4,
    nullable: true,
    comment: 'EPS年增率，以小數格式儲存 (0.15 = 15%)',
  })
  epsGrowthYoy?: number; // EPS年增率，小數格式 (0.15 = 15%)

  // === 元數據 ===
  @Column({
    name: 'data_source',
    type: 'varchar',
    nullable: true,
  })
  dataSource?: string; // 資料來源

  @Column({
    name: 'last_updated',
    type: 'timestamptz',
    nullable: true,
  })
  lastUpdated?: Date; // 資料更新時間

  @Column({
    name: 'regional_data',
    type: 'jsonb',
    nullable: true,
    comment: '地區特有數據，用於儲存無法標準化的欄位',
  })
  regionalData?: Record<string, any>; // 地區特有數據

  @CreateDateColumn({
    type: 'timestamptz',
    name: 'created_at',
  })
  createdAt?: Date;

  @UpdateDateColumn({
    type: 'timestamptz',
    name: 'updated_at',
  })
  updatedAt?: Date;

  @Column({
    name: 'symbol_id',
    type: 'uuid',
    nullable: false,
  })
  symbolId!: string;

  // === 關聯 ===
  @ManyToOne(() => SymbolEntity, { nullable: false })
  @JoinColumn({ name: 'symbol_id' })
  symbol!: SymbolEntity;
}
