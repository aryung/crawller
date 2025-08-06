# 爬蟲系統整合指南

**文件版本**: 1.0  
**撰寫日期**: 2025-08-06  
**作者**: AI Assistant  
**專案**: AHA 智投系統 - 爬蟲整合指南  
**目標讀者**: 爬蟲開發團隊

## 1. 整合概述

本指南協助爬蟲團隊將現有的 Yahoo Finance 爬蟲系統與後端 `FundamentalDataEntity` 整合，實現自動化的財務數據匯入。

### 1.1 整合目標
- 統一各地區（台灣、美國、日本）的數據格式
- 自動化數據轉換和驗證流程
- 支援批量匯入到後端資料庫

### 1.2 整合架構
```
爬蟲系統 → 標準化轉換 → JSON 輸出 → API 匯入 → 後端資料庫
```

## 2. 必要修改清單

### 2.1 欄位名稱統一 🔴 高優先級

以下欄位必須統一命名，以支援後端計算：

```typescript
// @crawler/src/transforms/sites/yahoo-finance-tw.ts
// @crawler/src/transforms/sites/yahoo-finance-us.ts  
// @crawler/src/transforms/sites/yahoo-finance-jp.ts

// 營業收入統一
revenue | totalRevenue | operatingRevenue → revenue

// 銷貨成本統一（重要：存貨周轉率計算依賴）
costOfRevenue | costOfGoodsSold → costOfGoodsSold

// 淨利統一
netIncome | netProfit → netIncome

// 股東權益統一
shareholdersEquity | stockholdersEquity | totalEquity → shareholdersEquity

// 資本支出統一
capex | capitalExpenditure → capex
```

### 2.2 新增標準化轉換函數 🔴 高優先級

在每個地區的 transform 檔案中新增標準化函數：

