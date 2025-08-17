# 開發參考手冊 (v3.1.1)

**專案**: Universal Web Crawler Development Reference  
**版本**: v3.1.1  
**更新日期**: 2025-08-16

重要原則: Always use sequential-thinking tool before tackling complex problems or coding tasks.

## 🎯 開發概述

本開發參考手冊涵蓋 Universal Web Crawler v3.1.1 的核心開發概念、最佳實踐、配置系統和技術實作詳情，包含最新的 Site-based Concurrency 智慧並發控制。

## 🏗️ CSS 選擇器最佳實踐

### 六大核心開發原則

#### 1. 結構化選擇器優先原則 ⭐

**最高優先原則**: 優先使用結構化的位置選擇器，避免依賴文字內容。

##### 選擇器優先級順序：

1. **位置選擇器** (最優先)

   ```css
   /* 表格第一行的所有數據格 */
   table > tbody > tr:nth-child(1) > td:nth-child(n+2)

   /* 特定區塊的第二個子元素 */
   section[data-testid*='financials'] > div:nth-child(2)

   /* 使用類別和位置組合 */
   .table-container > div:first-child > div > div:nth-child(n+2)
   ```

2. **屬性選擇器** (次優先)

   ```css
   [data-testid="quarterly-data"]
   [aria-label*="financial"]
   ```

3. **類別選擇器** (輔助)

   ```css
   .financial-table .data-cell
   ```

4. **:has() 配合結構** (特殊情況)
   ```css
   tr:has(td:contains('每股盈餘')) td:last-child
   ```

**❌ 避免使用 :contains()** 的原因：

- 依賴文字內容不穩定
- 語言相關，國際化困難
- 相當於 hardcode 文字

##### 實際配置範例

```json
{
  "selectors": {
    // ✅ 好的做法：使用結構化選擇器
    "operatingCashFlow": {
      "selector": "section[data-testid*='table'] > div:nth-child(2) > div:nth-child(1) > div > div:nth-child(n+2)",
      "transform": "parseFinancialValue"
    },

    // ✅ 使用 :has() 選擇器精確定位
    "eps": {
      "selector": "tr:has(td:contains('每股盈餘')) td:last-child",
      "transform": "cleanEPSValue"
    },

    // ❌ 避免：依賴文字內容
    "badExample": {
      "selector": "tr:has(td:contains('Operating Cash Flow')) td:nth-child(2)",
      "transform": "parseFinancialValue"
    }
  }
}
```

#### 2. DOM 預處理 - Exclude Selector

**核心概念**: 使用 exclude 選擇器移除會干擾目標數據提取的元素。

##### 使用時機判斷

**🟢 建議使用的場景**:

- 目標數據區域內包含廣告或干擾元素
- 這些干擾元素與目標數據在同一層級
- 主選擇器無法完全排除干擾時

**🔴 不需要使用的場景**:

- header、footer、sidebar 等本身就不在選擇器範圍內的元素
- 能夠通過精確 `:has()` 選擇器直接定位純淨數據時

##### 最佳實踐示例

```json
{
  // ✅ 正確：只排除真正影響數據提取的元素
  "excludeSelectors": [
    ".financial-table .advertisement",     // 表格內的廣告
    "tr[data-ad-type]",                   // 廣告標記行
    ".data-section .sponsored-content"     // 數據區域的贊助內容
  ],
  "selectors": {
    "eps": {
      "selector": "tr:has(td:contains('每股盈餘')) td:last-child",
      "transform": "cleanEPSValue"
    }
  }
}

// ❌ 避免：過度排除不相關元素
{
  "excludeSelectors": [
    ".header, .footer, .nav",  // 這些本來就不會被選到
    ".sidebar, .menu"          // 與目標數據無關
  ]
}
```

#### 3. 禁止錯誤數據捉取

**嚴禁**: 使用通用選擇器捉取混雜資料再透過轉換函數進行過濾。

```typescript
// ❌ 錯誤：捉取混雜數據再過濾
"allData": {
  "selector": "table td, .data-cell, li, span",
  "transform": "complexFilterAndExtract"  // 複雜過濾函數
}

// ✅ 正確：精確選取
"revenueQ1": {
  "selector": "table.financial-data tr:has(td:contains('營收')) td:nth-child(2)",
  "transform": "cleanFinancialNumber"  // 簡單格式轉換
}
```

#### 4. 獨立選擇器

每個最終輸出欄位使用獨立的 CSS 選擇器，基於最終 data 結構的欄位需求設計。

#### 5. 動態時間軸提取

