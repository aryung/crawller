import { chromium, Browser, BrowserContext } from 'playwright';
import { logger } from '../utils';

export interface BrowserPoolOptions {
  maxSize?: number;
  maxIdleTime?: number; // 最大閒置時間（毫秒）
  browserLaunchOptions?: {
    headless?: boolean;
    args?: string[];
    timeout?: number;
  };
}

export interface PooledBrowser {
  browser: Browser;
  context: BrowserContext;
  id: string;
  createdAt: number;
  lastUsed: number;
  inUse: boolean;
  failureCount: number;
}

export class BrowserPool {
  private pool: PooledBrowser[] = [];
  private readonly maxSize: number;
  private readonly maxIdleTime: number;
  private readonly browserOptions: any;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private isDestroyed = false;
  
  constructor(options: BrowserPoolOptions = {}) {
    this.maxSize = options.maxSize || 3;
    this.maxIdleTime = options.maxIdleTime || 300000; // 5分鐘
    this.browserOptions = {
      headless: options.browserLaunchOptions?.headless ?? true,
      args: options.browserLaunchOptions?.args || [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor'
      ],
      timeout: options.browserLaunchOptions?.timeout || 30000
    };
    
    // 每30秒清理一次閒置的瀏覽器
    this.cleanupInterval = setInterval(() => {
      this.cleanupIdleBrowsers();
    }, 30000);
    
    logger.info(`🏊 BrowserPool 初始化完成 (最大池大小: ${this.maxSize})`);
  }

  /**
   * 獲取可用的瀏覽器實例
   */
  async acquire(): Promise<PooledBrowser> {
    if (this.isDestroyed) {
      throw new Error('BrowserPool has been destroyed');
    }

    // 尋找可用的瀏覽器
    let availableBrowser = this.pool.find(b => !b.inUse && !this.isBrowserDead(b.browser));
    
    if (availableBrowser) {
      availableBrowser.inUse = true;
      availableBrowser.lastUsed = Date.now();
      logger.debug(`♻️ 重用瀏覽器實例 ${availableBrowser.id}`);
      return availableBrowser;
    }

    // 如果池未滿，創建新的瀏覽器
    if (this.pool.length < this.maxSize) {
      const pooledBrowser = await this.createBrowser();
      this.pool.push(pooledBrowser);
      pooledBrowser.inUse = true;
      logger.info(`🆕 創建新瀏覽器實例 ${pooledBrowser.id} (池大小: ${this.pool.length}/${this.maxSize})`);
      return pooledBrowser;
    }

    // 池已滿，等待可用實例
    logger.warn(`⏳ 瀏覽器池已滿，等待可用實例...`);
    return new Promise((resolve, reject) => {
      const checkInterval = setInterval(() => {
        if (this.isDestroyed) {
          clearInterval(checkInterval);
          reject(new Error('BrowserPool was destroyed while waiting'));
          return;
        }

        const available = this.pool.find(b => !b.inUse && !this.isBrowserDead(b.browser));
        if (available) {
          clearInterval(checkInterval);
          available.inUse = true;
          available.lastUsed = Date.now();
          logger.debug(`✅ 獲得等待中的瀏覽器實例 ${available.id}`);
          resolve(available);
        }
      }, 100);

      // 超時處理
      setTimeout(() => {
        clearInterval(checkInterval);
        reject(new Error('Timeout waiting for available browser'));
      }, 30000);
    });
  }

