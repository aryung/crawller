#!/usr/bin/env tsx

import { chromium, Browser } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import { StockScraperBase, SectorResult, Stock, CategoryLink, CategoriesData } from './lib/stock-scraper-base';

/**
 * Yahoo Japan 股票詳細資料爬蟲腳本
 * 讀取 yahoo-jp-stock-categories.json，遍歷每個分類連結，爬取股票詳細資料
 * 輸出格式: {sectorId: [{name: "公司名", symbolCode: "股票代碼"}]}
 */

class YahooJPStockDetailsScraper extends StockScraperBase {
  /**
   * 爬取單個分類的股票列表
   */
  async scrapeStockListForSector(
    browser: Browser,
    categoryName: string,
    url: string,
    retryCount: number = 0
  ): Promise<SectorResult> {
    const sectorId = this.extractSectorId(url) || categoryName;
    console.log(`📈 處理分類: ${categoryName} (ID: ${sectorId})`);

    const context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      viewport: { width: 1920, height: 1080 },
    });

    const page = await context.newPage();

    try {
      console.log(`🔗 載入 URL: ${url}`);

      // 載入頁面
      await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });

      // 等待頁面載入
      await page.waitForTimeout(3000);

      // 等待表格載入
      try {
        await page.waitForSelector('table, [role="table"], .table, tbody', {
          timeout: 10000,
        });
      } catch (e) {
        console.log('⚠️  未檢測到表格元素，繼續嘗試提取');
      }

      // 提取股票列表
      const stockList = await page.evaluate(() => {
        const stocks: Stock[] = [];

        console.log('開始分析頁面結構...');

        // 嘗試多種可能的選擇器 (針對日本市場)
        const selectors = [
          'tbody tr',
          'table tr',
          '[data-symbol]',
          'a[href*="/stocks/"]',
          '.stock-item',
          'tr[data-row-key]',
          '[class*="StocksTable"]',
          '[class*="ranking"]',
        ];

        let foundElements: NodeListOf<Element> | null = null;

        for (const selector of selectors) {
          const elements = document.querySelectorAll(selector);
          if (elements.length > 0) {
            console.log(
              `測試選擇器: ${selector}, 找到 ${elements.length} 個元素`
            );
            // 檢查第一個元素是否包含股票相關信息
            const firstElement = elements[0];
            const hasStockInfo =
              firstElement.textContent?.includes('.T') ||
              firstElement.querySelector('a[href*="stocks"]') ||
              /\d{4}/.test(firstElement.textContent || '');

            if (hasStockInfo) {
              console.log(
                `✅ 使用選擇器: ${selector}, 找到 ${elements.length} 個相關元素`
              );
              foundElements = elements;
              break;
            }
          }
        }

        if (!foundElements) {
          console.log('⚠️  未找到股票列表元素');
          return [];
        }

        foundElements.forEach((element, index) => {
          try {
            let symbolCode = '';
            let companyName = '';

            // 提取股票代碼 (日本市場通常是4位數字.T)
            const symbolElement = element.querySelector('a[href*="/stocks/"], .stock-code, td:first-child');
            if (symbolElement) {
              const href = (symbolElement as HTMLAnchorElement).href;
              if (href) {
                const match = href.match(/code=(\d{4})/);
                if (match) {
                  symbolCode = match[1];
                }
              } else {
                const text = symbolElement.textContent?.trim() || '';
                const codeMatch = text.match(/(\d{4})/);
                if (codeMatch) {
                  symbolCode = codeMatch[1];
                }
              }
            }

            // 如果還沒找到，直接從元素文本中提取
            if (!symbolCode) {
              const fullText = element.textContent || '';
              const codeMatch = fullText.match(/(\d{4})(?:\.T)?/);
              if (codeMatch) {
                symbolCode = codeMatch[1];
              }
            }

            // 提取公司名稱
            const nameElement = element.querySelector('td:nth-child(2), .company-name, .stock-name');
            if (nameElement) {
              let name = nameElement.textContent?.trim() || '';
              // 移除股票代碼部分，只保留公司名稱
              name = name.replace(/\d{4}\.?T?/g, '').trim();
              if (name && name.length > 0 && name !== symbolCode) {
                companyName = name;
              }
            }

            // 驗證和清理數據
            if (symbolCode && companyName) {
              // 驗證股票代碼格式 (通常是4位數字)
              if (/^\d{4}$/.test(symbolCode)) {
                stocks.push({
                  name: companyName,
                  symbolCode: `${symbolCode}.T`, // 添加 .T 後綴
                });
                console.log(`提取股票: ${symbolCode}.T - ${companyName}`);
              }
            }
          } catch (error: any) {
            console.log(`處理第 ${index} 個元素時出錯:`, error.message);
          }
        });

        return stocks;
      });

      console.log(`✅ ${categoryName} 完成，找到 ${stockList.length} 支股票`);

      await context.close();
      return { sectorId, categoryName, stocks: stockList };
    } catch (error: any) {
      console.error(`❌ ${categoryName} 處理失敗:`, error.message);

      await context.close();

      // 重試機制
      if (retryCount < this.retryCount) {
        console.log(`🔄 重試 ${categoryName} (${retryCount + 1}/${this.retryCount})`);
        await this.delay(2000);
        return this.scrapeStockListForSector(
          browser,
          categoryName,
          url,
          retryCount + 1
        );
      }

      return { sectorId, categoryName, stocks: [], error: error.message };
    }
  }
}

