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
├── config/                         # 爬蟲配置檔案
├── output/                         # 輸出結果
└── docs/                          # 技術文檔
```

## 核心開發原則

### 獨立選擇器搭配 :has() 偽類 (Independent Selectors with :has() Pseudo-class)

**核心概念**: 每個數據欄位使用獨立的 CSS 選擇器搭配 `:has()` 偽類，直接選取正確的值，徹底避免字串解析、拼接和大量比對邏輯。

#### ⭐ 新增核心原則: 使用 :has() 精確定位

**最高優先原則**: 採用 `:has()` 偽類搭配獨立選擇器，直接鎖定包含特定內容的元素，避免提取後再進行複雜比對。

#### ✅ 推薦做法 (:has() 精確選擇器)

**使用 :has() 直接選取包含特定文字的元素**:

```json
{
  "selectors": {
    "currentPrice": {
      "selector": "tr:has(td:contains('目前股價')) td:nth-child(2)",
      "multiple": false,
      "transform": "cleanNumericValue"
    },
    "revenueRow2025Q1": {
      "selector": "tr:has(td:contains('2025')) td:contains('Q1') + td",
      "multiple": false,
      "transform": "extractRevenueValue"
    },
    "operatingCashFlowHeader": {
      "selector": "th:has(:contains('營業活動之現金流量'))",
      "multiple": false,
      "transform": "extractCashFlowHeader"
    },
    "balanceSheetAssets": {
      "selector": "tbody tr:has(td:contains('總資產')) td:last-child",
      "multiple": false,
      "transform": "cleanFinancialValue"
    }
  }
}
```

**對應的簡化轉換函數**:
```typescript
// 大幅簡化的轉換邏輯 - 無需複雜比對
cleanNumericValue: (content: string | string[]): number => {
  // 直接處理已精確選取的數值，無需搜索和比對
  const cleanStr = content.toString().replace(/[^\d.-]/g, '');
  return parseFloat(cleanStr) || 0;
},

extractRevenueValue: (content: string | string[]): number => {
  // 已選取到精確位置，直接轉換即可
  const value = content.toString().replace(/[^\d,.-]/g, '');
  return parseInt(value.replace(/,/g, '')) || 0;
}
```

#### 📋 :has() 選擇器應用場景

| 應用場景 | 傳統方法問題 | :has() 解決方案 |
|----------|--------------|-----------------|
| **表格行定位** | 提取所有行再逐一比對標題 | `tr:has(td:contains('營收'))` 直接選取營收行 |
| **特定期間數據** | 提取所有數據再匹配期間 | `td:has(:contains('2025-Q1')) + td` 直接選取對應數值 |
| **標題下的數據** | 複雜的相鄰元素查找邏輯 | `th:contains('EPS') ~ td` 直接選取 EPS 數據列 |
| **條件性元素** | 多步驟篩選和驗證邏輯 | `div:has(.positive-value)` 直接選取包含正值的區塊 |

#### 🔧 實際應用範例

**場景**: Yahoo Finance 財務報表數據提取

**❌ 傳統複雜比對方法**:
```json
{
  "allTableData": {
    "selector": "table tr td",
    "multiple": true,
    "transform": "complexFinancialDataExtraction"
  }
}
```

```typescript
// 複雜的提取邏輯 - 需要大量比對代碼
complexFinancialDataExtraction: (content: string | string[]): FinancialData[] => {
  const results: FinancialData[] = [];
  const contentArray = Array.isArray(content) ? content : [content];
  
  // 複雜的搜尋和比對邏輯
  for (let i = 0; i < contentArray.length; i++) {
    const cell = contentArray[i]?.toString().trim();
    
    // 判斷是否為期間標題
    if (cell?.match(/(20\d{2})\s*[Qq]([1-4])/)) {
      // 尋找對應的數值（複雜的相對位置計算）
      const valueIndex = findCorrespondingValue(contentArray, i);
      if (valueIndex !== -1) {
        // 更多比對和驗證邏輯...
        results.push(extractDataFromPosition(contentArray, valueIndex));
      }
    }
  }
  
  return results;
}
```

**✅ :has() 精確選擇器方法**:
```json
{
  "revenue2025Q1": {
    "selector": "tr:has(td:contains('2025')) td:contains('Q1') + td",
    "multiple": false,
    "transform": "cleanFinancialValue"
  },
  "revenue2024Q4": {
    "selector": "tr:has(td:contains('2024')) td:contains('Q4') + td", 
    "multiple": false,
    "transform": "cleanFinancialValue"
  },
  "totalAssets": {
    "selector": "tr:has(td:contains('總資產')) td:last-child",
    "multiple": false,
    "transform": "cleanFinancialValue"
  },
  "operatingCashFlow": {
    "selector": "tr:has(td:contains('營業活動')) td:nth-last-child(2)",
    "multiple": false,
    "transform": "cleanFinancialValue"
  }
}
```

```typescript
// 極度簡化的轉換邏輯 - 無需比對
cleanFinancialValue: (content: string | string[]): number => {
  // 已精確選取，直接清理和轉換即可
  const cleanStr = content.toString().replace(/[^\d,.-]/g, '');
  const numericValue = parseFloat(cleanStr.replace(/,/g, ''));
  return isNaN(numericValue) ? 0 : numericValue;
}
```

#### 🚫 禁止捉取錯誤資料再事後過濾 (No Wrong Data Extraction + Post-filtering)

**核心概念**: 選擇器必須直接捉取正確的資料，絕對禁止先捉取混雜的資料再透過轉換函數進行過濾，這會大幅增加轉換函數的複雜度。

#### ❌ 錯誤做法 (捉錯再過濾)

**問題**: 使用通用選擇器捉取大量混雜資料，再在轉換函數中進行複雜過濾

```json
{
  "mixedTableData": {
    "selector": "table td, .data-cell, li, span",
    "multiple": true, 
    "transform": "complexFilterAndExtract"
  }
}
```

```typescript
// ❌ 複雜的過濾轉換函數 - 大幅增加函數複雜度
complexFilterAndExtract: (content: string | string[]): FinancialData[] => {
  const contentArray = Array.isArray(content) ? content : [content];
  const results: FinancialData[] = [];
  
  // 大量的過濾邏輯
  for (let i = 0; i < contentArray.length; i++) {
    const item = contentArray[i]?.toString().trim();
    
    // 過濾掉不需要的資料類型
    if (isStockPrice(item)) continue;      // 過濾股價
    if (isCompanyNews(item)) continue;     // 過濾新聞
    if (isAdvertisement(item)) continue;   // 過濾廣告
    if (isNavigation(item)) continue;      // 過濾導航
    
    // 判斷資料類型並分類處理
    if (isRevenueData(item)) {
      // 更多複雜的判斷和轉換...
      const revenue = parseRevenueData(item);
      if (isValidRevenue(revenue)) {
        results.push(revenue);
      }
    } else if (isEPSData(item)) {
      // EPS 資料處理...
    } else if (isDividendData(item)) {
      // 股息資料處理...
    }
    // 更多資料類型判斷...
  }
  
  // 事後排序和清理
  return filterValidResults(sortByPeriod(results));
}

// 輔助函數激增 - 維護噩夢
function isStockPrice(content: string): boolean { /* 複雜判斷邏輯 */ }
function isCompanyNews(content: string): boolean { /* 複雜判斷邏輯 */ }
function isRevenueData(content: string): boolean { /* 複雜判斷邏輯 */ }
function parseRevenueData(content: string): RevenueData { /* 複雜解析邏輯 */ }
// 10+ 個輔助函數...
```

#### ✅ 正確做法 (精確捉取 + 格式轉換)

**原則**: 選擇器直接捉取目標資料，轉換函數只負責格式調整，不進行資料過濾

```json
{
  "revenueQ1Data": {
    "selector": "tr:has(td:contains('營收')) td:contains('Q1') + td",
    "multiple": false,
    "transform": "cleanFinancialNumber"
  },
  "epsCurrentQuarter": {
    "selector": "section.eps-data tr:has(th:contains('本季')) td:last-child",
    "multiple": false,
    "transform": "cleanEPSValue"
  },
  "dividendYield": {
    "selector": "div.dividend-info span:has(:contains('殖利率')) + span",
    "multiple": false,
    "transform": "cleanPercentageValue"
  }
}
```

```typescript
// ✅ 簡化的格式轉換函數 - 無需過濾邏輯
cleanFinancialNumber: (content: string | string[]): number => {
  // 只負責格式清理，不判斷資料類型
  const cleanStr = content.toString().replace(/[^\d,.-]/g, '');
  return parseFloat(cleanStr.replace(/,/g, '')) || 0;
},

