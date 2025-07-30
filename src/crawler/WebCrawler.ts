import puppeteer, { Browser, Page } from 'puppeteer';
import axios, { AxiosResponse } from 'axios';
import { CrawlerConfig, CrawlerResult, CrawlerOptions } from '../types';
import { CookieManager } from './CookieManager';
import { DataExtractor } from './DataExtractor';
import { logger, delay, validateCrawlerConfig } from '../utils';

export class WebCrawler {
  private browser: Browser | null = null;
  private cookieManager: CookieManager | null = null;
  private dataExtractor: DataExtractor;
  private isShuttingDown: boolean = false;
  private activeTasks: Set<Promise<any>> = new Set();
  private defaultOptions: CrawlerOptions = {
    waitFor: 2000,
    timeout: 15000,  // 降到 15 秒
    retries: 3,
    headless: true,
    delay: 1000,
    viewport: { width: 1920, height: 1080 }
  };

  constructor() {
    this.dataExtractor = new DataExtractor();
  }

  async crawl(config: CrawlerConfig): Promise<CrawlerResult> {
    if (this.isShuttingDown) {
      throw new Error('Crawler is shutting down');
    }

    const errors = validateCrawlerConfig(config);
    if (errors.length > 0) {
      throw new Error(`Configuration errors: ${errors.join(', ')}`);
    }

    const options = { ...this.defaultOptions, ...config.options };
    let attempt = 0;
    let lastError: Error | null = null;

    const crawlTask = (async () => {
      while (attempt < (options.retries || 3) && !this.isShuttingDown) {
        try {
          attempt++;
          logger.info(`Crawling attempt ${attempt} for ${config.url}`);

          let result: CrawlerResult;
          if (this.shouldUsePuppeteer(config)) {
            result = await this.crawlWithPuppeteer(config, options);
          } else {
            result = await this.crawlWithAxios(config, options);
          }

          return result;
        } catch (error) {
          lastError = error as Error;
          logger.warn(`Attempt ${attempt} failed:`, error);
          
          // 檢查是否為致命錯誤（不需要重試）
          if (this.isFatalError(error as Error)) {
            break;
          }
          
          if (attempt < (options.retries || 3) && !this.isShuttingDown) {
            await delay(options.delay || 1000);
            // 清理瀏覽器但不完全關閉，以便重試
            if (this.browser) {
              try {
                const pages = await this.browser.pages();
                await Promise.all(pages.slice(1).map(page => page.close().catch(() => {})));
              } catch (cleanupError) {
                logger.debug('Error during partial cleanup:', cleanupError);
              }
            }
          }
        }
      }

      return {
        url: config.url,
        data: {},
        timestamp: new Date(),
        success: false,
        error: this.isShuttingDown ? 'Crawler shutdown' : (lastError?.message || 'Unknown error')
      };
    })();

    // 追蹤活動任務
    this.activeTasks.add(crawlTask);
    
    try {
      const result = await crawlTask;
      return result;
    } finally {
      this.activeTasks.delete(crawlTask);
    }
  }

  private isFatalError(error: Error): boolean {
    const fatalMessages = [
      'Navigation timeout',
      'Browser launch failed',
      'Configuration errors',
      'Invalid URL format'
    ];
    
    return fatalMessages.some(msg => error.message.includes(msg));
  }

  private shouldUsePuppeteer(config: CrawlerConfig): boolean {
    return !!(
      config.cookies?.enabled || 
      config.selectors || 
      config.options?.screenshot ||
      config.options?.waitFor
    );
  }

