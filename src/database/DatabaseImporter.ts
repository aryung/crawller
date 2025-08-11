import { DataSource, Repository } from 'typeorm';
import { AppDataSource, initializeDatabase } from './ormconfig.js';
import { FundamentalDataEntity } from './entities/fundamental-data.entity.js';
import { FiscalReportType } from '../common/shared-types/index.js';
import { UnifiedFinancialData } from '../types/unified-financial-data.js';

export interface ImportResult {
  total: number;
  inserted: number;
  updated: number;
  failed: number;
  errors: string[];
}

export interface ImportOptions {
  batchSize?: number;
  upsert?: boolean;
  skipValidation?: boolean;
}

/**
 * Handles database import operations for fundamental data
 */
export class DatabaseImporter {
  private dataSource: DataSource | null = null;
  private repository: Repository<FundamentalDataEntity> | null = null;

  /**
   * Initialize database connection
   */
  async initialize(): Promise<void> {
    if (!this.dataSource || !this.dataSource.isInitialized) {
      this.dataSource = await initializeDatabase();
      this.repository = this.dataSource.getRepository(FundamentalDataEntity);
    }
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    if (this.dataSource && this.dataSource.isInitialized) {
      await this.dataSource.destroy();
      this.dataSource = null;
      this.repository = null;
    }
  }

  /**
   * Import a batch of unified fundamental data
   */
  async importBatch(
    dataArray: UnifiedFinancialData[],
    options: ImportOptions = {}
  ): Promise<ImportResult> {
    const {
      batchSize = 100,
      upsert = true,
      skipValidation = false,
    } = options;

    await this.initialize();

    const result: ImportResult = {
      total: dataArray.length,
      inserted: 0,
      updated: 0,
      failed: 0,
      errors: [],
    };

    // Process in batches
    for (let i = 0; i < dataArray.length; i += batchSize) {
      const batch = dataArray.slice(i, i + batchSize);
      
      try {
        await this.dataSource!.transaction(async (manager) => {
          for (const data of batch) {
            try {
              // Validate data if required
              if (!skipValidation && !this.validateData(data)) {
                result.failed++;
                result.errors.push(`Invalid data for ${data.symbolCode} ${data.reportDate}`);
                continue;
              }

              // Convert to entity
              const entity = this.toEntity(data);

              if (upsert) {
                // Use upsert (insert or update)
                const existing = await manager.findOne(FundamentalDataEntity, {
                  where: {
                    symbolCode: entity.symbolCode,
                    exchangeArea: entity.exchangeArea,
                    fiscalYear: entity.fiscalYear,
                    fiscalMonth: entity.fiscalMonth,
                    reportType: entity.reportType,
                  },
                });

                if (existing) {
                  // Update existing record
                  Object.assign(existing, entity);
                  await manager.save(existing);
                  result.updated++;
                } else {
                  // Insert new record
                  await manager.save(entity);
                  result.inserted++;
                }
              } else {
                // Simple insert
                await manager.save(entity);
                result.inserted++;
              }
            } catch (error) {
              result.failed++;
              result.errors.push(`Error processing ${data.symbolCode}: ${(error as Error).message}`);
            }
          }
        });
      } catch (error) {
        result.failed += batch.length;
        result.errors.push(`Batch transaction failed: ${(error as Error).message}`);
      }
    }

    return result;
  }

  /**
   * Import a single record
   */
  async importSingle(
    data: UnifiedFinancialData,
    upsert: boolean = true
  ): Promise<void> {
    await this.initialize();

    if (!this.validateData(data)) {
      throw new Error(`Invalid data for ${data.symbolCode}`);
    }

    const entity = this.toEntity(data);

    if (upsert) {
      await this.upsertFundamentalData(entity);
    } else {
      await this.repository!.save(entity);
    }
  }

  /**
   * Upsert (insert or update) fundamental data
   */
  private async upsertFundamentalData(entity: FundamentalDataEntity): Promise<void> {
    // 移除關聯對象，只保留數據欄位
    const { symbol, ...entityData } = entity;
    
    const queryBuilder = this.repository!.createQueryBuilder()
      .insert()
      .into(FundamentalDataEntity)
      .values(entityData as any)
      .orUpdate(
        [
          'revenue',
          'cost_of_goods_sold',
          'gross_profit',
          'operating_income',
          'net_income',
          'eps',
          'total_assets',
          'total_liabilities',
          'shareholders_equity',
          'book_value_per_share',
          'operating_cash_flow',
          'investing_cash_flow',
          'financing_cash_flow',
          'free_cash_flow',
          'net_cash_flow',
          'roe',
          'roa',
          'shares_outstanding',
          'regional_data',
          'data_source',
          'updated_at',
        ],
        [
          'symbol_code',
          'exchange_area',
          'fiscal_year',
          'fiscal_month',
          'report_type',
        ]
      );

    await queryBuilder.execute();
  }

