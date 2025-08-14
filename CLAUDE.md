# Universal Web Crawler - Claude 協作指南

**專案**: 通用網路爬蟲系統
**框架**: TypeScript + Playwright + Node.js  
**開發日期**: 2025-08-04

重要原則: Always use sequential-thinking tool before tackling complex problems or coding tasks.

## 專案概述

通用網路爬蟲系統，主要用於爬取 Yahoo Finance 各地區的財務數據。支援 JSON 配置驅動的爬蟲任務，提供豐富的數據轉換和處理功能。

## 系統架構

```
crawler/
├── src/
│   ├── cli.ts                      # 命令行介面
│   ├── config/                     # 配置管理
│   ├── crawler/                    # 爬蟲核心 (Playwright + DataExtractor)
│   ├── transforms/sites/           # 各網站專用轉換
│   ├── types/                      # 型別定義
│   └── utils/                      # 工具函數
├── scripts/                        # 爬蟲腳本
│   ├── scrape-yahoo-us-simple.ts   # US 單一科技部門爬蟲
│   ├── scrape-yahoo-us-sectors.ts  # US 多部門爬蟲 (11個部門)
│   ├── scrape-yahoo-tw-stock-categories.ts  # TW 股票分類爬蟲
│   └── scrape-yahoo-tw-stock-details.ts     # TW 股票詳情爬蟲
├── config/                         # 爬蟲配置檔案
└── output/                         # 輸出結果
    ├── yahoo-us-sectors/           # US 部門數據
    ├── yahoo-tw-sectors/           # TW 部門數據 (規劃中)
    └── yahoo-jp-sectors/           # JP 部門數據 (規劃中)
```

## 六大核心開發原則

### 1. 結構化選擇器優先原則 ⭐

**最高優先原則**: 優先使用結構化的位置選擇器，避免依賴文字內容。

#### 選擇器優先級順序：

1. **位置選擇器** (最優先)

   - 使用 `nth-child()`, `nth-of-type()` 等結構化選擇器
   - 基於 DOM 結構而非內容
   - 語言無關，更加穩定

2. **屬性選擇器** (次優先)

   - 使用 `[data-testid]`, `[aria-label]` 等屬性
   - 相對穩定的標識符

3. **類別選擇器** (輔助)

   - 使用特定的 CSS 類別
   - 注意類別可能會變動

4. **:has() 配合結構** (特殊情況)
   - 當需要複雜邏輯時使用
   - 盡量配合結構而非文字

**❌ 避免使用 :contains()**：

- 依賴文字內容不穩定
- 語言相關，國際化困難
- 相當於 hardcode 文字

```json
{
  "selectors": {
    // ✅ 好的做法：使用結構化選擇器
    "operatingCashFlow": {
      "selector": "section[data-testid*='table'] > div:nth-child(2) > div:nth-child(1) > div > div:nth-child(n+2)",
      "transform": "parseFinancialValue"
    },

    // ❌ 避免：依賴文字內容
    "badExample": {
      "selector": "tr:has(td:contains('Operating Cash Flow')) td:nth-child(2)",
      "transform": "parseFinancialValue"
    }
  }
}
```

**結構化選擇器範例**:

```css
/* 表格第一行的所有數據格 */
table > tbody > tr:nth-child(1) > td:nth-child(n+2)

/* 特定區塊的第二個子元素 */
section[data-testid*='financials'] > div:nth-child(2)

/* 使用類別和位置組合 */
.table-container > div:first-child > div > div:nth-child(n+2)
```

### 2. DOM 預處理 - Exclude Selector

**核心概念**: 使用 exclude 選擇器移除會干擾目標數據提取的元素。注意：exclude 是輔助手段，精確選擇器優先。

#### 使用時機判斷

**🟢 建議使用的場景**:

- 目標數據區域內包含廣告或干擾元素
- 這些干擾元素與目標數據在同一層級
- 主選擇器無法完全排除干擾時

**🔴 不需要使用的場景**:

- header、footer、sidebar 等本身就不在選擇器範圍內的元素
- 能夠通過精確 `:has()` 選擇器直接定位純淨數據時

#### 最佳實踐示例

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