cleanEPSValue: (content: string | string[]): number => {
  // 已知是 EPS 資料，只需格式調整
  const epsStr = content.toString().replace(/[^\d.-]/g, '');
  const eps = parseFloat(epsStr);
  return Math.round(eps * 100) / 100; // 控制精度到2位小數
},

cleanPercentageValue: (content: string | string[]): number => {
  // 已知是百分比資料，只需轉換
  const percentStr = content.toString().replace(/[^\d.-]/g, '');
  return parseFloat(percentStr) / 100; // 轉為小數
}
```

#### 📊 複雜度對比表

| 方面 | 錯誤做法 (捉錯再過濾) | 正確做法 (精確捉取) |
|------|---------------------|------------------|
| **選擇器複雜度** | 簡單通用選擇器 | 精確語義選擇器 |
| **轉換函數複雜度** | 極高 (100+ 行) | 極低 (5-10 行) |
| **輔助函數數量** | 10+ 個判斷函數 | 0-2 個格式函數 |
| **維護難度** | 噩夢級別 | 容易維護 |
| **除錯難度** | 極高 | 極低 |
| **效能** | 差 (大量判斷) | 好 (直接轉換) |
| **錯誤率** | 高 (多步驟錯誤累積) | 低 (單純格式轉換) |

#### 🔧 實際問題範例

**場景**: 提取 Yahoo Finance 營收資料時同時捉到股價、廣告、新聞資料

**❌ 錯誤方式的問題**:
```typescript
// 捉取到混雜資料
const mixedData = [
  "營收 Q1: 56,433,621",      // ✓ 需要的資料
  "股價: 1,125.50",           // ✗ 不需要的資料
  "廣告：投資理財專家...",      // ✗ 不需要的資料  
  "新聞：公司宣布...",         // ✗ 不需要的資料
  "營收 Q2: 58,234,112",      // ✓ 需要的資料
  "熱門搜尋: 台積電股價",       // ✗ 不需要的資料
];

// 轉換函數變得極其複雜
function extractRevenue(mixedData) {
  // 需要複雜的判斷邏輯來過濾不相關資料
  // 容易誤判，維護困難
  // 性能較差
}
```

**✅ 正確方式的解決**:
```json
{
  "revenueQ1": {
    "selector": "table.financial-data tr:has(td:contains('營收')) td:nth-child(2)",
    "transform": "cleanFinancialNumber"
  },
  "revenueQ2": {
    "selector": "table.financial-data tr:has(td:contains('營收')) td:nth-child(3)", 
    "transform": "cleanFinancialNumber"
  }
}
```

```typescript
// 直接捉取到: ["56,433,621", "58,234,112"]
// 轉換函數超級簡單
cleanFinancialNumber: (content: string): number => {
  return parseFloat(content.replace(/,/g, ''));
}
```

### Exclude Selector 預處理 (Exclude Selector Preprocessing)

**核心概念**: 在數據提取前使用 exclude 選擇器預先移除干擾元素，確保主選擇器只選取到目標數據，進一步減少比對代碼和提升選擇器精確度。

#### ⭐ 第六核心原則: DOM 預處理優化

**最高效率原則**: 通過 exclude 選擇器在提取階段前預先清除廣告、導航、無關內容等干擾元素，讓主選擇器更精確，避免後續複雜的過濾比對邏輯。

#### ✅ Exclude Selector 配置語法

**在配置模板中添加 excludeSelectors 欄位**:

```json
{
  "templateType": "tw-eps-clean",
  "url": "https://tw.stock.yahoo.com/quote/${symbolCode}/eps",
  "excludeSelectors": [
    ".advertisement, .ad-banner, [class*='ad-']",
    ".navigation, .nav-menu, .breadcrumb",
    ".sidebar, .related-news, .trending",
    ".footer-content, .social-sharing",
    ".popup, .overlay, .modal"
  ],
  "selectors": {
    "cleanEPSData": {
      "selector": "tr:has(td:contains('每股盈餘')) td:last-child",
      "multiple": false,
      "transform": "cleanEPSValue"
    },
    "fiscalPeriods": {
      "selector": "table.financial-data th:contains('Q')",
      "multiple": true,
      "transform": "extractCleanPeriods"
    }
  }
}
```

#### 📋 Exclude Selector 應用場景

| 應用場景 | 干擾問題 | Exclude 解決方案 | 效益 |
|----------|----------|-----------------|------|
| **廣告清理** | 廣告文字混入財務數據 | `.advertisement, [class*='ad-']` | 消除廣告數字干擾 |
| **導航清理** | 導航選單文字污染 | `.navigation, .nav-menu, .breadcrumb` | 精確定位表格數據 |
| **新聞清理** | 相關新聞標題混淆 | `.related-news, .news-sidebar` | 避免新聞標題中的數字 |
| **彈窗清理** | 彈窗內容影響選擇器 | `.popup, .overlay, .modal` | 確保主內容選擇精確 |
| **社群清理** | 分享按鈕文字干擾 | `.social-sharing, .share-buttons` | 移除社群相關干擾 |

#### 🔧 技術實作架構

**Playwright 引擎實現**:
```typescript
// PlaywrightCrawler.ts 中新增的預處理方法
private async removeExcludedElements(page: Page, excludeSelectors: string[]): Promise<void> {
  if (!excludeSelectors || excludeSelectors.length === 0) return;
  
  for (const selector of excludeSelectors) {
    try {
      await page.evaluate((sel) => {
        const elements = document.querySelectorAll(sel);
        elements.forEach(el => el.remove());
      }, selector);
      
      logger.debug(`Removed elements matching: ${selector}`);
    } catch (error) {
      logger.warn(`Failed to remove elements with selector "${selector}":`, error);
    }
  }
  
  logger.info(`Preprocessed DOM: removed ${excludeSelectors.length} exclude selector patterns`);
}
```

**Cheerio 引擎實現**:
```typescript
// DataExtractor.ts 中新增的預處理方法
private removeExcludedElementsCheerio($: CheerioAPI, excludeSelectors: string[]): void {
  if (!excludeSelectors || excludeSelectors.length === 0) return;
  
  for (const selector of excludeSelectors) {
    try {
      const removedCount = $(selector).remove().length;
      logger.debug(`Removed ${removedCount} elements matching: ${selector}`);
    } catch (error) {
      logger.warn(`Failed to remove elements with selector "${selector}":`, error);
    }
  }
  
  logger.info(`Preprocessed DOM: processed ${excludeSelectors.length} exclude selector patterns`);
}
```

#### 💡 實際應用範例

**場景**: Yahoo Finance EPS 頁面包含大量廣告和推薦內容

**❌ 傳統方法問題**:
```json
{
  "epsData": {
    "selector": "td",  // 選取到廣告中的數字: "立即投資", "99%用戶推薦", "廣告 3.2%"
    "multiple": true,
    "transform": "complexEPSFilterFunction"  // 需要複雜過濾邏輯
  }
}
```

```typescript
// 複雜的過濾函數
complexEPSFilterFunction: (content: string[]): EPSData[] => {
  const results: EPSData[] = [];
  
  for (const item of content) {
    // 大量過濾邏輯
    if (item.includes('廣告')) continue;
    if (item.includes('推薦')) continue;
    if (item.includes('投資')) continue;
    if (item.includes('立即')) continue;
    // 10+ 個過濾條件...
    
    // 複雜的數據驗證
    if (isValidEPSData(item)) {
      results.push(parseEPSData(item));
    }
  }
  
  return results;
}
```

**✅ Exclude Selector 方法**:
```json
{
  "templateType": "tw-eps-clean",
  "url": "https://tw.stock.yahoo.com/quote/${symbolCode}/eps",
  "excludeSelectors": [
    ".advertisement, [data-module='ad'], [class*='ad-']",
    ".recommendation, .suggest, [class*='recommend']", 
    ".sidebar, .related-content, .trending-topics",
    ".social-share, .share-buttons, .social-media",
    ".popup-banner, .promotion, .marketing-content"
  ],
  "selectors": {
    "cleanEPSData": {
      "selector": "table.financial-data td:contains('每股盈餘') + td",
      "multiple": false,
      "transform": "simpleEPSClean"  // 極簡轉換函數
    },
    "quarterlyEPS": {
      "selector": "tr:has(th:contains('季度')) td:nth-last-child(-n+4)",
      "multiple": true,
      "transform": "cleanNumericArray"
    }
  }
}
```

```typescript
// 極簡的轉換函數 - 無需過濾邏輯
simpleEPSClean: (content: string): number => {
  // DOM 已預先清理，直接處理數值格式即可
  const cleanStr = content.replace(/[^\d.-]/g, '');
  return Math.round(parseFloat(cleanStr) * 100) / 100;
},