/**
 * 主函數
 */
async function scrapeYahooJPStockDetails(): Promise<any> {
  // 解析命令行參數
  const args = process.argv.slice(2);
  const limitArg = args.find((arg) => arg.startsWith('--limit='));
  const sectorArg = args.find((arg) => arg.startsWith('--sector='));
  const concurrentArg = args.find((arg) => arg.startsWith('--concurrent='));

  const limit = limitArg ? parseInt(limitArg.split('=')[1]) : null;
  const specificSector = sectorArg ? sectorArg.split('=')[1] : null;
  const concurrentLimit = concurrentArg
    ? parseInt(concurrentArg.split('=')[1])
    : 2;

  console.log('🔍 Yahoo Japan 股票詳細資料爬蟲啟動');
  console.log('====================================');

  if (limit) console.log(`📊 限制處理: ${limit} 個分類`);
  if (specificSector) console.log(`🎯 指定分類: ${specificSector}`);
  console.log(`⚡ 並發數量: ${concurrentLimit}`);

  try {
    // 讀取股票分類數據
    const outputDir = path.join(__dirname, '../output');
    const files = fs
      .readdirSync(outputDir)
      .filter(
        (file) =>
          file.startsWith('yahoo-jp-stock-categories') && file.endsWith('.json')
      )
      .sort((a, b) => b.localeCompare(a));

    if (files.length === 0) {
      throw new Error('找不到日本股票分類數據文件，請先執行 scrape-yahoo-jp-stock-categories.ts');
    }

    const latestFile = path.join(outputDir, files[0]);
    console.log(`📁 使用分類數據文件: ${latestFile}`);
    const categoriesData: CategoriesData = JSON.parse(fs.readFileSync(latestFile, 'utf8'));

    // 收集所有分類
    const allCategories: CategoryLink[] = [];
    Object.keys(categoriesData).forEach((categoryGroup) => {
      categoriesData[categoryGroup].forEach((category) => {
        allCategories.push(category);
      });
    });

    console.log(`📊 總共發現 ${allCategories.length} 個分類`);

    // 過濾分類
    let categoriesToProcess = allCategories;
    const scraper = new YahooJPStockDetailsScraper(concurrentLimit);

    if (specificSector) {
      categoriesToProcess = allCategories.filter(
        (cat) => cat.name === specificSector
      );
      console.log(`🎯 過濾後處理 ${categoriesToProcess.length} 個分類`);
    }

    if (limit) {
      categoriesToProcess = categoriesToProcess.slice(0, limit);
      console.log(`📊 限制處理前 ${categoriesToProcess.length} 個分類`);
    }

    // 啟動瀏覽器
    console.log('🚀 啟動瀏覽器...');
    const browser = await chromium.launch({
      headless: true,
      timeout: 30000,
    });

    // 批次處理分類
    const results = await scraper.processCategoriesInBatches(
      browser,
      categoriesToProcess,
      concurrentLimit
    );

    await browser.close();

    // 整理結果
    const stockDetails: { [sectorId: string]: Stock[] } = {};
    let totalStocks = 0;
    let successfulCategories = 0;

    Object.keys(results).forEach((sectorId) => {
      const { stocks, error } = results[sectorId];
      stockDetails[sectorId] = stocks;
      totalStocks += stocks.length;
      if (!error && stocks.length > 0) successfulCategories++;
    });

    // 保存結果
    const timestamp = new Date()
      .toISOString()
      .slice(0, 16)
      .replace(/[:\-]/g, '')
      .replace('T', '-');
    const outputPath = path.join(
      outputDir,
      `yahoo-jp-stock-details_${timestamp}.json`
    );

    fs.writeFileSync(outputPath, JSON.stringify(stockDetails, null, 2), 'utf8');

    console.log('✅ 爬取完成！');
    console.log('====================================');
    console.log(`📄 結果文件: ${outputPath}`);
    console.log(`📊 處理分類: ${Object.keys(results).length}`);
    console.log(`✅ 成功分類: ${successfulCategories}`);
    console.log(`🎯 總股票數: ${totalStocks}`);

    return stockDetails;
  } catch (error: any) {
    console.error('❌ 爬取過程中發生錯誤:', error.message);
    throw error;
  }
}

// 如果直接執行此腳本
if (require.main === module) {
  scrapeYahooJPStockDetails()
    .then((data) => {
      console.log('🏆 爬取任務完成！');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 爬取任務失敗:', error);
      process.exit(1);
    });
}

export { scrapeYahooJPStockDetails };