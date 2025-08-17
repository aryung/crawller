#!/usr/bin/env tsx

/**
 * 股票代碼驗證腳本
 * 批量檢查股票代碼是否有效，識別已下市或變更的股票
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import { Page, Browser, chromium } from 'playwright';

interface StockValidationResult {
  stockCode: string;
  market: string;
  url: string;
  isValid: boolean;
  status: 'valid' | '404' | '403' | 'timeout' | 'error';
  error?: string;
  redirectUrl?: string;
}

interface ValidationReport {
  total: number;
  valid: number;
  invalid: number;
  byStatus: Record<string, number>;
  invalidStocks: StockValidationResult[];
  recommendations: string[];
}

class StockCodeValidator {
  private browser?: Browser;
  private page?: Page;

  constructor() {}

  /**
   * 初始化瀏覽器
   */
  async init(): Promise<void> {
    this.browser = await chromium.launch({
      headless: true,
      timeout: 30000
    });
    this.page = await this.browser.newPage();
    
    // 設置通用 headers
    await this.page.setExtraHTTPHeaders({
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    });
  }

  /**
   * 清理資源
   */
  async cleanup(): Promise<void> {
    if (this.page) {
      await this.page.close();
    }
    if (this.browser) {
      await this.browser.close();
    }
  }

  /**
   * 構建股票 URL
   */
  buildStockUrl(stockCode: string, market: string): string {
    switch (market.toLowerCase()) {
      case 'us':
        return `https://finance.yahoo.com/quote/${stockCode}`;
      case 'tw':
        return `https://tw.stock.yahoo.com/quote/${stockCode}.TW`;
      case 'jp':
        return `https://finance.yahoo.com/quote/${stockCode}.T`;
      default:
        throw new Error(`不支援的市場: ${market}`);
    }
  }

  /**
   * 驗證單個股票代碼
   */
  async validateSingleStock(stockCode: string, market: string): Promise<StockValidationResult> {
    const url = this.buildStockUrl(stockCode, market);
    const result: StockValidationResult = {
      stockCode,
      market,
      url,
      isValid: false,
      status: 'error'
    };

    try {
      if (!this.page) {
        throw new Error('頁面未初始化');
      }

      // 設置較短的超時時間
      const response = await this.page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: 15000
      });

      if (!response) {
        result.status = 'error';
        result.error = '無回應';
        return result;
      }

      const status = response.status();
      
      if (status === 404) {
        result.status = '404';
        result.error = '頁面不存在';
      } else if (status === 403) {
        result.status = '403';
        result.error = '權限被拒';
      } else if (status >= 400) {
        result.status = 'error';
        result.error = `HTTP ${status}`;
      } else {
        // 檢查是否有重定向
        const currentUrl = this.page.url();
        if (currentUrl !== url) {
          result.redirectUrl = currentUrl;
        }

        // 檢查頁面內容是否有效
        try {
          // 等待關鍵元素載入
          await this.page.waitForSelector('[data-symbol], .quote-header, .quoteHeader', {
            timeout: 5000
          });

          // 檢查是否有錯誤訊息
          const errorElements = await this.page.$$('text=Quote not found, text=Symbol not found, text=404');
          if (errorElements.length > 0) {
            result.status = '404';
            result.error = '股票不存在';
          } else {
            result.isValid = true;
            result.status = 'valid';
          }
        } catch (e) {
          // 如果找不到關鍵元素，可能是頁面結構變化或股票不存在
          const pageText = await this.page.textContent('body') || '';
          if (pageText.toLowerCase().includes('not found') || 
              pageText.toLowerCase().includes('quote lookup failed') ||
              pageText.toLowerCase().includes('symbol not found')) {
            result.status = '404';
            result.error = '股票不存在（頁面內容檢查）';
          } else {
            result.isValid = true;
            result.status = 'valid';
            result.error = '頁面載入完成但結構可能變化';
          }
        }
      }

    } catch (error) {
      const errorMessage = (error as Error).message;
      if (errorMessage.includes('timeout') || errorMessage.includes('Timeout')) {
        result.status = 'timeout';
        result.error = '請求超時';
      } else {
        result.status = 'error';
        result.error = errorMessage;
      }
    }

    return result;
  }

  /**
   * 從配置檔案提取股票代碼
   */
  async extractStockCodesFromConfigs(configDir: string = 'config-categorized'): Promise<Array<{stockCode: string; market: string}>> {
    const stocks: Array<{stockCode: string; market: string}> = [];
    
    if (!await fs.pathExists(configDir)) {
      throw new Error(`配置目錄不存在: ${configDir}`);
    }

    const findConfigFiles = async (dir: string): Promise<string[]> => {
      const files: string[] = [];
      const items = await fs.readdir(dir);
      
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = await fs.stat(fullPath);
        
        if (stat.isDirectory()) {
          files.push(...await findConfigFiles(fullPath));
        } else if (item.endsWith('.json') && item.includes('yahoo-finance')) {
          files.push(fullPath);
        }
      }
      
      return files;
    };

    const configFiles = await findConfigFiles(configDir);
    console.log(`📁 發現 ${configFiles.length} 個配置檔案`);

    const stockSet = new Set<string>();

    for (const file of configFiles) {
      // 從檔案名解析股票代碼和市場
      const filename = path.basename(file);
      const match = filename.match(/yahoo-finance-(\w+)-\w+(?:-\w+)*-(.+)\.json$/);
      
      if (match) {
        const [, market, stockPart] = match;
        const stockCode = stockPart.replace(/_TW$/, ''); // 移除 _TW 後綴
        
        const key = `${stockCode}-${market}`;
        if (!stockSet.has(key)) {
          stocks.push({ stockCode, market });
          stockSet.add(key);
        }
      }
    }

    console.log(`📊 提取到 ${stocks.length} 個唯一股票代碼`);
    return stocks;
  }

  /**
   * 批量驗證股票代碼
   */
  async validateStocks(
    stocks: Array<{stockCode: string; market: string}>,
    options: {
      concurrent?: number;
      delay?: number;
      dryRun?: boolean;
    } = {}
  ): Promise<ValidationReport> {
    const { concurrent = 2, delay = 3000, dryRun = false } = options;
    
    if (dryRun) {
      console.log('🧪 預覽模式：將驗證以下股票代碼');
      stocks.slice(0, 10).forEach((stock, i) => {
        console.log(`   ${i + 1}. ${stock.stockCode} (${stock.market.toUpperCase()})`);
      });
      if (stocks.length > 10) {
        console.log(`   ... 還有 ${stocks.length - 10} 個股票`);
      }
      return {
        total: stocks.length,
        valid: 0,
        invalid: 0,
        byStatus: {},
        invalidStocks: [],
        recommendations: ['執行 npm run crawl:validate:stocks 進行實際驗證']
      };
    }

    console.log(`🚀 開始驗證 ${stocks.length} 個股票代碼...`);
    console.log(`⚙️  併發數: ${concurrent}, 延遲: ${delay}ms`);
    
    const results: StockValidationResult[] = [];
    const chunks = this.chunkArray(stocks, concurrent);
    
    let completed = 0;
    const startTime = Date.now();

    for (const chunk of chunks) {
      const chunkPromises = chunk.map(async (stock) => {
        const result = await this.validateSingleStock(stock.stockCode, stock.market);
        completed++;
        
        const progress = ((completed / stocks.length) * 100).toFixed(1);
        const elapsed = (Date.now() - startTime) / 1000;
        const estimatedTotal = (elapsed / completed) * stocks.length;
        const remaining = estimatedTotal - elapsed;
        
        console.log(`[${progress}%] ${stock.stockCode} (${stock.market.toUpperCase()}): ${result.status} (剩餘 ${remaining.toFixed(0)}s)`);
        
        return result;
      });

      const chunkResults = await Promise.all(chunkPromises);
      results.push(...chunkResults);

      // 延遲以避免過於頻繁的請求
      if (delay > 0 && results.length < stocks.length) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    return this.generateReport(results);
  }

  /**
   * 將陣列分割成指定大小的塊
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * 生成驗證報告
   */
  generateReport(results: StockValidationResult[]): ValidationReport {
    const total = results.length;
    const valid = results.filter(r => r.isValid).length;
    const invalid = total - valid;
    
    const byStatus: Record<string, number> = {};
    const invalidStocks: StockValidationResult[] = [];

    results.forEach(result => {
      byStatus[result.status] = (byStatus[result.status] || 0) + 1;
      if (!result.isValid) {
        invalidStocks.push(result);
      }
    });

    const recommendations = this.generateRecommendations(byStatus, invalidStocks);

    return {
      total,
      valid,
      invalid,
      byStatus,
      invalidStocks,
      recommendations
    };
  }

  /**
   * 生成建議
   */
  generateRecommendations(
    byStatus: Record<string, number>,
    invalidStocks: StockValidationResult[]
  ): string[] {
    const recommendations: string[] = [];

    if (byStatus['404'] > 0) {
      recommendations.push(
        `🔍 發現 ${byStatus['404']} 個 404 錯誤股票：`,
        '   • 這些股票可能已下市或代碼變更',
        '   • 建議從配置中移除這些股票',
        '   • 可執行: npm run crawl:clean:invalid'
      );
    }

    if (byStatus['403'] > 0) {
      recommendations.push(
        `🚫 發現 ${byStatus['403']} 個權限錯誤股票：`,
        '   • 可能存在地區限制或反爬蟲機制',
        '   • 建議調整請求頻率或使用代理'
      );
    }

    if (byStatus['timeout'] > 0) {
      recommendations.push(
        `⏰ 發現 ${byStatus['timeout']} 個超時股票：`,
        '   • 可能是網路問題或服務器負載高',
        '   • 建議稍後重新驗證'
      );
    }

    if (invalidStocks.length > 10) {
      recommendations.push(
        `⚠️  發現大量無效股票 (${invalidStocks.length} 個)：`,
        '   • 建議檢查股票數據來源是否需要更新',
        '   • 執行: npm run update:stockcodes 更新股票列表'
      );
    }

    return recommendations;
  }

  /**
   * 輸出驗證報告
   */
  printReport(report: ValidationReport): void {
    console.log('\n' + '='.repeat(60));
    console.log('📊 股票代碼驗證報告');
    console.log('='.repeat(60));
    
    console.log(`\n📋 總覽：`);
    console.log(`   • 總驗證數：${report.total}`);
    console.log(`   • ✅ 有效：${report.valid} (${(report.valid/report.total*100).toFixed(1)}%)`);
    console.log(`   • ❌ 無效：${report.invalid} (${(report.invalid/report.total*100).toFixed(1)}%)`);

    console.log(`\n📈 狀態分佈：`);
    Object.entries(report.byStatus)
      .sort((a, b) => b[1] - a[1])
      .forEach(([status, count]) => {
        const icon = status === 'valid' ? '✅' : 
                    status === '404' ? '🔍' :
                    status === '403' ? '🚫' :
                    status === 'timeout' ? '⏰' : '❌';
        console.log(`   ${icon} ${status}: ${count} 個`);
      });

    if (report.invalidStocks.length > 0) {
      console.log(`\n❌ 無效股票詳情：`);
      
      // 按狀態分組顯示
      const groupedByStatus: Record<string, StockValidationResult[]> = {};
      report.invalidStocks.forEach(stock => {
        if (!groupedByStatus[stock.status]) {
          groupedByStatus[stock.status] = [];
        }
        groupedByStatus[stock.status].push(stock);
      });

      Object.entries(groupedByStatus).forEach(([status, stocks]) => {
        console.log(`   📌 ${status.toUpperCase()} (${stocks.length} 個):`);
        stocks.slice(0, 10).forEach((stock, index) => {
          console.log(`      ${index + 1}. ${stock.stockCode} (${stock.market.toUpperCase()}) - ${stock.error}`);
        });
        if (stocks.length > 10) {
          console.log(`      ... 還有 ${stocks.length - 10} 個`);
        }
      });
    }

    console.log(`\n💡 處理建議：`);
    report.recommendations.forEach(rec => {
      console.log(`   ${rec}`);
    });

    console.log(`\n🛠️  後續操作：`);
    console.log(`   • npm run crawl:clean:invalid    - 清理無效股票配置`);
    console.log(`   • npm run update:stockcodes      - 更新股票代碼資料庫`);
    console.log(`   • npm run generate:configs       - 重新生成配置檔案`);
  }

  /**
   * 保存驗證結果到檔案
   */
  async saveResults(report: ValidationReport, outputPath: string = 'output/stock-validation-report.json'): Promise<void> {
    await fs.ensureDir(path.dirname(outputPath));
    
    const reportData = {
      timestamp: new Date().toISOString(),
      summary: {
        total: report.total,
        valid: report.valid,
        invalid: report.invalid,
        byStatus: report.byStatus
      },
      invalidStocks: report.invalidStocks,
      recommendations: report.recommendations
    };

    await fs.writeFile(outputPath, JSON.stringify(reportData, null, 2));
    console.log(`\n💾 驗證報告已保存到: ${outputPath}`);
  }
}

