# CSS 選擇器最佳實踐指南

## 📚 目錄
1. [核心概念](#核心概念)
2. [高級選擇器](#高級選擇器)
3. [Yahoo Finance Taiwan 實戰案例](#yahoo-finance-taiwan-實戰案例)
4. [測試與調試技巧](#測試與調試技巧)
5. [常見錯誤與解決方案](#常見錯誤與解決方案)

## 核心概念

### 選擇器優先級原則
1. **精確性優先**: 使用最具體的選擇器，避免過於通用
2. **語義化選擇**: 優先使用 `:has()` 等語義選擇器
3. **位置獨立**: 避免依賴絕對位置，使用相對關係

## 高級選擇器

### :has() 偽類選擇器
`:has()` 選擇器允許選擇包含特定子元素的父元素，是現代 CSS 最強大的功能之一。

#### 基本語法
```css
/* 選擇包含特定子元素的父元素 */
div:has(> span)              /* 直接子元素 */
div:has(span)                 /* 任意後代元素 */
div:has(> span.active)        /* 特定類別的直接子元素 */
```

#### 實際應用範例
```css
/* 選擇有非空期間欄位的表格行 */
div.table-row:has(> div:nth-child(2):not(:empty))

/* 選擇包含特定文字的行 */
tr:has(td:contains('營業收入'))

/* 組合多個條件 */
li:has(> div:nth-child(2):not(:empty)):has(> div:nth-child(3))
```

### :not() 偽類選擇器
`:not()` 用於排除符合特定條件的元素。

#### 基本語法
```css
/* 排除空元素 */
div:not(:empty)

/* 排除特定類別 */
.item:not(.hidden)

/* 組合排除條件 */
div:not(:empty):not(.ad)
```

#### 實際應用範例
```css
/* 選擇非空的期間欄位 */
div:nth-child(2):not(:empty)

/* 排除廣告和導航元素 */
div:not(.advertisement):not(.navigation)
```

### nth-child() 選擇器
`nth-child()` 用於選擇特定位置的子元素。

#### 基本語法
```css
/* 選擇特定位置 */
div:nth-child(2)              /* 第2個子元素 */
div:nth-child(n+2)            /* 從第2個開始的所有元素 */
div:nth-child(2n)             /* 所有偶數位置 */
div:nth-child(2n+1)           /* 所有奇數位置 */
```

#### 實際應用範例
```css
/* 股息表格的欄位選擇 */
div.table-row > div:nth-child(1)    /* 發放期間 */
div.table-row > div:nth-child(2)    /* 所屬期間 */
div.table-row > div:nth-child(3)    /* 現金股利 */
div.table-row > div:nth-child(4)    /* 股票股利 */
```

## Yahoo Finance Taiwan 實戰案例

### 案例1: 股息數據提取

#### 問題描述
需要從股息頁面提取期間、現金股利、股票股利，並確保數據對齊。

#### HTML 結構
```html
<ul>
  <li>
    <div class="table-row">
      <div>2025/04/10</div>  <!-- 發放期間 -->
      <div>2025Q1</div>       <!-- 所屬期間 -->
      <div>5.00</div>         <!-- 現金股利 -->
      <div>-</div>            <!-- 股票股利 -->
    </div>
  </li>
  <li>
    <div class="table-row">
      <div>2025/01/10</div>
      <div>2024Q4</div>
      <div>4.5000</div>
      <div>-</div>
    </div>
  </li>
</ul>
```

#### 選擇器設計
```json
{
  "dividendPeriods": {
    "selector": "ul > li > div.table-row > div:nth-child(2):not(:empty)",
    "multiple": true,
    "transform": "extractDividendPeriodsSeparately"
  },
  "cashDividends": {
    "selector": "ul > li > div.table-row:has(> div:nth-child(2):not(:empty)) > div:nth-child(3)",
    "multiple": true,
    "transform": "extractCashDividendsSeparately"
  },
  "stockDividends": {
    "selector": "ul > li > div.table-row:has(> div:nth-child(2):not(:empty)) > div:nth-child(4)",
    "multiple": true,
    "transform": "extractStockDividendsSeparately"
  }
}
```

#### 關鍵技巧
1. **使用 `:has()` 確保數據對齊**: 只選擇有期間值的行的股利數據
2. **使用 `:not(:empty)` 過濾空值**: 確保只選擇有效數據
3. **使用 `nth-child()` 精確定位**: 根據固定的欄位順序選擇

### 案例2: 財務報表數據提取

#### 選擇器設計
```json
{
  "periods": {
    "selector": "div.table-header > div.table-header-wrapper > div:nth-child(n+2)",
    "multiple": true
  },
  "revenueValues": {
    "selector": "ul > li:nth-child(1) > div > div:nth-child(n+2)",
    "multiple": true
  },
  "netIncomeValues": {
    "selector": "ul > li:nth-child(5) > div > div:nth-child(n+2)",
    "multiple": true
  }
}
```

#### 關鍵技巧
1. **使用 `n+2` 跳過標題欄**: 從第2個元素開始選擇
2. **使用位置索引對應數據類型**: `li:nth-child(1)` 對應營收
3. **保持選擇器結構一致**: 確保數據可以正確對齊

## 測試與調試技巧

### 瀏覽器開發者工具測試

#### 1. 在 Chrome/Edge DevTools Console 測試
```javascript
// 測試選擇器是否正確
document.querySelectorAll("ul > li > div.table-row > div:nth-child(2):not(:empty)")

// 查看選擇的元素內容
Array.from(document.querySelectorAll("div.table-row > div:nth-child(3)"))
  .map(el => el.textContent.trim())

// 測試 :has() 選擇器（需要較新版本瀏覽器）
document.querySelectorAll("div.table-row:has(> div:nth-child(2):not(:empty))")
```

#### 2. 使用 jQuery 測試（如果頁面有jQuery）
```javascript
// jQuery 支援更多選擇器
$("tr:has(td:contains('營業收入'))")
$("div:not(:empty)")
```

### Playwright 測試
```javascript
// 在 Playwright 中測試選擇器
const periods = await page.$$eval(
  "ul > li > div.table-row > div:nth-child(2):not(:empty)",
  elements => elements.map(el => el.textContent.trim())
);
console.log('期間:', periods);
```

### 調試配置文件
```json
{
  "selectors": {
    "debugField": {
      "selector": "your-selector-here",
      "transform": "debugFieldExtraction"  // 使用調試函數查看原始數據
    }
  }
}
```

## 常見錯誤與解決方案

### 錯誤1: 數據數量不匹配

**問題**: 期間有 44 個，但股利值有 53 個

**原因**: 選擇器選到了不相關的元素

**解決方案**:
```css
/* ❌ 錯誤：選擇所有 div，包括空值和其他數據 */
div.table-row > div

/* ✅ 正確：只選擇有期間值的行的特定欄位 */
div.table-row:has(> div:nth-child(2):not(:empty)) > div:nth-child(3)
```

### 錯誤2: 選擇器過於通用

**問題**: 選到頁面上其他區域的數據

**解決方案**:
```css
/* ❌ 錯誤：太通用 */
div:contains('2025')

/* ✅ 正確：加上結構限制 */
ul > li > div.table-row > div:nth-child(2):contains('2025')
```

### 錯誤3: 依賴絕對位置

**問題**: 頁面結構變化時選擇器失效

**解決方案**:
```css
/* ❌ 錯誤：硬編碼位置 */
body > div:nth-child(5) > div:nth-child(3) > ul > li:nth-child(1)

/* ✅ 正確：使用相對關係和類別 */
div.table-container ul > li > div.table-row
```

### 錯誤4: :has() 瀏覽器兼容性

**問題**: 舊版瀏覽器不支援 `:has()`

**解決方案**:
1. 確保使用 Playwright/Puppeteer 的較新版本
2. 在配置中強制使用 Playwright 模式：
```json
{
  "options": {
    "engine": "playwright",
    "forceEngine": "playwright"
  }
}
```

## 最佳實踐總結

### ✅ DO (建議做法)
1. **使用語義化選擇器**: 優先使用 `:has()`, `:not()` 等
2. **測試選擇器**: 在瀏覽器控制台先測試
3. **保持簡潔**: 選擇器應該簡單明瞭
4. **考慮維護性**: 避免過度依賴頁面結構
5. **文檔化**: 為複雜選擇器添加註釋

### ❌ DON'T (避免做法)
1. **避免過長的選擇器鏈**: 超過 5 層就該重新考慮
2. **避免硬編碼索引**: 除非結構固定
3. **避免通用選擇器**: 如 `div`, `span` 不加限制
4. **避免正則表達式選擇**: CSS 不支援正則
5. **避免依賴動態生成的類名**: 如 `class="css-1x2y3z"`

## 參考資源

- [MDN :has() 選擇器文檔](https://developer.mozilla.org/en-US/docs/Web/CSS/:has)
- [MDN :not() 選擇器文檔](https://developer.mozilla.org/en-US/docs/Web/CSS/:not)
- [MDN :nth-child() 選擇器文檔](https://developer.mozilla.org/en-US/docs/Web/CSS/:nth-child)
- [Playwright 選擇器文檔](https://playwright.dev/docs/selectors)
- [Can I Use :has()](https://caniuse.com/css-has)

---

*最後更新: 2025-08-07*
*作者: AHA Crawler System*