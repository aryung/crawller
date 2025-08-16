/**
 * Site-based Concurrency Control Configuration
 *
 * This configuration provides site-specific concurrency limits to prevent
 * blocking individual websites while allowing parallel processing across
 * different domains.
 *
 * Usage: Instead of global concurrency control, each website domain has
 * its own concurrent execution limits based on site characteristics.
 */

export interface SiteConcurrencyConfig {
  /** Maximum concurrent requests for this site */
  maxConcurrent: number;
  /** Minimum delay between requests (milliseconds) */
  delayBetweenRequests: number;
  /** Request timeout (milliseconds) */
  requestTimeout: number;
  /** Maximum retry attempts for failed requests */
  maxRetries: number;
  /** Whether this site supports parallel requests */
  supportsParallel: boolean;
  /** Site description for logging/debugging */
  description: string;
}

/**
 * Site-specific concurrency settings based on website characteristics
 * and observed performance patterns.
 */
export const SITE_CONCURRENCY_SETTINGS: Record<string, SiteConcurrencyConfig> =
  {
    // Taiwan Stock Exchange (Official API) - High reliability, can handle more concurrent requests
    'www.twse.com.tw': {
      maxConcurrent: 2,
      delayBetweenRequests: 2000,
      requestTimeout: 30000,
      maxRetries: 3,
      supportsParallel: true,
      description: 'Taiwan Stock Exchange Official API - Daily/History Data',
    },

    // Taiwan Yahoo Finance - Moderate concurrency for quarterly data
    'tw.stock.yahoo.com': {
      maxConcurrent: 2,
      delayBetweenRequests: 2000,
      requestTimeout: 30000,
      maxRetries: 3,
      supportsParallel: true,
      description: 'Yahoo Finance Taiwan - Quarterly Financial Data',
    },

    // US Yahoo Finance - Conservative settings due to higher traffic volume
    'finance.yahoo.com': {
      maxConcurrent: 2,
      delayBetweenRequests: 2000,
      requestTimeout: 30000,
      maxRetries: 3,
      supportsParallel: true,
      description: 'Yahoo Finance US - Quarterly Financial Data & History',
    },

    // Japan Yahoo Finance - Conservative settings for international access
    'finance.yahoo.co.jp': {
      maxConcurrent: 2,
      delayBetweenRequests: 2000,
      requestTimeout: 30000,
      maxRetries: 3,
      supportsParallel: true,
      description: 'Yahoo Finance Japan - Quarterly Financial Data & History',
    },

    // Default settings for unknown sites
    default: {
      maxConcurrent: 1,
      delayBetweenRequests: 5000,
      requestTimeout: 30000,
      maxRetries: 3,
      supportsParallel: false,
      description: 'Default settings for unknown domains',
    },
  };

/**
 * Extract domain from URL for site-based concurrency lookup
 */
export function extractDomainFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch (error) {
    console.warn(`Failed to extract domain from URL: ${url}`, error);
    return 'default';
  }
}

/**
 * Get site concurrency configuration for a given URL
 */
export function getSiteConcurrencyConfig(url: string): SiteConcurrencyConfig {
  const domain = extractDomainFromUrl(url);
  return (
    SITE_CONCURRENCY_SETTINGS[domain] || SITE_CONCURRENCY_SETTINGS['default']
  );
}

/**
 * Get all configured site domains
 */
export function getConfiguredSiteDomains(): string[] {
  return Object.keys(SITE_CONCURRENCY_SETTINGS).filter(
    (domain) => domain !== 'default'
  );
}

/**
 * Calculate total maximum concurrent requests across all sites
 */
export function getTotalMaxConcurrency(): number {
  return Object.values(SITE_CONCURRENCY_SETTINGS)
    .filter(
      (_, index) => Object.keys(SITE_CONCURRENCY_SETTINGS)[index] !== 'default'
    )
    .reduce((total, config) => total + config.maxConcurrent, 0);
}

/**
 * Site distribution mapping for different data types
 */
export const SITE_DISTRIBUTION = {
  daily: {
    tw: 'www.twse.com.tw',
    jp: 'finance.yahoo.co.jp',
    us: 'finance.yahoo.com',
  },
  quarterly: {
    tw: 'tw.stock.yahoo.com',
    jp: 'finance.yahoo.co.jp',
    us: 'finance.yahoo.com',
  },
} as const;

export type DataType = keyof typeof SITE_DISTRIBUTION;
export type MarketRegion = keyof typeof SITE_DISTRIBUTION.daily;