#### 台灣範例 (@crawler/src/transforms/sites/yahoo-finance-tw.ts)
```typescript
/**
 * 轉換為標準化基本面數據格式
 */
export const toStandardizedFundamentalData = {
  // 從現金流量表轉換
  fromCashFlow: (data: TWCashFlowData, symbolCode: string): StandardizedFundamentalData => {
    const [year, quarter] = parseFiscalPeriod(data.fiscalPeriod);
    
    return {
      // 基本資訊
      symbolCode: symbolCode.replace('.TW', ''),
      exchangeArea: 'TW',
      reportDate: new Date().toISOString().split('T')[0],
      fiscalYear: year,
      fiscalQuarter: quarter,
      reportType: 'quarterly',
      
      // 現金流數據（仟元 → 元）
      operatingCashFlow: data.operatingCashFlow ? data.operatingCashFlow * 1000 : undefined,
      investingCashFlow: data.investingCashFlow ? data.investingCashFlow * 1000 : undefined,
      financingCashFlow: data.financingCashFlow ? data.financingCashFlow * 1000 : undefined,
      freeCashFlow: data.freeCashFlow ? data.freeCashFlow * 1000 : undefined,
      netCashFlow: data.netCashFlow ? data.netCashFlow * 1000 : undefined,
      capex: data.capitalExpenditure ? data.capitalExpenditure * 1000 : undefined,
      
      // 元數據
      dataSource: 'yahoo-finance-tw',
      lastUpdated: new Date().toISOString(),
      currencyCode: 'TWD'
    };
  },

  // 從損益表轉換
  fromIncomeStatement: (data: TWIncomeStatementData, symbolCode: string): StandardizedFundamentalData => {
    const [year, quarter] = parseFiscalPeriod(data.fiscalPeriod);
    
    return {
      symbolCode: symbolCode.replace('.TW', ''),
      exchangeArea: 'TW',
      reportDate: new Date().toISOString().split('T')[0],
      fiscalYear: year,
      fiscalQuarter: quarter,
      reportType: 'quarterly',
      
      // 損益表數據（仟元 → 元）
      revenue: data.totalRevenue ? data.totalRevenue * 1000 : undefined,
      grossProfit: data.grossProfit ? data.grossProfit * 1000 : undefined,
      operatingExpenses: data.operatingExpenses ? data.operatingExpenses * 1000 : undefined,
      operatingIncome: data.operatingIncome ? data.operatingIncome * 1000 : undefined,
      netIncome: data.netIncome ? data.netIncome * 1000 : undefined,
      eps: data.basicEPS,
      
      // 新增欄位建議
      incomeBeforeTax: data.incomeBeforeTax ? data.incomeBeforeTax * 1000 : undefined,
      incomeTax: data.incomeTax ? data.incomeTax * 1000 : undefined,
      
      dataSource: 'yahoo-finance-tw',
      lastUpdated: new Date().toISOString(),
      currencyCode: 'TWD'
    };
  },

  // 從資產負債表轉換
  fromBalanceSheet: (data: TWBalanceSheetData, symbolCode: string): StandardizedFundamentalData => {
    const [year, quarter] = parseFiscalPeriod(data.fiscalPeriod);
    
    return {
      symbolCode: symbolCode.replace('.TW', ''),
      exchangeArea: 'TW',
      reportDate: new Date().toISOString().split('T')[0],
      fiscalYear: year,
      fiscalQuarter: quarter,
      reportType: 'quarterly',
      
      // 資產負債表數據（仟元 → 元）
      totalAssets: data.totalAssets ? data.totalAssets * 1000 : undefined,
      currentAssets: data.currentAssets ? data.currentAssets * 1000 : undefined,
      cashAndEquivalents: data.cashAndEquivalents ? data.cashAndEquivalents * 1000 : undefined,
      accountsReceivable: data.accountsReceivable ? data.accountsReceivable * 1000 : undefined,
      inventory: data.inventory ? data.inventory * 1000 : undefined,
      totalLiabilities: data.totalLiabilities ? data.totalLiabilities * 1000 : undefined,
      currentLiabilities: data.currentLiabilities ? data.currentLiabilities * 1000 : undefined,
      accountsPayable: data.accountsPayable ? data.accountsPayable * 1000 : undefined,
      longTermDebt: data.longTermDebt ? data.longTermDebt * 1000 : undefined,
      shortTermDebt: data.shortTermDebt ? data.shortTermDebt * 1000 : undefined,
      shareholdersEquity: (data.stockholdersEquity || data.totalEquity) ? 
        (data.stockholdersEquity || data.totalEquity) * 1000 : undefined,
      bookValuePerShare: data.bookValuePerShare,
      
      // 新增欄位建議
      propertyPlantEquipment: data.propertyPlantEquipment ? data.propertyPlantEquipment * 1000 : undefined,
      intangibleAssets: data.intangibleAssets ? data.intangibleAssets * 1000 : undefined,
      retainedEarnings: data.retainedEarnings ? data.retainedEarnings * 1000 : undefined,
      
      dataSource: 'yahoo-finance-tw',
      lastUpdated: new Date().toISOString(),
      currencyCode: 'TWD'
    };
  },

  // 合併多個報表數據
  mergeFinancialData: (
    incomeData?: StandardizedFundamentalData,
    balanceData?: StandardizedFundamentalData,
    cashFlowData?: StandardizedFundamentalData
  ): StandardizedFundamentalData => {
    return {
      ...incomeData,
      ...balanceData,
      ...cashFlowData,
      // 確保元數據使用最新的
      lastUpdated: new Date().toISOString()
    };
  }
};

// 輔助函數：解析財務期間
function parseFiscalPeriod(period: string): [number, number | undefined] {
  // "2024-Q3" → [2024, 3]
  const quarterMatch = period.match(/(\d{4})-Q(\d)/);
  if (quarterMatch) {
    return [parseInt(quarterMatch[1]), parseInt(quarterMatch[2])];
  }
  
  // "2024/09" → [2024, undefined] (月度數據)
  const monthMatch = period.match(/(\d{4})\/(\d{2})/);
  if (monthMatch) {
    return [parseInt(monthMatch[1]), undefined];
  }
  
  return [new Date().getFullYear(), undefined];
}
```

