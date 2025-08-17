import * as fs from 'fs-extra';
import * as path from 'path';
import { CrawlerResult, ExportOptions } from '../types';
import { logger } from './logger';
import { sanitizeFilename, formatTimestamp } from './helpers';

export class DataExporter {
  private outputDir: string;

  constructor(outputDir: string = 'output') {
    this.outputDir = outputDir;
  }

  async exportResults(
    results: CrawlerResult[],
    options: ExportOptions
  ): Promise<string> {
    await fs.ensureDir(this.outputDir);

    const filename = this.generateFilename(options);
    const categorizedPath = this.getCategorizedPath(options.configName || '', filename);
    const filePath = path.join(this.outputDir, categorizedPath);

    // 確保分類目錄存在
    await fs.ensureDir(path.dirname(filePath));

    try {
      switch (options.format) {
        case 'json':
          return await this.exportAsJson(results, filePath);
        case 'csv':
          return await this.exportAsCsv(results, filePath);
        case 'xlsx':
          return await this.exportAsExcel(results, filePath);
        default:
          throw new Error(`Unsupported export format: ${options.format}`);
      }
    } catch (error) {
      logger.error(`Failed to export data as ${options.format}:`, error);
      throw error;
    }
  }

  private async exportAsJson(results: CrawlerResult[], filePath: string): Promise<string> {
    const exportData = {
      exportDate: new Date().toISOString(),
      totalResults: results.length,
      successCount: results.filter(r => r.success).length,
      results: results.map(result => ({
        ...result,
        screenshot: result.screenshot ? `<Buffer ${result.screenshot.length} bytes>` : undefined
      }))
    };

    await fs.writeJson(filePath, exportData, { spaces: 2 });
    logger.info(`Exported ${results.length} results to JSON: ${filePath}`);
    return filePath;
  }

  private async exportAsCsv(results: CrawlerResult[], filePath: string): Promise<string> {
    if (results.length === 0) {
      await fs.writeFile(filePath, 'No data to export\n');
      return filePath;
    }

    const headers = this.extractHeaders(results);
    const csvContent = [
      headers.join(','),
      ...results.map(result => this.resultToCsvRow(result, headers))
    ].join('\n');

    await fs.writeFile(filePath, csvContent, 'utf8');
    logger.info(`Exported ${results.length} results to CSV: ${filePath}`);
    return filePath;
  }

  private async exportAsExcel(results: CrawlerResult[], filePath: string): Promise<string> {
    try {
      const XLSX = await import('xlsx');

      const workbook = XLSX.utils.book_new();

      // 主要資料工作表
      const worksheetData = results.map(result => this.flattenResult(result));
      const worksheet = XLSX.utils.json_to_sheet(worksheetData);
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Crawl Results');

      // 統計工作表
      const stats = this.generateStats(results);
      const statsWorksheet = XLSX.utils.json_to_sheet([stats]);
      XLSX.utils.book_append_sheet(workbook, statsWorksheet, 'Statistics');

      XLSX.writeFile(workbook, filePath);
      logger.info(`Exported ${results.length} results to Excel: ${filePath}`);
      return filePath;
    } catch (error) {
      logger.warn('XLSX not available, falling back to CSV export');
      return await this.exportAsCsv(results, filePath.replace('.xlsx', '.csv'));
    }
  }

  private extractHeaders(results: CrawlerResult[]): string[] {
    const headers = new Set(['url', 'success', 'timestamp', 'error']);

    results.forEach(result => {
      if (result.data && typeof result.data === 'object') {
        Object.keys(result.data).forEach(key => headers.add(key));
      }
    });

    return Array.from(headers);
  }