**禁止硬編碼**: 所有時間軸和期間數據必須動態提取。

```typescript
// ❌ 錯誤：硬編碼時間
const fiscalPeriods = ['2025-Q1', '2024-Q4', '2024-Q3'];

// ✅ 正確：動態解析
const patterns = [
  /(20\d{2})\s*Q([1-4])\s+([0-9]+\.?[0-9]{0,2})/g, // 動態匹配
  /(20\d{2})\s*H([1-2])\s+([0-9]+\.?[0-9]{0,2})/g, // 支援半年度
];
```

#### 6. 真實數值常數

參考 `src/const/finance.ts` 定義的真實常數進行驗證和轉換。

```typescript
export const TW_REVENUE_DATA_CONSTANTS = {
  MIN_YEAR: 1990,
  MAX_YEAR_OFFSET: 2,
  MIN_REASONABLE_VALUE: 1,
  MAX_DIGITS: 15,
} as const;

export const UNIT_MULTIPLIERS = {
  MILLION_YEN: 1000000,
  THOUSAND_TWD: 1000,
  PERCENTAGE: 0.01,
} as const;
```

## 🔧 配置系統架構

### 配置檔案結構

```typescript
interface CrawlerConfig {
  templateType: string; // 配置類型識別
  url: string; // 目標 URL
  variables?: Record<string, string>; // 變數替換
  stockInfo?: StockInfo; // 股票資訊
  actions?: Action[]; // 頁面操作
  selectors: SelectorConfig; // 資料選擇器
  excludeSelectors?: string[]; // 排除元素選擇器
  export?: ExportConfig; // 輸出設定
  options?: CrawlerOptions; // 爬蟲選項
}

interface SelectorConfig {
  [key: string]: {
    selector: string;
    multiple?: boolean;
    attribute?: string;
    transform?: string;
  };
}

interface Action {
  type: 'click' | 'input' | 'select' | 'wait';
  selector: string;
  value?: string;
  timeout?: number;
}
```

### 配置範本系統

#### 範本目錄結構

```
config/templates/
├── yahoo-finance-tw-eps.json           # 台灣 EPS 範本
├── yahoo-finance-tw-balance-sheet.json # 台灣資產負債表範本
├── yahoo-finance-tw-cash-flow.json     # 台灣現金流量表範本
├── yahoo-finance-us-financials.json    # 美國財務數據範本
└── yahoo-finance-jp-performance.json   # 日本績效數據範本
```

#### 範本變數替換

```json
{
  "templateType": "tw-eps",
  "url": "https://tw.stock.yahoo.com/quote/{{stockCode}}",
  "variables": {
    "stockCode": "2330"
  },
  "export": {
    "filename": "yahoo_finance_tw_eps_{{stockCode}}"
  }
}
```

### 配置生成器

```bash
# 台灣市場配置生成
npx tsx scripts/generate-yahoo-tw-configs.ts --type=eps
npx tsx scripts/generate-yahoo-tw-configs.ts --type=balance-sheet
npx tsx scripts/generate-yahoo-tw-configs.ts --type=cash-flow-statement

# 美國市場配置生成
npx tsx scripts/generate-yahoo-us-configs.ts --type=financials

# 日本市場配置生成
npx tsx scripts/generate-yahoo-jp-configs.ts --type=performance
```

### v3.0 分類配置系統

```
config-categorized/
├── quarterly/          # 季度數據配置
│   ├── tw/            # 台灣市場
│   ├── us/            # 美國市場
│   └── jp/            # 日本市場
├── daily/             # 每日數據配置
│   ├── tw-history/    # 台灣歷史價格
│   ├── us-history/    # 美國歷史價格
│   └── jp-history/    # 日本歷史價格
└── metadata/          # 元數據配置
    ├── symbols/       # 股票代碼
    └── labels/        # 分類標籤
```

## 🎯 位置獨立選擇器方法

**適用場景**: 複雜 DOM 結構且數據類型需要精確對齊時。

### 5 階段開發流程

1. **問題診斷**: 識別數據提取問題（缺失期間、數據錯位、數值異常）
2. **DOM 結構分析**: 使用 `debugFieldExtraction` 獲取完整 DOM 數據
3. **位置映射建立**: 建立數據類型與位置的精確對應關係
4. **獨立提取實現**: 為每種數據類型創建專用提取邏輯
5. **驗證測試**: 確保所有數據正確對齊

### 實際案例：Yahoo Finance 現金流表

