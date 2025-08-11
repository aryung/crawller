# Universal Web Crawler

一個功能強大、易於使用的通用網頁爬蟲工具，支援靈活的 URL、選擇器、標頭配置，以及 Cookie 管理功能。

> **📢 最新更新 (2025-01-13)**  
> - ✅ 修復 HTTP 413 Payload Too Large 問題（優化批次大小）
> - ✅ 修復 API 404 端點不存在問題（自動端點偵測）  
> - ✅ 改進 Token 認證流程（自動讀取 .env）
> - ✅ 新增智能批次處理策略（根據數據量自動調整）
> - 📦 預設批次大小：import:symbols (30)、sync:labels:chunk (100)

## 📋 快速參考卡片

### 常見問題快速解決

| 問題 | 解決命令 | 說明 |
|-----|---------|------|
| 413 Payload Too Large | `npm run import:symbols:small` | 使用最小批次 (10) |
| 404 API Not Found | 自動處理 | 系統會嘗試多個端點 |
| Token 無效 | 更新 `.env` 的 `BACKEND_API_TOKEN` | 重新獲取 token |
| 大量數據處理 | `npm run import:symbols -- --batch-size=5` | 極小批次處理 |
| 標籤同步失敗 | `npm run sync:labels -- --chunk-size=50` | 減小分塊大小 |

### 批次大小速查表

```bash
# 🚀 快速模式（網路良好）
import:symbols         # 批次 30
sync:labels           # 正常處理

# 🐢 安全模式（網路不穩或數據量大）
import:symbols:small   # 批次 10
sync:labels:chunk     # 分塊 100

# 🐌 極限模式（極大數據量或網路極差）
import:symbols -- --batch-size=5
sync:labels -- --chunk-size=30
```

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

## Pipeline 與 Scripts 命令指南

### 🚀 快速開始

```bash
# 1. 設置環境變數
cp .env.example .env
# 編輯 .env 添加 BACKEND_API_TOKEN

# 2. 測試連接
./test-fixes.sh        # 測試修復後的功能
./test-token-fix.sh    # 測試 Token 讀取

# 3. 執行設置（使用優化後的批次大小）
npm run sync:labels:chunk     # 同步標籤（分塊大小 100）
npm run import:symbols:small  # 匯入股票（批次大小 10）
```

### 三大核心命令對比

| 命令 | 用途 | 執行內容 | 適用場景 | 批次優化 |
|-----|------|---------|---------|----------|
| `npm run clear:labels` | 清理標籤 | 刪除系統定義的產業標籤 | 重置標籤數據 | 自動嘗試多個 API 端點 |
| `npm run pipeline:full` | 完整流程 | 爬蟲→數據處理→後端同步 | 從零開始的完整更新 | 使用小批次處理 |
| `npm run setup:all` | 數據設置 | 跳過爬蟲，使用現有數據→後端同步 | 基於現有數據的快速設置 | 智能分塊處理 |

### 常用命令詳解

#### 1. Pipeline 命令（完整流程）
```bash
# 完整 Pipeline 流程（包含爬蟲）
npm run pipeline:full

# 僅數據處理（跳過爬蟲，使用現有輸出）
npm run pipeline:data-only
npm run setup:all  # 等同於 pipeline:data-only

# 僅執行爬蟲（不同步到後端）
npm run pipeline:crawl-only

# 查看 Pipeline 統計
npm run pipeline:stats
```

#### 2. 標籤管理命令
```bash
# 清理標籤（需要確認）
npm run clear:labels          # 軟刪除所有標籤（自動嘗試多個端點）
npm run clear:labels:dry      # 預覽模式
npm run clear:labels:hard     # 硬刪除（永久刪除）
npm run clear:labels:tpe      # 只清理台灣市場標籤

# 同步標籤（優化後的批次處理）
npm run sync:labels           # 同步類別標籤到後端
npm run sync:labels:dry       # 預覽模式
npm run sync:labels:chunk     # 分塊處理（預設 100，解決 413 錯誤）

# 自訂分塊大小
npm run sync:labels -- --chunk-size=50   # 更小的分塊
npm run sync:labels -- --chunk-size=200  # 較大的分塊
```

