import puppeteerCore, { Browser, Page } from 'puppeteer-core';
import { CrawlerConfig, CrawlerResult, CrawlerOptions } from '../types';
import { CookieManager } from './CookieManager';
import { DataExtractor } from './DataExtractor';
import { logger, delay, validateCrawlerConfig, BrowserDetector } from '../utils';

export class PuppeteerCoreWebCrawler {
  private browser: Browser | null = null;
  private cookieManager: CookieManager | null = null;
  private dataExtractor: DataExtractor;
  private isShuttingDown: boolean = false;
  private activeTasks: Set<Promise<any>> = new Set();
  private browserPath: string | null = null;
  private defaultOptions: CrawlerOptions = {
    waitFor: 2000,
    timeout: 15000,
    retries: 3,
    headless: true,
    delay: 1000,
    viewport: { width: 1920, height: 1080 }
  };

  constructor() {
    this.dataExtractor = new DataExtractor();
    this.initializeBrowserPath();
  }

  private async initializeBrowserPath(): Promise<void> {
    try {
      this.browserPath = await BrowserDetector.getBestBrowserPath();
      if (this.browserPath) {
        logger.info(`Detected browser: ${this.browserPath}`);
      } else {
        logger.warn('No browser detected on system');
      }
    } catch (error) {
      logger.error('Error detecting browser:', error);
    }
  }

  async crawl(config: CrawlerConfig): Promise<CrawlerResult> {
    if (this.isShuttingDown) {
      throw new Error('Crawler is shutting down');
    }

    const errors = validateCrawlerConfig(config);
    if (errors.length > 0) {
      throw new Error(`Configuration errors: ${errors.join(', ')}`);
    }

    // 確保瀏覽器路徑已初始化
    if (!this.browserPath) {
      await this.initializeBrowserPath();
      if (!this.browserPath) {
        throw new Error('No compatible browser found on system. Please install Chrome, Chromium, Edge, or Brave.');
      }
    }

    const options = { ...this.defaultOptions, ...config.options };
    let attempt = 0;
    let lastError: Error | null = null;

    const crawlTask = (async () => {
      while (attempt < (options.retries || 3) && !this.isShuttingDown) {
        try {
          attempt++;
          logger.info(`Crawling attempt ${attempt} for ${config.url}`);

          const result = await this.crawlWithPuppeteerCore(config, options);
          return result;
        } catch (error) {
          lastError = error as Error;
          logger.warn(`Attempt ${attempt} failed:`, error);
          
          if (this.isFatalError(error as Error)) {
            break;
          }
          
          if (attempt < (options.retries || 3) && !this.isShuttingDown) {
            await delay(options.delay || 1000);
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
      'Invalid URL format',
      'No compatible browser found'
    ];
    
    return fatalMessages.some(msg => error.message.includes(msg));
  }

  private async crawlWithPuppeteerCore(config: CrawlerConfig, options: CrawlerOptions): Promise<CrawlerResult> {
    let page: Page | null = null;
    
    try {
      if (!this.browser) {
        this.browser = await this.launchBrowser(options);
      }

      page = await this.browser.newPage();
      
      await this.setupPage(page, config, options);

      if (config.cookies?.enabled) {
        this.cookieManager = new CookieManager(config.cookies);
        await this.cookieManager.handleCookies(page);
      }

      await page.goto(config.url, { 
        waitUntil: 'networkidle2', 
        timeout: options.timeout 
      });

      if (options.waitFor) {
        await delay(options.waitFor);
      }

      const data = await this.dataExtractor.extractData(page, config.selectors);

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
    if (!this.browserPath) {
      throw new Error('No browser path available');
    }

    const launchOptions = {
      executablePath: this.browserPath,
      headless: options.headless === false ? false : true,
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
      timeout: 10000,
      protocolTimeout: 60000,
      handleSIGINT: false,
      handleSIGTERM: false,
      handleSIGHUP: false
    };

    try {
      logger.info(`Launching browser with puppeteer-core: ${this.browserPath}`);
      const browser = await puppeteerCore.launch(launchOptions);
      
      browser.on('disconnected', () => {
        logger.warn('Browser disconnected unexpectedly');
      });

      browser.on('targetcreated', () => {
        logger.debug('New target created');
      });

      return browser;
    } catch (error) {
      logger.error('Failed to launch browser with full options, trying minimal setup:', error);
      
      try {
        return await puppeteerCore.launch({
          executablePath: this.browserPath,
          headless: true,
          args: [
            '--no-sandbox', 
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage'
          ],
          timeout: 8000,
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
      page.on('error', (error) => {
        logger.error('Page error:', error);
      });

      page.on('pageerror', (error) => {
        logger.warn('Page JavaScript error:', error.message);
      });

      page.on('requestfailed', (request) => {
        logger.debug('Request failed:', request.url(), request.failure()?.errorText);
      });

      page.setDefaultTimeout(options.timeout || 30000);
      page.setDefaultNavigationTimeout(options.timeout || 30000);

      if (options.viewport) {
        await page.setViewport(options.viewport);
      }

      const userAgent = options.userAgent || 
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
      await page.setUserAgent(userAgent);

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

      await page.setRequestInterception(true);
      page.on('request', (request) => {
        try {
          const resourceType = request.resourceType();
          const url = request.url();

          if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
            request.abort();
            return;
          }

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

  async cleanup(): Promise<void> {
    this.isShuttingDown = true;
    
    try {
      if (this.activeTasks.size > 0) {
        logger.info(`Waiting for ${this.activeTasks.size} active tasks to complete...`);
        const timeout = new Promise(resolve => setTimeout(resolve, 10000));
        const allTasks = Promise.all(Array.from(this.activeTasks));
        
        await Promise.race([allTasks, timeout]);
        
        if (this.activeTasks.size > 0) {
          logger.warn(`${this.activeTasks.size} tasks still running, forcing shutdown`);
        }
      }

      if (this.browser) {
        try {
          const pages = await this.browser.pages();
          await Promise.all(pages.map(page => page.close().catch(() => {})));
          
          await this.browser.close();
          this.browser = null;
          logger.info('Browser closed gracefully');
        } catch (error) {
          logger.warn('Error closing browser:', error);
          
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

      this.activeTasks.clear();
      this.isShuttingDown = false;
      
    } catch (error) {
      logger.error('Error during cleanup:', error);
      this.browser = null;
      this.activeTasks.clear();
      this.isShuttingDown = false;
    }
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

  async getBrowserInfo(): Promise<{ path: string | null; available: boolean }> {
    if (!this.browserPath) {
      await this.initializeBrowserPath();
    }
    
    return {
      path: this.browserPath,
      available: !!this.browserPath
    };
  }
}