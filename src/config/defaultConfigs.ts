import { CrawlerConfig } from '../types';

export const DEFAULT_NEWS_CONFIG: CrawlerConfig = {
  url: 'https://example-news.com',
  selectors: {
    title: 'h1.article-title',
    content: '.article-content',
    author: '.author-name',
    publishDate: {
      selector: '.publish-date',
      attribute: 'datetime',
      transform: (value: string) => new Date(value)
    },
    tags: {
      selector: '.tag:multiple',
      transform: (value: string) => value.split(',').map(tag => tag.trim())
    }
  },
  headers: {
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'zh-TW,zh;q=0.9,en;q=0.8'
  },
  options: {
    waitFor: 2000,
    timeout: 30000,
    retries: 3,
    headless: true,
    screenshot: false
  }
};

export const DEFAULT_ECOMMERCE_CONFIG: CrawlerConfig = {
  url: 'https://example-shop.com/product/123',
  selectors: {
    name: '.product-name',
    price: {
      selector: '.price',
      transform: (value: string) => parseFloat(value.replace(/[^\d.]/g, ''))
    },
    description: '.product-description',
    images: {
      selector: '.product-image img:multiple',
      attribute: 'src'
    },
    availability: '.stock-status',
    rating: {
      selector: '.rating',
      attribute: 'data-rating',
      transform: (value: string) => parseFloat(value)
    }
  },
  headers: {
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Cache-Control': 'no-cache'
  },
  options: {
    waitFor: 3000,
    timeout: 45000,
    retries: 2,
    headless: true,
    screenshot: true
  }
};

export const DEFAULT_SOCIAL_CONFIG: CrawlerConfig = {
  url: 'https://example-social.com/profile/user123',
  selectors: {
    username: '.username',
    bio: '.bio-text',
    followerCount: {
      selector: '.followers-count',
      transform: (value: string) => parseInt(value.replace(/[^\d]/g, ''))
    },
    posts: {
      selector: '.post:multiple .post-text'
    }
  },
  cookies: {
    enabled: true,
    loginUrl: 'https://example-social.com/login',
    loginSelectors: {
      username: '#username',
      password: '#password',
      submit: '.login-button'
    },
    credentials: {
      username: 'your-username',
      password: 'your-password'
    }
  },
  options: {
    waitFor: 5000,
    timeout: 60000,
    retries: 3,
    headless: true,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  }
};

export const DEFAULT_TABLE_CONFIG: CrawlerConfig = {
  url: 'https://example-data.com/table',
  selectors: {
    tableData: {
      selector: 'table.data-table',
      transform: (html: string) => {
        // 這裡可以加入表格解析邏輯
        return html;
      }
    }
  },
  options: {
    waitFor: 2000,
    timeout: 30000,
    retries: 2,
    headless: true
  }
};

export const DEFAULT_API_CONFIG: CrawlerConfig = {
  url: 'https://api.example.com/data',
  headers: {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_TOKEN_HERE'
  },
  options: {
    timeout: 15000,
    retries: 3,
    headless: false // API 不需要瀏覽器
  }
};

export const presetConfigs = {
  news: DEFAULT_NEWS_CONFIG,
  ecommerce: DEFAULT_ECOMMERCE_CONFIG,
  social: DEFAULT_SOCIAL_CONFIG,
  table: DEFAULT_TABLE_CONFIG,
  api: DEFAULT_API_CONFIG
};

export function getPresetConfig(preset: keyof typeof presetConfigs): CrawlerConfig {
  return JSON.parse(JSON.stringify(presetConfigs[preset]));
}