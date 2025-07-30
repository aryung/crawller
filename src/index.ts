import { PlaywrightCrawler } from './crawler';
import { EnhancedConfigManager } from './config';
import { DataExporter, logger, DomainRateLimiter } from './utils';
import { CrawlerConfig, CrawlerResult, ExportOptions, EnhancedCrawlerConfig, EnhancedSelectorConfig, EnhancedSelectorItem, ExtractConfig, SelectorConfig, TransformFunction } from './types';
import { getTransformFunction } from './transforms';
import { CheerioAPI } from 'cheerio';

export * from './crawler';
export * from './config';
export * from './utils';
export * from './types';
export * from './transforms';

function isEnhancedConfig(config: CrawlerConfig | EnhancedCrawlerConfig): config is EnhancedCrawlerConfig {
  return 'transforms' in config || 'variables' in config || 'dataDriven' in config || 'export' in config;
}

export class UniversalCrawler {
  private playwrightCrawler: PlaywrightCrawler;
  public configManager: EnhancedConfigManager;  // Made public for CLI access
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

  async crawl(config: CrawlerConfig | EnhancedCrawlerConfig | string): Promise<CrawlerResult> {
    let crawlerConfig: CrawlerConfig;
    let enhancedConfig: EnhancedCrawlerConfig | null = null;

    if (typeof config === 'string') {
      try {
        enhancedConfig = await this.configManager.loadEnhancedConfig(config);
        crawlerConfig = await this.configManager.loadConfig(config);
      } catch (error) {
        crawlerConfig = await this.configManager.loadConfig(config);
      }
    } else {
      crawlerConfig = config;
    }

    return await this.crawlWithFallback(crawlerConfig, enhancedConfig);
  }

  private async crawlWithFallback(config: CrawlerConfig, enhancedConfig?: EnhancedCrawlerConfig | null): Promise<CrawlerResult> {
    const errors: string[] = [];
    const startTime = Date.now();

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

    return {
      url: config.url,
      data: {},
      timestamp: new Date(),
      success: false,
      error: `All crawling methods failed:\n${errors.join('\n')}`
    };
  }

  private isHttpCompatible(config: CrawlerConfig): boolean {
    if (config.cookies?.enabled || config.options?.screenshot) {
      return false;
    }

    const staticSites = ['moneydj.com', 'twse.com.tw', 'tpex.org.tw', 'cnyes.com', 'yahoo.com'];
    const url = config.url.toLowerCase();
    const isStaticSite = staticSites.some(site => url.includes(site));

    if (isStaticSite) {
      logger.debug(`Detected static site: ${config.url}`);
    }

    return true;
  }

  private async crawlWithHttpMode(config: CrawlerConfig | EnhancedCrawlerConfig): Promise<CrawlerResult> {
    const axios = (await import('axios')).default;
    const cheerio = (await import('cheerio')).load;
    const { EncodingHelper } = await import('./utils');

    try {
      const response = await axios.get(config.url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          ...config.headers
        },
        timeout: config.options?.timeout || 30000,
        maxRedirects: 5,
        responseType: 'arraybuffer'
      });

      let htmlContent: string;
      const buffer = Buffer.from(response.data);
      const contentType = response.headers['content-type'] as string;

      if (config.options?.encoding) {
        htmlContent = EncodingHelper.convertToUtf8(buffer, config.options.encoding);
        logger.info(`Using specified encoding: ${config.options.encoding}`);
      } else {
        const detectedEncoding = EncodingHelper.detectEncoding(buffer, contentType);
        htmlContent = EncodingHelper.convertToUtf8(buffer, detectedEncoding);
        logger.info(`Auto-detected encoding: ${detectedEncoding}`);
      }

      const $ = cheerio(htmlContent);
      let data: Record<string, unknown> = {};