```typescript
// DOM 位置映射表
const POSITION_MAPPING = {
  fiscalPeriods: { start: 105, end: 124, count: 20 },
  operatingCashFlow: { start: 130, end: 149, count: 20 },
  investingCashFlow: { start: 153, end: 172, count: 20 },
  financingCashFlow: { start: 175, end: 194, count: 20 },
  endCashPosition: { start: 197, end: 216, count: 20 },
};

// 位置獨立提取函數
extractOperatingCashFlowFromPosition: (
  content: string | string[]
): number[] => {
  const contentArray = Array.isArray(content) ? content : [content];

  // 動態位置檢測
  const mapping = POSITION_MAPPING.operatingCashFlow;
  const results: number[] = [];

  for (let i = mapping.start; i <= mapping.end; i++) {
    if (i < contentArray.length) {
      const value = parseFinancialNumber(contentArray[i]);
      if (!isNaN(value)) {
        results.push(value);
      }
    }
  }

  return results;
};
```

## 🔄 數據轉換函數

### 標準轉換函數

```typescript
// 基本數字清理
cleanFinancialNumber: (value: string): number => {
  const cleaned = value.replace(/[^\d.-]/g, '');
  return parseFloat(cleaned) || 0;
};

// EPS 專用清理
cleanEPSValue: (value: string): number => {
  // 移除貨幣符號和單位
  const cleaned = value.replace(/[$¥€£,\s]/g, '');
  return parseFloat(cleaned) || 0;
};

// 動態時間解析
parseFiscalPeriod: (value: string): string => {
  const patterns = [
    /(20\d{2})\s*Q([1-4])/g, // 2024 Q1
    /(20\d{2})\/(\d{1,2})/g, // 2024/3
    /(20\d{2})-(\d{2})-(\d{2})/g, // 2024-03-31
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(value);
    if (match) {
      return formatFiscalPeriod(match);
    }
  }

  return value;
};

// 調試用途
debugFieldExtraction: (content: string | string[]): any => {
  console.log('[Debug] Raw content:', content);
  if (Array.isArray(content)) {
    console.log('[Debug] Content length:', content.length);
    content.slice(0, 50).forEach((item, index) => {
      console.log(`[Debug] [${index}]:`, item);
    });
  }
  return content;
};
```

### 自定義轉換函數開發

```typescript
// 1. 在 src/transforms/sites/ 目錄建立轉換文件
// src/transforms/sites/yahoo-finance-tw.ts

export const YahooFinanceTWTransforms = {
  // 新增轉換函數
  customEPSExtraction: (content: string | string[]): EPSData[] => {
    const contentArray = Array.isArray(content) ? content : [content];

    // 實作自定義邏輯
    const results: EPSData[] = [];

    // 模式匹配和數據提取
    const pattern = /(20\d{2})\s*Q([1-4])\s+([0-9]+\.?[0-9]{0,2})/g;

    contentArray.forEach(item => {
      const matches = [...item.matchAll(pattern)];
      matches.forEach(match => {
        results.push({
          year: parseInt(match[1]),
          quarter: parseInt(match[2]),
          eps: parseFloat(match[3])
        });
      });
    });

    return results;
  }
};

// 2. 在配置中使用
{
  "eps": {
    "selector": "table td",
    "multiple": true,
    "transform": "customEPSExtraction"
  }
}
```

## 🚀 開發工作流程

### 新功能開發流程

1. **需求分析**

   - 確定目標網站和數據類型
   - 分析頁面結構和數據格式
   - 設計預期的輸出格式

2. **配置開發**

   ```bash
   # 1. 建立測試配置
   vi config/active/test-new-feature.json

   # 2. 測試配置
   npx tsx src/cli.ts --config config/active/test-new-feature.json

   # 3. 調試和優化
   # 使用 debugFieldExtraction 查看原始數據
   ```

3. **轉換函數開發**

   ```bash
   # 1. 實作轉換函數
   vi src/transforms/sites/yahoo-finance-tw.ts

   # 2. 測試轉換函數
   npm run typecheck
   ```

4. **範本和生成器**

   ```bash
   # 1. 建立範本
   vi config/templates/new-feature-template.json

   # 2. 更新生成器
   vi scripts/generate-yahoo-tw-configs.ts

   # 3. 生成配置
   npx tsx scripts/generate-yahoo-tw-configs.ts --type=new-feature
   ```

5. **測試和驗證**

   ```bash
   # 1. 批量測試
   npm run crawl:tw:new-feature

   # 2. 驗證數據
   ls -la output/quarterly/tw/new-feature/

   # 3. 檢查數據格式
   jq '.results[0]' output/quarterly/tw/new-feature/sample.json
   ```

### 調試技巧

#### 1. 瀏覽器開發者工具