  /**
   * 歸還瀏覽器實例
   */
  async release(pooledBrowser: PooledBrowser, hasError: boolean = false): Promise<void> {
    if (hasError) {
      pooledBrowser.failureCount++;
      logger.warn(`⚠️ 瀏覽器 ${pooledBrowser.id} 發生錯誤，失敗次數: ${pooledBrowser.failureCount}`);
      
      // 如果失敗次數過多，銷毀這個瀏覽器
      if (pooledBrowser.failureCount >= 3) {
        logger.error(`💥 瀏覽器 ${pooledBrowser.id} 失敗次數過多，將被銷毀`);
        await this.destroyBrowser(pooledBrowser);
        return;
      }
    }

    // 檢查瀏覽器是否仍然可用
    if (this.isBrowserDead(pooledBrowser.browser)) {
      logger.warn(`💀 瀏覽器 ${pooledBrowser.id} 已死亡，將被移除`);
      await this.destroyBrowser(pooledBrowser);
      return;
    }

    // 歸還到池中
    pooledBrowser.inUse = false;
    pooledBrowser.lastUsed = Date.now();
    
    // 關閉當前的 context，準備下次使用
    try {
      await pooledBrowser.context.close();
      pooledBrowser.context = await pooledBrowser.browser.newContext();
    } catch (error) {
      logger.warn(`🔄 重置瀏覽器 context 失敗 ${pooledBrowser.id}:`, error);
      await this.destroyBrowser(pooledBrowser);
      return;
    }
    
    logger.debug(`📤 歸還瀏覽器實例 ${pooledBrowser.id}`);
  }

  /**
   * 強制銷毀有問題的瀏覽器
   */
  async destroyBrowser(pooledBrowser: PooledBrowser): Promise<void> {
    const index = this.pool.indexOf(pooledBrowser);
    if (index > -1) {
      this.pool.splice(index, 1);
    }

    try {
      if (!this.isBrowserDead(pooledBrowser.browser)) {
        await pooledBrowser.browser.close();
      }
      logger.info(`🗑️ 銷毀瀏覽器實例 ${pooledBrowser.id} (池大小: ${this.pool.length}/${this.maxSize})`);
    } catch (error) {
      logger.warn(`❌ 銷毀瀏覽器時發生錯誤:`, error);
    }
  }

  /**
   * 清理閒置的瀏覽器
   */
  private async cleanupIdleBrowsers(): Promise<void> {
    if (this.isDestroyed) return;

    const now = Date.now();
    const idleBrowsers = this.pool.filter(b => 
      !b.inUse && (now - b.lastUsed) > this.maxIdleTime
    );

    for (const browser of idleBrowsers) {
      logger.info(`🧹 清理閒置瀏覽器 ${browser.id} (閒置時間: ${Math.round((now - browser.lastUsed) / 1000)}秒)`);
      await this.destroyBrowser(browser);
    }
  }

  /**
   * 檢查瀏覽器是否已死亡
   */
  private isBrowserDead(browser: Browser): boolean {
    try {
      return !browser.isConnected();
    } catch {
      return true;
    }
  }

  /**
   * 創建新的瀏覽器實例
   */
  private async createBrowser(): Promise<PooledBrowser> {
    const id = `browser-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      const browser = await chromium.launch(this.browserOptions);
      const context = await browser.newContext({
        viewport: { width: 1920, height: 1080 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      });

      return {
        browser,
        context,
        id,
        createdAt: Date.now(),
        lastUsed: Date.now(),
        inUse: false,
        failureCount: 0
      };
    } catch (error) {
      logger.error(`❌ 創建瀏覽器失敗:`, error);
      throw new Error(`Failed to create browser: ${error}`);
    }
  }

  /**
   * 獲取池狀態統計
   */
  getStatistics() {
    const inUse = this.pool.filter(b => b.inUse).length;
    const available = this.pool.filter(b => !b.inUse).length;
    const total = this.pool.length;
    
    return {
      total,
      inUse,
      available,
      maxSize: this.maxSize,
      utilization: total > 0 ? Math.round((inUse / total) * 100) : 0
    };
  }

  /**
   * 銷毀整個瀏覽器池
   */
  async destroy(): Promise<void> {
    if (this.isDestroyed) return;
    
    this.isDestroyed = true;
    
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    logger.info(`🏊‍♂️ 正在銷毀瀏覽器池 (${this.pool.length} 個實例)...`);
    
    const destroyPromises = this.pool.map(async (pooledBrowser) => {
      try {
        if (!this.isBrowserDead(pooledBrowser.browser)) {
          await pooledBrowser.browser.close();
        }
      } catch (error) {
        logger.warn(`清理瀏覽器 ${pooledBrowser.id} 時發生錯誤:`, error);
      }
    });

    await Promise.allSettled(destroyPromises);
    this.pool = [];
    
    logger.info(`🏊‍♂️ 瀏覽器池已完全銷毀`);
  }
}