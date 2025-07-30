# API 參考文檔

## 核心類別

### UniversalCrawler

主要的爬蟲控制器，提供統一的介面來管理不同的爬蟲引擎。

```typescript
class UniversalCrawler {
  constructor(options?: {
    usePlaywright?: boolean;
    configPath?: string;
    outputDir?: string;
  })
}
```

#### 建構子參數

- `usePlaywright` (boolean, 可選): 是否使用 Playwright 引擎，預設為 false (使用 Puppeteer)
- `configPath` (string, 可選): 配置檔案存放路徑，預設為 'configs'
- `outputDir` (string, 可選): 輸出檔案路徑，預設為 'output'

#### 方法

##### crawl(config)

執行單一頁面爬蟲。

```typescript
async crawl(config: CrawlerConfig | string): Promise<CrawlerResult>
```

**參數:**
- `config`: 爬蟲配置物件或配置檔案名稱

**回傳:** `CrawlerResult` 爬蟲結果

**範例:**
```typescript
const result = await crawler.crawl({
  url: 'https://example.com',
  selectors: { title: 'h1' }
});

// 或使用配置檔案
const result = await crawler.crawl('my-config');
```

##### crawlMultiple(configs, concurrent)

執行批量爬蟲。

```typescript
async crawlMultiple(
  configs: (CrawlerConfig | string)[], 
  concurrent?: number
): Promise<CrawlerResult[]>
```

**參數:**
- `configs`: 配置陣列
- `concurrent`: 併發數量，預設為 3

**回傳:** `CrawlerResult[]` 爬蟲結果陣列

##### export(results, options)

匯出爬蟲結果。

```typescript
async export(
  results: CrawlerResult[], 
  options: ExportOptions
): Promise<string>
```

**參數:**
- `results`: 要匯出的結果
- `options`: 匯出選項

**回傳:** 匯出檔案的路徑

##### 配置管理方法

```typescript
async saveConfig(name: string, config: CrawlerConfig): Promise<void>
async loadConfig(name: string): Promise<CrawlerConfig>
async listConfigs(): Promise<string[]>
```

##### 工具方法

```typescript
async saveScreenshots(results: CrawlerResult[]): Promise<string[]>
async generateReport(results: CrawlerResult[]): Promise<string>
async cleanup(): Promise<void>
setEngine(usePlaywright: boolean): void
```

### WebCrawler

基於 Puppeteer 的爬蟲引擎。

```typescript
class WebCrawler {
  async crawl(config: CrawlerConfig): Promise<CrawlerResult>
  async cleanup(): Promise<void>
  async isHealthy(): Promise<boolean>
}
```

### PlaywrightCrawler

基於 Playwright 的爬蟲引擎。

```typescript
class PlaywrightCrawler {
  async crawl(config: CrawlerConfig): Promise<CrawlerResult>
  async cleanup(): Promise<void>
}
```

### ConfigManager

配置檔案管理器。

```typescript
class ConfigManager {
  constructor(configPath: string = 'configs')
  
  async loadConfig(name: string): Promise<CrawlerConfig>
  async saveConfig(name: string, config: CrawlerConfig): Promise<void>
  async listConfigs(): Promise<string[]>
  async deleteConfig(name: string): Promise<void>
  async duplicateConfig(sourceName: string, targetName: string): Promise<void>
  async mergeConfigs(baseConfigName: string, overrideConfig: Partial<CrawlerConfig>): Promise<CrawlerConfig>
}
```

#### 方法詳解

##### loadConfig(name)

載入指定名稱的配置檔案。

**參數:**
- `name`: 配置檔案名稱（不含 .json 副檔名）

**拋出異常:**
- 配置檔案不存在
- 配置檔案格式錯誤
- 配置驗證失敗

##### saveConfig(name, config)

儲存配置檔案。

**參數:**
- `name`: 配置檔案名稱
- `config`: 配置物件

**功能:**
- 自動建立配置目錄
- 驗證配置格式
- 格式化 JSON 輸出

##### mergeConfigs(baseConfigName, overrideConfig)

合併配置檔案。

