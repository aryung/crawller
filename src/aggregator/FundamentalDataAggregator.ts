import { OutputFileManager, FileInfo } from '../pipeline/OutputFileManager.js';
import { StandardizedFundamentalData } from '../types/standardized.js';
import * as yahooTWTransforms from '../transforms/sites/yahoo-finance-tw.js';
import * as yahooUSTransforms from '../transforms/sites/yahoo-finance-us.js';
import * as yahooJPTransforms from '../transforms/sites/yahoo-finance-jp.js';

export interface AggregatedData {
  symbolCode: string;
  region: string;
  periods: Map<string, StandardizedFundamentalData>;
}

/**
 * Aggregates and standardizes financial data from multiple crawler outputs
 */
export class FundamentalDataAggregator {
  private fileManager: OutputFileManager;

  constructor(outputDir: string = 'output') {
    this.fileManager = new OutputFileManager(outputDir);
  }

  /**
   * Aggregate all financial data for a specific symbol
   */
  async aggregateSymbolData(
    symbolCode: string,
    region: string
  ): Promise<AggregatedData> {
    const files = await this.fileManager.getFinancialDataFiles(symbolCode, region);
    
    if (files.length === 0) {
      throw new Error(`No data files found for ${symbolCode} in region ${region}`);
    }

    const aggregated: AggregatedData = {
      symbolCode,
      region,
      periods: new Map(),
    };

    // Process each file and extract standardized data
    for (const file of files) {
      try {
        const rawData = await this.fileManager.readFinancialDataFile(file.filePath);
        const standardizedDataArray = await this.standardizeData(rawData, region, file.reportType, symbolCode);
        
        // Merge standardized data into periods map
        for (const data of standardizedDataArray) {
          const periodKey = this.getPeriodKey(data);
          
          if (aggregated.periods.has(periodKey)) {
            // Merge with existing period data
            const existing = aggregated.periods.get(periodKey)!;
            aggregated.periods.set(periodKey, this.mergeData(existing, data));
          } else {
            // Add new period data
            aggregated.periods.set(periodKey, data);
          }
        }
      } catch (error) {
        console.error(`Error processing file ${file.fileName}:`, error);
      }
    }

    return aggregated;
  }

  /**
   * Standardize raw crawler data based on region and report type
   */
  private async standardizeData(
    rawData: any,
    region: string,
    reportType: string,
    symbolCode: string
  ): Promise<StandardizedFundamentalData[]> {
    const results: StandardizedFundamentalData[] = [];

    // Extract actual data from crawler output structure
    const crawlerResults = rawData.results?.[0]?.data || rawData.data || rawData;

    switch (region.toUpperCase()) {
      case 'TW':
        results.push(...this.standardizeTWData(crawlerResults, reportType, symbolCode));
        break;
      case 'US':
        results.push(...this.standardizeUSData(crawlerResults, reportType, symbolCode));
        break;
      case 'JP':
        results.push(...this.standardizeJPData(crawlerResults, reportType, symbolCode));
        break;
      default:
        console.warn(`Unknown region: ${region}`);
    }

    return results;
  }

  /**
   * Standardize Taiwan data
   */
  private standardizeTWData(
    data: any,
    reportType: string,
    symbolCode: string
  ): StandardizedFundamentalData[] {
    const results: StandardizedFundamentalData[] = [];

    try {
      switch (reportType) {
        case 'cash_flow_statement':
          if (data.independentCashFlowData) {
            for (const item of data.independentCashFlowData) {
              results.push(yahooTWTransforms.toStandardizedFromCashFlow(item, symbolCode));
            }
          }
          break;

        case 'income_statement':
          if (data.incomeStatementData) {
            for (const item of data.incomeStatementData) {
              results.push(yahooTWTransforms.toStandardizedFromIncomeStatement(item, symbolCode));
            }
          }
          break;

        case 'balance_sheet':
          if (data.balanceSheetData) {
            for (const item of data.balanceSheetData) {
              results.push(yahooTWTransforms.toStandardizedFromBalanceSheet(item, symbolCode));
            }
          }
          break;

        case 'eps':
          if (data.simpleEPSData) {
            for (const item of data.simpleEPSData) {
              results.push(yahooTWTransforms.toStandardizedFromEPS(item, symbolCode));
            }
          }
          break;

        case 'dividend':
          if (data.dividendData) {
            for (const item of data.dividendData) {
              results.push(yahooTWTransforms.toStandardizedFromDividend(item, symbolCode));
            }
          }
          break;

        case 'revenue':
          if (data.revenueData) {
            for (const item of data.revenueData) {
              results.push(yahooTWTransforms.toStandardizedFromRevenue(item, symbolCode));
            }
          }
          break;

        default:
          console.warn(`Unhandled TW report type: ${reportType}`);
      }
    } catch (error) {
      console.error(`Error standardizing TW data for ${reportType}:`, error);
    }

    return results;
  }

