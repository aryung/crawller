# Universal Web Crawler - Claude 協作指南

**專案**: 通用網路爬蟲系統
**框架**: TypeScript + Playwright + Node.js  
**開發日期**: 2025-08-04

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
├── config/                         # 爬蟲配置檔案
└── output/                         # 輸出結果
```

## 六大核心開發原則

### 1. :has() 偽類精確選擇器 ⭐

**最高優先原則**: 使用 `:has()` 偽類直接定位包含特定內容的元素，避免複雜比對邏輯。

```json
{
  "selectors": {
    "currentPrice": {
      "selector": "tr:has(td:contains('目前股價')) td:nth-child(2)",
      "transform": "cleanNumericValue"
    },
    "revenue2025Q1": {
      "selector": "tr:has(td:contains('2025')) td:contains('Q1') + td",
      "transform": "extractRevenueValue"
    }
  }
}
```

**:has() 選擇器模式庫**:
```css
tr:has(td:contains('關鍵字'))                    /* 選取包含關鍵字的行 */
th:contains('標題') + td                         /* 選取標題後的數據格 */
div:has(.specific-class) .data-value             /* 選取包含特定類別的容器內的數據 */
tr:has(td.positive) td:last-child                /* 選取包含正值的行的最後一欄 */
```

### 2. DOM 預處理 - Exclude Selector

**核心概念**: 使用 exclude 選擇器預先移除干擾元素，確保主選擇器只選取目標數據。

```json
{
  "excludeSelectors": [
    ".advertisement, [data-module='ad'], [class*='ad-']",
    ".navigation, .nav-menu, .breadcrumb",
    ".sidebar, .related-news, .trending",
    ".popup, .overlay, .modal"
  ],
  "selectors": {
    "cleanEPSData": {
      "selector": "tr:has(td:contains('每股盈餘')) td:last-child",
      "transform": "cleanEPSValue"
    }
  }
}
```

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
  /(20\d{2})\s*Q([1-4])\s+([0-9]+\.?[0-9]{0,2})/g,  // 動態匹配
  /(20\d{2})\s*H([1-2])\s+([0-9]+\.?[0-9]{0,2})/g   // 支援半年度
];
```

### 6. 真實數值常數

參考 `src/const/finance.ts` 定義的真實常數進行驗證和轉換。

```typescript
export const TW_REVENUE_DATA_CONSTANTS = {
  MIN_YEAR: 1990,
  MAX_YEAR_OFFSET: 2,
  MIN_REASONABLE_VALUE: 1,
  MAX_DIGITS: 15
} as const;

export const UNIT_MULTIPLIERS = {
  MILLION_YEN: 1000000,
  THOUSAND_TWD: 1000,
  PERCENTAGE: 0.01
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
  investingCashFlow: { start: 153, end: 172, count: 20 }
};

// 位置獨立提取函數
extractOperatingCashFlowFromPosition: (content: string | string[]): number[] => {
  const contentArray = Array.isArray(content) ? content : [content];
  // 動態位置檢測邏輯...
  return results;
}
```

## 配置生成器系統

### 目錄結構

```
config/
├── templates/                    # 配置模板
├── active/                       # 開發環境專用配置
├── yahoo-finance-tw-*-XXXX_TW.json  # 生成的台灣配置
└── data/
    └── yahoo-finance-*-stockcodes.json  # 股票代碼數據源
```

### 生成指令

```bash
# 台灣市場
npx tsx scripts/generate-yahoo-tw-configs.ts --type=eps
npx tsx scripts/generate-yahoo-tw-configs.ts --type=balance-sheet
npx tsx scripts/generate-yahoo-tw-configs.ts --type=cash-flow-statement

# 美國市場
npx tsx scripts/generate-yahoo-us-configs.ts --type=financials

# 日本市場
npx tsx scripts/generate-yahoo-jp-configs.ts --type=performance
```

### 開發工作流程

1. 在 `config/active/` 創建測試配置
2. 使用 `npx tsx src/cli.ts --config config/active/test.json` 測試
3. 確認有效後更新對應模板
4. 重新生成所有相關配置

## 常用命令

```bash
# 執行配置 (config/ 目錄)
npm run crawl yahoo-finance-tw-eps-2454_TW

# 執行 active/ 配置 (需要 --config 參數)
npx tsx src/cli.ts --config config/active/test-eps.json

# 檢查 TypeScript 錯誤
npm run typecheck

# 列出所有配置
npm run list
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

## 版本記錄

- **v1.3.0** (2025-08-07): Exclude Selector 預處理完整實現
- **v1.2.0** (2025-08-05): 位置獨立選擇器方法完善，解決現金流數據對齊問題
- **v1.1.0** (2025-08-05): 配置生成器架構統一化，支援三區域
- **v1.0.0** (2025-08-04): 初始版本，實現純動態 EPS 提取

## 聯繫資訊

- **專案路徑**: `/Users/aryung/Downloads/Workshop/crawler`
- **開發狀態**: 積極開發中
- **核心功能**: Yahoo Finance 多地區財務數據爬取完成

## 重要提醒

**✨ 最高優先原則**: 優先使用 `:has()` 偽類選擇器直接定位包含特定內容的元素，避免大量比對邏輯。

**🚫 嚴禁原則**: 絕對禁止使用通用選擇器捉取混雜資料再透過轉換函數進行過濾。轉換函數只能進行格式調整，不能進行資料篩選。

遵循六大核心原則確保代碼的可維護性和可擴展性。