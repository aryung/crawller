import { chromium, Browser, Page } from 'playwright';
import { CrawlerConfig, CrawlerResult, CrawlerOptions } from '../types';
import { DataExtractor } from './DataExtractor';
import { logger, delay, validateCrawlerConfig } from '../utils';

export class PlaywrightCrawler {
  private browser: Browser | null = null;
  private dataExtractor: DataExtractor;
  private defaultOptions: CrawlerOptions = {
    waitFor: 2000,
    timeout: 30000,
    retries: 3,
    headless: true,
    delay: 1000,
    viewport: { width: 1920, height: 1080 }
  };

  constructor() {
    this.dataExtractor = new DataExtractor();
  }

  async crawl(config: CrawlerConfig): Promise<CrawlerResult> {
    const errors = validateCrawlerConfig(config);
    if (errors.length > 0) {
      throw new Error(`Configuration errors: ${errors.join(', ')}`);
    }

    const options = { ...this.defaultOptions, ...config.options };
    let attempt = 0;
    let lastError: Error | null = null;

    while (attempt < (options.retries || 3)) {
      try {
        attempt++;
        logger.info(`Playwright crawling attempt ${attempt} for ${config.url}`);
        
        return await this.crawlWithPlaywright(config, options);
      } catch (error) {
        lastError = error as Error;
        logger.warn(`Playwright attempt ${attempt} failed:`, error);
        
        if (attempt < (options.retries || 3)) {
          await delay(options.delay || 1000);
          await this.cleanup();
        }
      }
    }

    return {
      url: config.url,
      data: {},
      timestamp: new Date(),
      success: false,
      error: lastError?.message || 'Unknown error'
    };
  }

  private async crawlWithPlaywright(config: CrawlerConfig, options: CrawlerOptions): Promise<CrawlerResult> {
    let page: Page | null = null;
    
    try {
      if (!this.browser) {
        this.browser = await chromium.launch({
          headless: options.headless ?? true,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage'
          ]
        });
      }

      page = await this.browser.newPage({
        viewport: options.viewport,
        userAgent: options.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      });

      // 設定額外的 headers
      if (config.headers) {
        await page.setExtraHTTPHeaders(config.headers);
      }

      // 處理 cookies（簡化版本）
      if (config.cookies?.cookieString) {
        const cookies = this.parseCookies(config.cookies.cookieString, config.url);
        await page.context().addCookies(cookies);
      }

      // 導航到目標頁面
      await page.goto(config.url, { 
        waitUntil: 'networkidle',
        timeout: options.timeout 
      });

      // 等待指定時間
      if (options.waitFor) {
        await page.waitForTimeout(options.waitFor);
      }

      // 提取資料 - 需要適配 Playwright
      const data = await this.extractDataPlaywright(page, config.selectors || {});

      // 截圖
      let screenshot: Buffer | undefined;
      if (options.screenshot) {
        screenshot = await page.screenshot({ fullPage: true });
      }

      return {
        url: config.url,
        data,
        timestamp: new Date(),
        success: true,
        screenshot
      };

    } finally {
      if (page) {
        await page.close().catch(() => {});
      }
    }
  }

  private async extractDataPlaywright(page: Page, selectors: any): Promise<Record<string, any>> {
    const data: Record<string, any> = {};

    for (const [key, selector] of Object.entries(selectors)) {
      try {
        if (typeof selector === 'string') {
          const element = await page.$(selector);
          if (element) {
            data[key] = await element.textContent() || '';
          }
        }
      } catch (error) {
        logger.warn(`Failed to extract ${key}:`, error);
        data[key] = null;
      }
    }

    return data;
  }

  private parseCookies(cookieString: string, url: string) {
    const domain = new URL(url).hostname;
    return cookieString.split(';').map(cookie => {
      const [name, value] = cookie.trim().split('=');
      return {
        name: name.trim(),
        value: value?.trim() || '',
        domain,
        path: '/'
      };
    });
  }

  async cleanup(): Promise<void> {
    if (this.browser) {
      try {
        await this.browser.close();
        this.browser = null;
        logger.info('Playwright browser closed successfully');
      } catch (error) {
        logger.warn('Error closing Playwright browser:', error);
        this.browser = null;
      }
    }
  }
}