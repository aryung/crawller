import { chromium, Browser, Page } from 'playwright';
import { CrawlerConfig, CrawlerResult, CrawlerOptions, EnhancedCrawlerConfig, ActionItem } from '../types';
import { DataExtractor } from './DataExtractor';
import { logger, delay, validateCrawlerConfig } from '../utils';
import { builtinTransforms, getTransformFunction } from '../transforms';

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

  async crawl(config: CrawlerConfig | EnhancedCrawlerConfig): Promise<CrawlerResult> {
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

  private async crawlWithPlaywright(config: CrawlerConfig | EnhancedCrawlerConfig, options: CrawlerOptions): Promise<CrawlerResult> {
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

      // 導航到目標頁面 - 根據配置選擇等待策略
      const waitUntil = options.waitForNetworkIdle === false ? 'domcontentloaded' : 'networkidle';
      console.log(`[Playwright] Using wait strategy: ${waitUntil}`);
      
      await page.goto(config.url, { 
        waitUntil: waitUntil as 'domcontentloaded' | 'networkidle',
        timeout: options.timeout 
      });

      // 等待指定時間
      if (options.waitFor) {
        await page.waitForTimeout(options.waitFor);
      }

      // 執行動態操作序列 (如點擊按鈕)
      if ('actions' in config && config.actions && config.actions.length > 0) {
        await this.executeActions(page, config.actions);
      }

      // 提取資料 - 支援 Enhanced Selectors
      const data = await this.extractDataWithEnhancedSelectors(page, config.selectors || {}, config);

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

  private async extractDataWithEnhancedSelectors(page: Page, selectors: any, config: any): Promise<Record<string, any>> {
    const data: Record<string, any> = {};

    for (const [key, selector] of Object.entries(selectors)) {
      try {
        if (typeof selector === 'string') {
          // 簡單字符串選擇器
          if (selector.includes(':multiple')) {
            const cleanSelector = selector.replace(':multiple', '');
            const elements = await page.$$(cleanSelector);
            const values = [];
            for (const element of elements) {
              const text = await element.textContent();
              if (text) values.push(text.trim());
            }
            data[key] = values;
          } else {
            const element = await page.$(selector);
            data[key] = element ? (await element.textContent() || '').trim() : '';
          }
        } else if (typeof selector === 'object' && selector !== null) {
          // Enhanced Selector 對象
          const selectorObj = selector as any;
          
          if (selectorObj.selector || selectorObj.extract) {
            // 這是 EnhancedSelectorItem 格式或有 extract 配置
            // Pass accumulated data as context for transforms that need it
            data[key] = await this.processEnhancedSelectorPlaywright(page, selectorObj, config, data);
          }
        }
      } catch (selectorError) {
        logger.warn(`Failed to extract ${key}:`, selectorError);
        data[key] = null;
      }
    }

    return data;
  }

  private async processEnhancedSelectorPlaywright(page: Page, selectorObj: any, config: any, accumulatedData?: Record<string, any>): Promise<any> {
    const { selector, multiple, extract, attribute, transform } = selectorObj;
    
    if (extract) {
      // 有 extract 配置 - 提取多個屬性
      const cleanSelector = selector ? selector.replace(':multiple', '') : '';
      const isMultiple = multiple || (selector && selector.includes(':multiple'));
      return await this.processExtractConfigPlaywright(page, { selector: cleanSelector, multiple: isMultiple, extract }, config, accumulatedData);
    }
    
    if (!selector) {
      logger.warn('Enhanced selector missing selector property');
      return null;
    }

    const cleanSelector = selector.replace(':multiple', '');
    const isMultiple = multiple || selector.includes(':multiple');

    if (attribute) {
      // 提取特定屬性
      let values;
      if (isMultiple) {
        const elements = await page.$$(cleanSelector);
        values = [];
        for (const element of elements) {
          const attrValue = await element.getAttribute(attribute);
          if (attrValue) values.push(attrValue);
        }
      } else {
        const element = await page.$(cleanSelector);
        values = element ? await element.getAttribute(attribute) : null;
      }

      // 應用轉換
      if (transform) {
        values = await this.applyTransformPlaywright(values, transform, config, accumulatedData);
      }

      return values;
    } else {
      // 提取文本
      let values;
      if (isMultiple) {
        const elements = await page.$$(cleanSelector);
        values = [];
        for (const element of elements) {
          const text = await element.textContent();
          if (text) values.push(text.trim());
        }
      } else {
        const element = await page.$(cleanSelector);
        values = element ? (await element.textContent() || '').trim() : '';
      }

      // 應用轉換
      if (transform) {
        values = await this.applyTransformPlaywright(values, transform, config, accumulatedData);
      }

      return values;
    }
  }

  private async processExtractConfigPlaywright(page: Page, selectorConfig: any, config: any, accumulatedData?: Record<string, any>): Promise<any> {
    const { selector, multiple, extract } = selectorConfig;
    const isMultiple = multiple || selector.includes(':multiple');
    const cleanSelector = selector.replace(':multiple', '');

    // Check if selector matches any elements
    const matchedElements = await page.$$(cleanSelector);
    if (matchedElements.length === 0) {
      logger.debug(`Selector "${cleanSelector}" matched no elements`);
      return isMultiple ? [] : null;
    }

    if (isMultiple) {
      // 多元素提取
      const results: any[] = [];
      for (const element of matchedElements) {
        const result: any = {};
        for (const [key, extractConfig] of Object.entries(extract)) {
          result[key] = await this.extractSingleValuePlaywright(page, element, extractConfig, config, accumulatedData);
        }
        results.push(result);
      }
      return results;
    } else {
      // 單元素提取
      const element = matchedElements[0];
      if (!element) return null;

      const result: any = {};
      for (const [key, extractConfig] of Object.entries(extract)) {
        result[key] = await this.extractSingleValuePlaywright(page, element, extractConfig, config, accumulatedData);
      }
      return result;
    }
  }

  private async extractSingleValuePlaywright(page: Page, element: any, extractConfig: any, config: any, accumulatedData?: Record<string, any>): Promise<any> {
    let value: any;

    if (typeof extractConfig === 'string') {
      // 直接提取文本或屬性
      if (extractConfig === 'text') {
        value = (await element.textContent() || '').trim();
      } else {
        value = await element.getAttribute(extractConfig);
      }
    } else if (typeof extractConfig === 'object' && extractConfig !== null) {
      // 對象配置
      const { attribute, transform } = extractConfig;
      
      if (attribute) {
        value = await element.getAttribute(attribute);
      } else {
        value = (await element.textContent() || '').trim();
      }

      // 應用轉換
      if (transform) {
        value = await this.applyTransformPlaywright(value, transform, config, accumulatedData);
      }
    }

    return value;
  }

  private async applyTransformPlaywright(value: any, transformName: string, config: any, accumulatedData?: Record<string, any>): Promise<any> {
    try {
      // 創建 context 用於轉換函數，包含累積的選擇器數據
      const context = {
        url: config.url,
        baseUrl: config.variables?.baseUrl || config.url,
        templateType: config.templateType,
        ...accumulatedData // Include all previously extracted data
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
          baseUrl: config.variables?.baseUrl || config.url,
          templateType: config.templateType
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

  private async executeActions(page: Page, actions: ActionItem[]): Promise<void> {
    logger.info(`Executing ${actions.length} dynamic actions`);
    
    for (let i = 0; i < actions.length; i++) {
      const action = actions[i];
      logger.debug(`Executing action ${i + 1}/${actions.length}: ${action.type}`, action.description || '');
      
      try {
        switch (action.type) {
          case 'click':
            if (action.selector) {
              await page.waitForSelector(action.selector, { timeout: action.timeout || 10000 });
              await page.click(action.selector);
              logger.debug(`Clicked element: ${action.selector}`);
            }
            break;
            
          case 'type':
            if (action.selector && action.value) {
              await page.waitForSelector(action.selector, { timeout: action.timeout || 10000 });
              await page.fill(action.selector, action.value);
              logger.debug(`Typed "${action.value}" into: ${action.selector}`);
            }
            break;
            
          case 'wait':
            const waitTime = action.timeout || parseInt(action.value || '1000');
            await page.waitForTimeout(waitTime);
            logger.debug(`Waited for ${waitTime}ms`);
            break;
            
          case 'scroll':
            if (action.selector) {
              await page.waitForSelector(action.selector, { timeout: action.timeout || 10000 });
              await page.locator(action.selector).scrollIntoViewIfNeeded();
              logger.debug(`Scrolled to element: ${action.selector}`);
            } else {
              // 滾動到頁面底部
              await page.evaluate(() => (globalThis as any).window.scrollTo(0, (globalThis as any).document.body.scrollHeight));
              logger.debug('Scrolled to bottom of page');
            }
            break;
            
          case 'select':
            if (action.selector && action.value) {
              await page.waitForSelector(action.selector, { timeout: action.timeout || 10000 });
              await page.selectOption(action.selector, action.value);
              logger.debug(`Selected "${action.value}" in: ${action.selector}`);
            }
            break;
            
          default:
            logger.warn(`Unknown action type: ${action.type}`);
        }
        
        // 每個操作之後稍微等待一下，模擬真實用戶操作
        await page.waitForTimeout(500);
        
      } catch (error) {
        logger.error(`Error executing action ${i + 1} (${action.type}):`, error);
        // 繼續執行下一個動作，不中斷流程
      }
    }
    
    logger.info('All dynamic actions completed');
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