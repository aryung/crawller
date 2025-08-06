# 爬蟲資料標準化實作計劃

**文件版本**: 1.0  
**撰寫日期**: 2025-08-06  
**作者**: AI Assistant  
**專案**: AHA 智投系統 - 爬蟲標準化改進

## 1. 執行摘要

本文件詳細規劃爬蟲系統輸出標準化的實作方案，確保爬蟲資料可以直接匯入後端 `FundamentalDataEntity` 資料表。

### 1.1 核心目標

- 統一各地區（台灣、美國、日本）的資料格式
- 確保欄位名稱與後端資料庫完全一致
- 正確處理各地區的單位轉換
- 提供可直接匯入的標準化資料

### 1.2 單位轉換需求

| 地區 | 資料類型 | 原始單位 | 目標單位 | 轉換方式 |
|------|---------|---------|----------|---------|
| **美國** | financials | 千美元 | 美元 | × 1000 |
| **美國** | cash-flow | 美元 | 美元 | 直接使用 |
| **日本** | performance | 円 | 円 | 直接使用（已轉換） |
| **日本** | financials | 円 | 円 | 直接使用（已轉換） |
| **台灣** | 所有報表 | 元 | 元 | 直接使用（已轉換） |

## 2. 標準化資料格式定義

### 2.1 介面定義

```typescript
interface StandardizedFundamentalData {
  // === 基本資訊 (與後端欄位名稱完全一致) ===
  symbolCode: string;        // 股票代碼 (不含 .TW/.T 後綴)
  exchangeArea: string;      // "TW" | "US" | "JP"
  reportDate: string;        // ISO 日期格式 "2024-09-30"
  fiscalYear: number;        // 2024
  fiscalQuarter?: number;    // 1-4 (季度報表)
  fiscalMonth?: number;      // 1-12 (月度報表，日本年報用 3)
  reportType: string;        // "quarterly" | "annual" | "monthly"
  
  // === 損益表欄位 (Income Statement) ===
  revenue?: number;          // 營業收入 (基礎單位)
  costOfGoodsSold?: number;  // 銷貨成本
  grossProfit?: number;      // 毛利
  operatingExpenses?: number;// 營業費用
  operatingIncome?: number;  // 營業利益
  interestExpense?: number;  // 利息費用
  taxExpense?: number;       // 所得稅費用
  incomeBeforeTax?: number;  // 稅前淨利
  incomeTax?: number;        // 所得稅
  netIncome?: number;        // 淨利
  ebitda?: number;           // EBITDA
  eps?: number;              // 每股盈餘
  dilutedEPS?: number;       // 稀釋每股盈餘
  
  // === 資產負債表欄位 (Balance Sheet) ===
  totalAssets?: number;      // 總資產
  currentAssets?: number;    // 流動資產
  inventory?: number;        // 存貨
  accountsReceivable?: number; // 應收帳款
  totalLiabilities?: number; // 總負債
  currentLiabilities?: number; // 流動負債
  accountsPayable?: number;  // 應付帳款
  shareholdersEquity?: number; // 股東權益
  totalDebt?: number;        // 總債務
  longTermDebt?: number;     // 長期負債
  shortTermDebt?: number;    // 短期負債
  cashAndEquivalents?: number; // 現金及約當現金
  workingCapital?: number;   // 營運資金
  bookValuePerShare?: number;// 每股淨值
  propertyPlantEquipment?: number; // 不動產廠房設備
  intangibleAssets?: number; // 無形資產
  retainedEarnings?: number; // 保留盈餘
  
  // === 現金流量表欄位 (Cash Flow Statement) ===
  operatingCashFlow?: number; // 營運現金流
  investingCashFlow?: number; // 投資現金流
  financingCashFlow?: number; // 融資現金流
  netCashFlow?: number;       // 淨現金流
  freeCashFlow?: number;      // 自由現金流
  capex?: number;             // 資本支出
  dividendPayments?: number;  // 股利支付
  debtIssuance?: number;      // 債務發行
  debtRepayment?: number;     // 債務償還
  
  // === 財務比率 (Financial Ratios) ===
  peRatio?: number;           // 本益比
  pbRatio?: number;           // 股價淨值比
  roe?: number;               // 股東權益報酬率 (小數格式)
  roa?: number;               // 資產報酬率 (小數格式)
  grossMargin?: number;       // 毛利率 (小數格式)
  operatingMargin?: number;   // 營業利益率 (小數格式)
  netMargin?: number;         // 淨利率 (小數格式)
  currentRatio?: number;      // 流動比率
  debtToEquity?: number;      // 負債權益比
  dividendYield?: number;     // 股息殖利率 (小數格式)
  
  // === 市場數據 (Market Data) ===
  sharesOutstanding?: number; // 流通股數
  marketCap?: number;         // 市值
  dividendPerShare?: number;  // 每股股利
  
  // === 地區特有欄位 (Regional Specific) ===
  regionalData?: {
    // 日本特有
    ordinaryProfit?: number;     // 經常利益
    ordinaryMargin?: number;     // 經常利益率
    equityRatio?: number;        // 自有資本比率
    capital?: number;            // 資本金
    // 其他地區特有欄位...
  };
  
  // === 元數據 (Metadata) ===
  dataSource: string;         // 資料來源
  lastUpdated: string;        // 最後更新時間 (ISO timestamp)
}
```

