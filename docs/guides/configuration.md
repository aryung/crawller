# 配置指南

## 基本配置結構

```typescript
interface CrawlerConfig {
  url: string;                    // 必填：目標 URL
  selectors?: SelectorConfig;     // 可選：資料選擇器
  headers?: Record<string, string>; // 可選：HTTP 標頭
  cookies?: CookieConfig;         // 可選：Cookie 設定
  options?: CrawlerOptions;       // 可選：爬蟲選項
}
```

## URL 配置

### 基本 URL
```typescript
{
  url: 'https://example.com'
}
```

### 帶參數的 URL
```typescript
{
  url: 'https://example.com/search?q=keyword&page=1'
}
```

### 動態 URL（透過配置檔案）
```json
{
  "url": "https://api.example.com/posts/{id}",
  "urlParams": {
    "id": "123"
  }
}
```

## 選擇器配置

### 基本選擇器

```typescript
{
  selectors: {
    title: 'h1',                    // CSS 選擇器
    content: '.post-content',       // Class 選擇器
    author: '#author',              // ID 選擇器
    date: 'time[datetime]'          // 屬性選擇器
  }
}
```

### 進階選擇器

```typescript
{
  selectors: {
    // 提取屬性值
    link: {
      selector: 'a.main-link',
      attribute: 'href'
    },
    
    // 提取多個元素
    tags: {
      selector: '.tag:multiple'
    },
    
    // 資料轉換
    price: {
      selector: '.price',
      transform: (value: string) => parseFloat(value.replace('$', ''))
    },
    
    // 複雜轉換
    metadata: {
      selector: '.meta',
      transform: (value: string) => {
        const parts = value.split('|');
        return {
          author: parts[0]?.trim(),
          date: parts[1]?.trim(),
          category: parts[2]?.trim()
        };
      }
    }
  }
}
```

### 多元素選擇器

```typescript
{
  selectors: {
    // 所有連結
    allLinks: {
      selector: 'a:multiple',
      attribute: 'href'
    },
    
    // 所有圖片
    images: {
      selector: 'img:multiple',
      transform: (elements: any[]) => elements.map(img => ({
        src: img.src,
        alt: img.alt,
        width: img.width,
        height: img.height
      }))
    },
    
    // 列表項目
    listItems: {
      selector: 'li:multiple',
      transform: (items: string[]) => items.map(item => item.trim()).filter(Boolean)
    }
  }
}
```

## HTTP 標頭配置

### 基本標頭
```typescript
{
  headers: {
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'zh-TW,zh;q=0.9,en;q=0.8',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache'
  }
}
```

### API 請求標頭
```typescript
{
  headers: {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_TOKEN_HERE',
    'X-API-Key': 'your-api-key'
  }
}
```

### 自定義 User Agent
```typescript
{
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  }
}
```

## Cookie 配置

### Cookie 字串
```typescript
{
  cookies: {
    enabled: true,
    cookieString: 'sessionId=abc123; userId=456; preferences=dark-mode',
    domain: 'example.com'  // 可選
  }
}
```

### 自動登入
```typescript
{
  cookies: {
    enabled: true,
    loginUrl: 'https://example.com/login',
    loginSelectors: {
      username: 'input[name="username"]',
      password: 'input[name="password"]',
      submit: 'button[type="submit"]'
    },
    credentials: {
      username: 'your_username',
      password: 'your_password'
    }
  }
}
```

### 複雜登入流程
```typescript
{
  cookies: {
    enabled: true,
    loginUrl: 'https://example.com/auth/login',
    loginSelectors: {
      username: '#email-input',
      password: '#password-input',
      submit: '.login-button'
    },
    credentials: {
      username: 'user@example.com',
      password: 'secure_password'
    },
    // 登入後等待時間
    waitAfterLogin: 3000
  }
}
```

## 爬蟲選項配置

### 基本選項
```typescript
{
  options: {
    waitFor: 2000,           // 頁面載入後等待時間（毫秒）
    timeout: 30000,          // 請求超時時間（毫秒）
    retries: 3,              // 重試次數
    headless: true,          // 是否使用無頭模式
    screenshot: false,       // 是否截圖
    delay: 1000             // 重試間隔（毫秒）
  }
}
```

### 進階選項
```typescript
{
  options: {
    viewport: {
      width: 1920,
      height: 1080
    },
    userAgent: 'Custom User Agent String',
    waitFor: 5000,
    timeout: 60000,
    retries: 5,
    headless: false,         // 顯示瀏覽器視窗（除錯用）
    screenshot: true,
    delay: 2000
  }
}
```

## 完整配置範例

