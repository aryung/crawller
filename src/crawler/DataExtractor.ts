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
}