      if (config.selectors) {
        if (isEnhancedConfig(config)) {
          data = await this.extractDataWithEnhancedSelectors($, config.selectors as EnhancedSelectorConfig, config);
        } else {
          // Handle basic config selectors
          data = this.extractBasicSelectors($, config.selectors);
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

  async crawlMultiple(configs: (CrawlerConfig | EnhancedCrawlerConfig | string)[], concurrent = 1, onProgress?: (completed: number, total: number) => void): Promise<CrawlerResult[]> {
    const results: CrawlerResult[] = [];
    const configsByDomain = new Map<string, (CrawlerConfig | EnhancedCrawlerConfig | string)[]>();

    for (const config of configs) {
      const crawlerConfig = typeof config === 'string'
        ? await this.configManager.loadConfig(config)
        : config as CrawlerConfig;

      const domain = this.extractDomain(crawlerConfig.url);
      if (!configsByDomain.has(domain)) {
        configsByDomain.set(domain, []);
      }
      configsByDomain.get(domain)!.push(config);
    }

    let completedCount = 0;
    const totalCount = configs.length;

    const domainTasks = Array.from(configsByDomain.entries()).map(async ([, domainConfigs]) => {
      const domainResults: CrawlerResult[] = [];

      for (const config of domainConfigs) {
        try {
          const crawlerConfig = typeof config === 'string'
            ? await this.configManager.loadConfig(config)
            : config as CrawlerConfig;

          const domainDelay = crawlerConfig.options?.domainDelay;
          await this.domainRateLimiter.waitForDomain(crawlerConfig.url, domainDelay);

          const result = await this.crawl(config);
          domainResults.push(result);

        } catch (error) {
          const url = typeof config === 'string' ? config : config.url;
          domainResults.push({
            url,
            data: {},
            timestamp: new Date(),
            success: false,
            error: (error as Error).message
          });
        }

        // 更新進度
        completedCount++;
        if (onProgress) {
          onProgress(completedCount, totalCount);
        }
      }

      return domainResults;
    });

    const allDomainResults = await Promise.all(domainTasks);
    results.push(...allDomainResults.flat());
    this.domainRateLimiter.cleanup();

    return results;
  }

  private extractBasicSelectors($: CheerioAPI, selectors: SelectorConfig): Record<string, unknown> {
    const data: Record<string, unknown> = {};
    
    for (const [key, selector] of Object.entries(selectors)) {
      try {
        if (typeof selector === 'string') {
          if (selector.includes(':multiple')) {
            const cleanSelector = selector.replace(':multiple', '');
            data[key] = $(cleanSelector).map((_, el) => $(el).text().trim()).get();
          } else {
            data[key] = $(selector).text().trim();
          }
        } else if (typeof selector === 'object' && selector !== null) {
          const value = selector.attribute ? $(selector.selector).attr(selector.attribute) : $(selector.selector).text().trim();
          data[key] = (typeof selector.transform === 'function') ? selector.transform(value || '') : value;
        }
      } catch (error) {
        logger.warn(`Failed to extract ${key}:`, error);
        data[key] = null;
      }
    }
    
    return data;
  }

  private extractDomain(url: string): string {
    try {
      return new URL(url).hostname;
    } catch (error) {
      logger.warn(`Failed to extract domain from URL: ${url}`, error);
      return url;
    }
  }

  private async extractDataWithEnhancedSelectors($: CheerioAPI, selectors: EnhancedSelectorConfig, config: EnhancedCrawlerConfig): Promise<Record<string, unknown>> {
    const data: Record<string, unknown> = {};

    for (const [key, selector] of Object.entries(selectors)) {
      try {
        if (typeof selector === 'string') {
          if (selector.includes(':multiple')) {
            const cleanSelector = selector.replace(':multiple', '');
            data[key] = $(cleanSelector).map((_, el) => $(el).text().trim()).get();
          } else {
            data[key] = $(selector).text().trim();
          }
        } else if (typeof selector === 'object' && selector !== null) {
          const selectorObj = selector as EnhancedSelectorItem;
          if (selectorObj.selector || selectorObj.extract) {
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

  private async processEnhancedSelector($: CheerioAPI, selectorObj: EnhancedSelectorItem, config: EnhancedCrawlerConfig): Promise<unknown> {
    const { selector, multiple, extract, attribute, transform } = selectorObj;

    if (extract) {
      const cleanSelector = selector ? selector.replace(':multiple', '') : '';
      const isMultiple = Boolean(multiple || (selector && selector.includes(':multiple')));
      return await this.processExtractConfig($, { selector: cleanSelector, multiple: isMultiple, extract }, config);
    }

    if (!selector) {
      logger.warn('Enhanced selector missing selector property');
      return null;
    }

    const cleanSelector = selector.replace(':multiple', '');
    const isMultiple = multiple || selector.includes(':multiple');

    if (attribute) {
      let values = isMultiple
        ? $(cleanSelector).map((_, el) => $(el).attr(attribute)).get()
        : $(cleanSelector).attr(attribute);

      if (transform) {
        values = await this.applyTransform(values, transform as string, config) as string | string[] | undefined;
      }
      return values;
    } else {
      let values = isMultiple
        ? $(cleanSelector).map((_, el) => $(el).text().trim()).get()
        : $(cleanSelector).text().trim();

      if (transform) {
        values = await this.applyTransform(values, transform as string, config) as string | string[];
      }
      return values;
    }
  }

  private async processExtractConfig($: CheerioAPI, selectorConfig: { selector: string; multiple: boolean; extract: ExtractConfig }, config: EnhancedCrawlerConfig): Promise<unknown> {
    const { selector, multiple, extract } = selectorConfig;
    const matchedElements = $(selector);

    if (matchedElements.length === 0) {
      logger.debug(`Selector "${selector}" matched no elements`);
      return multiple ? [] : null;
    }

    if (multiple) {
      const results: unknown[] = [];
      for (let i = 0; i < matchedElements.length; i++) {
        const element = matchedElements.eq(i);
        const result: Record<string, unknown> = {};
        for (const [key, extractConfig] of Object.entries(extract)) {
          result[key] = await this.extractSingleValue($, element, extractConfig, config);
        }
        results.push(result);
      }
      return results;
    } else {
      const element = matchedElements.first();
      if (element.length === 0) return null;

      const result: Record<string, unknown> = {};
      for (const [key, extractConfig] of Object.entries(extract)) {
        result[key] = await this.extractSingleValue($, element, extractConfig, config);
      }
      return result;
    }
  }

  private async extractSingleValue($: CheerioAPI, element: ReturnType<CheerioAPI>, extractConfig: string | { attribute?: string; transform?: string | TransformFunction | ((value: string) => unknown) }, config: EnhancedCrawlerConfig): Promise<unknown> {
    let value: unknown;

    if (typeof extractConfig === 'string') {
      if (extractConfig === 'text') {
        value = $(element).text().trim();
      } else {
        value = $(element).attr(extractConfig);
      }
    } else if (typeof extractConfig === 'object' && extractConfig !== null) {
      const { attribute, transform } = extractConfig;
      if (attribute) {
        value = $(element).attr(attribute);
      } else {
        value = $(element).text().trim();
      }

      if (transform) {
        value = await this.applyTransform(value, typeof transform === 'string' ? transform : 'identity', config);
      }
    }

    return value;
  }

  private async applyTransform(value: unknown, transformName: string, config: EnhancedCrawlerConfig): Promise<unknown> {
    try {
      const context = {
        url: config.url,
        baseUrl: config.variables?.baseUrl || config.url
      };

      const transformFn = getTransformFunction(transformName, context);
      if (transformFn) {
        return transformFn(value, context);
      }

      if (config.transforms && config.transforms[transformName]) {
        const customTransformCode = config.transforms[transformName];
        const fn = new Function('value', 'context', customTransformCode);
        return fn(value, context);
      }

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

  async saveConfig(name: string, config: CrawlerConfig): Promise<void> {
    return await this.configManager.saveConfig(name, config);
  }

  async loadConfig(name: string): Promise<CrawlerConfig> {
    return await this.configManager.loadConfig(name);
  }

  async listConfigs(): Promise<string[]> {
    return await this.configManager.listConfigs();
  }

  async cleanup(): Promise<void> {
    await this.playwrightCrawler.cleanup();
  }
}
