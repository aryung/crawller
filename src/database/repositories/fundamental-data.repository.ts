import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FundamentalDataEntity } from '../entities/fundamental-data.entity';
import { Repository } from 'typeorm';
import { MarketRegion, FiscalReportType } from '../shared-types';

@Injectable()
export class FundamentalDataRepository {
  constructor(
    @InjectRepository(FundamentalDataEntity)
    private repository: Repository<FundamentalDataEntity>
  ) {}

  async findBySymbol(
    symbolCode: string,
    exchangeArea?: string
  ): Promise<FundamentalDataEntity | null> {
    const whereCondition: any = { symbolCode: symbolCode };
    if (exchangeArea) {
      whereCondition.exchangeArea = exchangeArea;
    }
    return this.repository.findOne({ where: whereCondition });
  }

  async findBySymbolAndDate(
    symbolCode: string,
    date: Date,
    exchangeArea?: string
  ): Promise<FundamentalDataEntity | null> {
    const whereCondition: any = {
      symbolCode: symbolCode,
      reportDate: date,
    };
    if (exchangeArea) {
      whereCondition.exchangeArea = exchangeArea;
    }
    return this.repository.findOne({
      where: whereCondition,
      order: { reportDate: 'DESC' },
    });
  }

  async findLatestBySymbol(
    symbolCode: string,
    reportType?: FiscalReportType,
    exchangeArea?: MarketRegion
  ): Promise<FundamentalDataEntity | null> {
    const whereCondition: any = { symbolCode: symbolCode };
    if (reportType) {
      whereCondition.reportType = reportType;
    }
    if (exchangeArea) {
      whereCondition.exchangeArea = exchangeArea;
    }

    return this.repository.findOne({
      where: whereCondition,
      order: { reportDate: 'DESC' },
    });
  }

  async findBySymbolAndFiscalPeriod(
    symbolCode: string,
    fiscalYear: number,
    fiscalQuarter?: number,
    reportType?: FiscalReportType,
    exchangeArea?: string
  ): Promise<FundamentalDataEntity | null> {
    const whereCondition: any = {
      symbolCode: symbolCode,
      fiscalYear: fiscalYear,
    };

    if (fiscalQuarter !== undefined) {
      whereCondition.fiscalQuarter = fiscalQuarter;
    }

    if (reportType) {
      whereCondition.reportType = reportType;
    }

    if (exchangeArea) {
      whereCondition.exchangeArea = exchangeArea;
    }

    return this.repository.findOne({
      where: whereCondition,
      order: { reportDate: 'DESC' },
    });
  }

  /**
   * 根據特定期間查找基本面數據（支援月度、季度、年度）
   */
  async findBySpecificPeriod(
    symbolCode: string,
    fiscalYear: number,
    reportType: FiscalReportType,
    fiscalQuarter?: number,
    fiscalMonth?: number,
    exchangeArea?: string
  ): Promise<FundamentalDataEntity | null> {
    const whereCondition: any = {
      symbolCode: symbolCode,
      fiscalYear: fiscalYear,
      reportType: reportType,
    };

    // 根據報表類型設定不同的查詢條件
    switch (reportType) {
      case FiscalReportType.MONTHLY:
        if (fiscalMonth !== undefined) {
          whereCondition.fiscalMonth = fiscalMonth;
        }
        whereCondition.fiscalQuarter = null; // 月度數據 fiscalQuarter 為 null
        break;

      case FiscalReportType.QUARTERLY:
        if (fiscalQuarter !== undefined) {
          whereCondition.fiscalQuarter = fiscalQuarter;
        }
        whereCondition.fiscalMonth = null; // 季度數據 fiscalMonth 為 null
        break;

      case FiscalReportType.ANNUAL:
        whereCondition.fiscalQuarter = null; // 年度數據兩者都為 null
        whereCondition.fiscalMonth = null;
        break;
    }

    if (exchangeArea) {
      whereCondition.exchangeArea = exchangeArea;
    }

    return this.repository.findOne({
      where: whereCondition,
      order: { reportDate: 'DESC' },
    });
  }

  /**
   * 查找月度數據的範圍（支援季度聚合）
   */
  async findMonthlyDataInRange(
    symbolCode: string,
    fiscalYear: number,
    startMonth: number,
    endMonth: number,
    exchangeArea?: string
  ): Promise<FundamentalDataEntity[]> {
    const query = this.repository
      .createQueryBuilder('fd')
      .where('fd.symbolCode = :symbolCode', { symbolCode })
      .andWhere('fd.fiscalYear = :fiscalYear', { fiscalYear })
      .andWhere('fd.reportType = :reportType', {
        reportType: FiscalReportType.MONTHLY,
      })
      .andWhere('fd.fiscalMonth >= :startMonth', { startMonth })
      .andWhere('fd.fiscalMonth <= :endMonth', { endMonth })
      .andWhere('fd.fiscalQuarter IS NULL'); // 確保是月度數據

    if (exchangeArea) {
      query.andWhere('fd.exchangeArea = :exchangeArea', { exchangeArea });
    }

    return query.orderBy('fd.fiscalMonth', 'ASC').getMany();
  }

  async findPreviousYearData(
    symbolCode: string,
    currentFiscalYear: number,
    currentFiscalQuarter: number,
    reportType: FiscalReportType,
    exchangeArea?: string,
    currentFiscalMonth?: number
  ): Promise<FundamentalDataEntity | null> {
    const previousYear = currentFiscalYear - 1;

    // 根據報表類型處理不同的查詢邏輯
    switch (reportType) {
      case FiscalReportType.MONTHLY:
        // 月度數據：查找去年同月
        if (currentFiscalMonth !== undefined) {
          return this.findBySpecificPeriod(
            symbolCode,
            previousYear,
            reportType,
            undefined,
            currentFiscalMonth,
            exchangeArea
          );
        }
        return null;

      case FiscalReportType.QUARTERLY:
        // 季度數據：查找去年同季
        return this.findBySpecificPeriod(
          symbolCode,
          previousYear,
          reportType,
          currentFiscalQuarter,
          undefined,
          exchangeArea
        );

      case FiscalReportType.ANNUAL:
        // 年度數據：查找去年年報
        return this.findBySpecificPeriod(
          symbolCode,
          previousYear,
          reportType,
          undefined,
          undefined,
          exchangeArea
        );

      default:
        return null;
    }
  }

  async save(data: FundamentalDataEntity): Promise<FundamentalDataEntity> {
    return this.repository.save(data);
  }
}