#### 3. 股票與數據匯入
```bash
# 股票代碼匯入（優化後的批次大小）
npm run import:symbols         # 匯入所有市場（批次 30）
npm run import:symbols:small   # 最小批次匯入（批次 10）
npm run import:symbols:dry     # 預覽模式（批次 30）
npm run import:symbols:tpe     # 只匯入台灣股票（批次 30）
npm run import:symbols:us      # 只匯入美國股票（批次 30）
npm run import:symbols:jp      # 只匯入日本股票（批次 30）

# 自訂批次大小
npm run import:symbols -- --batch-size=20  # 自訂批次大小
npm run import:symbols -- --batch-size=5   # 極小批次（網路慢時使用）

# 基本面數據匯入
npm run import:fundamental:batch  # 批量匯入所有數據
npm run import:fundamental:tw     # 只匯入台灣數據
npm run import:fundamental:us     # 只匯入美國數據
npm run import:fundamental:jp     # 只匯入日本數據
```

### 環境配置

所有命令都會自動讀取 `.env` 檔案中的配置：

```bash
# .env 檔案範例
BACKEND_API_URL=http://localhost:3000
BACKEND_API_TOKEN=eyJhbGciOiJIUzI1NiIs...  # JWT Token
```

**重要**：確保 `.env` 中的 `BACKEND_API_TOKEN` 是有效的，這樣可以避免權限問題。

### 常見錯誤與解決方案

#### 1. HTTP 413 Payload Too Large
**錯誤原因**：一次性傳送的數據量太大（如 8000+ 個股票）

**解決方案**：
```bash
# 使用更小的批次大小（已優化預設值）
npm run import:symbols        # 預設批次大小 30
npm run import:symbols:small  # 批次大小 10（最小）
npm run sync:labels:chunk     # 分塊大小 100

# 自訂批次大小
npm run import:symbols -- --batch-size=20
npm run sync:labels -- --chunk-size=50
```

**批次大小建議**：
- 少於 1000 個項目：批次 50-100
- 1000-5000 個項目：批次 30-50
- 超過 5000 個項目：批次 10-30

#### 2. DELETE API 403/404 錯誤
**錯誤原因**：API 端點不存在或權限不足

**解決方案**：
1. 確認 `.env` 中的 `BACKEND_API_TOKEN` 是有效的管理員 token
2. 系統會自動嘗試多個可能的 API 端點
3. 嘗試使用軟刪除而非硬刪除

**自動端點偵測**：
系統會自動嘗試以下端點格式：
- `/label-industry/labels/{id}`
- `/labels/{id}`
- `/label-industry/labels/{id}/force-delete`
- `/symbols/bulk`, `/symbols/bulk-create`

#### 3. Token 過期或無效
**錯誤提示**：`Token 可能已過期或無效`

**解決方案**：
1. 更新 `.env` 中的 `BACKEND_API_TOKEN`
2. 從後端重新獲取有效的 token
3. 確認 token 具有管理員權限

### 推薦工作流程

#### 首次設置（優化版）
```bash
# 1. 環境準備
cp .env.example .env
# 編輯 .env 設置 BACKEND_API_TOKEN
./test-fixes.sh  # 驗證環境配置

# 2. 生成類別映射
npm run generate:mappings

# 3. 分步執行（推薦，避免超時）
npm run sync:labels:chunk        # 同步標籤（分塊 100）
npm run import:symbols:small     # 匯入股票（批次 10）
npm run import:fundamental:batch # 匯入基本面數據

# 或完整 Pipeline（自動處理）
npm run pipeline:full
```

#### 大數據量處理策略
```bash
# 針對 8000+ 股票的處理方案
# 1. 分市場處理
npm run import:symbols:tpe --batch-size=20  # 台灣市場
npm run import:symbols:us --batch-size=20   # 美國市場
npm run import:symbols:jp --batch-size=20   # 日本市場

# 2. 使用最小批次（網路不穩定時）
npm run import:symbols -- --batch-size=5

# 3. 分塊同步標籤
npm run sync:labels -- --chunk-size=50
```

