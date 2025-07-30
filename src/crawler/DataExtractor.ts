import { Page } from 'playwright';
import { load, CheerioAPI } from 'cheerio';
import { SelectorConfig, SelectorItem } from '../types';
import { parseSelector, logger } from '../utils';

export class DataExtractor {
  async extractData(page: Page, selectors: SelectorConfig = {}): Promise<Record<string, unknown>> {
    const data: Record<string, unknown> = {};

    try {
      const content = await page.content();
      const $ = load(content);

      for (const [key, selectorConfig] of Object.entries(selectors)) {
        const selectorItem = parseSelector(selectorConfig);
        data[key] = await this.extractSingleValue($, selectorItem, page);
      }

      logger.info(`Extracted data for ${Object.keys(data).length} selectors`);
      return data;
    } catch (error) {
      logger.error('Failed to extract data:', error);
      throw error;
    }
  }

  private async extractSingleValue(
    $: CheerioAPI, 
    selectorItem: SelectorItem, 
    page: Page
  ): Promise<any> {
    const { selector, attribute, transform } = selectorItem;

    try {
      let value: any;

      if (attribute === 'innerHTML') {
        value = $(selector).html();
      } else if (attribute === 'outerHTML') {
        value = $.html($(selector));
      } else if (attribute) {
        value = $(selector).attr(attribute);
      } else {
        value = $(selector).text().trim();
      }

      if (selector.includes(':multiple') || $(selector).length > 1) {
        value = $(selector).map((_, el) => {
          if (attribute === 'innerHTML') {
            return $(el).html();
          } else if (attribute === 'outerHTML') {
            return $.html($(el));
          } else if (attribute) {
            return $(el).attr(attribute);
          } else {
            return $(el).text().trim();
          }
        }).get();
      }

      if (transform && typeof transform === 'function') {
        value = transform(value);
      }

      return value;
    } catch (error) {
      logger.warn(`Failed to extract value for selector "${selector}":`, error);
      return null;
    }
  }

  async extractByEvaluation(page: Page, evaluationFn: string): Promise<any> {
    try {
      const result = await page.evaluate(evaluationFn);
      logger.info('Data extracted using page evaluation');
      return result;
    } catch (error) {
      logger.error('Failed to extract data using evaluation:', error);
      throw error;
    }
  }

  async extractTableData(page: Page, tableSelector: string): Promise<any[]> {
    try {
      const content = await page.content();
      const $ = load(content);
      const table = $(tableSelector);
      
      if (!table.length) {
        throw new Error(`Table not found with selector: ${tableSelector}`);
      }

      const headers = table.find('thead tr th, thead tr td').map((_, el) => 
        $(el).text().trim()
      ).get();

      const rows: Record<string, string>[] = [];
      table.find('tbody tr, tr:not(thead tr)').each((_, row) => {
        const cells = $(row).find('td, th').map((_, cell) => 
          $(cell).text().trim()
        ).get();
        
        const rowData: Record<string, string> = {};
        headers.forEach((header, index) => {
          rowData[header || `column_${index}`] = cells[index] || '';
        });
        
        rows.push(rowData);
      });

      logger.info(`Extracted ${rows.length} rows from table`);
      return rows;
    } catch (error) {
      logger.error('Failed to extract table data:', error);
      throw error;
    }
  }

  async extractStructuredTable(page: Page, tableSelector: string, transforms?: Record<string, Function>): Promise<any[]> {
    try {
      const content = await page.content();
      const $ = load(content);
      
      // 嘗試找到表格或包含表格內容的元素
      let tableElement = $(tableSelector);
      
      if (!tableElement.length) {
        // 如果找不到特定表格，嘗試尋找包含財務數據的區域
        tableElement = $('[class*="performance"], [class*="Performance"], table').first();
      }
      
      if (!tableElement.length) {
        logger.warn(`No table found with selector: ${tableSelector}`);
        return [];
      }

      const tableText = tableElement.text() || tableElement.html() || '';
      
      // 如果有提供轉換函數，使用它來結構化數據
      if (transforms && transforms.structureFinancialData) {
        logger.info('Using structured financial data transform');
        return transforms.structureFinancialData(tableText);
      }
      
      // 使用傳統的表格提取方法作為備用
      return this.parseTraditionalTable($, tableElement);
      
    } catch (error) {
      logger.error('Failed to extract structured table data:', error);
      return [];
    }
  }

  private parseTraditionalTable($: CheerioAPI, tableElement: any): any[] {
    try {
      const rows: Record<string, string>[] = [];
      
      // 嘗試提取標題
      const headers = tableElement.find('thead tr th, thead tr td, tr:first th, tr:first td').map((_: any, el: any) => 
        $(el).text().trim()
      ).get();
      
      // 提取數據行
      const dataRows = tableElement.find('tbody tr, tr:not(:first)');
      
      dataRows.each((_: any, row: any) => {
        const cells = $(row).find('td, th').map((_: any, cell: any) => 
          $(cell).text().trim()
        ).get();
        
        if (cells.length > 0) {
          const rowData: Record<string, string> = {};
          
          if (headers.length > 0) {
            headers.forEach((header: string, index: number) => {
              rowData[header || `column_${index}`] = cells[index] || '';
            });
          } else {
            cells.forEach((cell: string, index: number) => {
              rowData[`column_${index}`] = cell;
            });
          }
          
          rows.push(rowData);
        }
      });
      
      logger.info(`Extracted ${rows.length} rows using traditional table parsing`);
      return rows;
      
    } catch (error) {
      logger.error('Failed to parse traditional table:', error);
      return [];
    }
  }

  async extractFinancialPerformanceData(page: Page, options?: {
    tableSelector?: string;
    transforms?: Record<string, Function>;
  }): Promise<any[]> {
    try {
      const tableSelector = options?.tableSelector || 'table, [class*="performance"], [class*="Performance"]';
      const transforms = options?.transforms;
      
      logger.info('Extracting financial performance data...');
      
      // 首先嘗試結構化提取
      const structuredData = await this.extractStructuredTable(page, tableSelector, transforms);
      
      if (structuredData && structuredData.length > 0) {
        logger.info(`Successfully extracted ${structuredData.length} structured financial records`);
        return structuredData;
      }
      
      // 如果結構化提取失敗，嘗試傳統表格提取
      logger.warn('Structured extraction failed, trying traditional table extraction');
      return await this.extractTableData(page, tableSelector);
      
    } catch (error) {
      logger.error('Failed to extract financial performance data:', error);
      return [];
    }
  }
}