**參數:**
- `baseConfigName`: 基底配置名稱
- `overrideConfig`: 要覆蓋的配置部分

**回傳:** 合併後的配置物件

**合併策略:**
- 基本屬性：覆蓋
- 物件屬性（headers, selectors, options, cookies）：深度合併

### DataExtractor

資料提取器，負責從頁面中提取資料。

```typescript
class DataExtractor {
  async extractData(page: Page, selectors?: SelectorConfig): Promise<Record<string, any>>
  async extractByEvaluation(page: Page, evaluationFn: string): Promise<any>
  async extractTableData(page: Page, tableSelector: string): Promise<any[]>
}
```

#### 方法詳解

##### extractData(page, selectors)

使用選擇器提取資料。

**支援的選擇器類型:**
- 字串選擇器：`'h1'`
- 屬性選擇器：`{ selector: 'a', attribute: 'href' }`
- 多元素選擇器：`'.item:multiple'`
- 轉換函式：`{ selector: '.price', transform: (value) => parseFloat(value) }`

##### extractByEvaluation(page, evaluationFn)

使用 JavaScript 程式碼提取資料。

**參數:**
- `evaluationFn`: 要在頁面中執行的 JavaScript 程式碼字串

##### extractTableData(page, tableSelector)

提取表格資料。

**回傳:** 表格資料陣列，每個元素代表一行資料

### CookieManager

Cookie 管理器。

```typescript
class CookieManager {
  constructor(config: CookieConfig)
  
  async handleCookies(page: Page): Promise<void>
  async getCookies(page: Page): Promise<any[]>
  async saveCookiesToFile(page: Page, filepath: string): Promise<void>
  async loadCookiesFromFile(page: Page, filepath: string): Promise<void>
}
```

#### 支援的 Cookie 處理方式

1. **Cookie 字串**: 直接設定 Cookie 值
2. **自動登入**: 透過表單自動登入獲取 Cookie
3. **檔案載入**: 從檔案載入之前儲存的 Cookie

### DataExporter

資料匯出器。

```typescript
class DataExporter {
  constructor(outputDir: string = 'output')
  
  async exportResults(results: CrawlerResult[], options: ExportOptions): Promise<string>
  async saveScreenshots(results: CrawlerResult[]): Promise<string[]>
  async generateReport(results: CrawlerResult[]): Promise<string>
}
```

#### 支援的匯出格式

- **JSON**: 完整的結構化資料
- **CSV**: 表格形式，適合 Excel 開啟
- **XLSX**: Excel 格式，包含統計工作表

## 工具函式

### 日誌記錄

```typescript
import { logger } from './utils';

logger.info('資訊訊息');
logger.warn('警告訊息');
logger.error('錯誤訊息');
```

### 輔助函式

```typescript
import { delay, isValidUrl, parseSelector, sanitizeFilename, formatTimestamp } from './utils';

await delay(1000);                    // 延遲 1 秒
const valid = isValidUrl(url);        // 驗證 URL
const selector = parseSelector(sel);  // 解析選擇器
const filename = sanitizeFilename(name); // 清理檔名
const timestamp = formatTimestamp();  // 格式化時間戳
```

### 驗證函式

```typescript
import { validateCrawlerConfig, validateCookieConfig, validateCrawlerOptions } from './utils';

const errors = validateCrawlerConfig(config);
if (errors.length > 0) {
  console.error('配置錯誤:', errors);
}
```

## 錯誤處理

所有的異步方法都可能拋出異常，建議使用 try-catch 包裝：

```typescript
try {
  const result = await crawler.crawl(config);
  console.log('成功:', result);
} catch (error) {
  console.error('失敗:', error.message);
} finally {
  await crawler.cleanup();
}
```

## 常見錯誤

1. **配置驗證錯誤**: 檢查 URL 格式、必填欄位
2. **網路連線錯誤**: 檢查網路連線、目標網站狀態
3. **選擇器錯誤**: 檢查 CSS 選擇器語法、元素是否存在
4. **Cookie 設定錯誤**: 檢查 Cookie 格式、登入資訊
5. **瀏覽器啟動錯誤**: 檢查系統依賴、權限設定