### 新聞網站
```typescript
{
  url: 'https://news.example.com/article/123',
  selectors: {
    headline: 'h1.article-title',
    content: '.article-body',
    author: '.author-name',
    publishDate: {
      selector: 'time.publish-date',
      attribute: 'datetime',
      transform: (value: string) => new Date(value)
    },
    tags: {
      selector: '.tag:multiple',
      transform: (tags: string[]) => tags.map(tag => tag.toLowerCase())
    },
    comments: {
      selector: '.comment:multiple .comment-text'
    }
  },
  headers: {
    'Accept-Language': 'zh-TW,zh;q=0.9'
  },
  options: {
    waitFor: 3000,
    screenshot: true,
    viewport: { width: 1200, height: 800 }
  }
}
```

### 電商網站
```typescript
{
  url: 'https://shop.example.com/product/456',
  selectors: {
    name: '.product-name',
    price: {
      selector: '.price-current',
      transform: (value: string) => parseFloat(value.replace(/[^\d.]/g, ''))
    },
    originalPrice: {
      selector: '.price-original',
      transform: (value: string) => parseFloat(value.replace(/[^\d.]/g, ''))
    },
    description: '.product-description',
    images: {
      selector: '.product-gallery img:multiple',
      attribute: 'src'
    },
    availability: '.stock-status',
    rating: {
      selector: '.rating-value',
      attribute: 'data-rating',
      transform: (value: string) => parseFloat(value)
    },
    reviews: {
      selector: '.review:multiple',
      transform: (reviews: any[]) => reviews.map(review => ({
        text: review.querySelector('.review-text')?.textContent,
        rating: review.querySelector('.review-rating')?.getAttribute('data-stars'),
        author: review.querySelector('.review-author')?.textContent
      }))
    }
  },
  headers: {
    'Accept': 'text/html,application/xhtml+xml',
    'Cache-Control': 'no-cache'
  },
  options: {
    waitFor: 4000,
    timeout: 45000,
    screenshot: true,
    retries: 2
  }
}
```

### 需要登入的社交網站
```typescript
{
  url: 'https://social.example.com/profile/user123',
  selectors: {
    username: '.profile-username',
    bio: '.profile-bio',
    followerCount: {
      selector: '.followers-count',
      transform: (value: string) => parseInt(value.replace(/\D/g, ''))
    },
    posts: {
      selector: '.post:multiple',
      transform: (posts: any[]) => posts.map(post => ({
        content: post.querySelector('.post-text')?.textContent,
        likes: parseInt(post.querySelector('.like-count')?.textContent || '0'),
        timestamp: post.querySelector('.post-time')?.getAttribute('datetime')
      }))
    }
  },
  cookies: {
    enabled: true,
    loginUrl: 'https://social.example.com/login',
    loginSelectors: {
      username: 'input[name="email"]',
      password: 'input[name="password"]',
      submit: 'button.login-btn'
    },
    credentials: {
      username: 'your_email@example.com',
      password: 'your_password'
    }
  },
  headers: {
    'Accept-Language': 'zh-TW'
  },
  options: {
    waitFor: 5000,
    timeout: 60000,
    headless: true,
    screenshot: false,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  }
}
```

## 配置檔案管理

### 儲存配置
```typescript
const crawler = new UniversalCrawler();

await crawler.saveConfig('news-site', {
  url: 'https://news.example.com',
  selectors: { /* ... */ }
});
```

### 使用配置
```typescript
// 使用配置檔案名稱
const result = await crawler.crawl('news-site');

// 或載入並修改配置
const config = await crawler.loadConfig('news-site');
config.url = 'https://news.example.com/latest';
const result = await crawler.crawl(config);
```

### 預設配置模板
```typescript
import { getPresetConfig } from './src';

// 獲得預設新聞配置
const newsConfig = getPresetConfig('news');
newsConfig.url = 'your-news-url';

// 獲得預設電商配置
const shopConfig = getPresetConfig('ecommerce');
shopConfig.url = 'your-shop-url';
```

## 配置驗證

系統會自動驗證配置的正確性：

- **URL 格式**: 必須是有效的 URL
- **必填欄位**: url 欄位必須存在
- **Cookie 配置**: 如果啟用自動登入，必須提供完整的登入資訊
- **數值範圍**: timeout、retries 等數值必須為正數

如果配置無效，系統會拋出詳細的錯誤訊息。

## 最佳實踐

1. **使用配置檔案**: 將常用的配置儲存為檔案，方便重複使用
2. **合理的等待時間**: 根據網站載入速度設定適當的 waitFor 時間
3. **錯誤處理**: 設定足夠的重試次數和超時時間
4. **選擇器優化**: 使用穩定的 CSS 選擇器，避免過於具體的選擇器
5. **資料轉換**: 在選擇器層級進行資料轉換，保持資料結構一致性