**關鍵原則**: exclude selector 主要用於「取得的資料中再排除」干擾項目，而非排除所有無關元素。

### 3. 禁止錯誤數據捉取

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

### 4. 獨立選擇器

每個最終輸出欄位使用獨立的 CSS 選擇器，基於最終 data 結構的欄位需求設計。

### 5. 動態時間軸提取

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

### 6. 真實數值常數

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

## 位置獨立選擇器方法 (複雜 DOM 處理)

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
};

// 位置獨立提取函數
extractOperatingCashFlowFromPosition: (
  content: string | string[]
): number[] => {
  const contentArray = Array.isArray(content) ? content : [content];
  // 動態位置檢測邏輯...
  return results;
};
```

## 配置生成器系統

### 目錄結構 (v3.0 分類架構)

```
config-categorized/               # v3.0 分類配置系統
├── quarterly/                   # 季度數據配置
│   ├── tw/                     # 台灣市場
│   ├── us/                     # 美國市場
│   └── jp/                     # 日本市場
├── daily/                      # 每日數據配置
│   ├── tw-history/             # 台灣歷史價格
│   ├── us-history/             # 美國歷史價格
│   └── jp-history/             # 日本歷史價格
├── metadata/                   # 元數據配置
│   ├── symbols/                # 股票代碼
│   └── labels/                 # 分類標籤
└── templates/                  # 配置模板
    └── yahoo-finance-*.json
```

### 生成指令

配置生成器會根據爬取的部門數據自動生成個股配置：

```bash
# 台灣市場 (基於 scrape:tw:details 的數據)
npx tsx scripts/generate-yahoo-tw-configs.ts --type=eps
npx tsx scripts/generate-yahoo-tw-configs.ts --type=balance-sheet
npx tsx scripts/generate-yahoo-tw-configs.ts --type=cash-flow-statement

# 美國市場 (基於 scrape:us:all 的數據)
npx tsx scripts/generate-yahoo-us-configs.ts --type=financials

# 日本市場
npx tsx scripts/generate-yahoo-jp-configs.ts --type=performance
```

### 開發工作流程 (v3.0)

1. 在 `config/active/` 創建測試配置
2. 使用 `npx tsx src/cli.ts --config config/active/test.json` 測試
3. 確認有效後更新對應模板
4. 重新生成所有相關配置 (自動輸出到分類目錄)
5. 配置會自動分類到對應的 `config-categorized/` 子目錄

## 常用命令

### 🕷️ 爬蟲命令

```bash
# 執行分類配置 (config-categorized/ 目錄，v3.0 預設)
npm run crawl yahoo-finance-tw-eps-2454_TW

# 執行 active/ 測試配置 (開發用)
npx tsx src/cli.ts --config config/active/test-eps.json

# 檢查 TypeScript 錯誤
npm run typecheck

# 列出所有配置
npm run list
```

### 🏢 部門爬蟲命令 (Sector Scraping)

#### US 市場部門爬蟲

```bash
# 簡化版 - 只爬取科技部門
npm run scrape:us:simple               # 預設 10 頁
npm run scrape:us:simple -- 5          # 指定 5 頁

# 完整版 - 支援 11 個部門
npm run scrape:us:technology           # 科技部門
npm run scrape:us:financial            # 金融部門
npm run scrape:us:healthcare           # 醫療保健部門
npm run scrape:us:consumer             # 消費者週期部門
npm run scrape:us:industrial           # 工業部門
npm run scrape:us:communication        # 通訊服務部門
npm run scrape:us:energy               # 能源部門
npm run scrape:us:realestate           # 房地產部門
npm run scrape:us:materials            # 基礎材料部門
npm run scrape:us:utilities            # 公用事業部門
npm run scrape:us:defensive            # 消費防禦部門

# 批次爬取
npm run scrape:us:all                  # 爬取所有 11 個部門
npm run scrape:us:all:limit            # 爬取所有部門 (限制 5 頁)

# 進階使用
npx tsx scripts/scrape-yahoo-us-sectors.ts --sector healthcare --limit 10
npx tsx scripts/scrape-yahoo-us-sectors.ts --all --limit 3
```

#### TW 市場股票爬蟲

```bash
# 爬取股票分類
npm run scrape:tw:categories           # 爬取所有股票分類