```javascript
// 在瀏覽器 Console 測試選擇器
document.querySelectorAll("tr:has(td:contains('每股盈餘')) td:last-child");

// 檢查元素結構
$0; // 選中的元素
$0.textContent; // 元素文字內容
$0.children; // 子元素
```

#### 2. 配置調試

```json
{
  "fiscalPeriods": {
    "selector": "li div:first-child",
    "transform": "debugFieldExtraction" // 查看原始數據
  },
  "options": {
    "headless": false, // 顯示瀏覽器
    "screenshot": true, // 截圖調試
    "timeout": 60000 // 增加超時時間
  }
}
```

#### 3. 日誌分析

```bash
# 啟用詳細日誌
export DEBUG=crawler:*
npx tsx src/cli.ts --config config/active/test.json

# 查看關鍵日誌信息
grep "Pattern Match" logs/crawler.log
grep "Position Extract" logs/crawler.log
grep "Data Alignment" logs/crawler.log
```

### 常見開發問題

#### 1. 選擇器無法定位元素

**診斷步驟**:

```bash
# 1. 檢查頁面是否完全載入
# 增加 waitFor 時間

# 2. 檢查選擇器語法
# 在瀏覽器 Console 測試

# 3. 檢查動態內容
# 使用 screenshot: true 查看實際頁面
```

#### 2. 數據格式解析失敗

**解決方案**:

```typescript
// 使用更寬鬆的解析模式
cleanFinancialNumber: (value: string): number => {
  // 移除所有非數字字符（保留小數點和負號）
  const cleaned = value.replace(/[^\d.-]/g, '');
  const parsed = parseFloat(cleaned);

  // 驗證合理範圍
  if (isNaN(parsed) || parsed < -1000000 || parsed > 1000000000) {
    console.warn(`Invalid financial number: ${value} -> ${parsed}`);
    return 0;
  }

  return parsed;
};
```

#### 3. 動態內容載入問題

**解決方案**:

```json
{
  "actions": [
    {
      "type": "click",
      "selector": "button[data-testid='quarterly']",
      "timeout": 5000
    },
    {
      "type": "wait",
      "value": "3000" // 等待內容載入
    }
  ],
  "options": {
    "waitFor": 5000, // 增加等待時間
    "timeout": 30000 // 增加總超時時間
  }
}
```

## 📋 技術標準

### 程式碼品質標準

```bash
# TypeScript 類型檢查
npm run typecheck

# 程式碼風格檢查
npm run lint

# 單元測試
npm run test

# 整合測試
npm run test:integration
```

### 配置驗證標準

```typescript
// 配置驗證 Schema
interface ConfigValidation {
  templateType: string; // 必須符合預定義類型
  url: string; // 必須是有效 URL
  selectors: {
    // 至少包含一個選擇器
    [key: string]: {
      selector: string; // 必須是有效 CSS 選擇器
      transform?: string; // 必須是已定義的轉換函數
    };
  };
}

// 運行時驗證
function validateConfig(config: CrawlerConfig): ValidationResult {
  const errors: string[] = [];

  // URL 驗證
  if (!isValidUrl(config.url)) {
    errors.push('Invalid URL format');
  }

  // 選擇器驗證
  Object.entries(config.selectors).forEach(([key, selector]) => {
    if (!isValidCSSSelector(selector.selector)) {
      errors.push(`Invalid CSS selector for ${key}`);
    }
  });

  return { valid: errors.length === 0, errors };
}
```

### 效能標準

- **頁面載入時間**: < 10 秒
- **數據提取時間**: < 5 秒
- **記憶體使用**: < 512MB
- **錯誤率**: < 5%

### 相容性標準

- **瀏覽器**: Chrome 90+, Firefox 88+
- **Node.js**: 18.0+
- **TypeScript**: 5.0+

## 📚 參考資源

### 官方文檔

- [Playwright Documentation](https://playwright.dev/)
- [CSS Selectors Reference](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Selectors)
- [JSON Schema](https://json-schema.org/)

### 內部文檔

- `README.md` - 專案概述和快速開始
- `CLAUDE.md` - 開發協作指南
- `20250814-complete-system-guide.md` - 完整系統指南
- `20250814-api-integration-guide.md` - API 整合指南

### 範例檔案

- `config/templates/` - 配置範本
- `config/active/` - 開發測試配置
- `src/transforms/sites/` - 轉換函數範例

---

**版本**: v3.0.0  
**狀態**: ✅ 生產就緒  
**最後更新**: 2025-08-14  
**維護者**: AHA 智投開發團隊