// 主函數
async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const helpFlag = args.includes('--help') || args.includes('-h');
  const concurrent = parseInt(args.find(arg => arg.startsWith('--concurrent='))?.split('=')[1] || '2');
  const delay = parseInt(args.find(arg => arg.startsWith('--delay='))?.split('=')[1] || '3000');
  const outputPath = args.find(arg => arg.startsWith('--output='))?.split('=')[1];

  if (helpFlag) {
    console.log(`
📋 股票代碼驗證工具使用說明

使用方式：
  tsx scripts/validate-stock-codes.ts [選項]

選項：
  --dry-run                     預覽模式，不實際驗證
  --concurrent=<數量>           併發驗證數量 (預設: 2)
  --delay=<毫秒>                請求間延遲 (預設: 3000ms)
  --output=<路徑>               報告輸出路徑
  --help, -h                    顯示此幫助信息

範例：
  tsx scripts/validate-stock-codes.ts --dry-run
  tsx scripts/validate-stock-codes.ts --concurrent=3 --delay=5000
  tsx scripts/validate-stock-codes.ts --output=output/validation-$(date +%Y%m%d).json
`);
    return;
  }

  const validator = new StockCodeValidator();

  try {
    console.log('🔍 提取股票代碼...');
    const stocks = await validator.extractStockCodesFromConfigs();
    
    if (stocks.length === 0) {
      console.log('❌ 未找到任何股票代碼');
      return;
    }

    if (!dryRun) {
      console.log('🚀 初始化瀏覽器...');
      await validator.init();
    }

    const report = await validator.validateStocks(stocks, {
      concurrent,
      delay,
      dryRun
    });

    validator.printReport(report);

    if (!dryRun && outputPath) {
      await validator.saveResults(report, outputPath);
    }

  } catch (error) {
    console.error('❌ 驗證過程中發生錯誤:', error);
    process.exit(1);
  } finally {
    await validator.cleanup();
  }
}

// 執行主函數
if (require.main === module) {
  main().catch(console.error);
}

export { StockCodeValidator };