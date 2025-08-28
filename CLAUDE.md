# Universal Web Crawler - Claude 協作指南

**專案**: 通用網路爬蟲系統
**框架**: TypeScript + Playwright + Node.js  
**版本**: v3.1.2

**重要原則**: Always use sequential-thinking tool before tackling complex problems or coding tasks.

**重要原則**: 思考和執行過程都請用中文

## MCP 工具與資源 ⭐

爬蟲專案特別推薦以下 MCP servers，大幅提升開發效率：

### 核心工具

- **context7** 📚 - 最新技術文檔
  - 功能：Playwright、TypeScript、Yahoo Finance API 文檔
  - 使用場景：查詢新 API、了解最佳實踐、技術更新

### Context7 強制查詢清單 ⭐

**以下情況必須先查詢 context7 再編碼**：

- [ ] 開發新的網頁選擇器策略
- [ ] 實作 Playwright 自動化流程和等待策略
- [ ] 處理 Yahoo Finance API 變更和新欄位
- [ ] 優化並發控制機制（Site-based Concurrency）
- [ ] 實作數據轉換函數和清洗邏輯
- [ ] 設計批次處理和重試機制
- [ ] 實作進度追蹤和斷點續傳
- [ ] 處理動態內容和 JavaScript 渲染

**查詢範例**：
```bash
# 開發選擇器前
context7: "Playwright selector strategies 2025"
context7: "CSS :has() pseudo-class advanced usage"
context7: "XPath vs CSS selector performance"

# Playwright 自動化
context7: "Playwright wait strategies best practices"
context7: "Playwright page.evaluate() advanced patterns"
context7: "Playwright browser context isolation"

# Yahoo Finance 處理
context7: "Yahoo Finance API latest changes 2025"
context7: "Yahoo Finance financial data structure"

# 並發優化
context7: "Node.js concurrency patterns 2025"
context7: "Promise.allSettled vs Promise.all best practices"
```

### 爬蟲開發工作流程

```bash
# 1. 代碼理解階段
serena           # 分析現有配置和轉換邏輯

# 2. 選擇器開發階段
playwright       # 測試和驗證網頁選擇器

# 3. 配置調試階段
serena           # 查找相關轉換函數和常數定義

# 4. 文檔查詢階段
context7         # 獲取最新 API 文檔和範例
```

### 特殊使用提示

- **配置開發**：使用 serena 快速查找相似配置範例
- **選擇器調試**：使用 playwright 直接測試選擇器效果
- **轉換函數開發**：使用 serena 查找現有轉換函數實作

## 專案概述

通用網路爬蟲系統，主要用於爬取 Yahoo Finance 各地區的財務數據。支援 JSON 配置驅動的爬蟲任務，提供豐富的數據轉換和處理功能。

### 系統架構

```
crawler/
├── src/                        # 核心源碼
│   ├── cli.ts                  # 命令行介面
│   ├── crawler/                # 爬蟲核心 (Playwright + DataExtractor)
│   ├── transforms/sites/       # 各網站專用轉換
│   └── utils/                  # 工具函數
├── scripts/                    # 爬蟲腳本
├── config-categorized/         # v3.0 分類配置系統
├── output/                     # 結構化輸出目錄
└── docs/                       # 技術文檔 (13個專門文檔)
```

## 六大核心開發原則

### 1. 結構化選擇器優先原則 ⭐

**最高優先原則**: 優先使用結構化的位置選擇器，避免依賴文字內容。

#### 選擇器優先級順序：

1. **位置選擇器** (最優先) - `nth-child()`, `nth-of-type()`
2. **屬性選擇器** (次優先) - `[data-testid]`, `[aria-label]`
3. **類別選擇器** (輔助) - CSS 類別
4. **:has() 配合結構** (特殊情況)

**❌ 避免使用 :contains()** - 依賴文字內容不穩定，語言相關

```json
{
  "selectors": {
    // ✅ 好的做法：使用結構化選擇器
    "operatingCashFlow": {
      "selector": "section[data-testid*='table'] > div:nth-child(2)",
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

### 2. DOM 預處理 - Exclude Selector

**核心概念**: 使用 exclude 選擇器移除會干擾目標數據提取的元素。

```json
{
  // ✅ 正確：只排除真正影響數據提取的元素
  "excludeSelectors": [
    ".financial-table .advertisement", // 表格內的廣告
    "tr[data-ad-type]", // 廣告標記行
    ".data-section .sponsored-content" // 數據區域的贊助內容
  ]
}
```

### 3. 禁止錯誤數據捉取

**嚴禁**: 使用通用選擇器捉取混雜資料再透過轉換函數進行過濾。

### 4. 獨立選擇器

每個最終輸出欄位使用獨立的 CSS 選擇器。

### 5. 動態時間軸提取

**禁止硬編碼**: 所有時間軸和期間數據必須動態提取。

### 6. 真實數值常數

參考 `src/const/finance.ts` 定義的真實常數進行驗證和轉換。

## 常用命令

### 🕷️ 基礎爬蟲命令

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

### 🏢 部門爬蟲命令

#### US 市場部門爬蟲

```bash
# 簡化版 - 只爬取科技部門
npm run scrape:us:simple               # 預設 10 頁

