# Universal Web Crawler - Claude 協作指南

**專案**: 通用網路爬蟲系統
**框架**: TypeScript + Playwright + Node.js
**開發日期**: 2025-08-04

## 專案概述

這是一個通用的網路爬蟲系統，主要用於爬取 Yahoo Finance 各地區的財務數據。系統支援 JSON 配置驅動的爬蟲任務，並提供豐富的數據轉換和處理功能。

## 系統架構

```
crawler/
├── src/
│   ├── cli.ts                      # 命令行介面
│   ├── index.ts                    # 主程式入口
│   ├── config/                     # 配置管理
│   │   ├── ConfigManager.ts        # 基本配置管理器
│   │   ├── EnhancedConfigManager.ts # 增強配置管理器
│   │   └── defaultConfigs.ts       # 預設配置
│   ├── const/                      # 常數定義
│   │   ├── finance.ts              # 財務數據常數
│   │   └── index.ts                # 常數匯出
│   ├── crawler/                    # 爬蟲核心
│   │   ├── PlaywrightCrawler.ts    # Playwright 引擎
│   │   ├── DataExtractor.ts        # 數據提取器
│   │   └── CookieManager.ts        # Cookie 管理
│   ├── transforms/                 # 數據轉換
│   │   └── sites/                  # 各網站專用轉換
│   │       ├── yahoo-finance-tw.ts # Yahoo Finance 台灣
│   │       ├── yahoo-finance-jp.ts # Yahoo Finance 日本
│   │       └── yahoo-finance-us.ts # Yahoo Finance 美國
│   ├── types/                      # 型別定義
│   └── utils/                      # 工具函數
├── configs/                        # 爬蟲配置檔案
├── output/                         # 輸出結果
└── docs/                          # 技術文檔
```

## 核心開發原則

### 獨立選擇器 (Independent Selectors)

**核心概念**: 每個數據欄位使用獨立的 CSS 選擇器，避免字串解析和拼接問題。

#### 錯誤做法
```json
{
  "combinedData": {
    "selector": "tr td",
    "multiple": true,
    "transform": "parseRowData"
  }
}
```

#### 正確做法
```json
{
  "fiscalPeriods": {
    "selector": "li div:first-child",
    "multiple": true,
    "transform": "debugFieldExtraction"
  },
  "epsValues": {
    "selector": "li div:nth-child(2)", 
    "multiple": true,
    "transform": "debugFieldExtraction"
  }
}
```

**優勢**:
- 避免串接問題: 如 `12.5531` (應為 `12.55` + `31%`)
- 精確提取: 每個欄位獨立控制
- 容易調試: 可單獨測試每個選擇器
- 可擴展性: 新增欄位不影響現有邏輯

### 禁止硬編碼軸數據 (No Hard-coded Timeline Data)

**核心概念**: 所有時間軸和期間數據必須動態提取，禁止寫死任何時間相關的數據。

#### 錯誤做法
```typescript
// 硬編碼時間軸
const fiscalPeriods = ['2025-Q1', '2024-Q4', '2024-Q3', '2024-Q2'];
const epsValues = [18.43, 14.96, 15.94, 16.19];

// 硬編碼映射
const hardcodedMapping = {
  '2025-Q1': 18.43,
  '2024-Q4': 14.96
};
```

#### 正確做法
```typescript
// 純動態提取
function combineSimpleEPSFields(content: string | string[]): SimpleEPSData[] {
  const patterns = [
    // 動態匹配時間格式 (季度和半年度)
    /(20\d{2})\s*Q([1-4])\s+([0-9]+\.?[0-9]{0,2})/g,  // 2020-Q1 格式
    /(20\d{2})\s*Q([1-4])([0-9]{1,2}\.[0-9]{1,2})/g,  // 2020-Q1 格式
    /(20\d{2})\s*H([1-2])\s+([0-9]+\.?[0-9]{0,2})/g,  // 2020-H1 格式
    /(20\d{2})\s*H([1-2])([0-9]{1,2}\.[0-9]{1,2})/g   // 2020-H1 格式
  ];
  
  // 從頁面內容中動態解析
  const results = extractDataUsingPatterns(content, patterns);
  return results;
}
```

**用戶反饋記錄**:
- "現在的問題應該是用 hard coded ? 應該儘量使用 parse 的邏輯來判斷而不要使用 hard coded 的方式"
- "請勿 hard code.."
- "上面應該是捉取 fiscalPeriod 而不是用寫死的方式....是吧?"