  /**
   * Convert UnifiedFinancialData to FundamentalDataEntity
   */
  private toEntity(data: UnifiedFinancialData): FundamentalDataEntity {
    const entity = new FundamentalDataEntity();

    // Basic fields
    entity.symbolCode = data.symbolCode;
    entity.exchangeArea = data.exchangeArea;
    entity.reportDate = new Date(data.reportDate);
    entity.fiscalYear = data.fiscalYear;
    entity.fiscalMonth = data.fiscalMonth;
    entity.reportType = this.mapReportType(data.reportType);

    // Income statement fields
    entity.revenue = data.revenue;
    entity.costOfGoodsSold = data.costOfGoodsSold;
    entity.grossProfit = data.grossProfit;
    entity.operatingIncome = data.operatingIncome;
    entity.netIncome = data.netIncome;
    entity.eps = data.eps;

    // Balance sheet fields
    entity.totalAssets = data.totalAssets;
    entity.totalLiabilities = data.totalLiabilities;
    entity.shareholdersEquity = data.shareholdersEquity;
    entity.bookValuePerShare = data.bookValuePerShare;

    // Cash flow fields
    entity.operatingCashFlow = data.operatingCashFlow;
    entity.investingCashFlow = data.investingCashFlow;
    entity.financingCashFlow = data.financingCashFlow;
    entity.freeCashFlow = data.freeCashFlow;
    entity.netCashFlow = data.netCashFlow;

    // Ratios
    entity.roe = data.roe;
    entity.roa = data.roa;

    // Metadata
    entity.dataSource = data.dataSource;
    entity.sharesOutstanding = data.sharesOutstanding;
    entity.regionalData = data.regionalData;

    return entity;
  }

  /**
   * Map report type string to enum
   */
  private mapReportType(reportType: string): FiscalReportType {
    const normalized = reportType.toUpperCase();
    switch (normalized) {
      case 'QUARTERLY':
        return FiscalReportType.QUARTERLY;
      case 'ANNUAL':
        return FiscalReportType.ANNUAL;
      case 'MONTHLY':
        return FiscalReportType.MONTHLY;
      default:
        return FiscalReportType.QUARTERLY;
    }
  }

  /**
   * Validate data before import
   */
  private validateData(data: UnifiedFinancialData): boolean {
    // Required fields
    if (!data.symbolCode || !data.exchangeArea || !data.reportDate) {
      return false;
    }

    // Valid fiscal year
    if (!data.fiscalYear || data.fiscalYear < 2000 || data.fiscalYear > 2030) {
      return false;
    }

    // Valid fiscal month if present
    if (data.fiscalMonth && (data.fiscalMonth < 1 || data.fiscalMonth > 12)) {
      return false;
    }

    // Valid date format
    try {
      new Date(data.reportDate);
    } catch {
      return false;
    }

    return true;
  }

  /**
   * Get import statistics
   */
  async getStatistics(): Promise<{
    totalRecords: number;
    byRegion: Record<string, number>;
    byReportType: Record<string, number>;
    latestReportDate: Date | null;
  }> {
    await this.initialize();

    const totalRecords = await this.repository!.count();

    // Count by region
    const regionCounts = await this.repository!
      .createQueryBuilder('fd')
      .select('fd.exchange_area', 'region')
      .addSelect('COUNT(*)', 'count')
      .groupBy('fd.exchange_area')
      .getRawMany();

    const byRegion: Record<string, number> = {};
    for (const row of regionCounts) {
      byRegion[row.region] = parseInt(row.count);
    }

    // Count by report type
    const typeCounts = await this.repository!
      .createQueryBuilder('fd')
      .select('fd.report_type', 'type')
      .addSelect('COUNT(*)', 'count')
      .groupBy('fd.report_type')
      .getRawMany();

    const byReportType: Record<string, number> = {};
    for (const row of typeCounts) {
      byReportType[row.type] = parseInt(row.count);
    }

    // Get latest report date
    const latest = await this.repository!
      .createQueryBuilder('fd')
      .select('MAX(fd.report_date)', 'maxDate')
      .getRawOne();

    return {
      totalRecords,
      byRegion,
      byReportType,
      latestReportDate: latest?.maxDate || null,
    };
  }

  /**
   * Delete old records
   */
  async deleteOldRecords(beforeDate: Date): Promise<number> {
    await this.initialize();

    const result = await this.repository!
      .createQueryBuilder()
      .delete()
      .from(FundamentalDataEntity)
      .where('report_date < :date', { date: beforeDate })
      .execute();

    return result.affected || 0;
  }
}