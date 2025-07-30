import { PlaywrightCrawler } from './crawler';
import { ConfigManager, EnhancedConfigManager } from './config';
import { DataExporter, logger, BrowserDetector, DomainRateLimiter } from './utils';
import { CrawlerConfig, CrawlerResult, ExportOptions } from './types';
import { builtinTransforms, getTransformFunction } from './transforms';

export * from './crawler';
export * from './config';
export * from './utils';
export * from './types';
export * from './transforms';

export class UniversalCrawler {
  private playwrightCrawler: PlaywrightCrawler;
  private configManager: EnhancedConfigManager;
  private dataExporter: DataExporter;
  private domainRateLimiter: DomainRateLimiter;

  constructor(options?: {
    configPath?: string;
    outputDir?: string;
    defaultDomainDelay?: number;
  }) {
    this.playwrightCrawler = new PlaywrightCrawler();
    this.configManager = new EnhancedConfigManager(options?.configPath);
    this.dataExporter = new DataExporter(options?.outputDir);
    this.domainRateLimiter = new DomainRateLimiter(options?.defaultDomainDelay || 2000);
  }

  async crawl(config: CrawlerConfig | string): Promise<CrawlerResult> {
    let crawlerConfig: CrawlerConfig;
    let enhancedConfig: any = null;

    if (typeof config === 'string') {
      // 嘗試直接獲取增強配置，如果失敗則使用標準配置
      try {
        enhancedConfig = await this.configManager.loadEnhancedConfig(config);
        crawlerConfig = await this.configManager.loadConfig(config);
      } catch (error) {
        crawlerConfig = await this.configManager.loadConfig(config);
      }
    } else {
      crawlerConfig = config;
    }

    // 智能引擎選擇，優先使用增強配置
    return await this.crawlWithFallback(crawlerConfig, enhancedConfig);
  }