### 使用真實數值常數 (Use Real Value Constants)

**核心概念**: 數值驗證和轉換應參考 `@src/const/finance.ts` 中定義的真實常數，而非任意數字。

#### 財務數據常數範例

```typescript
// 台灣財務數據處理常數
export const TW_REVENUE_DATA_CONSTANTS = {
  MIN_YEAR: 1990,                    // 台灣股市開始電子化交易
  MAX_YEAR_OFFSET: 2,                // 允許未來2年
  MIN_MONTH: 1,
  MAX_MONTH: 12,
  MIN_REASONABLE_VALUE: 1,           // 避免0或負數
  MAX_DIGITS: 15                     // 避免超大數字錯誤
} as const;

// 單位轉換倍數
export const UNIT_MULTIPLIERS = {
  MILLION_YEN: 1000000,              // 百万円 → 円
  THOUSAND_TWD: 1000,                // 仟元 → 元
  PERCENTAGE: 0.01                   // % → 小數
} as const;
```

#### 正確使用方式
```typescript
import { TW_REVENUE_DATA_CONSTANTS, UNIT_MULTIPLIERS } from '@src/const/finance';

// 使用定義的常數進行驗證
function validateEPSValue(eps: number): boolean {
  return eps > TW_REVENUE_DATA_CONSTANTS.MIN_REASONABLE_VALUE && 
         eps.toString().length <= TW_REVENUE_DATA_CONSTANTS.MAX_DIGITS;
}

// 使用定義的倍數進行轉換
function convertTWDValue(value: number, unit: string): number {
  if (unit.includes('仟元')) {
    return value * UNIT_MULTIPLIERS.THOUSAND_TWD;
  }
  return value;
}
```

#### 錯誤做法
```typescript
// 任意硬編碼數字
if (eps > 0.1 && eps < 100) { // 沒有依據的魔法數字
  // ...
}

// 硬編碼轉換
const convertedValue = rawValue * 1000; // 沒有說明的轉換倍數
```

## 數據處理最佳實踐

### 精度控制
```typescript
// 嚴格控制 EPS 精度到2位小數
const rawEps = parseFloat(cleanEpsStr);
const eps = Math.round(rawEps * 100) / 100;
```

### 正則表達式優化
```typescript
// 限制小數位數的 regex 模式
const patterns = [
  /(20\d{2})\s*Q([1-4])\s+([0-9]+\.?[0-9]{0,2})/g,  // 2020-Q1 格式，最多2位小數
  /(20\d{2})\s*Q([1-4])([0-9]{1,2}\.[0-9]{1,2})/g,  // 2020-Q1 格式，嚴格2位小數
  /(20\d{2})\s*H([1-2])\s+([0-9]+\.?[0-9]{0,2})/g,  // 2020-H1 格式，最多2位小數
  /(20\d{2})\s*H([1-2])([0-9]{1,2}\.[0-9]{1,2})/g   // 2020-H1 格式，嚴格2位小數
];
```

### 數據驗證
```typescript
// 使用常數進行合理性檢查
if (!isNaN(eps) && 
    eps > TW_REVENUE_DATA_CONSTANTS.MIN_REASONABLE_VALUE && 
    eps.toString().length <= TW_REVENUE_DATA_CONSTANTS.MAX_DIGITS) {
  results.push({ fiscalPeriod, eps });
}
```

## 配置檔案結構

### 基本配置模板
```json
{
  "templateType": "tw-eps-simple",
  "url": "https://tw.stock.yahoo.com/quote/2454.TW/eps",
  "selectors": {
    "fiscalPeriods": {
      "selector": "li div:first-child",
      "multiple": true,
      "transform": "debugFieldExtraction"
    },
    "epsValues": {
      "selector": "li div:nth-child(2)", 
      "multiple": true,
      "transform": "debugFieldExtraction"
    },
    "simpleEPSData": {
      "selector": "body",
      "multiple": false,
      "transform": "combineSimpleEPSFields"
    }
  }
}
```

## 常用命令

```bash
# 執行特定配置 (configs/ 目錄中的配置)
npm run crawl yahoo-finance-tw-eps-2454_TW-simple

# 執行 active/ 目錄中的配置 (需要使用 --config 參數)
npx tsx src/cli.ts --config configs/active/test-eps.json

# 檢查 TypeScript 錯誤
npm run typecheck

# 列出所有配置
npm run list

# 清理輸出目錄
npm run clean:output
```

