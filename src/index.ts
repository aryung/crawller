import { WebCrawler, PlaywrightCrawler, PuppeteerCoreWebCrawler } from './crawler';
import { ConfigManager, EnhancedConfigManager } from './config';
import { DataExporter, logger, BrowserDetector } from './utils';
import { CrawlerConfig, CrawlerResult, ExportOptions } from './types';

export * from './crawler';
export * from './config';
export * from './utils';
export * from './types';
export * from './transforms';

export class UniversalCrawler {
  private webCrawler: WebCrawler;
  private puppeteerCoreWebCrawler: PuppeteerCoreWebCrawler;
  private playwrightCrawler: PlaywrightCrawler;
  private configManager: EnhancedConfigManager;
  private dataExporter: DataExporter;
  private usePlaywright: boolean;
  private usePuppeteerCore: boolean;

  constructor(options?: {
    usePlaywright?: boolean;
    usePuppeteerCore?: boolean;
    configPath?: string;
    outputDir?: string;
  }) {
    this.webCrawler = new WebCrawler();
    this.puppeteerCoreWebCrawler = new PuppeteerCoreWebCrawler();
    this.playwrightCrawler = new PlaywrightCrawler();
    this.configManager = new EnhancedConfigManager(options?.configPath);
    this.dataExporter = new DataExporter(options?.outputDir);
    this.usePlaywright = options?.usePlaywright || false;
    this.usePuppeteerCore = options?.usePuppeteerCore ?? true; // 預設使用 puppeteer-core
  }

  async crawl(config: CrawlerConfig | string): Promise<CrawlerResult> {
    const crawlerConfig = typeof config === 'string' 
      ? await this.configManager.loadConfig(config)
      : config;

    // 智能引擎選擇
    return await this.crawlWithFallback(crawlerConfig);
  }

  private async crawlWithFallback(config: CrawlerConfig): Promise<CrawlerResult> {
    const errors: string[] = [];
    const startTime = Date.now();

    // 對於靜態網站，優先嘗試 HTTP 模式
    if (this.isHttpCompatible(config)) {
      try {
        logger.info('Trying HTTP mode first (static site detected)...');
        const result = await this.crawlWithHttpMode(config);
        const duration = Date.now() - startTime;
        logger.info(`HTTP mode successful in ${duration}ms`);
        return result;
      } catch (error) {
        const errorMsg = `HTTP mode failed: ${(error as Error).message}`;
        logger.warn(errorMsg);
        errors.push(errorMsg);
      }
    }

    // 1. 嘗試用戶指定的引擎
    if (this.usePlaywright) {
      try {
        logger.info('Trying Playwright engine...');
        const result = await this.playwrightCrawler.crawl(config);
        const duration = Date.now() - startTime;
        logger.info(`Playwright successful in ${duration}ms`);
        return result;
      } catch (error) {
        const errorMsg = `Playwright failed: ${(error as Error).message}`;
        logger.warn(errorMsg);
        errors.push(errorMsg);
      }
    } else if (this.usePuppeteerCore) {
      try {
        logger.info('Trying Puppeteer-Core engine...');
        const result = await this.puppeteerCoreWebCrawler.crawl(config);
        const duration = Date.now() - startTime;
        logger.info(`Puppeteer-Core successful in ${duration}ms`);
        return result;
      } catch (error) {
        const errorMsg = `Puppeteer-Core failed: ${(error as Error).message}`;
        logger.warn(errorMsg);
        errors.push(errorMsg);
      }
    } else {
      try {
        logger.info('Trying Puppeteer engine...');
        const result = await this.webCrawler.crawl(config);
        const duration = Date.now() - startTime;
        logger.info(`Puppeteer successful in ${duration}ms`);
        return result;
      } catch (error) {
        const errorMsg = `Puppeteer failed: ${(error as Error).message}`;
        logger.warn(errorMsg);
        errors.push(errorMsg);
      }
    }

    // 2. 嘗試另一個瀏覽器引擎
    if (this.usePlaywright) {
      // 從 Playwright 回退到 Puppeteer-Core
      try {
        logger.info('Falling back to Puppeteer-Core engine...');
        const result = await this.puppeteerCoreWebCrawler.crawl(config);
        const duration = Date.now() - startTime;
        logger.info(`Puppeteer-Core fallback successful in ${duration}ms`);
        return result;
      } catch (error) {
        const errorMsg = `Puppeteer-Core fallback failed: ${(error as Error).message}`;
        logger.warn(errorMsg);
        errors.push(errorMsg);
      }
    } else if (this.usePuppeteerCore) {
      // 從 Puppeteer-Core 回退到 Playwright
      try {
        logger.info('Falling back to Playwright engine...');
        const result = await this.playwrightCrawler.crawl(config);
        const duration = Date.now() - startTime;
        logger.info(`Playwright fallback successful in ${duration}ms`);
        return result;
      } catch (error) {
        const errorMsg = `Playwright fallback failed: ${(error as Error).message}`;
        logger.warn(errorMsg);
        errors.push(errorMsg);
      }
    } else {
      // 從 Puppeteer 回退到 Puppeteer-Core
      try {
        logger.info('Falling back to Puppeteer-Core engine...');
        const result = await this.puppeteerCoreWebCrawler.crawl(config);
        const duration = Date.now() - startTime;
        logger.info(`Puppeteer-Core fallback successful in ${duration}ms`);
        return result;
      } catch (error) {
        const errorMsg = `Puppeteer-Core fallback failed: ${(error as Error).message}`;
        logger.warn(errorMsg);
        errors.push(errorMsg);
      }
    }

    // 3. 最後嘗試 HTTP 模式（如果還沒試過）
    if (!this.isHttpCompatible(config)) {
      logger.info('Forcing HTTP mode as last resort...');
    } else if (errors.length > 0) {
      logger.info('Retrying HTTP mode as fallback...');
    }
    
    try {
      const result = await this.crawlWithHttpMode(config);
      const duration = Date.now() - startTime;
      logger.info(`HTTP fallback successful in ${duration}ms`);
      return result;
    } catch (error) {
      const errorMsg = `HTTP fallback failed: ${(error as Error).message}`;
      logger.warn(errorMsg);
      errors.push(errorMsg);
    }

    // 所有方法都失敗
    return {
      url: config.url,
      data: {},
      timestamp: new Date(),
      success: false,
      error: `All crawling methods failed:\n${errors.join('\n')}`
    };
  }