  private async crawlWithPuppeteer(config: CrawlerConfig, options: CrawlerOptions): Promise<CrawlerResult> {
    let page: Page | null = null;
    
    try {
      if (!this.browser) {
        this.browser = await this.launchBrowser(options);
      }

      page = await this.browser.newPage();
      
      // 設定基本配置
      await this.setupPage(page, config, options);

      // 處理 Cookies
      if (config.cookies?.enabled) {
        this.cookieManager = new CookieManager(config.cookies);
        await this.cookieManager.handleCookies(page);
      }

      // 導航到目標頁面
      await page.goto(config.url, { 
        waitUntil: 'networkidle2', 
        timeout: options.timeout 
      });

      // 等待指定時間
      if (options.waitFor) {
        await delay(options.waitFor);
      }

      // 提取資料
      const data = await this.dataExtractor.extractData(page, config.selectors);

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

  private async launchBrowser(options: CrawlerOptions): Promise<Browser> {
    const launchOptions = {
      headless: options.headless === false ? false : 'new', // 使用新的 headless 模式
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--disable-extensions',
        '--disable-plugins',
        '--disable-images',
        '--disable-default-apps',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-ipc-flooding-protection',
        '--enable-features=NetworkService,NetworkServiceLogging',
        '--force-color-profile=srgb',
        '--metrics-recording-only',
        '--use-mock-keychain',
        '--disable-blink-features=AutomationControlled',
        '--disable-features=TranslateUI',
        '--disable-component-extensions-with-background-pages',
        '--disable-background-networking',
        '--disable-sync',
        '--disable-client-side-phishing-detection',
        '--disable-hang-monitor',
        '--disable-popup-blocking',
        '--disable-prompt-on-repost',
        '--disable-domain-reliability',
        '--disable-component-update'
      ],
      ignoreHTTPSErrors: true,
      ignoreDefaultArgs: ['--enable-automation'],
      timeout: 10000,  // 瀏覽器啟動最多等待 10 秒
      protocolTimeout: 60000,  // 協議超時 60 秒
      handleSIGINT: false,
      handleSIGTERM: false,
      handleSIGHUP: false
    };

    try {
      logger.info('Launching browser with enhanced stability options...');
      const browser = await puppeteer.launch(launchOptions);
      
      // 設定瀏覽器事件處理
      browser.on('disconnected', () => {
        logger.warn('Browser disconnected unexpectedly');
      });

      browser.on('targetcreated', () => {
        logger.debug('New target created');
      });

      return browser;
    } catch (error) {
      logger.error('Failed to launch browser with full options, trying minimal setup:', error);
      
      // 嘗試最小化配置
      try {
        return await puppeteer.launch({
          headless: 'new',
          args: [
            '--no-sandbox', 
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage'
          ],
          timeout: 8000,  // 最小化配置只等待 8 秒
          ignoreHTTPSErrors: true,
          handleSIGINT: false,
          handleSIGTERM: false
        });
      } catch (fallbackError) {
        logger.error('Even minimal browser setup failed:', fallbackError);
        const errorMessage = fallbackError instanceof Error 
          ? fallbackError.message 
          : JSON.stringify(fallbackError);
        throw new Error(`Browser launch failed: ${errorMessage}`);
      }
    }
  }

  private async setupPage(page: Page, config: CrawlerConfig, options: CrawlerOptions): Promise<void> {
    try {
      // 設定頁面事件處理
      page.on('error', (error) => {
        logger.error('Page error:', error);
      });

      page.on('pageerror', (error) => {
        logger.warn('Page JavaScript error:', error.message);
      });

      page.on('requestfailed', (request) => {
        logger.debug('Request failed:', request.url(), request.failure()?.errorText);
      });

      // 設定超時
      page.setDefaultTimeout(options.timeout || 30000);
      page.setDefaultNavigationTimeout(options.timeout || 30000);

      // 設定 viewport
      if (options.viewport) {
        await page.setViewport(options.viewport);
      }

      // 設定 User Agent
      const userAgent = options.userAgent || 
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
      await page.setUserAgent(userAgent);

      // 設定額外的 headers
      const defaultHeaders = {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'zh-TW,zh;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      };

      const headers = { ...defaultHeaders, ...config.headers };
      await page.setExtraHTTPHeaders(headers);

      // 攔截請求以提升效能和穩定性
      await page.setRequestInterception(true);
      page.on('request', (request) => {
        try {
          const resourceType = request.resourceType();
          const url = request.url();

          // 阻擋不必要的資源
          if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
            request.abort();
            return;
          }

          // 阻擋廣告和追蹤
          if (url.includes('google-analytics') || 
              url.includes('googletagmanager') || 
              url.includes('facebook.com/tr') ||
              url.includes('doubleclick.net')) {
            request.abort();
            return;
          }

          request.continue();
        } catch (error) {
          logger.debug('Request interception error:', error);
          try {
            request.continue();
          } catch {
            // 忽略已處理的請求錯誤
          }
        }
      });

      logger.debug('Page setup completed successfully');
    } catch (error) {
      logger.error('Failed to setup page:', error);
      throw error;
    }
  }

  private async crawlWithAxios(config: CrawlerConfig, options: CrawlerOptions): Promise<CrawlerResult> {
    try {
      const response: AxiosResponse = await axios.get(config.url, {
        headers: {
          'User-Agent': options.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          ...config.headers
        },
        timeout: options.timeout || 30000,
        maxRedirects: 5
      });

      // 使用 cheerio 處理簡單的 selector 提取
      const { load } = await import('cheerio');
      const $ = load(response.data);
      
      const data: Record<string, any> = {};
      if (config.selectors) {
        for (const [key, selector] of Object.entries(config.selectors)) {
          if (typeof selector === 'string') {
            data[key] = $(selector).text().trim();
          }
        }
      }

      return {
        url: config.url,
        data,
        timestamp: new Date(),
        success: true
      };

    } catch (error) {
      throw new Error(`Axios crawl failed: ${(error as Error).message}`);
    }
  }

  async cleanup(): Promise<void> {
    this.isShuttingDown = true;
    
    try {
      // 等待所有活動任務完成（最多等待10秒）
      if (this.activeTasks.size > 0) {
        logger.info(`Waiting for ${this.activeTasks.size} active tasks to complete...`);
        const timeout = new Promise(resolve => setTimeout(resolve, 10000));
        const allTasks = Promise.all(Array.from(this.activeTasks));
        
        await Promise.race([allTasks, timeout]);
        
        if (this.activeTasks.size > 0) {
          logger.warn(`${this.activeTasks.size} tasks still running, forcing shutdown`);
        }
      }

      // 關閉瀏覽器
      if (this.browser) {
        try {
          const pages = await this.browser.pages();
          await Promise.all(pages.map(page => page.close().catch(() => {})));
          
          await this.browser.close();
          this.browser = null;
          logger.info('Browser closed gracefully');
        } catch (error) {
          logger.warn('Error closing browser:', error);
          
          // 強制終止瀏覽器進程
          try {
            if (this.browser && this.browser.process()) {
              this.browser.process()?.kill();
            }
          } catch (killError) {
            logger.debug('Error killing browser process:', killError);
          }
          
          this.browser = null;
        }
      }

      // 清理活動任務集合
      this.activeTasks.clear();
      this.isShuttingDown = false;
      
    } catch (error) {
      logger.error('Error during cleanup:', error);
      this.browser = null;
      this.activeTasks.clear();
      this.isShuttingDown = false;
    }
  }

  async gracefulShutdown(timeout: number = 30000): Promise<void> {
    logger.info('Initiating graceful shutdown...');
    
    const shutdownPromise = this.cleanup();
    const timeoutPromise = new Promise<void>((resolve) => {
      setTimeout(() => {
        logger.warn(`Graceful shutdown timeout (${timeout}ms), forcing exit`);
        resolve();
      }, timeout);
    });

    await Promise.race([shutdownPromise, timeoutPromise]);
    logger.info('Graceful shutdown completed');
  }

  async isHealthy(): Promise<boolean> {
    if (!this.browser) return false;
    
    try {
      const pages = await this.browser.pages();
      return pages.length >= 1;
    } catch {
      return false;
    }
  }
}