## 調試技巧

### 1. 選擇器測試
在瀏覽器開發者工具中測試 CSS 選擇器:
```javascript
// 測試選擇器
document.querySelectorAll("li div:first-child");
document.querySelectorAll("li div:nth-child(2)");
```

### 2. 數據提取驗證
使用 `debugFieldExtraction` 轉換查看原始提取數據:
```json
{
  "fiscalPeriods": {
    "selector": "li div:first-child",
    "multiple": true,
    "transform": "debugFieldExtraction"
  }
}
```

### 3. 日誌分析
查看控制台輸出中的關鍵資訊:
```
[Simple EPS] Pattern 2 Match 1: "2025 Q118.43" -> 2025-Q1, EPS=18.43
[Simple EPS] ✅ Added: 2025-Q1 EPS=18.43
```

## 故障排除

### 常見問題

1. **精度問題**: EPS 值小數位過多
   - **解決方案**: 檢查 regex 模式，限制 `[0-9]{1,2}` 
   - **精度控制**: 使用 `Math.round(value * 100) / 100`

2. **TypeScript 錯誤**: 介面定義不完整
   - **解決方案**: 在 `YahooFinanceTWTransforms` 介面中加入新函數定義

3. **硬編碼檢測**: 動態提取失效
   - **解決方案**: 檢查是否使用了固定的時間軸或數值映射

4. **營業現金流顯示為 0**: Yahoo Finance 台灣現金流數據無法提取
   - **問題原因**: `debugFieldExtraction` 函數預設只保留前10項數據，但營業現金流數據位於第11項以後
   - **解決方案**: 將 `debugFieldExtraction` 中的 `content.slice(0, 10)` 修改為 `content.slice(0, 50)`
   - **相關檔案**: `/src/transforms/sites/yahoo-finance-tw.ts` line 3093
   - **修復效果**: 營業現金流從 0 正確提取為實際數值（如 625,573,672 仟元）
   - **批量更新**: 使用 `node scripts/generate-yahoo-tw-configs.js --type=cash-flow-statement` 重新生成所有配置

## 配置生成器開發工作流程 (Config Generator Development Workflow)

### 概述

配置生成器系統允許從模板快速生成多個股票代碼的爬蟲配置，支援批量處理和一致性管理。

### 📁 目錄結構

```
crawler/
├── configs/
│   ├── templates/                    # 配置模板目錄
│   │   ├── yahoo-finance-tw-balance-sheet.json
│   │   ├── yahoo-finance-tw-eps.json
│   │   ├── yahoo-finance-us-cashflow.json
│   │   ├── yahoo-finance-jp-cashflow.json
│   │   └── ...
│   ├── active/                       # 開發環境專用配置 (可選)
│   │   └── [手動測試用配置文件]
│   ├── yahoo-finance-tw-*-XXXX_TW.json  # 生成的台灣個別配置
│   ├── yahoo-finance-us-*-XXXX.json     # 生成的美國個別配置
│   └── yahoo-finance-jp-*-XXXX_T.json   # 生成的日本個別配置
├── data/
│   ├── yahoo-finance-tw-stockcodes.json  # 台灣股票代碼數據源
│   ├── yahoo-finance-us-stockcodes.json  # 美國股票代碼數據源
│   └── yahoo-finance-jp-stockcodes.json  # 日本股票代碼數據源
└── scripts/
    ├── generate-yahoo-tw-configs.js      # 台灣配置生成器
    ├── generate-yahoo-us-configs.js      # 美國配置生成器
    └── generate-yahoo-jp-configs.js      # 日本配置生成器 ✅
```

### 🔧 開發環境配置

#### configs/active/ 目錄用途

`configs/active/` 目錄是開發者專用的測試環境，用於：

- **手動配置測試**: 放置手動修改的配置文件進行測試
- **模板原型開發**: 在批量生成前的單一配置原型測試
- **調試專用配置**: 包含特殊選擇器或調試設置的配置
- **臨時修改**: 不影響批量生成配置的臨時修改

#### 開發工作流程

**重要**: 執行 `configs/active/` 目錄中的配置文件時，必須使用 `--config` 參數指定完整路徑，而不能使用 `npm run crawl` 命令。

