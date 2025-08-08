# Universal Web Crawler

一個功能強大、易於使用的通用網頁爬蟲工具，支援靈活的 URL、選擇器、標頭配置，以及 Cookie 管理功能。

## 特色功能

- 🚀 **雙引擎支援**: Puppeteer 和 Playwright 可選
- 🍪 **智慧 Cookie 管理**: 支援 Cookie 字串和自動登入
- ⚙️ **靈活配置**: JSON 配置檔案管理
- 📊 **多格式匯出**: JSON、CSV、Excel 支援
- 🔄 **重試機制**: 自動處理網路錯誤
- 📸 **截圖功能**: 可選的頁面截圖
- 🎯 **進階選擇器**: 支援複雜的資料提取
- 📈 **統計報告**: 自動生成爬蟲結果報告

## 快速開始

### 安裝

```bash
npm install
```

### 基本使用

```typescript
import { UniversalCrawler } from './src';

const crawler = new UniversalCrawler();

// 基本爬蟲
const result = await crawler.crawl({
  url: 'https://example.com',
  selectors: {
    title: 'h1',
    description: 'meta[name="description"]',
    links: 'a:multiple'
  },
  options: {
    waitFor: 2000,
    screenshot: true
  }
});

console.log(result);
await crawler.cleanup();
```

## 進階配置

### Cookie 管理

```typescript
// 使用 Cookie 字串
const result = await crawler.crawl({
  url: 'https://protected-site.com',
  cookies: {
    enabled: true,
    cookieString: 'sessionId=abc123; userId=456'
  },
  selectors: {
    userInfo: '.user-profile'
  }
});

// 自動登入
const result = await crawler.crawl({
  url: 'https://site.com/dashboard',
  cookies: {
    enabled: true,
    loginUrl: 'https://site.com/login',
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
});
```

### 進階選擇器

```typescript
const result = await crawler.crawl({
  url: 'https://blog.example.com/post/123',
  selectors: {
    // 基本文字
    title: 'h1.post-title',
    
    // 屬性提取
    canonicalUrl: {
      selector: 'link[rel="canonical"]',
      attribute: 'href'
    },
    
    // 多個元素
    tags: {
      selector: '.tag:multiple',
      transform: (values: string[]) => values.map(tag => tag.trim())
    },
    
    // 複雜轉換
    publishDate: {
      selector: '.publish-date',
      attribute: 'datetime',
      transform: (value: string) => new Date(value)
    }
  }
});
```

### 配置檔案管理

```typescript
// 儲存配置
await crawler.saveConfig('my-site', {
  url: 'https://example.com',
  selectors: { /* ... */ }
});

// 使用配置
const result = await crawler.crawl('my-site');

// 列出所有配置
const configs = await crawler.listConfigs();
```

### 批量爬蟲

```typescript
const results = await crawler.crawlMultiple([
  'https://site1.com',
  'https://site2.com',
  'config-name'
], 3); // 併發數量

// 匯出結果
await crawler.export(results, {
  format: 'xlsx',
  filename: 'crawl_results'
});
```

## 引擎切換

### Puppeteer (預設)
```typescript
const crawler = new UniversalCrawler({ usePlaywright: false });
```

### Playwright
```typescript
const crawler = new UniversalCrawler({ usePlaywright: true });

// 需要安裝 Playwright
// npm install playwright
// npx playwright install
```

### 動態切換
```typescript
const crawler = new UniversalCrawler();

// 嘗試 Puppeteer
crawler.setEngine(false);
let result = await crawler.crawl(config);

if (!result.success) {
  // 切換到 Playwright
  crawler.setEngine(true);
  result = await crawler.crawl(config);
}
```

## 常見問題解決

### WebSocket Hang Up 問題

本爬蟲已內建多種解決方案：

1. **--no-sandbox 參數**: 已自動加入
2. **重試機制**: 失敗時自動重試
3. **引擎切換**: Puppeteer 失敗時可切換到 Playwright
4. **資源攔截**: 停用不必要的資源載入

### 效能優化

```typescript
const crawler = new UniversalCrawler();

// 配置效能選項
const result = await crawler.crawl({
  url: 'https://example.com',
  options: {
    headless: true,        // 無頭模式
    timeout: 30000,        // 30秒超時
    waitFor: 1000,         // 減少等待時間
    screenshot: false      // 停用截圖
  }
});
```

## API 參考

### UniversalCrawler

主要的爬蟲類別。

#### 建構子選項
```typescript
new UniversalCrawler({
  usePlaywright?: boolean;  // 使用 Playwright 引擎
  configPath?: string;      // 配置檔案路徑
  outputDir?: string;       // 輸出目錄
})
```

#### 主要方法

- `crawl(config)`: 單一頁面爬蟲
- `crawlMultiple(configs, concurrent)`: 批量爬蟲
- `export(results, options)`: 匯出結果
- `saveConfig(name, config)`: 儲存配置
- `loadConfig(name)`: 載入配置
- `cleanup()`: 清理資源

### 配置選項

```typescript
interface CrawlerConfig {
  url: string;                    // 目標 URL
  selectors?: SelectorConfig;     // 選擇器配置
  headers?: Record<string, string>; // HTTP 標頭
  cookies?: CookieConfig;         // Cookie 設定
  options?: CrawlerOptions;       // 爬蟲選項
}
```

詳細的型別定義請參考 `src/types/index.ts`。

## 使用範例

系統提供豐富的使用方式，包括：

- 基本爬蟲操作
- 批量多網站爬取
- Cookie 認證和自動登入
- JSON 配置檔案管理
- 進階選擇器和數據轉換
- 多種爬蟲引擎支援

## 腳本命令

```bash
npm run build      # 編譯 TypeScript
npm run dev        # 開發模式執行
npm run test       # 執行測試
npm run lint       # 程式碼檢查
npm run typecheck  # 型別檢查
```

## 輸出結構

```
output/
├── *.json          # JSON 匯出檔案
├── *.csv           # CSV 匯出檔案
├── *.xlsx          # Excel 匯出檔案
├── screenshots/    # 截圖檔案
└── *.md           # 統計報告

config/
└── *.json         # 配置檔案

logs/
├── error.log      # 錯誤日誌
└── combined.log   # 完整日誌
```

## 注意事項

1. **合法使用**: 請遵守目標網站的 robots.txt 和使用條款
2. **速率限制**: 大量爬蟲時請加入適當延遲
3. **資源管理**: 使用完畢後請呼叫 `cleanup()` 方法
4. **敏感資訊**: 不要在配置檔案中儲存明文密碼

## 貢獻

歡迎提交 Issue 和 Pull Request！

## 授權

MIT License