cleanNumericArray: (content: string[]): number[] => {
  // 已清理過的內容，只需格式轉換
  return content.map(item => parseFloat(item.replace(/[^\d.-]/g, '')) || 0);
}
```

#### 🚀 Exclude Selector 優勢對比

| 方面 | 無預處理 (傳統) | Exclude Selector 預處理 |
|------|-----------------|------------------------|
| **DOM 複雜度** | 高 (包含所有干擾元素) | 低 (預先清理干擾) |
| **選擇器精確度** | 低 (需要複雜條件避開干擾) | 高 (直接選取目標) |
| **轉換函數複雜度** | 極高 (大量過濾邏輯) | 極低 (純格式轉換) |
| **維護難度** | 困難 (多層邏輯交錯) | 簡單 (清晰分層) |
| **調試效率** | 低 (難以定位問題源頭) | 高 (預處理 + 提取分離) |
| **效能表現** | 差 (JavaScript 大量運算) | 好 (瀏覽器原生 DOM 操作) |
| **擴展性** | 差 (添加新邏輯困難) | 優 (獨立添加排除規則) |

#### 🎯 Exclude Selector 模式庫

```css
/* 廣告清理模式 */
.advertisement, [data-module="ad"], [class*="ad-"], [id*="ad-"]
.banner, .promotion, .marketing, [class*="promo"]
.sponsored, [data-sponsored], [class*="sponsor"]

/* 導航清理模式 */
.navigation, .nav-menu, .navbar, [role="navigation"]
.breadcrumb, .breadcrumbs, .path-navigation
.menu, .header-menu, .footer-menu

/* 內容清理模式 */
.sidebar, .aside, .related-content, .recommendations
.social-share, .share-buttons, .social-media
.comments, .comment-section, .user-comments

/* 彈窗清理模式 */
.popup, .modal, .overlay, .lightbox
.notification, .alert-banner, .toast
.cookie-notice, .gdpr-notice

/* 新聞清理模式 */
.news, .article, .blog-post, [class*="news"]
.trending, .popular, .featured, .highlight
.related-articles, .more-stories

/* Yahoo Finance 特定模式 */
.quote-summary, .market-summary, .trending-tickers
.news-stream, .research-reports, .analyst-ratings
.options-data, .historical-data:not(.target-data)
```

#### 🔧 配置整合最佳實踐

**模板結構標準化**:
```json
{
  "templateType": "standardized-template",
  "url": "https://example.com/${symbolCode}",
  
  "_preprocessing": {
    "description": "DOM 預處理階段 - 清理干擾元素",
    "excludeSelectors": [
      "// 廣告相關",
      ".advertisement, [data-module='ad']",
      "// 導航相關", 
      ".navigation, .breadcrumb",
      "// 社群相關",
      ".social-share, .share-buttons"
    ]
  },
  
  "_extraction": {
    "description": "數據提取階段 - 精確選擇器",
    "selectors": {
      "targetData": {
        "selector": "cleaned-dom-specific-selector",
        "transform": "simpleFormatFunction"
      }
    }
  }
}
```

**分層配置原則**:
1. **第一層**: Exclude Selectors - DOM 預處理清理
2. **第二層**: Main Selectors - 精確數據選擇
3. **第三層**: Transform Functions - 純格式轉換

#### 🧪 測試與驗證工作流程

**1. 預處理效果驗證**:
```bash
# 生成測試配置
npx tsx scripts/generate-yahoo-tw-configs.ts --type=eps

# 啟用詳細日誌模式測試
npx tsx src/cli.ts --config config/active/test-eps-exclude.json --verbose

# 檢查日誌中的預處理資訊
# [INFO] Preprocessed DOM: removed 5 exclude selector patterns
# [DEBUG] Removed 23 elements matching: .advertisement, [data-module='ad']
# [DEBUG] Removed 8 elements matching: .navigation, .breadcrumb
```

**2. 選擇器精確度測試**:
```javascript
// 在瀏覽器控制台中驗證預處理效果
// 手動執行 exclude selectors
document.querySelectorAll('.advertisement, [data-module="ad"]').forEach(el => el.remove());
document.querySelectorAll('.navigation, .breadcrumb').forEach(el => el.remove());

// 驗證主選擇器結果
const results = document.querySelectorAll('tr:has(td:contains("每股盈餘")) td:last-child');
console.log('清理後選擇器結果:', results.length, results[0]?.textContent);
```

**3. 效能提升測試**:
```typescript
// 測試轉換函數複雜度 (前後對比)
// 無預處理: 50+ 行過濾邏輯 + 複雜判斷
// 有預處理: 3-5 行格式轉換

function benchmarkTransformComplexity() {
  const withoutPreprocess = measureComplexity(complexEPSFilterFunction);
  const withPreprocess = measureComplexity(simpleEPSClean);
  
  console.log(`複雜度降低: ${((withoutPreprocess - withPreprocess) / withoutPreprocess * 100).toFixed(1)}%`);
}
```

#### 🎯 :has() 選擇器優勢

1. **精確定位**: 直接選取包含特定內容的元素，無需後續搜尋
2. **零比對邏輯**: 轉換函數只需處理清理工作，無需複雜比對
3. **零過濾邏輯**: 選擇器保證資料正確性，無需事後過濾
4. **高可讀性**: 選擇器本身就說明了要選取什麼數據
5. **低維護成本**: DOM 結構變化時只需調整選擇器，無需改動轉換邏輯
6. **效能提升**: 避免 JavaScript 中的大量陣列遍歷和字串比對
7. **函數簡化**: 轉換函數只負責格式調整，不負責資料篩選

#### 📝 :has() 選擇器模式庫

```css
/* 表格行選擇模式 */
tr:has(td:contains('關鍵字'))                    /* 選取包含關鍵字的行 */
tr:has(th:contains('標題')) + tr                 /* 選取標題下一行 */
tr:has(td:contains('條件')) td:nth-child(n)      /* 選取符合條件行的第n列 */

/* 相鄰元素選擇模式 */
th:contains('標題') + td                         /* 選取標題後的數據格 */
td:contains('標籤') ~ td                         /* 選取標籤後的所有同級數據格 */
label:contains('欄位名') + input                 /* 選取標籤對應的輸入框 */

/* 父子層級選擇模式 */
div:has(.specific-class) .data-value             /* 選取包含特定類別的容器內的數據 */
section:has(h2:contains('標題')) .content        /* 選取特定標題區段的內容 */
li:has(span:contains('項目')) .value             /* 選取特定項目的數值 */