### 2.3 更新配置模板 🟡 中優先級

更新各報表的配置模板，加入標準化輸出：

#### 範例：現金流量表模板
```json
// @crawler/config/templates/yahoo-finance-tw-cash-flow-statement.json
{
  "selectors": {
    // 現有選擇器...
    "independentCashFlowData": {
      "selector": "body",
      "multiple": false,
      "transform": "combineIndependentCashFlowData"
    },
    
    // 新增：標準化數據輸出
    "standardizedData": {
      "selector": "body",
      "multiple": false,
      "transform": "toStandardizedCashFlowData"
    }
  },
  
  // 新增：輸出配置
  "export": {
    "formats": ["json"],
    "filename": "yahoo_finance_tw_cash_flow_${symbolCode}",
    "includeStandardized": true  // 標記包含標準化數據
  }
}
```

### 2.4 實作新的轉換函數 🟡 中優先級

在 transform 檔案中實作配置所需的轉換函數：

```typescript
/**
 * 轉換現金流數據為標準化格式
 */
toStandardizedCashFlowData: (content: string | string[]): StandardizedFundamentalData => {
  // 先獲取原始數據
  const cashFlowData = yahooFinanceTWTransforms.combineIndependentCashFlowData(content);
  
  if (!cashFlowData || cashFlowData.length === 0) {
    return null;
  }
  
  // 取最新一期數據
  const latestData = cashFlowData[0];
  
  // 從頁面提取股票代碼
  const symbolCode = extractSymbolFromPage(content);
  
  // 轉換為標準化格式
  return toStandardizedFundamentalData.fromCashFlow(latestData, symbolCode);
};

/**
 * 從頁面內容提取股票代碼
 */
function extractSymbolFromPage(content: string | string[]): string {
  const contentStr = Array.isArray(content) ? content.join(' ') : content;
  const match = contentStr.match(/(\d{4})\.TW/);
  return match ? match[0] : '';
}
```

## 3. 單位轉換規則

### 3.1 台灣 (TW) 單位轉換
```typescript
const TW_UNIT_MULTIPLIERS = {
  amount: 1000,        // 仟元 → 元
  percentage: 0.01,    // 百分比 → 小數 (25% → 0.25)
  eps: 1,              // EPS已是元
  shares: 1            // 股數不需轉換
};
```

### 3.2 美國 (US) 單位轉換
```typescript
const US_UNIT_MULTIPLIERS = {
  amount: 1,           // 美元保持不變
  percentage: 0.01,    // 百分比 → 小數
  eps: 1,              // EPS已是美元
  shares: 1            // 股數不需轉換
};
```

### 3.3 日本 (JP) 單位轉換
```typescript
const JP_UNIT_MULTIPLIERS = {
  amount: 1000000,     // 百万円 → 円
  percentage: 0.01,    // 百分比 → 小數
  eps: 1,              // EPS已是円
  shares: 1            // 股數不需轉換
};
```

## 4. 資料驗證實作