  private async crawlWithFallback(config: CrawlerConfig, enhancedConfig?: any): Promise<CrawlerResult> {
    const errors: string[] = [];
    const startTime = Date.now();

    // 對於靜態網站，優先嘗試 HTTP 模式
    if (this.isHttpCompatible(config)) {
      try {
        logger.info('Trying HTTP mode first (static site detected)...');
        const result = await this.crawlWithHttpMode(enhancedConfig || config);
        const duration = Date.now() - startTime;
        logger.info(`HTTP mode successful in ${duration}ms`);
        return result;
      } catch (error) {
        const errorMsg = `HTTP mode failed: ${(error as Error).message}`;
        logger.warn(errorMsg);
        errors.push(errorMsg);
      }
    }

    // 嘗試 Playwright 引擎
    try {
      logger.info('Trying Playwright engine...');
      const result = await this.playwrightCrawler.crawl(enhancedConfig || config);
      const duration = Date.now() - startTime;
      logger.info(`Playwright successful in ${duration}ms`);
      return result;
    } catch (error) {
      const errorMsg = `Playwright failed: ${(error as Error).message}`;
      logger.warn(errorMsg);
      errors.push(errorMsg);
    }

    // 最後嘗試 HTTP 模式（如果還沒試過）
    if (!this.isHttpCompatible(config)) {
      logger.info('Forcing HTTP mode as last resort...');
      
      try {
        const result = await this.crawlWithHttpMode(enhancedConfig || config);
        const duration = Date.now() - startTime;
        logger.info(`HTTP fallback successful in ${duration}ms`);
        return result;
      } catch (error) {
        const errorMsg = `HTTP fallback failed: ${(error as Error).message}`;
        logger.warn(errorMsg);
        errors.push(errorMsg);
      }
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
      let data: Record<string, any> = {};

      if (config.selectors) {
        data = await this.extractDataWithEnhancedSelectors($, config.selectors, config);
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
    
    // 將配置按域名分組
    const configsByDomain = new Map<string, (CrawlerConfig | string)[]>();
    
    for (const config of configs) {
      const crawlerConfig = typeof config === 'string' 
        ? await this.configManager.loadConfig(config)
        : config;
      
      const domain = this.extractDomain(crawlerConfig.url);
      if (!configsByDomain.has(domain)) {
        configsByDomain.set(domain, []);
      }
      configsByDomain.get(domain)!.push(config);
    }

    // 並行處理不同域名，但同域名內的請求序列化處理
    const domainTasks = Array.from(configsByDomain.entries()).map(async ([domain, domainConfigs]) => {
      const domainResults: CrawlerResult[] = [];
      
      // 同域名的請求序列化處理（應用速率限制）
      for (const config of domainConfigs) {
        try {
          // 解析配置以獲取 URL 和域名延遲設定
          const crawlerConfig = typeof config === 'string' 
            ? await this.configManager.loadConfig(config)
            : config;

          // 應用域名速率限制
          const domainDelay = crawlerConfig.options?.domainDelay;
          await this.domainRateLimiter.waitForDomain(crawlerConfig.url, domainDelay);

          // 執行爬取（使用原始配置，讓 crawl 方法處理增強配置）
          const result = await this.crawl(config);
          domainResults.push(result);
          
        } catch (error) {
          domainResults.push({
            url: typeof config === 'string' ? config : config.url,
            data: {},
            timestamp: new Date(),
            success: false,
            error: error.message
          });
        }
      }
      
      return domainResults;
    });

    // 等待所有域名的處理完成
    const allDomainResults = await Promise.all(domainTasks);
    
    // 扁平化結果
    for (const domainResults of allDomainResults) {
      results.push(...domainResults);
    }
    
    // 清理速率限制器
    this.domainRateLimiter.cleanup();

    return results;
  }

  private extractDomain(url: string): string {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch (error) {
      logger.warn(`Failed to extract domain from URL: ${url}`, error);
      return url;
    }
  }

  private async extractDataWithEnhancedSelectors($: any, selectors: any, config: any): Promise<Record<string, any>> {
    const data: Record<string, any> = {};

    for (const [key, selector] of Object.entries(selectors)) {
      try {
        if (typeof selector === 'string') {
          // 簡單字符串選擇器
          if (selector.includes(':multiple')) {
            const cleanSelector = selector.replace(':multiple', '');
            data[key] = $(cleanSelector).map((_, el) => $(el).text().trim()).get();
          } else {
            data[key] = $(selector).text().trim();
          }
        } else if (typeof selector === 'object' && selector !== null) {
          // Enhanced Selector 對象
          const selectorObj = selector as any;
          
          if (selectorObj.selector || selectorObj.extract) {
            // 這是 EnhancedSelectorItem 格式或有 extract 配置
            data[key] = await this.processEnhancedSelector($, selectorObj, config);
          }
        }
      } catch (selectorError) {
        logger.warn(`Failed to extract ${key}:`, selectorError);
        data[key] = null;
      }
    }

    return data;
  }

  private async processEnhancedSelector($: any, selectorObj: any, config: any): Promise<any> {
    const { selector, multiple, extract, attribute, transform } = selectorObj;
    
    if (extract) {
      // 有 extract 配置 - 提取多個屬性
      const cleanSelector = selector ? selector.replace(':multiple', '') : '';
      const isMultiple = multiple || (selector && selector.includes(':multiple'));
      return await this.processExtractConfig($, { selector: cleanSelector, multiple: isMultiple, extract }, config);
    }
    
    if (!selector) {
      logger.warn('Enhanced selector missing selector property');
      return null;
    }

    const cleanSelector = selector.replace(':multiple', '');
    const isMultiple = multiple || selector.includes(':multiple');

    if (attribute) {
      // 提取特定屬性
      let values = isMultiple
        ? $(cleanSelector).map((_, el) => $(el).attr(attribute)).get()
        : $(cleanSelector).attr(attribute);

      // 應用轉換
      if (transform) {
        values = await this.applyTransform(values, transform, config);
      }

      return values;
    } else {
      // 提取文本
      let values = isMultiple
        ? $(cleanSelector).map((_, el) => $(el).text().trim()).get()
        : $(cleanSelector).text().trim();

      // 應用轉換
      if (transform) {
        values = await this.applyTransform(values, transform, config);
      }

      return values;
    }
  }

  private async processExtractConfig($: any, selectorConfig: any, config: any): Promise<any> {
    const { selector, multiple, extract } = selectorConfig;
    const isMultiple = multiple || selector.includes(':multiple');
    const cleanSelector = selector.replace(':multiple', '');

    // Check if selector matches any elements
    const matchedElements = $(cleanSelector);
    if (matchedElements.length === 0) {
      logger.debug(`Selector "${cleanSelector}" matched no elements`);
      return isMultiple ? [] : null;
    }

    if (isMultiple) {
      // 多元素提取
      const results: any[] = [];
      for (let i = 0; i < $(cleanSelector).length; i++) {
        const element = $(cleanSelector).eq(i);
        const result: any = {};
        for (const [key, extractConfig] of Object.entries(extract)) {
          result[key] = await this.extractSingleValue($, element, extractConfig, config);
        }
        results.push(result);
      }
      return results;
    } else {
      // 單元素提取
      const element = $(cleanSelector).first();
      if (element.length === 0) return null;

      const result: any = {};
      for (const [key, extractConfig] of Object.entries(extract)) {
        result[key] = await this.extractSingleValue($, element, extractConfig, config);
      }
      return result;
    }
  }

  private async extractSingleValue($: any, element: any, extractConfig: any, config: any): Promise<any> {
    let value: any;

    if (typeof extractConfig === 'string') {
      // 直接提取文本或屬性
      if (extractConfig === 'text') {
        value = $(element).text().trim();
      } else {
        value = $(element).attr(extractConfig);
      }
    } else if (typeof extractConfig === 'object' && extractConfig !== null) {
      // 對象配置
      const { attribute, transform } = extractConfig;
      
      if (attribute) {
        value = $(element).attr(attribute);
      } else {
        value = $(element).text().trim();
      }

      // 應用轉換
      if (transform) {
        value = await this.applyTransform(value, transform, config);
      }
    }

    return value;
  }

  private async applyTransform(value: any, transformName: string, config: any): Promise<any> {
    try {
      // 創建 context 用於轉換函數
      const context = {
        url: config.url,
        baseUrl: config.variables?.baseUrl || config.url
      };
      
      // 檢查是否為內建轉換函數或網站特定轉換函數
      const transformFn = getTransformFunction(transformName, context);
      if (transformFn) {
        return transformFn(value, context);
      }

      // 檢查是否為配置中定義的自定義轉換
      if (config.transforms && config.transforms[transformName]) {
        const customTransformCode = config.transforms[transformName];
        // 創建函數並執行
        const fn = new Function('value', 'context', customTransformCode);
        const context = {
          url: config.url,
          baseUrl: config.variables?.baseUrl || config.url
        };
        return fn(value, context);
      }

      // 如果沒有找到轉換函數，返回原值
      logger.warn(`Transform function '${transformName}' not found`);
      return value;
    } catch (error) {
      logger.warn(`Error applying transform '${transformName}':`, error);
      return value;
    }
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
    await this.playwrightCrawler.cleanup();
  }

}