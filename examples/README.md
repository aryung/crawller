# 爬蟲使用範例

這個目錄包含了各種使用通用爬蟲的範例程式。

## 基本使用

### 1. 基本爬蟲 (basic-usage.ts)
展示最基本的爬蟲功能，包括：
- 簡單的 URL 和選擇器配置
- 截圖功能
- JSON 匯出

```bash
npx tsx examples/basic-usage.ts
```

### 2. 多網站爬蟲 (multiple-sites.ts)
展示如何同時爬取多個網站：
- 併發爬蟲控制
- 批量處理結果
- 生成統計報告
- Excel 匯出

```bash
npx tsx examples/multiple-sites.ts
```

## 進階功能

### 3. Cookie 和登入 (cookie-login.ts)
展示 Cookie 處理功能：
- 使用 Cookie 字串
- 自動登入網站
- 需要認證的頁面爬取

```bash
npx tsx examples/cookie-login.ts
```

### 4. 配置管理 (config-management.ts)
展示配置檔案管理：
- 預設配置模板
- 儲存和載入配置
- 批量使用不同配置

```bash
npx tsx examples/config-management.ts
```

### 5. 進階選擇器 (advanced-selectors.ts)
展示複雜的資料提取：
- 多種選擇器類型
- 資料轉換函式
- 複雜結構化資料提取

```bash
npx tsx examples/advanced-selectors.ts
```

### 6. 引擎比較 (playwright-vs-puppeteer.ts)
展示不同爬蟲引擎的使用：
- Puppeteer vs Playwright 比較
- 動態引擎切換
- 效能測試

```bash
npx tsx examples/playwright-vs-puppeteer.ts
```

## 執行前準備

1. 安裝依賴：
```bash
npm install
```

2. 編譯 TypeScript（可選）：
```bash
npm run build
```

3. 如果要使用 Playwright 範例，需要額外安裝：
```bash
npm install playwright
npx playwright install
```

## 輸出檔案

範例執行後會在以下目錄產生檔案：
- `output/` - 匯出的資料檔案（JSON, CSV, Excel）
- `output/screenshots/` - 截圖檔案
- `configs/` - 儲存的配置檔案
- `logs/` - 日誌檔案

## 注意事項

1. 某些範例使用範例網站，實際使用時請替換為真實的 URL
2. 使用登入功能時，請注意保護好你的帳號密碼
3. 爬蟲時請遵守網站的 robots.txt 和使用條款
4. 大量爬蟲時建議加入適當的延遲以避免對目標網站造成壓力

## 自定義範例

你可以參考這些範例來建立自己的爬蟲腳本：

```typescript
import { UniversalCrawler } from '../src';

async function myCustomCrawler() {
  const crawler = new UniversalCrawler();
  
  try {
    const result = await crawler.crawl({
      url: 'your-target-url',
      selectors: {
        // 你的選擇器配置
      }
    });
    
    // 處理結果
    console.log(result);
    
  } finally {
    await crawler.cleanup();
  }
}

myCustomCrawler();
```