## 3. 實作細節

### 3.1 台灣資料轉換 (yahoo-finance-tw.ts)

#### 3.1.1 現金流表轉換

```typescript
export const toStandardizedFundamentalData = {
  fromCashFlow: (data: TWCashFlowData, symbolCode: string): StandardizedFundamentalData => {
    const [year, quarter] = parseFiscalPeriod(data.fiscalPeriod); // "2025-Q1" → 2025, 1
    
    return {
      // 基本資訊
      symbolCode: symbolCode.replace('.TW', ''),
      exchangeArea: 'TW',
      reportDate: new Date().toISOString().split('T')[0],
      fiscalYear: year,
      fiscalQuarter: quarter,
      reportType: 'quarterly',
      
      // 現金流數據（單位已是元，直接使用）
      operatingCashFlow: data.operatingCashFlow,
      investingCashFlow: data.investingCashFlow,
      financingCashFlow: data.financingCashFlow,
      freeCashFlow: data.freeCashFlow,
      netCashFlow: data.netCashFlow,
      
      // 元數據
      dataSource: 'yahoo-finance-tw',
      lastUpdated: new Date().toISOString()
    };
  }
};
```

#### 3.1.2 損益表轉換

```typescript
fromIncomeStatement: (data: TWIncomeStatementData, symbolCode: string): StandardizedFundamentalData => {
  const [year, quarter] = parseFiscalPeriod(data.fiscalPeriod);
  
  return {
    // 基本資訊
    symbolCode: symbolCode.replace('.TW', ''),
    exchangeArea: 'TW',
    reportDate: new Date().toISOString().split('T')[0],
    fiscalYear: year,
    fiscalQuarter: quarter,
    reportType: 'quarterly',
    
    // 損益表數據（單位已是元）
    revenue: data.totalRevenue || data.operatingRevenue,
    costOfGoodsSold: data.costOfGoodsSold,
    grossProfit: data.grossProfit,
    operatingExpenses: data.operatingExpenses,
    operatingIncome: data.operatingIncome,
    incomeBeforeTax: data.incomeBeforeTax,
    incomeTax: data.incomeTax,
    netIncome: data.netIncome,
    eps: data.basicEPS,
    dilutedEPS: data.dilutedEPS,
    
    // 元數據
    dataSource: 'yahoo-finance-tw',
    lastUpdated: new Date().toISOString()
  };
}
```

#### 3.1.3 資產負債表轉換

```typescript
fromBalanceSheet: (data: TWBalanceSheetData, symbolCode: string): StandardizedFundamentalData => {
  // 類似的映射邏輯
  totalAssets: data.totalAssets,
  currentAssets: data.currentAssets,
  cashAndEquivalents: data.cashAndEquivalents,
  accountsReceivable: data.accountsReceivable,
  inventory: data.inventory,
  totalLiabilities: data.totalLiabilities,
  currentLiabilities: data.currentLiabilities,
  accountsPayable: data.accountsPayable,
  shareholdersEquity: data.stockholdersEquity || data.totalEquity,
  longTermDebt: data.longTermDebt,
  shortTermDebt: data.shortTermDebt,
  retainedEarnings: data.retainedEarnings,
  bookValuePerShare: data.bookValuePerShare,
  propertyPlantEquipment: data.propertyPlantEquipment,
  intangibleAssets: data.intangibleAssets
}
```