# 完整版 - 支援 11 個部門
npm run scrape:us:technology           # 科技部門
npm run scrape:us:financial            # 金融部門
npm run scrape:us:healthcare           # 醫療保健部門

# 批次爬取
npm run scrape:us:all                  # 爬取所有 11 個部門
npm run scrape:us:all:limit            # 爬取所有部門 (限制 5 頁)
```

#### TW 市場股票爬蟲

```bash
# 爬取股票分類
npm run scrape:tw:categories           # 爬取所有股票分類

# 爬取股票詳情
npm run scrape:tw:details              # 爬取所有股票詳情
npm run scrape:tw:details:limit        # 限制爬取數量
```

### 📊 數據匯入命令 (v3.1.2 結構化目錄系統)

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
npm run import:tw:eps                 # 只匯入台灣每股盈餘

npm run import:us:balance-sheet        # 只匯入美國資產負債表
npm run import:us:financials          # 只匯入美國財務數據
```

### 🔄 Pipeline 命令與重試機制 ⭐

#### Pipeline 最佳實踐命令

```bash
# 🚀 推薦：優化版完整流程 (避免重複匯入)
npm run pipeline:all                  # 跳過重複symbol匯入的完整流程
npm run pipeline:full                 # 同上，完整流程最佳化版本

# 基本執行模式
npm run pipeline:run                  # 標準完整流程（包含所有步驟）
npm run pipeline:legacy               # 傳統模式（向後相容）

# 部分執行
npm run pipeline:crawl-only           # 只執行爬取
npm run pipeline:symbols-only         # 只匯入股票代碼
npm run pipeline:labels-only          # 只同步標籤
```

#### 重試機制命令 ⭐

```bash
# 查看重試隊列狀態
npm run pipeline:retry-status

# 執行重試隊列
npm run pipeline:retry
# 自動重試失敗的爬取任務 (最多3次，指數退避延遲)

# 清空重試隊列 (謹慎使用)
npm run pipeline:clear-retries

# 只執行重試模式
npm run pipeline:retry-only
```

### 🗂️ 智慧進度檔案管理 (v3.1.2 新功能) ⭐

#### 智慧提醒機制

系統具備智慧進度檔案提醒功能，當 `.progress` 目錄累積超過 10 個檔案時自動提醒清理。

#### 進度檔案清理命令

```bash
# 完全清理
npm run clean:progress                # 刪除整個 .progress 目錄
npm run clean:progress:all            # 清理所有進度檔案

# 時間基礎清理
npm run clean:progress:old            # 清理 7 天前的檔案
npm run clean:progress:safe           # 清理 3 天前的檔案 (安全模式)
npm run clean:progress:keep-recent    # 保留最近 5 個檔案

# 按市場分類清理
npm run clean:progress:tw             # 清理台灣市場進度檔案
npm run clean:progress:us             # 清理美國市場進度檔案
npm run clean:progress:jp             # 清理日本市場進度檔案
```

#### 進度檢查命令

```bash
# 基本檢查
npm run progress:check                # 完整進度目錄狀態檢查
npm run progress:stats                # 快速統計 (檔案數量和大小)
npm run progress:analyze              # 分析進度檔案內容

# 維護命令
npm run maintenance                   # 執行完整維護
npm run maintenance:dry               # 維護建議 (不實際執行)
npm run maintenance:full              # 完整重置 (包含配置清理)
```

#### 批次斷點續傳 ⭐

**Ctrl+C 中斷支援**：系統完整支援 Ctrl+C 優雅中斷，自動保存進度到 `.progress` 目錄。

```bash
# 查看批次執行狀態
npm run crawl:status                  # 顯示當前進度和統計
npm run crawl:stats                   # 詳細統計資訊
npm run crawl:errors                  # 分析失敗原因

# 斷點續傳操作
npx tsx src/cli.ts crawl-batch --resume=batch_20250815_103045
npx tsx src/cli.ts crawl-batch --retry-failed=batch_20250815_103045
npx tsx src/cli.ts crawl-batch --start-from=100 --limit=50
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
├── metadata/                   # 元數據配置
└── templates/                  # 配置模板
```

### 生成指令

```bash
# 台灣市場
npx tsx scripts/generate-yahoo-tw-configs.ts --type=eps
npx tsx scripts/generate-yahoo-tw-configs.ts --type=balance-sheet

# 美國市場
npx tsx scripts/generate-yahoo-us-configs.ts --type=financials

# 日本市場
npx tsx scripts/generate-yahoo-jp-configs.ts --type=performance
```

## Site-based Concurrency 智慧並發控制 (v3.1.1) ⭐

### 核心特性

- **網站特定並發限制**: tw.stock.yahoo.com (3), finance.yahoo.com (2)
- **智慧延遲動態調整**: 根據網站響應自動優化 (1978-3962ms)
- **20% 性能提升**: 50秒 vs 60秒 (實測數據)
- **即時統計監控**: 詳細的並發控制調試功能

