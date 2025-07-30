import { CrawlerConfig, CookieConfig, CrawlerOptions } from '../types';

export function validateCrawlerConfig(config: CrawlerConfig): string[] {
  const errors: string[] = [];

  if (!config.url) {
    errors.push('URL is required');
  }

  if (config.url && !isValidUrl(config.url)) {
    errors.push('Invalid URL format');
  }

  if (config.cookies?.enabled && config.cookies?.loginUrl) {
    if (!config.cookies.loginSelectors) {
      errors.push('Login selectors are required when loginUrl is provided');
    }
    if (!config.cookies.credentials) {
      errors.push('Credentials are required when loginUrl is provided');
    }
  }

  return errors;
}

export function validateCookieConfig(config: CookieConfig): string[] {
  const errors: string[] = [];

  if (config.enabled && config.loginUrl && !isValidUrl(config.loginUrl)) {
    errors.push('Invalid login URL format');
  }

  return errors;
}

export function validateCrawlerOptions(options: CrawlerOptions): string[] {
  const errors: string[] = [];

  if (options.timeout && options.timeout < 0) {
    errors.push('Timeout must be positive');
  }

  if (options.retries && options.retries < 0) {
    errors.push('Retries must be positive');
  }

  if (options.delay && options.delay < 0) {
    errors.push('Delay must be positive');
  }

  return errors;
}

function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}