import { Page } from 'playwright';
import { CookieConfig } from '../types';
import { logger, delay } from '../utils';

export class CookieManager {
  private config: CookieConfig;

  constructor(config: CookieConfig) {
    this.config = config;
  }

  async handleCookies(page: Page): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    if (this.config.cookieString) {
      await this.setCookiesFromString(page);
    } else if (this.config.loginUrl && this.config.credentials) {
      await this.loginAndGetCookies(page);
    }
  }

  private async setCookiesFromString(page: Page): Promise<void> {
    if (!this.config.cookieString) return;

    try {
      const cookies = this.parseCookieString(this.config.cookieString);
      await page.context().addCookies(cookies);
      logger.info('Cookies set from string');
    } catch (error) {
      logger.error('Failed to set cookies from string:', error);
      throw error;
    }
  }

  private async loginAndGetCookies(page: Page): Promise<void> {
    if (!this.config.loginUrl || !this.config.credentials || !this.config.loginSelectors) {
      return;
    }

    try {
      logger.info(`Navigating to login page: ${this.config.loginUrl}`);
      await page.goto(this.config.loginUrl, { waitUntil: 'networkidle' });

      await page.waitForSelector(this.config.loginSelectors.username);
      await page.fill(this.config.loginSelectors.username, this.config.credentials.username);
      await page.fill(this.config.loginSelectors.password, this.config.credentials.password);

      await delay(1000);

      await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle' }),
        page.click(this.config.loginSelectors.submit)
      ]);

      logger.info('Login successful, cookies obtained');
    } catch (error) {
      logger.error('Failed to login and get cookies:', error);
      throw error;
    }
  }

  private parseCookieString(cookieString: string) {
    return cookieString.split(';').map(cookie => {
      const [name, value] = cookie.trim().split('=');
      return {
        name: name.trim(),
        value: value?.trim() || '',
        domain: this.config.domain || undefined,
        url: this.config.domain ? `https://${this.config.domain}` : undefined
      };
    });
  }

  async getCookies(page: Page): Promise<unknown[]> {
    return await page.context().cookies();
  }

  async saveCookiesToFile(page: Page, filepath: string): Promise<void> {
    const cookies = await this.getCookies(page);
    const fs = await import('fs-extra');
    await fs.writeJson(filepath, cookies, { spaces: 2 });
    logger.info(`Cookies saved to ${filepath}`);
  }

  async loadCookiesFromFile(page: Page, filepath: string): Promise<void> {
    const fs = await import('fs-extra');
    try {
      const cookies = await fs.readJson(filepath);
      await page.context().addCookies(cookies);
      logger.info(`Cookies loaded from ${filepath}`);
    } catch (error) {
      logger.warn(`Could not load cookies from ${filepath}:`, error);
    }
  }
}