/* 條件性選擇模式 */
tr:has(td.positive) td:last-child                /* 選取包含正值的行的最後一欄 */
div:has(.error-indicator):not(.hidden)           /* 選取有錯誤指示且可見的元素 */
card:has(.status-active) .details               /* 選取啟用狀態卡片的詳細資訊 */
```

### 獨立選擇器 (Independent Selectors)

**核心概念**: 每個**最終輸出欄位**使用獨立的 CSS 選擇器，選擇器應直接選取該欄位對應的數據，避免選取後再進行複雜解析。選擇器的設計應基於**最終 data 結構的欄位需求**，而非強制依照 DOM 結構分離。

#### ❌ 實際錯誤範例 (yahoo-finance-tw-revenue.json)

**問題描述**: 使用通用選擇器和複雜解析導致數據提取錯誤

```json
{
  "selectors": {
    "allData": {
      "selector": "table td, tbody td, div[class*='table'] div, li div, [class*='cell'], .table-cell",
      "multiple": true,
      "transform": "extractAllTableData"
    },
    "periods": {
      "selector": "table thead th, li div:first-child",
      "multiple": true,
      "transform": "extractPeriods"
    },
    "values": {
      "selector": "table tbody td, li div:nth-child(2)",
      "multiple": true,
      "transform": "extractValues"
    },
    "data": {
      "selector": "body",
      "multiple": false,
      "transform": "transformRevenueData"
    }
  }
}
```

**導致的問題**:
- **數據混淆**: `allData` 選擇器提取所有表格內容，包含股價、營收、其他財務數據
- **錯誤提取**: 營收數據 56,433,621 被誤認為股價數據 1,125,000
- **期間缺失**: 2024-2025 數據完全遺失
- **複雜解析**: `transformRevenueData` 函數需要複雜邏輯解析混合數據

**相同錯誤範例還包括**:
- `yahoo-finance-tw-income-statement.json` - 使用相同的通用選擇器模式
- `yahoo-finance-tw-dividend.json` - 同樣依賴複雜的 `extractPeriods` 和 `extractValues`
- `yahoo-finance-tw-cash-flow-statement.json` - 通用選擇器導致現金流類型混淆
- `yahoo-finance-us-financials.json` - 使用 `structureUSFinancialDataFromCells` 進行複雜解析
- `yahoo-finance-jp-financials.json` - 使用 `structureFinancialDataFromAllTableCells` 解析全表格

#### 📋 選擇器設計決策框架

根據 DOM 結構特性和最終輸出欄位需求，選擇最適合的獨立選擇器策略：

**情況A: DOM 中數據已自然分離**
```json
// ✅ 理想情況 - 直接獨立選擇器對應輸出欄位
{
  "cashDividend": {
    "selector": ".dividend-cash .amount",
    "transform": "cleanNumber"
  },
  "dividendYieldRate": {
    "selector": ".dividend-yield .rate", 
    "transform": "cleanPercentage"
  },
  "fiscalYear": {
    "selector": ".dividend-period .year",
    "transform": "cleanYear"
  }
}
```

**情況B: DOM 中數據混合但可分離選取**
```json
// ✅ 可接受 - 用精確選擇器分別選取各輸出欄位
{
  "cashDividend": {
    "selector": "li:has(:contains('現金股利')) .amount",
    "transform": "cleanNumber"
  },
  "stockDividend": {
    "selector": "li:has(:contains('股票股利')) .amount",
    "transform": "cleanNumber"  
  },
  "fiscalYear": {
    "selector": "li:has(:contains('發放年度')) .year",
    "transform": "cleanYear"
  }
}
```

**情況C: DOM 中數據完全混合無法分離**
```json
// ⚠️ 最後選擇 - 單一選擇器 + 結構化解析
{
  "dividendRecords": {
    "selector": "li .dividend-record-complete",
    "multiple": true,
    "transform": "extractAllDividendFields" // 直接返回包含所有欄位的結構化數據
  }
}
```

```typescript
// 情況C的轉換函數必須直接返回完整的輸出欄位結構
extractAllDividendFields: (content: string[]): DividendData[] => {
  return content.map(record => ({
    fiscalYear: extractYear(record),      // 直接提取年份欄位
    cashDividend: extractAmount(record),  // 直接提取股利金額欄位
    dividendYieldRate: extractRate(record) // 直接提取殖利率欄位
  }));
}
```

#### ✅ 正確做法範例

**每個數據欄位使用專門的 CSS 選擇器**:

```json
{
  "selectors": {
    "stockSymbol": {
      "selector": "h1 .symbol, .stock-name .symbol",
      "multiple": false,
      "transform": "extractStockSymbol"
    },
    "revenuePeriods": {
      "selector": "table.revenue-table thead th.period, .revenue-periods .period-cell",
      "multiple": true,
      "transform": "extractRevenuePeriods"
    },
    "revenueValues": {
      "selector": "table.revenue-table tbody td.revenue-amount, .revenue-data .amount-cell",
      "multiple": true,
      "transform": "extractRevenueValues"
    },
    "revenueGrowthRates": {
      "selector": "table.revenue-table tbody td.growth-rate, .revenue-data .growth-cell",
      "multiple": true,
      "transform": "extractGrowthRates"
    },
    "data": {
      "selector": "body",
      "multiple": false,
      "transform": "combineIndependentRevenueData"
    }
  }
}
```

**對應的轉換函數**:
```typescript
// 每個欄位獨立提取，避免數據混淆
extractRevenuePeriods: (content: string | string[]): string[] => {
  // 專門提取營收期間數據 (如 2025-Q1, 2024-Q4...)
},

extractRevenueValues: (content: string | string[]): number[] => {
  // 專門提取營收數值 (如 56,433,621, 42,851,513...)
},

combineIndependentRevenueData: (content: any, context?: any): UnifiedFinancialData[] => {
  // 組合已提取的獨立數據，確保精確對應
}
```

**優勢**:
- 避免串接問題: 如 `12.5531` (應為 `12.55` + `31%`)
- 精確提取: 每個欄位獨立控制
- 容易調試: 可單獨測試每個選擇器
- 可擴展性: 新增欄位不影響現有邏輯

### 位置獨立選擇器 (Position-Based Independent Selectors)

**高級案例概念**: 當面對複雜 DOM 結構且數據類型需要精確對齊時，使用位置獨立選擇器方法確保每種數據類型從固定位置提取。

#### 實際案例: Yahoo Finance 台灣現金流表

**問題背景**: Yahoo Finance 現金流表數據在垂直結構中排列，不同現金流類型（營業、投資、融資、自由、淨）需要與對應期間精確對齊。

**DOM 結構分析結果**:
```
DOM 位置映射表 (基於實際調試輸出):
├── 期間數據:    位置 105-124 (20個期間: 2025-Q1 ~ 2020-Q2)
├── 營業現金流:  位置 130-149 (20個數值)  
├── 投資現金流:  位置 153-172 (20個數值)
├── 融資現金流:  位置 176-195 (20個數值)
├── 自由現金流:  位置 199-218 (20個數值)
└── 淨現金流:    位置 222-241 (20個數值)
```

#### 位置獨立選擇器實現範例

**1. 配置文件結構**:
```json
{
  "selectors": {
    "fiscalPeriods": {
      "selector": "table td, tbody td, div[class*='table'] div, li div, [class*='cell'], .table-cell",
      "multiple": true,
      "transform": "extractFiscalPeriodsFromPosition"
    },
    "operatingCashFlowRow": {
      "selector": "table td, tbody td, div[class*='table'] div, li div, [class*='cell'], .table-cell",
      "multiple": true,
      "transform": "extractOperatingCashFlowFromPosition"
    },
    "investingCashFlowRow": {
      "selector": "table td, tbody td, div[class*='table'] div, li div, [class*='cell'], .table-cell",
      "multiple": true,
      "transform": "extractInvestingCashFlowFromPosition"
    }
  }
}
```

**2. 位置提取函數實現**:

#### ⚠️ 重要：硬編碼 vs 動態檢測

**調試階段 (可接受的硬編碼)**:
```typescript
// 期間數據提取 (調試確認位置 105-124)
extractFiscalPeriodsFromPosition: (content: string | string[]): string[] => {
  const contentArray = Array.isArray(content) ? content : [content];
  const periods: string[] = [];
  
  // ⚠️ 調試階段：使用硬編碼位置快速驗證
  for (let i = 105; i <= 124 && i < contentArray.length; i++) {
    const trimmed = contentArray[i]?.toString().trim();
    if (trimmed) {
      const periodMatch = trimmed.match(/(20\d{2})\s*[Qq]([1-4])/);
      if (periodMatch) {
        const period = `${periodMatch[1]}-Q${periodMatch[2]}`;
        periods.push(period);
      }
    }
  }
  
  return periods;
}
```

**生產階段 (動態檢測方法)**:
```typescript
// 期間數據提取 (動態位置檢測)
extractFiscalPeriodsFromPosition: (content: string | string[]): string[] => {
  const contentArray = Array.isArray(content) ? content : [content];
  const periods: string[] = [];
  
  // ✅ 生產階段：動態檢測期間數據位置
  let firstPeriodIndex = -1;
  let lastPeriodIndex = -1;
  
  // 第一階段：找到期間數據的開始和結束位置
  for (let i = 0; i < contentArray.length; i++) {
    const trimmed = contentArray[i]?.toString().trim();
    if (trimmed && /(20\d{2})\s*[Qq]([1-4])/.test(trimmed)) {
      if (firstPeriodIndex === -1) {
        firstPeriodIndex = i;
      }
      lastPeriodIndex = i;
    }
  }
  
  // 第二階段：在檢測到的範圍內提取數據
  if (firstPeriodIndex !== -1) {
    for (let i = firstPeriodIndex; i <= lastPeriodIndex && i < contentArray.length; i++) {
      const trimmed = contentArray[i]?.toString().trim();
      if (trimmed) {
        const periodMatch = trimmed.match(/(20\d{2})\s*[Qq]([1-4])/);
        if (periodMatch) {
          const period = `${periodMatch[1]}-Q${periodMatch[2]}`;
          periods.push(period);
        }
      }
    }
  }
  
  return periods;
},