### 3.2 美國資料轉換 (yahoo-finance-us.ts)

#### 3.2.1 財務報表轉換 (Financials - 需要單位轉換)

```typescript
export const toStandardizedFundamentalData = {
  fromFinancials: (data: USFinancialData, symbolCode: string): StandardizedFundamentalData => {
    // 日期格式轉換
    const reportDate = convertUSDateFormat(data.fiscalPeriod); // "9/30/2024" → "2024-09-30"
    const isAnnual = !data.fiscalPeriod.includes('Q');
    const fiscalYear = new Date(reportDate).getFullYear();
    
    return {
      // 基本資訊
      symbolCode: symbolCode, // AAPL (美國不需要去除後綴)
      exchangeArea: 'US',
      reportDate: reportDate,
      fiscalYear: fiscalYear,
      fiscalQuarter: isAnnual ? undefined : getQuarterFromMonth(reportDate),
      reportType: isAnnual ? 'annual' : 'quarterly',
      
      // 損益表數據（千美元 × 1000 → 美元）
      revenue: data.totalRevenue ? data.totalRevenue * 1000 : undefined,
      costOfGoodsSold: data.costOfRevenue ? data.costOfRevenue * 1000 : undefined,
      grossProfit: data.grossProfit ? data.grossProfit * 1000 : undefined,
      operatingExpenses: data.operatingExpense ? data.operatingExpense * 1000 : undefined,
      operatingIncome: data.operatingIncome ? data.operatingIncome * 1000 : undefined,
      incomeBeforeTax: data.pretaxIncome ? data.pretaxIncome * 1000 : undefined,
      taxExpense: data.taxProvision ? data.taxProvision * 1000 : undefined,
      netIncome: data.netIncomeCommonStockholders ? data.netIncomeCommonStockholders * 1000 : undefined,
      ebitda: data.ebitda ? data.ebitda * 1000 : undefined,
      
      // EPS 不需轉換
      eps: data.basicEPS,
      dilutedEPS: data.dilutedEPS,
      
      // 元數據
      dataSource: 'yahoo-finance-us',
      lastUpdated: new Date().toISOString()
    };
  }
};
```

#### 3.2.2 現金流表轉換 (Cash Flow - 單位已是美元)

```typescript
fromCashFlow: (data: USCashFlowData, symbolCode: string): StandardizedFundamentalData => {
  const reportDate = convertUSDateFormat(data.fiscalPeriod);
  const isAnnual = !data.fiscalPeriod.includes('Q');
  
  return {
    // 基本資訊
    symbolCode: symbolCode,
    exchangeArea: 'US',
    reportDate: reportDate,
    fiscalYear: new Date(reportDate).getFullYear(),
    fiscalQuarter: isAnnual ? undefined : getQuarterFromMonth(reportDate),
    reportType: isAnnual ? 'annual' : 'quarterly',
    
    // 現金流數據（單位已是美元，直接使用）
    operatingCashFlow: data.operatingCashFlow,
    investingCashFlow: data.investingCashFlow,
    financingCashFlow: data.financingCashFlow,
    freeCashFlow: data.freeCashFlow,
    capex: data.capitalExpenditure,
    debtIssuance: data.issuanceOfDebt,
    debtRepayment: data.repaymentOfDebt,
    
    // 元數據
    dataSource: 'yahoo-finance-us',
    lastUpdated: new Date().toISOString()
  };
}
```

### 3.3 日本資料轉換 (yahoo-finance-jp.ts)

#### 3.3.1 業績數據轉換 (Performance - 單位已是円)