```bash
# 1️⃣ 在 active/ 目錄中創建或複製測試配置
cp configs/yahoo-finance-tw-eps-2454_TW.json configs/active/test-eps.json

# 2️⃣ 修改 active/ 中的配置進行測試
vim configs/active/test-eps.json

# 3️⃣ 測試修改後的配置 (使用 --config 參數指定 active 目錄中的配置)
npx tsx src/cli.ts --config configs/active/test-eps.json

# 4️⃣ 確認修改有效後，更新對應的模板
vim configs/templates/yahoo-finance-tw-eps.json

# 5️⃣ 重新生成所有相關配置
node scripts/generate-yahoo-tw-configs.js --type=eps
```

**注意**: 
- `active/` 目錄的配置不會被生成器覆蓋
- 適合放置實驗性或一次性的配置修改
- 正式修改應該同步到對應的模板文件
- **使用 `--config` 參數**: 執行 active 目錄中的配置必須使用 `npx tsx src/cli.ts --config configs/active/<配置名>.json` 方式

### 🛠️ 模板開發流程

#### 1. 創建配置模板

**位置**: `configs/templates/yahoo-finance-{region}-{type}.json`

**模板範例** (Balance Sheet):
```json
{
  "templateType": "tw-balance-sheet",
  "url": "https://tw.stock.yahoo.com/quote/${symbolCode}/balance-sheet",
  "_note": "IMPROVED: This config extracts structured balance sheet data using independent selectors following CLAUDE.md principles.",
  "actions": [
    {
      "type": "wait",
      "timeout": 5000,
      "description": "等待頁面初始載入"
    }
  ],
  "selectors": {
    "stockInfo": {
      "selector": "h1, .symbol, .stock-name",
      "transform": "cleanStockSymbol"
    },
    "balanceSheetHeaders": {
      "selector": "table thead th, table thead td, .table-header, th, .header",
      "multiple": true,
      "transform": "extractBalanceSheetHeaders"
    },
    "balanceSheetData": {
      "selector": "body",
      "multiple": false,
      "transform": "combineBalanceSheetData"
    }
  },
  "variables": {
    "symbolCode": "2330.TW",
    "baseUrl": "https://tw.stock.yahoo.com"
  },
  "export": {
    "formats": ["json"],
    "filename": "yahoo_finance_tw_balance_sheet_${symbolCode}"
  }
}
```

**關鍵要素**:
- **變數替換**: 使用 `${symbolCode}` 作為股票代碼佔位符
- **獨立選擇器**: 遵循 CLAUDE.md 的 Independent Selectors 原則
- **模板類型**: `templateType` 應匹配文件名格式
- **區域特定**: URL 和轉換函數適配特定區域

#### 2. 更新股票代碼數據源

**檔案**: `data/yahoo-finance-{region}-stockcodes.json`

**格式範例**:
```json
[
  {
    "stockCode": "2330.TW",
    "companyName": "台灣積體電路製造股份有限公司",
    "sector": "半導體業"
  },
  {
    "stockCode": "2454.TW", 
    "companyName": "聯發科技股份有限公司",
    "sector": "半導體業"
  }
]
```

#### 3. 生成配置文件

**台灣市場**:
```bash
# 生成所有類型配置
node scripts/generate-yahoo-tw-configs.js

# 生成特定類型配置 (完整列表)
node scripts/generate-yahoo-tw-configs.js --type=balance-sheet
node scripts/generate-yahoo-tw-configs.js --type=cash-flow-statement  
node scripts/generate-yahoo-tw-configs.js --type=dividend
node scripts/generate-yahoo-tw-configs.js --type=eps
node scripts/generate-yahoo-tw-configs.js --type=income-statement
node scripts/generate-yahoo-tw-configs.js --type=revenue
```

**美國市場**:
```bash
# 生成所有類型配置
node scripts/generate-yahoo-us-configs.js

# 生成特定類型配置 (完整列表)
node scripts/generate-yahoo-us-configs.js --type=cashflow
node scripts/generate-yahoo-us-configs.js --type=financials
```

**日本市場**:
```bash
# 生成所有類型配置 ✅
node scripts/generate-yahoo-jp-configs.js

# 生成特定類型配置 (完整列表)
node scripts/generate-yahoo-jp-configs.js --type=cashflow
node scripts/generate-yahoo-jp-configs.js --type=financials
node scripts/generate-yahoo-jp-configs.js --type=performance
```