// 營業現金流提取 (動態位置檢測)
extractOperatingCashFlowFromPosition: (content: string | string[]): number[] => {
  const contentArray = Array.isArray(content) ? content : [content];
  const values: number[] = [];
  
  // ✅ 動態檢測：根據期間數據位置推算現金流位置
  let periodEndIndex = -1;
  
  // 找到期間數據的結束位置
  for (let i = 0; i < contentArray.length; i++) {
    const trimmed = contentArray[i]?.toString().trim();
    if (trimmed && /(20\d{2})\s*[Qq]([1-4])/.test(trimmed)) {
      periodEndIndex = i;
    }
  }
  
  // 基於期間結束位置動態推算現金流開始位置
  if (periodEndIndex !== -1) {
    const cashFlowStartIndex = periodEndIndex + 6; // 基於DOM結構的偏移量
    let consecutiveEmptyCount = 0;
    
    for (let i = cashFlowStartIndex; i < contentArray.length; i++) {
      const trimmed = contentArray[i]?.toString().trim();
      
      if (trimmed && /^-?\d{1,3}(,\d{3})*$/.test(trimmed.replace(/[^\d,-]/g, ''))) {
        const cleanValue = trimmed.replace(/[^\d.-]/g, '');
        const numValue = parseInt(cleanValue);
        if (!isNaN(numValue)) {
          values.push(numValue * 1000); // 轉換仟元為元
          consecutiveEmptyCount = 0; // 重置空值計數
        }
      } else {
        consecutiveEmptyCount++;
        // 連續3個非數值項目則停止提取
        if (consecutiveEmptyCount >= 3) break;
      }
    }
  }
  
  return values;
}
```

#### 🔄 開發流程建議

1. **調試階段**: 使用 `debugFieldExtraction` 確定位置範圍
2. **快速驗證**: 使用硬編碼位置驗證提取邏輯
3. **生產實現**: 改為動態檢測方法
4. **測試驗證**: 確保動態檢測在不同情況下都能正常工作

**3. 數據組合函數**:
```typescript
combineIndependentCashFlowData: (content: string | string[]): CashFlowData[] => {
  // 從各自的位置提取數據
  const periods = extractFiscalPeriodsFromPosition(content);
  const operating = extractOperatingCashFlowFromPosition(content);
  const investing = extractInvestingCashFlowFromPosition(content);
  const financing = extractFinancingCashFlowFromPosition(content);
  const free = extractFreeCashFlowFromPosition(content);
  const net = extractNetCashFlowFromPosition(content);
  
  // 確保所有數組長度一致
  const maxLength = Math.max(periods.length, operating.length, investing.length, 
                            financing.length, free.length, net.length);
  
  const results: CashFlowData[] = [];
  for (let i = 0; i < maxLength; i++) {
    if (periods[i] && operating[i] !== undefined) {
      results.push({
        fiscalPeriod: periods[i],
        operatingCashFlow: operating[i] || 0,
        investingCashFlow: investing[i] || 0,
        financingCashFlow: financing[i] || 0,
        freeCashFlow: free[i] || 0,
        netCashFlow: net[i] || 0,
        unit: "元"
      });
    }
  }
  
  return results;
}
```

#### 成功驗證結果

**修復前**: 數據錯位、2020-Q2 缺失、投資現金流數據混亂
**修復後**: 完美對齊，所有 20 個期間和 5 種現金流類型數據正確
```json
{
  "fiscalPeriod": "2020-Q2",
  "operatingCashFlow": 7177447000,    // ✅ 正確
  "investingCashFlow": -1862686000,   // ✅ 正確對齊
  "financingCashFlow": -9663376000,   // ✅ 正確對齊
  "freeCashFlow": 5314761000,         // ✅ 正確對齊
  "netCashFlow": -5900764000,         // ✅ 正確對齊
  "unit": "元"
}
```

#### 位置獨立選擇器關鍵原則

1. **DOM 結構分析優先**: 使用 `debugFieldExtraction` 獲取完整 DOM 數據
2. **精確位置映射**: 為每種數據類型建立固定的位置範圍
3. **獨立提取函數**: 每種數據類型有專用的提取邏輯
4. **類型安全驗證**: 確保提取的數據符合預期格式
5. **長度一致性檢查**: 驗證所有數據數組長度匹配

### 禁止硬編碼軸數據 (No Hard-coded Timeline Data)

**核心概念**: 所有時間軸和期間數據必須動態提取，禁止寫死任何時間相關的數據。

#### ⚠️ 位置選擇器的特殊考量

**重要說明**: 位置獨立選擇器中的位置檢測也應遵循動態原則，但可分階段實現：

1. **調試階段**: 允許使用硬編碼位置進行快速驗證
2. **生產階段**: 必須改為動態位置檢測
3. **文檔範例**: 應同時展示調試和生產兩種方法

#### 錯誤做法
```typescript
// ❌ 硬編碼時間軸數據
const fiscalPeriods = ['2025-Q1', '2024-Q4', '2024-Q3', '2024-Q2'];
const epsValues = [18.43, 14.96, 15.94, 16.19];

// ❌ 硬編碼數據映射
const hardcodedMapping = {
  '2025-Q1': 18.43,
  '2024-Q4': 14.96
};

// ❌ 硬編碼位置範圍 (即使基於調試輸出)
for (let i = 105; i <= 124; i++) {
  // 提取期間數據
}
```

#### 正確做法

**1. 動態內容解析**:
```typescript
// ✅ 純動態提取
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

**2. 動態位置檢測**:
```typescript
// ✅ 動態位置檢測方法
function findDataPositions(contentArray: string[], patterns: RegExp[]): DataPosition[] {
  const positions: DataPosition[] = [];
  
  for (let i = 0; i < contentArray.length; i++) {
    const content = contentArray[i]?.toString().trim();
    
    for (const pattern of patterns) {
      if (content && pattern.test(content)) {
        positions.push({
          index: i,
          content: content,
          type: getDataType(content)
        });
        break;
      }
    }
  }
  
  return positions;
}
```