  /**
   * Standardize US data
   */
  private standardizeUSData(
    data: any,
    reportType: string,
    symbolCode: string
  ): StandardizedFundamentalData[] {
    const results: StandardizedFundamentalData[] = [];

    try {
      switch (reportType) {
        case 'financials':
          if (data.structuredFinancialData) {
            for (const item of data.structuredFinancialData) {
              results.push(yahooUSTransforms.toStandardizedFromFinancials(item, symbolCode));
            }
          }
          break;

        case 'cashflow':
          if (data.cashFlowData) {
            for (const item of data.cashFlowData) {
              results.push(yahooUSTransforms.toStandardizedFromCashFlow(item, symbolCode));
            }
          }
          break;

        default:
          console.warn(`Unhandled US report type: ${reportType}`);
      }
    } catch (error) {
      console.error(`Error standardizing US data for ${reportType}:`, error);
    }

    return results;
  }

  /**
   * Standardize Japan data
   */
  private standardizeJPData(
    data: any,
    reportType: string,
    symbolCode: string
  ): StandardizedFundamentalData[] {
    const results: StandardizedFundamentalData[] = [];

    try {
      switch (reportType) {
        case 'performance':
          if (data.structuredFinancialData) {
            for (const item of data.structuredFinancialData) {
              results.push(yahooJPTransforms.toStandardizedFromPerformance(item, symbolCode));
            }
          }
          break;

        case 'financials':
          if (data.structuredFinancialData) {
            for (const item of data.structuredFinancialData) {
              results.push(yahooJPTransforms.toStandardizedFromFinancials(item, symbolCode));
            }
          }
          break;

        case 'cashflow':
          if (data.cashFlowData) {
            for (const item of data.cashFlowData) {
              results.push(yahooJPTransforms.toStandardizedFromCashFlow(item, symbolCode));
            }
          }
          break;

        default:
          console.warn(`Unhandled JP report type: ${reportType}`);
      }
    } catch (error) {
      console.error(`Error standardizing JP data for ${reportType}:`, error);
    }

    return results;
  }

  /**
   * Generate a unique key for a period
   */
  private getPeriodKey(data: StandardizedFundamentalData): string {
    const parts = [
      data.fiscalYear,
      data.fiscalQuarter || 'A', // A for annual
      data.fiscalMonth || '0',
      data.reportType,
    ];
    return parts.join('_');
  }

  /**
   * Merge two StandardizedFundamentalData objects
   * Later data overwrites earlier data for non-null values
   */
  private mergeData(
    existing: StandardizedFundamentalData,
    newData: StandardizedFundamentalData
  ): StandardizedFundamentalData {
    const merged = { ...existing };

    // Merge all fields, preferring non-null values from newData
    for (const [key, value] of Object.entries(newData)) {
      if (value !== null && value !== undefined) {
        (merged as any)[key] = value;
      }
    }

    // Merge regional data if present
    if (existing.regionalData || newData.regionalData) {
      merged.regionalData = {
        ...existing.regionalData,
        ...newData.regionalData,
      };
    }

    // Update lastUpdated timestamp
    merged.lastUpdated = new Date().toISOString();

    return merged;
  }

  /**
   * Get all aggregated data for all symbols
   */
  async aggregateAllSymbols(): Promise<AggregatedData[]> {
    const fileGroups = await this.fileManager.groupFilesBySymbol();
    const results: AggregatedData[] = [];

    for (const [key, group] of fileGroups) {
      try {
        const aggregated = await this.aggregateSymbolData(
          group.symbolCode,
          group.region
        );
        results.push(aggregated);
      } catch (error) {
        console.error(`Error aggregating data for ${key}:`, error);
      }
    }

    return results;
  }

  /**
   * Validate aggregated data
   */
  validateData(data: StandardizedFundamentalData): boolean {
    // Basic validation rules
    if (!data.symbolCode || !data.exchangeArea) {
      return false;
    }

    if (!data.fiscalYear || data.fiscalYear < 2000 || data.fiscalYear > 2030) {
      return false;
    }

    if (data.fiscalQuarter && (data.fiscalQuarter < 1 || data.fiscalQuarter > 4)) {
      return false;
    }

    if (data.fiscalMonth && (data.fiscalMonth < 1 || data.fiscalMonth > 12)) {
      return false;
    }

    return true;
  }
}