### 4.1 基本驗證函數
```typescript
/**
 * 驗證標準化數據的完整性和正確性
 */
export function validateStandardizedData(data: StandardizedFundamentalData): ValidationResult {
  const errors: ValidationError[] = [];
  
  // 必要欄位檢查
  if (!data.symbolCode) {
    errors.push({ field: 'symbolCode', message: '股票代碼不可為空' });
  }
  
  if (!data.exchangeArea || !['TW', 'US', 'JP'].includes(data.exchangeArea)) {
    errors.push({ field: 'exchangeArea', message: '交易所區域無效' });
  }
  
  if (!data.fiscalYear || data.fiscalYear < 2000 || data.fiscalYear > 2100) {
    errors.push({ field: 'fiscalYear', message: '財務年度超出合理範圍' });
  }
  
  // 數值邏輯檢查
  if (data.revenue !== undefined && data.revenue < 0) {
    errors.push({ field: 'revenue', message: '營業收入不可為負數' });
  }
  
  if (data.totalAssets !== undefined && data.currentAssets !== undefined) {
    if (data.currentAssets > data.totalAssets) {
      errors.push({ 
        field: 'currentAssets', 
        message: '流動資產不可大於總資產' 
      });
    }
  }
  
  // 計算必需欄位檢查
  const requiredForCalculation = [
    'revenue',           // 多數比率計算需要
    'costOfGoodsSold',   // 存貨周轉率
    'netIncome',         // ROE、ROA
    'shareholdersEquity', // ROE、負債權益比
    'totalAssets'        // ROA、資產周轉率
  ];
  
  for (const field of requiredForCalculation) {
    if (data[field] === undefined || data[field] === null) {
      errors.push({ 
        field, 
        message: `${field} 是計算財務指標的必要欄位` 
      });
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}
```

### 4.2 邏輯一致性檢查
```typescript
/**
 * 檢查財務數據的邏輯一致性
 */
export function checkLogicalConsistency(data: StandardizedFundamentalData): ConsistencyResult {
  const warnings: string[] = [];
  
  // 資產負債表平衡檢查
  if (data.totalAssets && data.totalLiabilities && data.shareholdersEquity) {
    const balance = data.totalAssets - (data.totalLiabilities + data.shareholdersEquity);
    const tolerance = data.totalAssets * 0.01; // 1%容差
    
    if (Math.abs(balance) > tolerance) {
      warnings.push(`資產負債表不平衡: 差額 ${balance.toLocaleString()}`);
    }
  }
  
  // 毛利率合理性
  if (data.grossProfit && data.revenue) {
    const grossMargin = data.grossProfit / data.revenue;
    if (grossMargin > 1 || grossMargin < -0.5) {
      warnings.push(`毛利率異常: ${(grossMargin * 100).toFixed(2)}%`);
    }
  }
  
  // 負債權益比檢查
  if (data.totalDebt && data.shareholdersEquity && data.shareholdersEquity > 0) {
    const debtToEquity = data.totalDebt / data.shareholdersEquity;
    if (debtToEquity > 10) {
      warnings.push(`負債權益比過高: ${debtToEquity.toFixed(2)}`);
    }
  }
  
  return {
    hasWarnings: warnings.length > 0,
    warnings
  };
}
```

## 5. 批量匯入腳本

### 5.1 匯入腳本範例
```typescript
// @crawler/scripts/import-to-backend.ts

import axios from 'axios';
import fs from 'fs';
import path from 'path';

interface ImportConfig {
  backendUrl: string;
  authToken: string;
  batchSize: number;
}

/**
 * 批量匯入標準化數據到後端
 */
async function importToBackend(config: ImportConfig) {
  const outputDir = path.join(__dirname, '../output');
  const files = fs.readdirSync(outputDir).filter(f => f.includes('standardized'));
  
  console.log(`找到 ${files.length} 個待匯入檔案`);
  
  for (const file of files) {
    try {
      // 讀取標準化數據
      const filePath = path.join(outputDir, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(content);
      
      // 驗證數據
      const validation = validateStandardizedData(data.standardizedData);
      if (!validation.isValid) {
        console.error(`檔案 ${file} 驗證失敗:`, validation.errors);
        continue;
      }
      
      // 呼叫後端 API
      const response = await axios.post(
        `${config.backendUrl}/api/fundamental-data/import`,
        {
          data: [data.standardizedData]
        },
        {
          headers: {
            'Authorization': `Bearer ${config.authToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      console.log(`✅ 成功匯入 ${file}:`, response.data);
      
      // 移動已處理檔案
      const processedDir = path.join(outputDir, 'processed');
      if (!fs.existsSync(processedDir)) {
        fs.mkdirSync(processedDir);
      }
      fs.renameSync(filePath, path.join(processedDir, file));
      
    } catch (error) {
      console.error(`❌ 匯入 ${file} 失敗:`, error.message);
    }
  }
}