#### 日常更新
```bash
# 使用現有爬蟲數據快速更新
npm run setup:all

# 或只更新特定部分
npm run sync:labels           # 只更新標籤
npm run import:fundamental:tw # 只更新台灣數據
```

#### 數據重置
```bash
# 完整重置流程
npm run clear:labels:hard     # 硬刪除所有標籤
npm run pipeline:full         # 重新執行完整流程
```

### 系統狀態檢查

```bash
# 查看 Pipeline 統計
npm run pipeline:stats

# 測試修復功能
./test-fixes.sh

# 測試 Token 配置
./test-token-fix.sh

# 測試 API 連接（腳本會自動顯示）
npm run clear:labels:dry

# 檢查配置
cat .env | grep BACKEND_API
```

### 📂 腳本功能總覽

### 核心腳本說明

| 腳本 | 功能 | 批次優化 | 自動重試 |
|-----|------|----------|----------|
| **sync-category-labels-simple** | 同步產業分類標籤到後端 | ✅ 智能分塊 (100-200) | ✅ |
| **clear-industry-labels** | 清理產業標籤（軟/硬刪除） | N/A | ✅ 多端點 |
| **import-symbols** | 批量匯入股票代碼 | ✅ 批次 30 | ✅ 多端點 |
| **import-fundamental-api** | 匯入財務基本面數據 | ✅ 批次 50 | ✅ |
| **PipelineOrchestrator** | 協調完整數據處理流程 | ✅ 自動 | ✅ |

### 資料處理流程圖

```
┌──────────────────┐
│   爬蟲獲取數據    │
└────────┬─────────┘
         ▼
┌──────────────────────────┐     ┌─────────────────────┐
│ generate-category-mapping │ ──► │ category-mappings   │
│  生成分類映射檔案         │     │     .json          │
└──────────────────────────┘     └──┬──────────┬──────┘
                                     ▼          ▼
                          ┌──────────────┐  ┌──────────────┐
                          │ sync-labels  │  │import-symbols│
                          │ 同步標籤     │  │ 匯入股票     │
                          └──────────────┘  └──────────────┘
                                     ▼
                          ┌───────────────────────┐
                          │ import-fundamental    │
                          │   匯入財務數據        │
                          └───────────────────────┘
```

> 💡 **詳細腳本文檔**：請參考 [`scripts/README.md`](scripts/README.md) 獲取完整使用說明

## 🏗️ 系統架構說明

#### API 客戶端架構
```
crawler/
├── src/common/api-client.ts     # 統一的 API 客戶端
│   ├── 自動端點偵測
│   ├── 批次處理優化
│   └── 錯誤重試機制
├── scripts/
│   ├── import-symbols.ts        # 股票匯入（批次 30）
│   ├── sync-category-labels-simple.ts  # 標籤同步（分塊 100）
│   └── clear-industry-labels.ts # 標籤清理（多端點嘗試）
└── pipeline/
    └── PipelineOrchestrator.ts  # Pipeline 協調器
```

#### 自動端點偵測機制
系統會自動嘗試多個可能的 API 端點，確保相容性：

**股票匯入端點**：
1. `/symbols/bulk`
2. `/symbols/bulk-create`
3. `/symbols/batch-create`
4. `/symbols`

**標籤刪除端點**：
1. `/label-industry/labels/{id}`
2. `/labels/{id}`
3. `/label-industry/labels/{id}/force-delete`
4. `/labels/{id}/force-delete`

#### 批次處理策略

| 數據量 | 建議批次大小 | 命令範例 |
|--------|-------------|----------|
| < 100 項 | 50-100 | `npm run import:symbols` |
| 100-1000 項 | 30-50 | `npm run import:symbols` |
| 1000-5000 項 | 20-30 | `npm run import:symbols -- --batch-size=20` |
| 5000-10000 項 | 10-20 | `npm run import:symbols:small` |
| > 10000 項 | 5-10 | `npm run import:symbols -- --batch-size=5` |

## 腳本命令（開發用）

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
5. **批次處理**: 大數據量請使用適當的批次大小，避免 413 錯誤
6. **Token 管理**: 定期更新 API Token，確保權限有效

## 貢獻

歡迎提交 Issue 和 Pull Request！

## 授權

MIT License