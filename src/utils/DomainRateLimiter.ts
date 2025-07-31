import { logger } from './logger';

export class DomainRateLimiter {
  private domainLastRequest: Map<string, number> = new Map();
  private defaultDelay: number;

  constructor(defaultDelay: number = 2000) {
    this.defaultDelay = defaultDelay;
  }

  /**
   * 從 URL 提取網域名稱
   */
  private extractDomain(url: string): string {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch (error) {
      logger.warn(`Failed to extract domain from URL: ${url}`, error);
      return url; // 回退到使用完整 URL
    }
  }

  /**
   * 檢查是否需要延遲，並在必要時執行延遲
   */
  async waitForDomain(url: string, domainDelay?: number): Promise<void> {
    const domain = this.extractDomain(url);
    const delay = domainDelay || this.defaultDelay;
    const now = Date.now();
    
    const lastRequest = this.domainLastRequest.get(domain);
    
    if (lastRequest) {
      const timeSinceLastRequest = now - lastRequest;
      const remainingDelay = delay - timeSinceLastRequest;
      
      if (remainingDelay > 0) {
        logger.info(`Rate limiting ${domain}: waiting ${remainingDelay}ms`);
        await this.sleep(remainingDelay);
      }
    }
    
    // 更新最後請求時間
    this.domainLastRequest.set(domain, Date.now());
  }

  /**
   * 獲取域名的最後請求時間
   */
  getLastRequestTime(url: string): number | undefined {
    const domain = this.extractDomain(url);
    return this.domainLastRequest.get(domain);
  }

  /**
   * 清理舊的域名記錄（清理超過 1 小時的記錄）
   */
  cleanup(): void {
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;
    
    for (const [domain, lastRequest] of this.domainLastRequest.entries()) {
      if (now - lastRequest > oneHour) {
        this.domainLastRequest.delete(domain);
        logger.debug(`Cleaned up domain rate limit record for: ${domain}`);
      }
    }
  }

  /**
   * 重設特定域名的限制
   */
  resetDomain(url: string): void {
    const domain = this.extractDomain(url);
    this.domainLastRequest.delete(domain);
    logger.debug(`Reset rate limit for domain: ${domain}`);
  }

  /**
   * 重設所有域名限制
   */
  resetAll(): void {
    this.domainLastRequest.clear();
    logger.debug('Reset all domain rate limits');
  }

  /**
   * 獲取目前追蹤的域名數量
   */
  getTrackedDomainsCount(): number {
    return this.domainLastRequest.size;
  }

  /**
   * 獲取所有被追蹤的域名
   */
  getTrackedDomains(): string[] {
    return Array.from(this.domainLastRequest.keys());
  }

  /**
   * 睡眠指定毫秒數
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}