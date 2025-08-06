import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum FiscalReportType {
  QUARTERLY = 'quarterly',
  ANNUAL = 'annual',
  MONTHLY = 'monthly',
}

/**
 * Fundamental Data Entity for crawler database integration
 * Simplified version matching finance-strategy database schema
 */
@Entity('fundamental_data')
@Index('IDX_fundamental_data_symbol_exchange', ['symbolCode', 'exchangeArea'])
@Index('IDX_fundamental_data_fiscal_period', [
  'symbolCode',
  'fiscalYear',
  'fiscalQuarter',
  'fiscalMonth',
  'reportType',
])
export class FundamentalDataEntity {
  @PrimaryColumn({
    type: 'uuid',
    default: () => 'uuid_generate_v4()',
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
    name: 'fiscal_quarter',
    type: 'integer',
    nullable: true,
  })
  @Index()
  fiscalQuarter?: number;

  @Column({
    name: 'fiscal_month',
    type: 'integer',
    nullable: true,
  })
  @Index()
  fiscalMonth?: number;

  @Column({
    name: 'report_type',
    type: 'varchar',
    default: FiscalReportType.QUARTERLY,
  })
  @Index()
  reportType!: FiscalReportType;

  // === Income Statement Fields ===
  @Column({
    name: 'revenue',
    type: 'decimal',
    precision: 15,
    scale: 2,
    nullable: true,
  })
  revenue?: number;

  @Column({
    name: 'cost_of_goods_sold',
    type: 'decimal',
    precision: 15,
    scale: 2,
    nullable: true,
  })
  costOfGoodsSold?: number;

  @Column({
    name: 'gross_profit',
    type: 'decimal',
    precision: 15,
    scale: 2,
    nullable: true,
  })
  grossProfit?: number;

  @Column({
    name: 'operating_income',
    type: 'decimal',
    precision: 15,
    scale: 2,
    nullable: true,
  })
  operatingIncome?: number;

  @Column({
    name: 'net_income',
    type: 'decimal',
    precision: 15,
    scale: 2,
    nullable: true,
  })
  netIncome?: number;

  @Column({
    name: 'eps',
    type: 'decimal',
    precision: 10,
    scale: 4,
    nullable: true,
  })
  eps?: number;

  // === Balance Sheet Fields ===
  @Column({
    name: 'total_assets',
    type: 'decimal',
    precision: 15,
    scale: 2,
    nullable: true,
  })
  totalAssets?: number;

  @Column({
    name: 'total_liabilities',
    type: 'decimal',
    precision: 15,
    scale: 2,
    nullable: true,
  })
  totalLiabilities?: number;

  @Column({
    name: 'shareholders_equity',
    type: 'decimal',
    precision: 15,
    scale: 2,
    nullable: true,
  })
  shareholdersEquity?: number;

  @Column({
    name: 'book_value_per_share',
    type: 'decimal',
    precision: 10,
    scale: 4,
    nullable: true,
  })
  bookValuePerShare?: number;

  // === Cash Flow Statement Fields ===
  @Column({
    name: 'operating_cash_flow',
    type: 'decimal',
    precision: 15,
    scale: 2,
    nullable: true,
  })
  operatingCashFlow?: number;

  @Column({
    name: 'investing_cash_flow',
    type: 'decimal',
    precision: 15,
    scale: 2,
    nullable: true,
  })
  investingCashFlow?: number;

  @Column({
    name: 'financing_cash_flow',
    type: 'decimal',
    precision: 15,
    scale: 2,
    nullable: true,
  })
  financingCashFlow?: number;

  @Column({
    name: 'free_cash_flow',
    type: 'decimal',
    precision: 15,
    scale: 2,
    nullable: true,
  })
  freeCashFlow?: number;

  @Column({
    name: 'net_cash_flow',
    type: 'decimal',
    precision: 15,
    scale: 2,
    nullable: true,
  })
  netCashFlow?: number;

  // === Financial Ratios ===
  @Column({
    name: 'roe',
    type: 'decimal',
    precision: 8,
    scale: 4,
    nullable: true,
  })
  roe?: number;

  @Column({
    name: 'roa',
    type: 'decimal',
    precision: 8,
    scale: 4,
    nullable: true,
  })
  roa?: number;

  // === Metadata ===
  @Column({
    name: 'data_source',
    type: 'varchar',
    nullable: true,
  })
  dataSource?: string;


  @Column({
    name: 'shares_outstanding',
    type: 'bigint',
    nullable: true,
  })
  sharesOutstanding?: number;

  @Column({
    name: 'regional_data',
    type: 'jsonb',
    nullable: true,
  })
  regionalData?: Record<string, any>;

  @CreateDateColumn({
    name: 'created_at',
  })
  createdAt!: Date;

  @UpdateDateColumn({
    name: 'updated_at',
  })
  updatedAt!: Date;
}