**3. 階段性開發方法**:
```typescript
// ✅ 開發流程：調試 → 驗證 → 動態化
function extractDataWithFallback(contentArray: string[]): Data[] {
  // 第一階段：嘗試動態檢測
  let positions = findDataPositions(contentArray, DATA_PATTERNS);
  
  // 第二階段：動態檢測失敗時的回退邏輯
  if (positions.length === 0) {
    console.warn('動態檢測失敗，使用回退範圍');
    // 使用較寬的搜索範圍而非硬編碼
    positions = searchInRange(contentArray, 100, 300);
  }
  
  return extractFromPositions(positions);
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
# 執行特定配置 (config/ 目錄中的配置)
npm run crawl yahoo-finance-tw-eps-2454_TW-simple

# 執行 active/ 目錄中的配置 (需要使用 --config 參數)
npx tsx src/cli.ts --config config/active/test-eps.json

# 檢查 TypeScript 錯誤
npm run typecheck

# 列出所有配置
npm run list

# 清理輸出目錄
npm run clean:output
```

## CSS 選擇器開發工作流程

### 完整開發流程 (5 階段方法)

#### 階段 1: 問題診斷
**目標**: 識別數據提取中的問題模式
```bash
# 執行爬蟲並檢查輸出
npx tsx src/cli.ts --config config/active/test-config.json

# 常見問題指標:
# - 缺失期間數據 (如 2020-Q2 missing)
# - 數據錯位 (投資現金流顯示融資現金流數據)
# - 數值異常 (應為負數的項目顯示正數)
```

#### 階段 2: DOM 結構分析
**目標**: 獲取完整的 DOM 數據並理解結構
```json
{
  "allTableCells": {
    "selector": "table td, tbody td, div[class*='table'] div, li div, [class*='cell'], .table-cell",
    "multiple": true,
    "transform": "debugFieldExtraction"
  }
}
```

**分析輸出範例**:
```
[DEBUG] 項目 105: "2025 Q1"     <- 期間數據開始位置
[DEBUG] 項目 106: "2024 Q4"  
[DEBUG] 項目 124: "2020 Q2"     <- 期間數據結束位置
[DEBUG] 項目 130: "13,422,960"  <- 營業現金流開始位置
[DEBUG] 項目 149: "7,177,447"   <- 營業現金流結束位置
[DEBUG] 項目 153: "-7,533,380"  <- 投資現金流開始位置
```

#### 階段 3: 位置映射建立
**目標**: 建立數據類型與位置的精確對應關係
```typescript
// 基於實際 DOM 分析建立位置映射表
const POSITION_MAPPING = {
  fiscalPeriods: { start: 105, end: 124, count: 20 },
  operatingCashFlow: { start: 130, end: 149, count: 20 },
  investingCashFlow: { start: 153, end: 172, count: 20 },
  financingCashFlow: { start: 176, end: 195, count: 20 },
  freeCashFlow: { start: 199, end: 218, count: 20 },
  netCashFlow: { start: 222, end: 241, count: 20 }
};
```

#### 階段 4: 獨立提取函數實現
**目標**: 為每種數據類型創建專用的提取邏輯
```typescript
// 模板: 位置獨立提取函數
extract{DataType}FromPosition: (content: string | string[]): DataType[] => {
  const contentArray = Array.isArray(content) ? content : [content];
  const results: DataType[] = [];
  
  // 使用映射表中的位置範圍
  const { start, end } = POSITION_MAPPING.{dataType};
  for (let i = start; i <= end && i < contentArray.length; i++) {
    const trimmed = contentArray[i]?.toString().trim();
    if (trimmed && isValidData(trimmed)) {
      results.push(parseData(trimmed));
    }
  }
  
  return results;
}
```

#### 階段 5: 驗證與測試
**目標**: 確保所有數據正確對齊和提取
```bash
# 1. 執行完整測試
npx tsx scripts/generate-yahoo-tw-configs.ts --type=cash-flow-statement
npx tsx src/cli.ts --config config/yahoo-finance-tw-cash-flow-statement-2454_TW.json

# 2. 驗證關鍵指標
# ✅ 期間完整性: 檢查是否包含所有預期期間 (如 2020-Q2)
# ✅ 數據對齊性: 確認每個期間的現金流數據正確對應
# ✅ 數值合理性: 驗證數值符合財務邏輯 (營業現金流通常為正)
```

### 獨立檢查方式實用範例

#### 1. 瀏覽器開發者工具驗證
```javascript
// 在 Yahoo Finance 頁面的控制台中執行
const cells = document.querySelectorAll("table td, tbody td, div[class*='table'] div, li div, [class*='cell'], .table-cell");
console.log(`總共找到 ${cells.length} 個元素`);

// 檢查特定位置的數據
console.log("期間數據範例:");
for (let i = 105; i <= 109; i++) {
  console.log(`位置 ${i}: "${cells[i]?.textContent?.trim()}"`);
}

console.log("營業現金流數據範例:");
for (let i = 130; i <= 134; i++) {
  console.log(`位置 ${i}: "${cells[i]?.textContent?.trim()}"`);
}
```

#### 2. TypeScript 類型安全檢查
```bash
# 檢查新增函數的類型定義
npm run typecheck

# 常見類型錯誤檢查清單:
# ✅ YahooFinanceTWTransforms 介面是否包含新函數
# ✅ 返回類型是否匹配 (string[] | number[])
# ✅ 參數類型是否正確 (content: string | string[])
```

#### 3. 配置模板測試流程
```bash
# 1. 在 active/ 目錄中測試單一配置
cp config/templates/yahoo-finance-tw-cash-flow-statement.json config/active/test-cashflow.json
npx tsx src/cli.ts --config config/active/test-cashflow.json

# 2. 檢查輸出結果結構
cat output/test-cashflow_*.json | jq '.results[0].data.independentCashFlowData[0]'

# 3. 驗證數據完整性
cat output/test-cashflow_*.json | jq '.results[0].data.independentCashFlowData | length'  # 應該是 20

# 4. 確認數據對齊
cat output/test-cashflow_*.json | jq '.results[0].data.independentCashFlowData[] | select(.fiscalPeriod == "2020-Q2")'
```

#### 4. 批量驗證命令
```bash
# 生成所有配置並測試第一個
npx tsx scripts/generate-yahoo-tw-configs.ts --type=cash-flow-statement
npx tsx src/cli.ts crawl yahoo-finance-tw-cash-flow-statement-2330_TW

# 檢查所有生成的配置文件
ls config/yahoo-finance-tw-cash-flow-statement-*.json | wc -l  # 應該是 15

# 批量測試 (選擇性)
for config in config/yahoo-finance-tw-cash-flow-statement-233*; do
  echo "測試: $(basename $config)"
  npx tsx src/cli.ts --config "$config" > /dev/null && echo "✅ 成功" || echo "❌ 失敗"
done
```

## 調試技巧