```typescript
export const toStandardizedFundamentalData = {
  fromPerformance: (data: FinancialData, symbolCode: string): StandardizedFundamentalData => {
    // 期間解析
    const fiscalYear = parseFiscalYear(data.fiscalPeriod); // "2025年3月期" → 2025
    
    return {
      // 基本資訊
      symbolCode: symbolCode.replace('.T', ''),
      exchangeArea: 'JP',
      reportDate: `${fiscalYear}-03-31`, // 日本財年結束日
      fiscalYear: fiscalYear,
      fiscalMonth: 3, // 日本年報都是3月
      reportType: 'annual',
      
      // 損益表數據（單位已是円，直接使用）
      revenue: data.revenue,
      grossProfit: data.grossProfit,
      operatingIncome: data.operatingProfit,
      netIncome: data.netProfit,
      
      // 財務比率（百分比轉小數）
      grossMargin: data.grossMargin ? data.grossMargin / 100 : undefined,
      operatingMargin: data.operatingMargin ? data.operatingMargin / 100 : undefined,
      
      // 地區特有欄位
      regionalData: {
        ordinaryProfit: data.ordinaryProfit,
        ordinaryMargin: data.ordinaryMargin ? data.ordinaryMargin / 100 : undefined,
        capital: data.capital
      },
      
      // 元數據
      dataSource: 'yahoo-finance-jp',
      lastUpdated: new Date().toISOString()
    };
  }
};
```

#### 3.3.2 財務數據轉換 (Financials - 單位已是円)

```typescript
fromFinancials: (data: FinancialData, symbolCode: string): StandardizedFundamentalData => {
  const fiscalYear = parseFiscalYear(data.fiscalPeriod);
  
  return {
    // 基本資訊
    symbolCode: symbolCode.replace('.T', ''),
    exchangeArea: 'JP',
    reportDate: `${fiscalYear}-03-31`,
    fiscalYear: fiscalYear,
    fiscalMonth: 3,
    reportType: 'annual',
    
    // 財務數據（單位已是円，直接使用）
    eps: data.eps,
    bookValuePerShare: data.bps,
    totalAssets: data.totalAssets,
    
    // 財務比率（已是小數格式）
    roe: data.roe,
    roa: data.roa,
    
    // 地區特有欄位
    regionalData: {
      equityRatio: data.equityRatio,
      capital: data.capital
    },
    
    // 元數據
    dataSource: 'yahoo-finance-jp',
    lastUpdated: new Date().toISOString()
  };
}
```

## 4. 實施計劃

### Phase 1: 爬蟲端標準化轉換函數開發 (2天)

**Day 1**:
- [ ] 在 `src/types/` 新增 `standardized.ts` 定義標準化介面
- [ ] 實作台灣資料轉換函數
- [ ] 實作美國資料轉換函數

**Day 2**:
- [ ] 實作日本資料轉換函數
- [ ] 為每個轉換函數撰寫單元測試
- [ ] 更新所有配置模板加入標準化輸出

### Phase 2: 輸出整合 (1天)

- [ ] 修改 DataExtractor 確保輸出包含標準化資料
- [ ] 保留原始資料格式以確保向後相容
- [ ] 更新輸出檔案結構文檔

### Phase 3: 測試與驗證 (1天)

- [ ] 執行完整的端到端測試
- [ ] 驗證各地區資料格式一致性
- [ ] 確認單位轉換正確性
- [ ] 測試與後端資料庫的相容性

## 5. 驗收標準

### 5.1 功能驗收

- [ ] 支援台灣、美國、日本三地區資料標準化
- [ ] 欄位名稱與後端 `FundamentalDataEntity` 完全一致
- [ ] 單位轉換正確無誤
- [ ] 保留原始資料格式（向後相容）

### 5.2 資料品質驗收

- [ ] 所有必要欄位都有正確映射
- [ ] 財務比率使用小數格式（0.15 = 15%）
- [ ] 日期格式統一為 ISO 格式
- [ ] 地區特有欄位存入 regionalData

### 5.3 技術驗收

- [ ] 單元測試覆蓋率 > 80%
- [ ] TypeScript 類型定義完整
- [ ] 文檔更新完整
- [ ] 程式碼通過 ESLint 檢查

## 6. 欄位映射對照表

### 6.1 損益表欄位映射

