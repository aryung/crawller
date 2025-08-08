import { Browser, BrowserContext, Page } from 'playwright';

export interface Stock {
  name: string;
  symbolCode: string;
}

export interface SectorResult {
  sectorId: string | null;
  categoryName: string;
  stocks: Stock[];
  error?: string;
}

export interface StockDetails {
  [sectorId: string]: Stock[];
}

export interface CategoryLink {
  name: string;
  url: string;
}

export interface CategoriesData {
  [category: string]: CategoryLink[];
}

export abstract class StockScraperBase {
  protected concurrentLimit: number;
  protected retryCount: number;

  constructor(concurrentLimit: number = 2, retryCount: number = 2) {
    this.concurrentLimit = concurrentLimit;
    this.retryCount = retryCount;
  }

  /**
   * 從 URL 中提取 sectorId
   */
  protected extractSectorId(url: string): string | null {
    const match = url.match(/sectorId=(\d+)/);
    return match ? match[1] : null;
  }

  /**
   * 延遲函數
   */
  protected delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 爬取單個分類的股票列表
   */
  abstract scrapeStockListForSector(
    browser: Browser,
    categoryName: string,
    url: string,
    retryCount?: number
  ): Promise<SectorResult>;

  /**
   * 批次處理分類
   */
  async processCategoriesInBatches(
    browser: Browser,
    categories: CategoryLink[],
    batchSize: number = 2
  ): Promise<{ [sectorId: string]: { categoryName: string; stocks: Stock[]; error?: string } }> {
    const results: { [sectorId: string]: { categoryName: string; stocks: Stock[]; error?: string } } = {};
    const totalCategories = categories.length;
    let processedCount = 0;

    for (let i = 0; i < totalCategories; i += batchSize) {
      const batch = categories.slice(i, i + batchSize);
      console.log(
        `📦 處理批次 ${Math.floor(i / batchSize) + 1}/${Math.ceil(totalCategories / batchSize)}`
      );

      const batchPromises = batch.map((category) =>
        this.scrapeStockListForSector(browser, category.name, category.url)
      );

      const batchResults = await Promise.allSettled(batchPromises);

      batchResults.forEach((result) => {
        if (result.status === 'fulfilled') {
          const { sectorId, categoryName, stocks, error } = result.value;
          if (sectorId) {
            results[sectorId] = {
              categoryName,
              stocks,
              ...(error && { error }),
            };
          }
          processedCount++;
        } else {
          console.error(`❌ 批次處理失敗:`, result.reason);
        }
      });

      console.log(`📊 進度: ${processedCount}/${totalCategories}`);

      // 批次間等待
      if (i + batchSize < totalCategories) {
        await this.delay(1000);
      }
    }

    return results;
  }
}