// 執行匯入
const config: ImportConfig = {
  backendUrl: process.env.BACKEND_URL || 'http://localhost:3000',
  authToken: process.env.AUTH_TOKEN || '',
  batchSize: 10
};

importToBackend(config).catch(console.error);
```

### 5.2 批次處理優化
```typescript
/**
 * 批次匯入多筆數據
 */
async function batchImport(dataArray: StandardizedFundamentalData[], config: ImportConfig) {
  const batches = [];
  
  // 分批處理
  for (let i = 0; i < dataArray.length; i += config.batchSize) {
    batches.push(dataArray.slice(i, i + config.batchSize));
  }
  
  console.log(`分成 ${batches.length} 批次處理，每批 ${config.batchSize} 筆`);
  
  for (const [index, batch] of batches.entries()) {
    try {
      const response = await axios.post(
        `${config.backendUrl}/api/fundamental-data/import`,
        { data: batch },
        {
          headers: {
            'Authorization': `Bearer ${config.authToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      console.log(`批次 ${index + 1}/${batches.length} 完成:`, response.data);
      
      // 避免過度請求
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      console.error(`批次 ${index + 1} 失敗:`, error.message);
    }
  }
}
```

## 6. 測試檢查清單

### 6.1 單元測試
- [ ] 欄位映射正確性
- [ ] 單位轉換準確性
- [ ] 財務期間解析
- [ ] 資料驗證邏輯

### 6.2 整合測試
- [ ] 爬取真實網頁數據
- [ ] 轉換為標準化格式
- [ ] 驗證通過
- [ ] API 匯入成功

### 6.3 端到端測試範例
```typescript
describe('Yahoo Finance TW Integration', () => {
  it('should crawl and standardize balance sheet data', async () => {
    // 1. 執行爬蟲
    const crawler = new PlaywrightCrawler();
    const config = require('../config/yahoo-finance-tw-balance-sheet-2330_TW.json');
    const rawData = await crawler.crawl(config);
    
    // 2. 轉換為標準化格式
    const standardized = toStandardizedFundamentalData.fromBalanceSheet(
      rawData.results[0].data.balanceSheetData,
      '2330.TW'
    );
    
    // 3. 驗證數據
    expect(standardized.symbolCode).toBe('2330');
    expect(standardized.exchangeArea).toBe('TW');
    expect(standardized.revenue).toBeGreaterThan(0);
    expect(standardized.totalAssets).toBeGreaterThan(standardized.currentAssets);
    
    // 4. 模擬 API 匯入
    const validation = validateStandardizedData(standardized);
    expect(validation.isValid).toBe(true);
  });
});
```

## 7. 常見問題處理

### 7.1 Q: 某些欄位在特定地區沒有數據怎麼辦？
A: 保留為 `undefined`，後端會處理缺失值。但計算必需的欄位（如 revenue, netIncome）應該警告。

### 7.2 Q: 如何處理不同的財務年度定義？
A: 日本財年特殊處理（4月開始），在 `parseFiscalPeriod` 函數中實作邏輯。

### 7.3 Q: 遇到新的欄位該如何處理？
A: 
1. 評估是否為計算必需
2. 如果是，加入必要欄位清單
3. 如果否，考慮加入 `regionalData` JSON 欄位

### 7.4 Q: 如何確保數據新鮮度？
A: 
1. 記錄 `lastUpdated` 時間戳
2. 後端可設定資料過期時間
3. 定期執行爬蟲更新

## 8. 聯絡資訊

- **後端 API 文檔**: http://localhost:3000/api-docs
- **測試環境**: http://test-api.aha.credit
- **問題回報**: 請在 GitHub Issues 中標記 `crawler-integration`

---

**文件結束**