  private isHttpCompatible(config: CrawlerConfig): boolean {
    // 如果需要 Cookie 登入或截圖，則不適合 HTTP 模式
    if (config.cookies?.enabled || config.options?.screenshot) {
      return false;
    }

    // 檢查是否為已知的靜態網站
    const staticSites = [
      'moneydj.com',
      'twse.com.tw',
      'tpex.org.tw',
      'cnyes.com',
      'yahoo.com'
    ];

    const url = config.url.toLowerCase();
    const isStaticSite = staticSites.some(site => url.includes(site));
    
    if (isStaticSite) {
      logger.debug(`Detected static site: ${config.url}`);
    }

    return true; // 預設都嘗試 HTTP 模式
  }

  private async crawlWithHttpMode(config: CrawlerConfig): Promise<CrawlerResult> {
    const axios = await import('axios');
    const cheerio = await import('cheerio');
    const { EncodingHelper } = await import('./utils');

    try {
      const response = await axios.default.get(config.url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          ...config.headers
        },
        timeout: config.options?.timeout || 30000,
        maxRedirects: 5,
        responseType: 'arraybuffer' // 獲取原始 buffer 以處理編碼
      });

      // 處理編碼轉換
      let htmlContent: string;
      const buffer = Buffer.from(response.data);
      const contentType = response.headers['content-type'] as string;
      
      if (config.options?.encoding) {
        // 使用指定編碼
        htmlContent = EncodingHelper.convertToUtf8(buffer, config.options.encoding);
        logger.info(`Using specified encoding: ${config.options.encoding}`);
      } else {
        // 自動檢測編碼
        const detectedEncoding = EncodingHelper.detectEncoding(buffer, contentType);
        htmlContent = EncodingHelper.convertToUtf8(buffer, detectedEncoding);
        logger.info(`Auto-detected encoding: ${detectedEncoding}`);
      }

      const $ = cheerio.load(htmlContent);
      const data: Record<string, any> = {};

      if (config.selectors) {
        for (const [key, selector] of Object.entries(config.selectors)) {
          try {
            if (typeof selector === 'string') {
              // 檢查是否為多元素選擇器
              if (selector.includes(':multiple')) {
                const cleanSelector = selector.replace(':multiple', '');
                data[key] = $(cleanSelector).map((_, el) => $(el).text().trim()).get();
              } else {
                data[key] = $(selector).text().trim();
              }
            } else if (selector.attribute) {
              const cleanSelector = selector.selector.replace(':multiple', '');
              if (selector.selector.includes(':multiple')) {
                data[key] = $(cleanSelector).map((_, el) => $(el).attr(selector.attribute!)).get();
              } else {
                data[key] = $(cleanSelector).attr(selector.attribute);
              }
            }
          } catch (selectorError) {
            logger.warn(`Failed to extract ${key}:`, selectorError);
            data[key] = null;
          }
        }
      }

      logger.info(`HTTP mode crawl successful for ${config.url}`);
      return {
        url: config.url,
        data,
        timestamp: new Date(),
        success: true
      };

    } catch (error) {
      throw new Error(`HTTP crawl failed: ${(error as Error).message}`);
    }
  }

  async crawlMultiple(configs: (CrawlerConfig | string)[], concurrent = 3): Promise<CrawlerResult[]> {
    const results: CrawlerResult[] = [];
    
    for (let i = 0; i < configs.length; i += concurrent) {
      const batch = configs.slice(i, i + concurrent);
      const batchResults = await Promise.all(
        batch.map(config => this.crawl(config).catch(error => ({
          url: typeof config === 'string' ? config : config.url,
          data: {},
          timestamp: new Date(),
          success: false,
          error: error.message
        })))
      );
      results.push(...batchResults);
    }

    return results;
  }

  async export(results: CrawlerResult[], options: ExportOptions): Promise<string> {
    return await this.dataExporter.exportResults(results, options);
  }

  async saveScreenshots(results: CrawlerResult[]): Promise<string[]> {
    return await this.dataExporter.saveScreenshots(results);
  }

  async generateReport(results: CrawlerResult[]): Promise<string> {
    return await this.dataExporter.generateReport(results);
  }

  // 配置管理方法
  async saveConfig(name: string, config: CrawlerConfig): Promise<void> {
    return await this.configManager.saveConfig(name, config);
  }

  async loadConfig(name: string): Promise<CrawlerConfig> {
    return await this.configManager.loadConfig(name);
  }

  async listConfigs(): Promise<string[]> {
    return await this.configManager.listConfigs();
  }

  // 清理資源
  async cleanup(): Promise<void> {
    await Promise.all([
      this.webCrawler.cleanup(),
      this.puppeteerCoreWebCrawler.cleanup(),
      this.playwrightCrawler.cleanup()
    ]);
  }

  // 切換爬蟲引擎
  setEngine(usePlaywright: boolean): void {
    this.usePlaywright = usePlaywright;
    logger.info(`Switched to ${usePlaywright ? 'Playwright' : 'Puppeteer'} engine`);
  }
}