| 標準欄位 | 台灣 | 美國 | 日本 | 單位處理 |
|---------|------|------|------|---------|
| revenue | totalRevenue/operatingRevenue | totalRevenue | revenue | TW/JP: 直接使用<br>US: ×1000 |
| costOfGoodsSold | costOfGoodsSold | costOfRevenue | - | TW: 直接使用<br>US: ×1000 |
| grossProfit | grossProfit | grossProfit | grossProfit | TW/JP: 直接使用<br>US: ×1000 |
| operatingIncome | operatingIncome | operatingIncome | operatingProfit | TW/JP: 直接使用<br>US: ×1000 |
| netIncome | netIncome | netIncomeCommonStockholders | netProfit | TW/JP: 直接使用<br>US: ×1000 |
| eps | basicEPS | basicEPS | eps | 不轉換 |
| dilutedEPS | dilutedEPS | dilutedEPS | - | 不轉換 |

### 6.2 資產負債表欄位映射

| 標準欄位 | 台灣 | 美國 | 日本 | 單位處理 |
|---------|------|------|------|---------|
| totalAssets | totalAssets | totalAssets | totalAssets | TW/JP: 直接使用<br>US: ×1000 |
| currentAssets | currentAssets | currentAssets | - | TW: 直接使用<br>US: ×1000 |
| cashAndEquivalents | cashAndEquivalents | cashAndEquivalents | - | TW: 直接使用<br>US: ×1000 |
| shareholdersEquity | stockholdersEquity/totalEquity | shareholdersEquity | - | TW: 直接使用<br>US: ×1000 |
| bookValuePerShare | bookValuePerShare | bookValuePerShare | bps | 不轉換 |

### 6.3 現金流量表欄位映射

| 標準欄位 | 台灣 | 美國 | 日本 | 單位處理 |
|---------|------|------|------|---------|
| operatingCashFlow | operatingCashFlow | operatingCashFlow | - | TW/US(cash-flow): 直接使用 |
| investingCashFlow | investingCashFlow | investingCashFlow | - | TW/US(cash-flow): 直接使用 |
| financingCashFlow | financingCashFlow | financingCashFlow | - | TW/US(cash-flow): 直接使用 |
| freeCashFlow | freeCashFlow | freeCashFlow | - | TW/US(cash-flow): 直接使用 |
| capex | capitalExpenditure | capitalExpenditure | - | TW/US(cash-flow): 直接使用 |

### 6.4 財務比率映射

| 標準欄位 | 台灣 | 美國 | 日本 | 格式 |
|---------|------|------|------|------|
| roe | roe | roe | roe | 小數格式 (0.15 = 15%) |
| roa | roa | roa | roa | 小數格式 |
| grossMargin | grossMargin | grossMargin | grossMargin/100 | 小數格式 |
| operatingMargin | operatingMargin | operatingMargin | operatingMargin/100 | 小數格式 |

## 7. 風險與緩解措施

### 7.1 技術風險

| 風險項目 | 影響程度 | 發生機率 | 緩解措施 |
|---------|---------|---------|---------|
| Yahoo Finance 格式變更 | 高 | 中 | 建立格式監控機制，快速響應變更 |
| 單位轉換錯誤 | 高 | 低 | 完整測試覆蓋，建立驗證機制 |
| 欄位映射遺漏 | 中 | 中 | 建立欄位檢查清單，定期審查 |
| 效能問題 | 低 | 低 | 優化轉換邏輯，使用快取機制 |

### 7.2 資料品質風險

- **缺失值處理**: 使用 undefined 而非 null，符合 TypeScript 慣例
- **異常值檢測**: 建立合理範圍檢查機制
- **一致性檢查**: 確保相關欄位邏輯一致（如總資產 = 總負債 + 股東權益）

## 8. 後續優化建議

1. **批量處理優化**: 實作批量轉換功能，提升大量資料處理效能
2. **快取機制**: 對頻繁使用的轉換結果進行快取
3. **監控與告警**: 建立資料品質監控系統，異常時自動告警
4. **版本管理**: 對標準化格式進行版本控制，支援向後相容
5. **自動化測試**: 建立自動化測試流程，確保每次更新不破壞現有功能

## 9. 相關文件

- [爬蟲系統 CLAUDE.md](../crawler/CLAUDE.md)
- [後端系統 CLAUDE.md](../finance-strategy/CLAUDE.md)
- [原始 PRD 文件](./crawler-fundamental-data-integration-prd.md)
- [FundamentalDataEntity 定義](../finance-strategy/src/common/entities/fundamental-data.entity.ts)

---

**文件結束**