### 1. 選擇器測試
在瀏覽器開發者工具中測試 CSS 選擇器:
```javascript
// 測試基本選擇器
document.querySelectorAll("li div:first-child");
document.querySelectorAll("li div:nth-child(2)");

// 測試複雜選擇器 (適用於複雜 DOM)
document.querySelectorAll("table td, tbody td, div[class*='table'] div, li div, [class*='cell'], .table-cell");
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

[Position Extract] 期間範圍 105-124: 找到 20 個期間
[Position Extract] 營業現金流範圍 130-149: 找到 20 個數值
[Position Extract] ✅ 數據完全對齊: 20 期間 × 5 現金流類型
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
   - **批量更新**: 使用 `npx tsx scripts/generate-yahoo-tw-configs.ts --type=cash-flow-statement` 重新生成所有配置

5. **數據對齊問題 (投資現金流錯位)**: 現金流表中不同類型數據錯位對應
   - **問題症狀**: 
     - 2020-Q2 期間缺失
     - 投資現金流數據顯示為融資現金流的數值
     - 期間與數值無法正確對應
   - **根本原因**: 使用單一選擇器提取所有數據後進行字串解析，導致複雜 DOM 結構中的數據混亂
   - **解決方案**: 採用**位置獨立選擇器方法**
     ```typescript
     // ❌ 錯誤方法: 單一選擇器 + 複雜解析
     "combinedData": {
       "selector": "table td",
       "transform": "parseComplexTableData"
     }
     
     // ✅ 正確方法: 位置獨立選擇器
     "fiscalPeriods": {
       "selector": "table td",
       "transform": "extractFiscalPeriodsFromPosition"  // 位置 105-124
     },
     "operatingCashFlow": {
       "selector": "table td", 
       "transform": "extractOperatingCashFlowFromPosition"  // 位置 130-149
     }
     ```
   - **實施步驟**:
     1. 使用 `debugFieldExtraction` 分析完整 DOM 結構
     2. 建立精確的位置映射表
     3. 為每種數據類型創建專用提取函數
     4. 實現數據組合邏輯確保對齊
   - **驗證結果**: 所有 20 個期間和 5 種現金流類型完美對齊

6. **位置選擇器開發常見錯誤**
   - **錯誤 1**: 硬編碼位置範圍 (違反動態原則)
     ```typescript
     // ❌ 錯誤: 硬編碼位置範圍 (即使基於調試輸出)
     for (let i = 105; i <= 124; i++) // 硬編碼範圍
     
     // ⚠️ 可接受: 調試階段的快速驗證
     // 調試階段：使用硬編碼快速驗證提取邏輯
     for (let i = 105; i <= 124; i++) // 臨時調試用
     
     // ✅ 正確: 生產階段的動態檢測
     let startIndex = findFirstMatchIndex(contentArray, /(20\d{2})\s*[Qq]([1-4])/);
     let endIndex = findLastMatchIndex(contentArray, /(20\d{2})\s*[Qq]([1-4])/);
     for (let i = startIndex; i <= endIndex; i++) // 動態範圍
     ```
   - **錯誤 2**: 數據類型驗證不充分
     ```typescript  
     // ❌ 錯誤: 缺乏數據格式驗證
     const value = parseInt(contentArray[i]);
     
     // ✅ 正確: 完整的數據驗證邏輯
     const trimmed = contentArray[i]?.toString().trim();
     if (trimmed && /^-?\d{1,3}(,\d{3})*$/.test(trimmed.replace(/[^\d,-]/g, ''))) {
       const value = parseInt(trimmed.replace(/[^\d-]/g, ''));
       if (!isNaN(value)) results.push(value);
     }
     ```
   - **錯誤 3**: 忽略數組長度一致性檢查
     ```typescript
     // ❌ 錯誤: 未檢查數組長度匹配
     for (let i = 0; i < periods.length; i++) {
       results.push({ period: periods[i], value: values[i] }); // values[i] 可能 undefined
     }
     
     // ✅ 正確: 確保數組長度一致
     const maxLength = Math.max(periods.length, values.length);
     for (let i = 0; i < maxLength; i++) {
       if (periods[i] && values[i] !== undefined) {
         results.push({ period: periods[i], value: values[i] });
       }
     }
     ```

## 配置生成器開發工作流程 (Config Generator Development Workflow)

### 概述

配置生成器系統允許從模板快速生成多個股票代碼的爬蟲配置，支援批量處理和一致性管理。

### 📁 目錄結構

```
crawler/
├── config/
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

#### config/active/ 目錄用途

`config/active/` 目錄是開發者專用的測試環境，用於：

- **手動配置測試**: 放置手動修改的配置文件進行測試
- **模板原型開發**: 在批量生成前的單一配置原型測試
- **調試專用配置**: 包含特殊選擇器或調試設置的配置
- **臨時修改**: 不影響批量生成配置的臨時修改

#### 開發工作流程

**重要**: 執行 `config/active/` 目錄中的配置文件時，必須使用 `--config` 參數指定完整路徑，而不能使用 `npm run crawl` 命令。

```bash
# 1️⃣ 在 active/ 目錄中創建或複製測試配置
cp config/yahoo-finance-tw-eps-2454_TW.json config/active/test-eps.json

# 2️⃣ 修改 active/ 中的配置進行測試
vim config/active/test-eps.json

# 3️⃣ 測試修改後的配置 (使用 --config 參數指定 active 目錄中的配置)
npx tsx src/cli.ts --config config/active/test-eps.json

# 4️⃣ 確認修改有效後，更新對應的模板
vim config/templates/yahoo-finance-tw-eps.json

# 5️⃣ 重新生成所有相關配置
npx tsx scripts/generate-yahoo-tw-configs.ts --type=eps
```

**注意**: 
- `active/` 目錄的配置不會被生成器覆蓋
- 適合放置實驗性或一次性的配置修改
- 正式修改應該同步到對應的模板文件
- **使用 `--config` 參數**: 執行 active 目錄中的配置必須使用 `npx tsx src/cli.ts --config config/active/<配置名>.json` 方式

### 🛠️ 模板開發流程

#### 1. 創建配置模板

**位置**: `config/templates/yahoo-finance-{region}-{type}.json`

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
npx tsx scripts/generate-yahoo-tw-configs.ts

# 生成特定類型配置 (完整列表)
npx tsx scripts/generate-yahoo-tw-configs.ts --type=balance-sheet
npx tsx scripts/generate-yahoo-tw-configs.ts --type=cash-flow-statement  
npx tsx scripts/generate-yahoo-tw-configs.ts --type=dividend
npx tsx scripts/generate-yahoo-tw-configs.ts --type=eps
npx tsx scripts/generate-yahoo-tw-configs.ts --type=income-statement
npx tsx scripts/generate-yahoo-tw-configs.ts --type=revenue
```

**美國市場**:
```bash
# 生成所有類型配置
npx tsx scripts/generate-yahoo-us-configs.ts

# 生成特定類型配置 (完整列表)
npx tsx scripts/generate-yahoo-us-configs.ts --type=cashflow
npx tsx scripts/generate-yahoo-us-configs.ts --type=financials
```

**日本市場**:
```bash
# 生成所有類型配置 ✅
npx tsx scripts/generate-yahoo-jp-configs.ts

# 生成特定類型配置 (完整列表)
npx tsx scripts/generate-yahoo-jp-configs.ts --type=cashflow
npx tsx scripts/generate-yahoo-jp-configs.ts --type=financials
npx tsx scripts/generate-yahoo-jp-configs.ts --type=performance
```

### 🔄 生成器腳本工作原理

#### 核心流程

1. **模板發現**: 自動掃描 `config/templates/` 目錄中的模板檔案
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
npx tsx scripts/generate-yahoo-tw-configs.ts --type=balance-sheet

# 檢查生成的配置數量和內容
ls config/yahoo-finance-tw-balance-sheet-*.json | wc -l
```

#### 2. 單一配置功能測試

```bash
# 測試生成的配置 (config/ 目錄中的配置)
npm run crawl yahoo-finance-tw-balance-sheet-2454_TW

# 測試 active/ 目錄中的配置 (使用 --config 參數)
npx tsx src/cli.ts --config config/active/test-balance-sheet.json

# 驗證輸出結果
cat output/yahoo-finance-tw-balance-sheet-2454_TW_*.json | jq '.results[0].data'
```

#### 3. 批量處理測試

```bash
# 小批量測試
npx tsx scripts/run-yahoo-tw-balance-sheet-batch.ts --limit=3

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
   **解決**: 確認 `config/templates/` 目錄中存在對應的模板文件

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
cat config/templates/yahoo-finance-tw-balance-sheet.json | jq '.'

# 測試變數替換
node -e "
const template = require('./config/templates/yahoo-finance-tw-balance-sheet.json');
console.log('URL:', template.url);
console.log('Variables:', template.variables);
"

# 驗證生成邏輯
npx tsx scripts/generate-yahoo-tw-configs.ts --type=balance-sheet | head -20
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
📁 輸出目錄: config/
```