### 🔄 生成器腳本工作原理

#### 核心流程

1. **模板發現**: 自動掃描 `configs/templates/` 目錄中的模板檔案
2. **股票代碼載入**: 讀取對應地區的股票代碼數據源
3. **變數替換**: 將模板中的 `${symbolCode}` 替換為實際股票代碼
4. **批量生成**: 為每個股票代碼生成獨立的配置文件
5. **文件命名**: 使用標準命名格式 `yahoo-finance-{region}-{type}-{code}.json`

#### 變數替換規則

```javascript
// URL 變數替換
config.url = config.url.replace('${symbolCode}', stock.stockCode);

// 變數物件更新
config.variables = {
  ...config.variables,
  symbolCode: stock.stockCode,
  companyName: stock.companyName,
  sector: stock.sector
};

// 檔案名變數替換
config.export.filename = config.export.filename.replace(
  '${symbolCode}', 
  stock.stockCode.replace('.TW', '_TW')
);
```

### 🧪 測試與驗證

#### 1. 配置生成測試

```bash
# 測試生成指定類型
node scripts/generate-yahoo-tw-configs.js --type=balance-sheet

# 檢查生成的配置數量和內容
ls configs/yahoo-finance-tw-balance-sheet-*.json | wc -l
```

#### 2. 單一配置功能測試

```bash
# 測試生成的配置 (configs/ 目錄中的配置)
npm run crawl yahoo-finance-tw-balance-sheet-2454_TW

# 測試 active/ 目錄中的配置 (使用 --config 參數)
npx tsx src/cli.ts --config configs/active/test-balance-sheet.json

# 驗證輸出結果
cat output/yahoo-finance-tw-balance-sheet-2454_TW_*.json | jq '.results[0].data'
```

#### 3. 批量處理測試

```bash
# 小批量測試
node scripts/run-yahoo-tw-balance-sheet-batch.js --limit=3

# 檢查批量結果
ls output/yahoo-finance-tw-balance-sheet-*_*.json
```

### 📋 最佳實踐

#### 模板設計原則

1. **遵循核心原則**: 使用獨立選擇器，避免硬編碼，使用真實常數
2. **區域適配**: URL、語言、時區適配特定市場
3. **錯誤容錯**: 包含適當的等待時間和重試機制
4. **變數一致性**: 使用標準的變數命名和替換模式

#### 生成器維護

1. **模板同步**: 當改進單一配置時，同步更新對應模板
2. **數據源維護**: 定期更新股票代碼數據源
3. **批量驗證**: 定期驗證所有生成的配置仍然有效
4. **版本控制**: 模板變更應該有清楚的版本記錄

### 🔧 故障排除

#### 常見問題

1. **模板不存在**:
   ```
   ❌ 沒有找到 Yahoo Finance Taiwan 模板文件
   ```
   **解決**: 確認 `configs/templates/` 目錄中存在對應的模板文件

2. **股票代碼數據源缺失**:
   ```
   ❌ 找不到台灣股票代碼數據文件
   ```
   **解決**: 檢查 `data/yahoo-finance-tw-stockcodes.json` 文件是否存在

3. **生成的配置無效**:
   ```
   TypeError: Cannot read property 'transform' of undefined
   ```
   **解決**: 檢查模板中的選擇器定義和轉換函數是否正確

#### 除錯技巧

```bash
# 檢查模板結構
cat configs/templates/yahoo-finance-tw-balance-sheet.json | jq '.'

# 測試變數替換
node -e "
const template = require('./configs/templates/yahoo-finance-tw-balance-sheet.json');
console.log('URL:', template.url);
console.log('Variables:', template.variables);
"

# 驗證生成邏輯
node scripts/generate-yahoo-tw-configs.js --type=balance-sheet | head -20
```

### 🌐 跨區域一致性

#### 支援的區域

| 區域 | 腳本 | 數據源 | URL 格式 | 代碼格式 |
|------|------|--------|----------|----------|
| **台灣** | `generate-yahoo-tw-configs.js` | `yahoo-finance-tw-stockcodes.json` | `tw.stock.yahoo.com` | `2330.TW` |
| **美國** | `generate-yahoo-us-configs.js` | `yahoo-finance-us-stockcodes.json` | `finance.yahoo.com` | `AAPL` |
| **日本** | `generate-yahoo-jp-configs.js` | `yahoo-finance-jp-stockcodes.json` | `finance.yahoo.co.jp` | `7203.T` |