# 爬取股票詳情
npm run scrape:tw:details              # 爬取所有股票詳情
npm run scrape:tw:details:limit        # 限制爬取數量
```

#### 整合工作流程

```bash
# 部門數據更新流程
npm run update:sectors:us              # 爬取 US 部門 + 更新 stockcodes
npm run update:sectors:tw              # 爬取 TW 分類 + 詳情 + 更新 stockcodes
npm run update:sectors:all             # 更新所有市場部門數據
```

### 📊 數據匯入命令 (v3.0 結構化目錄系統)

新的 v3.0 匯入系統支援結構化目錄掃描，可以按類別、市場、類型精確匯入數據到後端 API。

#### 基礎匯入命令

```bash
# 匯入所有類別的數據
npm run import:fundamental:batch

# 按類別匯入
npm run import:fundamental:quarterly    # 季度財務數據
npm run import:fundamental:daily        # 每日數據
npm run import:fundamental:metadata     # 元數據

# 按市場匯入
npm run import:fundamental:tw          # 台灣所有數據
npm run import:fundamental:us          # 美國所有數據
npm run import:fundamental:jp          # 日本所有數據
```

#### 組合匯入命令

```bash
# 特定市場 + 類別
npm run import:fundamental:tw:quarterly # 台灣季度數據

# 市場特定數據類型
npm run import:tw:balance-sheet        # 只匯入台灣資產負債表
npm run import:tw:cash-flow           # 只匯入台灣現金流量表
npm run import:tw:income-statement     # 只匯入台灣損益表
npm run import:tw:dividend            # 只匯入台灣股利資料
npm run import:tw:eps                 # 只匯入台灣每股盈餘

npm run import:us:balance-sheet        # 只匯入美國資產負債表
npm run import:us:cash-flow           # 只匯入美國現金流量表
npm run import:us:financials          # 只匯入美國財務數據

npm run import:jp:balance-sheet        # 只匯入日本資產負債表
npm run import:jp:performance         # 只匯入日本績效數據
```

#### 快速設置命令

```bash
# 結構化設置 (使用新目錄架構)
npm run setup:structured              # 匯入所有 + 股票代碼 + 標籤

# 特定市場設置
npm run setup:tw                      # 只設置台灣數據
```

#### 進階匯入選項

```bash
# 直接使用腳本 (更多選項)
npx tsx scripts/import-fundamental-api.ts --category quarterly --market tw --dry-run
npx tsx scripts/import-fundamental-api.ts --market us --type balance-sheet
npx tsx scripts/import-fundamental-api.ts --category metadata --verbose

# 參數說明:
# --category: 指定類別 (quarterly/daily/metadata)
# --market: 指定市場 (tw/us/jp)
# --type: 指定類型 (balance-sheet/income-statement/cash-flow-statement/etc)
# --dry-run: 測試模式，不實際匯入
# --verbose: 顯示詳細處理資訊
```

### 🔄 完整工作流程

```bash
# 階段 1: 爬取數據到結構化目錄
npm run crawl:tw:quarterly            # 爬取台灣季度數據

# 階段 2: 匯入到後端 API
npm run import:fundamental:tw:quarterly # 匯入台灣季度數據

# 或者一次性設置 (跳過爬蟲，使用現有數據)
npm run setup:structured              # 使用現有 output/ 數據
```

## 調試與故障排除

### 常見問題解決

1. **精度問題**: 使用 `Math.round(value * 100) / 100` 控制
2. **數據對齊問題**: 採用位置獨立選擇器方法
3. **營業現金流為 0**: 將 `debugFieldExtraction` 限制從 10 項增加到 50 項
4. **TypeScript 錯誤**: 在 `YahooFinanceTWTransforms` 介面中加入新函數定義

### 調試技巧

```javascript
// 瀏覽器開發者工具測試選擇器
document.querySelectorAll("tr:has(td:contains('每股盈餘')) td:last-child");