  private resultToCsvRow(result: CrawlerResult, headers: string[]): string {
    return headers.map(header => {
      let value: any;

      switch (header) {
        case 'url':
          value = result.url;
          break;
        case 'success':
          value = result.success;
          break;
        case 'timestamp':
          value = result.timestamp.toISOString();
          break;
        case 'error':
          value = result.error || '';
          break;
        default:
          value = result.data?.[header] || '';
      }

      // CSV 轉義處理
      if (typeof value === 'string') {
        value = value.replace(/"/g, '""');
        if (value.includes(',') || value.includes('"') || value.includes('\n')) {
          value = `"${value}"`;
        }
      }

      return value;
    }).join(',');
  }

  private flattenResult(result: CrawlerResult): Record<string, any> {
    return {
      url: result.url,
      success: result.success,
      timestamp: result.timestamp.toISOString(),
      error: result.error || '',
      ...result.data,
      hasScreenshot: !!result.screenshot
    };
  }

  private generateStats(results: CrawlerResult[]): Record<string, any> {
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    return {
      totalResults: results.length,
      successfulCrawls: successful.length,
      failedCrawls: failed.length,
      successRate: results.length > 0 ? (successful.length / results.length * 100).toFixed(2) + '%' : '0%',
      averageDataFields: successful.length > 0
        ? (successful.reduce((sum, r) => sum + Object.keys(r.data || {}).length, 0) / successful.length).toFixed(1)
        : '0',
      commonErrors: this.getCommonErrors(failed),
      exportDate: new Date().toISOString()
    };
  }

  private getCommonErrors(failedResults: CrawlerResult[]): string {
    const errorCounts: Record<string, number> = {};

    failedResults.forEach(result => {
      if (result.error) {
        const errorKey = result.error.substring(0, 100); // 截取前100字符作為錯誤類型
        errorCounts[errorKey] = (errorCounts[errorKey] || 0) + 1;
      }
    });

    return Object.entries(errorCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([error, count]) => `${error} (${count}x)`)
      .join('; ');
  }

  /**
   * 解析配置名稱並生成分類路徑
   */
  private getCategorizedPath(configName: string, filename: string): string {
    console.log(`[DataExporter] 🔍 處理配置名稱: "${configName}", 檔案名: "${filename}"`);
    
    if (!configName) {
      console.log(`[DataExporter] ⚠️ 配置名稱為空，返回檔案名: "${filename}"`);
      return filename; // 無配置名稱時，直接返回檔案名
    }

    // 提取實際的配置檔案名稱（去除路徑前綴）
    // 處理格式如: quarterly/jp/financials/yahoo-finance-jp-financials-9993_T
    const actualConfigName = configName.includes('/') 
      ? configName.split('/').pop() || configName 
      : configName;

    console.log(`[DataExporter] 📋 提取的實際配置名稱: "${actualConfigName}"`);

    // 解析配置名稱格式: yahoo-finance-{market}-{type}-{symbol} 或 yahoo-finance-{market}-{detailed-type}-{symbol}
    // 支援格式如: yahoo-finance-tw-balance-sheet-2330_TW, yahoo-finance-tw-eps-2330_TW
    const match = actualConfigName.match(/^yahoo-finance-([a-z]+)-(.+?)-.+/);
    if (!match) {
      console.log(`[DataExporter] ❌ 無法解析配置名稱，返回檔案名: "${filename}"`);
      return filename; // 無法解析時，直接返回檔案名
    }

    const [, market, typeSegment] = match;
    console.log(`[DataExporter] ✅ 解析結果 - 市場: "${market}", 類型: "${typeSegment}"`);
    
    // 處理複合類型名稱 (如 balance-sheet, cash-flow-statement)
    const type = typeSegment;
    
    // 判斷分類
    let category = '';
    
    if (type === 'history') {
      category = 'daily';
    } else if (['symbols', 'labels', 'categories', 'details', 'sectors'].includes(type)) {
      category = 'metadata';
    } else {
      // 其他財務數據類型如 balance-sheet, cash-flow-statement, income-statement, eps, dividend 等
      category = 'quarterly';
    }

    // 構建分類路徑: category/market/type/filename
    const finalPath = category === 'metadata' 
      ? path.join(category, type, filename)
      : path.join(category, market, type, filename);
    
    console.log(`[DataExporter] 🎯 最終路徑: "${finalPath}"`);
    return finalPath;
  }

  private generateFilename(options: ExportOptions): string {
    if (options.filename) {
      const baseFilename = options.filename.endsWith(`.${options.format}`)
        ? options.filename.replace(`.${options.format}`, '')
        : options.filename;

      // Add config name prefix if available and not already present
      // 檢查檔案名是否已經包含配置名稱，避免重複添加
      const configName = options.configName || '';
      // 更精確的檢測：將連字符和下劃線標準化後比較
      const normalizedConfigName = configName.replace(/[-_]/g, '_');
      const normalizedFilename = baseFilename.replace(/[-_]/g, '_');
      const alreadyHasConfigName = configName && (
        normalizedFilename.includes(normalizedConfigName) ||
        normalizedFilename === normalizedConfigName ||
        // 特殊處理：檔案名本身已經是完整的配置名
        baseFilename.startsWith('yahoo_finance_') || baseFilename.startsWith('yahoo-finance-')
      );
      
      const finalFilename = options.configName && !alreadyHasConfigName
        ? `${options.configName}_${baseFilename}`
        : baseFilename;

      return `${finalFilename}.${options.format}`;
    }

    const timestamp = formatTimestamp();
    const baseFilename = timestamp;

    // Add config name prefix if available
    const finalFilename = options.configName
      ? `${options.configName}_${baseFilename}`
      : baseFilename;

    return `${finalFilename}.${options.format}`;
  }

  async saveScreenshots(results: CrawlerResult[]): Promise<string[]> {
    const screenshotDir = path.join(this.outputDir, 'screenshots');
    await fs.ensureDir(screenshotDir);

    const savedPaths: string[] = [];

    for (const [index, result] of results.entries()) {
      if (result.screenshot) {
        const filename = `screenshot_${index}_${sanitizeFilename(result.url)}.png`;
        const filepath = path.join(screenshotDir, filename);

        await fs.writeFile(filepath, result.screenshot);
        savedPaths.push(filepath);
      }
    }

    logger.info(`Saved ${savedPaths.length} screenshots to ${screenshotDir}`);
    return savedPaths;
  }

  async generateReport(results: CrawlerResult[]): Promise<string> {
    const stats = this.generateStats(results);
    const reportPath = path.join(this.outputDir, `crawl_report_${formatTimestamp()}.md`);

    const report = `# 爬蟲結果報告

## 基本統計
- **總計**: ${stats.totalResults} 個結果
- **成功**: ${stats.successfulCrawls} 個
- **失敗**: ${stats.failedCrawls} 個
- **成功率**: ${stats.successRate}
- **平均資料欄位數**: ${stats.averageDataFields}

## 常見錯誤
${stats.commonErrors || '無錯誤'}

## 詳細結果
${results.map((result, index) =>
      `### ${index + 1}. ${result.url}
- **狀態**: ${result.success ? '✅ 成功' : '❌ 失敗'}
- **時間**: ${result.timestamp.toLocaleString('zh-TW')}
- **資料欄位**: ${Object.keys(result.data || {}).length} 個
${result.error ? `- **錯誤**: ${result.error}` : ''}
${result.screenshot ? '- **截圖**: 已保存' : ''}
`).join('\n')}

---
*報告生成時間: ${new Date().toLocaleString('zh-TW')}*
`;

    await fs.writeFile(reportPath, report, 'utf8');
    logger.info(`Generated report: ${reportPath}`);
    return reportPath;
  }
}