#### 各區域可用模板類型

| 區域 | 可用 --type 選項 | 說明 |
|------|------------------|------|
| **台灣** | `balance-sheet`, `cash-flow-statement`, `dividend`, `eps`, `income-statement`, `revenue` | 6 種財務報表類型 |
| **美國** | `cashflow`, `financials` | 2 種財務報表類型 |
| **日本** | `cashflow`, `financials`, `performance` | 3 種財務報表類型 ✅ |

#### 標準化命名

```
配置模板: yahoo-finance-{region}-{type}.json
生成配置: yahoo-finance-{region}-{type}-{code}.json
輸出文件: yahoo-finance-{region}-{type}-{code}_{timestamp}.json
```

### 📊 生成統計

典型的生成結果範例:
```
🔍 Yahoo Finance Taiwan 配置生成器
====================================
📊 balance-sheet: 15 個配置文件
📊 eps: 15 個配置文件  
📊 dividend: 15 個配置文件

🎯 總計: 45 個配置文件
📁 輸出目錄: configs/
```

### 📋 快速參考指令

#### 台灣股票配置生成
```bash
# 所有類型
node scripts/generate-yahoo-tw-configs.js

# 特定類型
node scripts/generate-yahoo-tw-configs.js --type=balance-sheet
node scripts/generate-yahoo-tw-configs.js --type=cash-flow-statement
node scripts/generate-yahoo-tw-configs.js --type=dividend
node scripts/generate-yahoo-tw-configs.js --type=eps
node scripts/generate-yahoo-tw-configs.js --type=income-statement
node scripts/generate-yahoo-tw-configs.js --type=revenue
```

#### 美國股票配置生成
```bash
# 所有類型
node scripts/generate-yahoo-us-configs.js

# 特定類型
node scripts/generate-yahoo-us-configs.js --type=cashflow
node scripts/generate-yahoo-us-configs.js --type=financials
```

#### 日本股票配置生成 ✅
```bash
# 所有類型
node scripts/generate-yahoo-jp-configs.js

# 特定類型
node scripts/generate-yahoo-jp-configs.js --type=cashflow
node scripts/generate-yahoo-jp-configs.js --type=financials
node scripts/generate-yahoo-jp-configs.js --type=performance
```

## 版本記錄

- **v1.1.0** (2025-08-05): 配置生成器架構統一化
  - **新增**: 創建 `generate-yahoo-jp-configs.js` 日本配置生成器
  - **統一**: 所有三個區域生成器使用扁平結構輸出到 `configs/`
  - **改進**: 標準化生成器輸出格式和命令行參數
  - **文檔**: 新增 `configs/active/` 開發環境說明
  - **完成**: yahoo-tw、yahoo-jp、yahoo-us 三區域配置生成器完整支援
  - **說明**: 使用 `configs/active/` 目錄中的配置需要 `--config` 參數指定完整路徑

- **v1.0.0** (2025-08-04): 初始版本
  - 實現純動態 EPS 提取
  - 修復精度控制問題
  - 完善 TypeScript 型別定義
  - 建立開發原則文檔
  - **新增**: 配置生成器開發工作流程文檔
  - **改進**: Balance Sheet 模板使用獨立選擇器方法
  - **修復**: Yahoo Finance 台灣現金流營業現金流為 0 的問題
    - 根本原因: `debugFieldExtraction` 數據截斷限制
    - 解決方案: 將數據限制從 10 項增加到 50 項
    - 影響範圍: 所有台灣現金流配置 (15 個股票代碼)
    - 驗證結果: 營業現金流正確提取 (如 2330.TW: 625,573,672 仟元)

## 聯繫資訊

- **專案路徑**: `/Users/aryung/Downloads/Workshop/crawler`
- **配置目錄**: `configs/`
- **輸出目錄**: `output/`
- **文檔目錄**: `docs/`

---

**最後更新**: 2025-08-04
**開發狀態**: 積極開發中
**核心功能**: Yahoo Finance 多地區財務數據爬取完成

### 重要提醒
遵循三大核心原則: **獨立選擇器**、**禁止硬編碼時間軸**、**使用真實數值常數**，確保代碼的可維護性和可擴展性。