### Site-based Concurrency 命令

```bash
# 啟用 site-based concurrency (預設)
npm run crawl:tw:quarterly:site-concurrent

# 傳統全域並發模式
npm run crawl:tw:quarterly:global-concurrent

# 混合模式測試
npm run crawl:mixed:site-vs-global

# 即時統計監控
npm run crawl:stats:site-concurrency
```

## 調試與故障排除

### 常見問題解決

1. **精度問題**: 使用 `Math.round(value * 100) / 100` 控制
2. **數據對齊問題**: 採用位置獨立選擇器方法
3. **TypeScript 錯誤**: 在 `YahooFinanceTWTransforms` 介面中加入新函數定義

### 重試和批次處理故障排除

```bash
# 查看重試狀態和原因
npm run pipeline:retry-status

# 分析錯誤模式
npm run crawl:errors

# 分批處理重試隊列
npm run pipeline:retry --limit=20
```

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

## 📚 完整技術文檔導引

### 核心文檔 (3 個主要文檔)

- **@crawler/docs/20250814-complete-system-guide.md** - 完整系統指南 (系統概述、工作流程、故障排除)
- **@crawler/docs/20250814-api-integration-guide.md** - API 整合指南 (數據匯入、批次處理、監控診斷)
- **@crawler/docs/20250814-development-reference.md** - 開發參考手冊 (CSS 選擇器、配置系統、開發流程)

### 專門功能指南

- **@crawler/docs/20250815-pipeline-retry-batch-guide.md** - Pipeline Retry & Batch 功能完整指南 (重試機制詳細說明)
- **@crawler/docs/20250816-site-based-concurrency-guide.md** - Site-based Concurrency 智慧並發控制指南 (智慧並發控制系統)
- **@crawler/docs/20250816-batch-crawler-retry-guide.md** - Batch Crawler 重試機制指南 (批量爬取重試機制)
- **@crawler/docs/20250817-skip-task-retry-enhancement.md** - Skip Task Retry Enhancement 功能詳細說明 (跳過任務重試功能) ⭐
- **@crawler/docs/20250817-stats-analysis-guide.md** - 爬蟲統計分析完整指南 (監控診斷和統計分析)

### 快速導航

- **系統使用**: 查看完整系統指南的快速開始章節
- **API 整合**: 查看 API 整合指南的批次處理優化
- **CSS 選擇器最佳實踐**: 查看開發參考手冊的六大核心原則
- **重試和批次處理**: 查看 Pipeline Retry & Batch 功能指南

## 版本記錄

- **v3.1.2** (2025-08-17): **跳過任務重試功能增強 + 智慧進度檔案管理系統**

  - 🚀 重大功能: 新增強制重試 SKIP 任務的能力，突破傳統設計限制
  - 新增智慧進度檔案提醒機制，超過 10 個檔案自動提醒清理
  - 完整的進度檔案清理命令系統 (11 個清理命令)
  - 完善的 Ctrl+C 優雅中斷和斷點續傳支援

- **v3.1.1** (2025-08-16): **Site-based Concurrency 智慧並發控制系統**

  - 全新 Site-based Concurrency 機制
  - 20% 性能提升：50秒 vs 60秒
  - 智慧延遲動態調整，根據網站響應自動優化

- **v3.1.0** (2025-08-14): **US Scrape Scripts TypeScript 轉換**

  - 新增 21 個 npm scrape 命令支援 US 11 個部門爬取
  - 統一輸出目錄結構

- **v3.0.0** (2025-08-14): **數據匯入系統重大更新 + 文檔架構重組**
  - 新增結構化目錄掃描支援
  - 完整的爬取→匯入工作流程整合
  - 文檔重組: 整合為 3 個核心文檔

## 聯繫資訊

- **專案路徑**: `/Users/aryung/Downloads/Workshop/crawler`
- **開發狀態**: 積極開發中，v3.1.2 架構穩定
- **核心功能**: Yahoo Finance 多地區財務數據爬取 + API 整合 + Site-based Concurrency 智慧並發控制
- **最新特色**: 智慧進度檔案管理系統，完整的 Ctrl+C 中斷恢復支援
- **文檔狀態**: 已整合為 3 個核心文檔，包含完整的並發控制、性能優化和進度管理指南

## 重要提醒

**✨ 最高優先原則**: 優先使用 `:has()` 偽類選擇器直接定位包含特定內容的元素，避免大量比對邏輯。

**🚫 嚴禁原則**: 絕對禁止使用通用選擇器捉取混雜資料再透過轉換函數進行過濾。轉換函數只能進行格式調整，不能進行資料篩選。

**📖 深度學習**: 複雜的技術概念如「位置獨立選擇器方法」請參考開發參考手冊，其中包含完整的 5 階段開發流程和實際案例。

---

**更新日期**: 2025-08-17  
**版本**: v3.1.2  
**狀態**: 積極開發中，架構穩定 ✅  
**最新功能**: 智慧進度檔案管理，跳過任務重試增強，Site-based Concurrency 智慧並發控制