// 配置測試
{
  "fiscalPeriods": {
    "selector": "li div:first-child",
    "transform": "debugFieldExtraction"  // 查看原始數據
  }
}
```

### 日誌分析關鍵信息

```
[Simple EPS] Pattern 2 Match 1: "2025 Q118.43" -> 2025-Q1, EPS=18.43
[Position Extract] ✅ 數據完全對齊: 20 期間 × 5 現金流類型
[INFO] Preprocessed DOM: removed 23 elements matching: .advertisement
```

## 📚 完整技術文檔導引

### 核心文檔 (3 個主要文檔)

- **[完整系統指南](docs/20250814-complete-system-guide.md)** - 系統概述、工作流程、故障排除  
  _新手入門必讀，涵蓋完整的爬取→匯入工作流程_

- **[API 整合指南](docs/20250814-api-integration-guide.md)** - 數據匯入、批次處理、監控診斷  
  _專注 v3.0 結構化匯入系統和批次處理優化_

- **[開發參考手冊](docs/20250814-development-reference.md)** - CSS 選擇器、配置系統、開發流程  
  _深度技術參考，包含位置獨立選擇器方法的完整實現_

### 快速導航

- **系統使用**: 查看 [完整系統指南](docs/20250814-complete-system-guide.md) 的快速開始章節
- **API 整合**: 查看 [API 整合指南](docs/20250814-api-integration-guide.md) 的批次處理優化
- **CSS 選擇器最佳實踐**: 查看 [開發參考手冊](docs/20250814-development-reference.md) 的六大核心原則
- **位置獨立選擇器方法**: 查看 [開發參考手冊](docs/20250814-development-reference.md) 的複雜 DOM 處理章節

### 歸檔文檔

- **[完整工作流程歸檔](docs/20250814-complete-workflow-archive.md)** - 詳細工作流程參考

## 版本記錄

- **v3.1.0** (2025-08-14): **US Scrape Scripts TypeScript 轉換**
  - 將 scrape-yahoo-us-simple.js 和 scrape-yahoo-us-sectors.js 轉換為 TypeScript
  - 新增 21 個 npm scrape 命令支援 US 11 個部門爬取
  - 統一輸出目錄結構為 `output/yahoo-(tw/jp/us)-sectors/`
  - 改進錯誤處理和類型安全性
  - 新增完整的命令列參數支援和幫助系統
  - 功能差異確認：simple (單一科技部門) vs sectors (多部門)
- **v3.0.0** (2025-08-14): **數據匯入系統重大更新 + 文檔架構重組**
  - 新增結構化目錄掃描支援 (quarterly/daily/metadata)
  - 重寫 import-fundamental-api.ts 支援 --category, --market, --type 參數
  - 更新 package.json 命令，新增組合匯入命令
  - 保持對舊格式的向後兼容性
  - 完整的爬取→匯入工作流程整合
  - **文檔重組**: 整合為 3 個核心文檔，消除內容重複
- **v1.3.0** (2025-08-07): Exclude Selector 預處理完整實現
- **v1.2.0** (2025-08-05): 位置獨立選擇器方法完善，解決現金流數據對齊問題
- **v1.1.0** (2025-08-05): 配置生成器架構統一化，支援三區域
- **v1.0.0** (2025-08-04): 初始版本，實現純動態 EPS 提取

## 聯繫資訊

- **專案路徑**: `/Users/aryung/Downloads/Workshop/crawler`
- **開發狀態**: 積極開發中，v3.1 架構穩定
- **核心功能**: Yahoo Finance 多地區財務數據爬取 + API 整合 + 部門爬蟲完成
- **文檔狀態**: 已整合為 3 個核心文檔，包含完整部門爬蟲說明

## 重要提醒

**✨ 最高優先原則**: 優先使用 `:has()` 偽類選擇器直接定位包含特定內容的元素，避免大量比對邏輯。

**🚫 嚴禁原則**: 絕對禁止使用通用選擇器捉取混雜資料再透過轉換函數進行過濾。轉換函數只能進行格式調整，不能進行資料篩選。

**📖 深度學習**: 複雜的技術概念如「位置獨立選擇器方法」請參考 [開發參考手冊](docs/20250814-development-reference.md)，其中包含完整的 5 階段開發流程和實際案例。

遵循六大核心原則確保代碼的可維護性和可擴展性。