### 📋 快速參考指令

#### 台灣股票配置生成
```bash
# 所有類型
npx tsx scripts/generate-yahoo-tw-configs.ts

# 特定類型
npx tsx scripts/generate-yahoo-tw-configs.ts --type=balance-sheet
npx tsx scripts/generate-yahoo-tw-configs.ts --type=cash-flow-statement
npx tsx scripts/generate-yahoo-tw-configs.ts --type=dividend
npx tsx scripts/generate-yahoo-tw-configs.ts --type=eps
npx tsx scripts/generate-yahoo-tw-configs.ts --type=income-statement
npx tsx scripts/generate-yahoo-tw-configs.ts --type=revenue
```

#### 美國股票配置生成
```bash
# 所有類型
npx tsx scripts/generate-yahoo-us-configs.ts

# 特定類型
npx tsx scripts/generate-yahoo-us-configs.ts --type=cashflow
npx tsx scripts/generate-yahoo-us-configs.ts --type=financials
```

#### 日本股票配置生成 ✅
```bash
# 所有類型
npx tsx scripts/generate-yahoo-jp-configs.ts

# 特定類型
npx tsx scripts/generate-yahoo-jp-configs.ts --type=cashflow
npx tsx scripts/generate-yahoo-jp-configs.ts --type=financials
npx tsx scripts/generate-yahoo-jp-configs.ts --type=performance
```

#### 🎯 Exclude Selector 整合驗證

**完整測試指令**:
```bash
# 1. 測試新的 exclude selector 功能 (使用 --config 參數)
npx tsx src/cli.ts --config config/active/test-eps-exclude.json

# 2. 驗證預處理日誌
# 查找類似以下的日誌訊息:
# [INFO] Preprocessed DOM: removed 45 elements using 6 exclude selector patterns
# [DEBUG] Removed 23 elements matching: .advertisement, [data-module='ad']
# [DEBUG] Removed 8 elements matching: .navigation, .nav-menu, .breadcrumb

# 3. 對比無預處理的結果 (使用原始配置)
npx tsx src/cli.ts --config config/yahoo-finance-tw-eps-2330_TW.json

# 4. 檢查輸出差異
diff output/demo_exclude_selector_eps_2330_TW_*.json output/yahoo_finance_tw_eps_2330_TW_*.json
```

**成功指標**:
- **預處理日誌**: 顯示移除的元素數量和模式
- **選擇器精確度**: 無廣告或導航內容混入財務數據  
- **數據質量**: EPS 數據更加純淨和準確
- **效能提升**: 轉換函數執行時間縮短

#### 🚀 最佳實踐整合

**六大核心原則的協同效應**:

1. **:has() 偽類選擇器** + **Exclude Selector** = 雙重精確定位
2. **禁止錯誤數據捉取** + **DOM 預處理** = 源頭品質保證
3. **動態提取** + **預處理清理** = 完全自動化流程
4. **真實常數** + **精確選擇** = 可靠數據驗證

**完整配置範例 (整合六大原則)**:
```json
{
  "templateType": "comprehensive-best-practice",
  "url": "https://tw.stock.yahoo.com/quote/${symbolCode}/eps",
  
  "_principle1_exclude_preprocessing": {
    "excludeSelectors": [
      ".advertisement, [data-module='ad']",
      ".navigation, .breadcrumb", 
      ".social-share, .popup"
    ]
  },
  
  "_principle2_has_selectors": {
    "precisePeriods": "tr:has(td:contains('Q')) th:contains('20')",
    "preciseEPS": "tr:has(td:contains('每股盈餘')) td:nth-last-child(-n+4)"
  },
  
  "_principle3_no_wrong_data": {
    "note": "No generic selectors, no post-filtering transforms"
  },
  
  "_principle4_independent_selectors": {
    "note": "Each data field has dedicated selector"
  },
  
  "_principle5_dynamic_timeline": {
    "note": "All periods extracted dynamically, no hardcoded dates"
  },
  
  "_principle6_real_constants": {
    "note": "Use TW_REVENUE_DATA_CONSTANTS for validation"
  }
}
```

## 版本記錄

- **v1.3.0** (2025-08-07): Exclude Selector 預處理完整實現
  - **核心新增**: 第六核心原則 - Exclude Selector 預處理
  - **技術實現**:
    - ✅ PlaywrightCrawler.ts 新增 `removeExcludedElements()` 方法
    - ✅ DataExtractor.ts 新增 `removeExcludedElementsCheerio()` 方法  
    - ✅ CrawlerConfig 介面擴展 `excludeSelectors?: string[]` 屬性
    - ✅ 雙引擎支援: Playwright `page.evaluate()` + Cheerio `.remove()`
  - **文檔完善**: 
    - 完整的 Exclude Selector 原則說明和應用場景
    - 技術實作架構和效能對比表
    - 實際應用範例和測試驗證工作流程
    - Exclude Selector 模式庫和配置整合指南
  - **範例配置**: 
    - 更新 `yahoo-finance-tw-eps.json` 模板包含 excludeSelectors
    - 創建 `test-eps-exclude.json` 示範配置
  - **驗證結果**: 六大核心原則完整整合，DOM 預處理 → 精確選擇 → 格式轉換的三層架構

- **v1.2.0** (2025-08-05): 位置獨立選擇器方法完善
  - **重大突破**: 完成位置獨立選擇器 (Position-Based Independent Selectors) 方法
  - **核心解決**: Yahoo Finance 台灣現金流表數據對齊問題
    - ✅ 修復 2020-Q2 期間缺失問題
    - ✅ 解決投資現金流數據錯位問題 (原顯示融資現金流數據)
    - ✅ 實現所有 20 個period × 5 種現金流類型完美對齊
  - **技術創新**: 
    - DOM 結構精確分析方法 (位置 105-241 精確映射)
    - 5 階段 CSS 選擇器開發工作流程
    - 獨立檢查方式實用範例 (瀏覽器工具 + TypeScript + 批量驗證)
  - **文檔完善**: 在 CLAUDE.md 中新增完整的位置選擇器開發指南
    - 實際案例: Yahoo Finance 現金流表完整實現
    - 開發流程: 問題診斷 → DOM 分析 → 位置映射 → 獨立實現 → 驗證測試
    - 常見錯誤: 位置範圍、數據驗證、數組長度一致性檢查
  - **驗證結果**: 2454.TW 現金流數據從錯位混亂到完美對齊

- **v1.1.0** (2025-08-05): 配置生成器架構統一化
  - **新增**: 創建 `generate-yahoo-jp-configs.js` 日本配置生成器
  - **統一**: 所有三個區域生成器使用扁平結構輸出到 `config/`
  - **改進**: 標準化生成器輸出格式和命令行參數
  - **文檔**: 新增 `config/active/` 開發環境說明
  - **完成**: yahoo-tw、yahoo-jp、yahoo-us 三區域配置生成器完整支援
  - **說明**: 使用 `config/active/` 目錄中的配置需要 `--config` 參數指定完整路徑

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
- **配置目錄**: `config/`
- **輸出目錄**: `output/`
- **文檔目錄**: `docs/`

---

**最後更新**: 2025-08-04
**開發狀態**: 積極開發中
**核心功能**: Yahoo Finance 多地區財務數據爬取完成

### 重要提醒
遵循六大核心原則: **獨立選擇器搭配 :has() 偽類**、**禁止捉取錯誤資料再事後過濾**、**Exclude Selector 預處理**、**獨立選擇器**、**禁止硬編碼時間軸**、**使用真實數值常數**，確保代碼的可維護性和可擴展性。

**✨ 最高優先原則**: 優先使用 `:has()` 偽類選擇器直接定位包含特定內容的元素，避免大量比對邏輯，減少 parse 錯誤。

**🚫  嚴禁原則**: 絕對禁止使用通用選擇器捉取混雜資料再透過轉換函數進行過濾，這會大幅增加轉換函數的複雜度並降低可維護性。轉換函數只能進行格式調整，不能進行資料篩選。