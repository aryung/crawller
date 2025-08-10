# 基本面資料整合 PRD v2.0

**文檔版本**: 2.0  
**更新日期**: 2025-08-10  
**專案**: AHA 智投系統  
**範圍**: Crawler 系統與 Finance-Strategy 資料庫整合

## 1. 執行摘要

本文檔描述了 Crawler 系統產出的財務資料與 Finance-Strategy 後端資料庫的整合策略，涵蓋資料格式標準化、單位處理策略、以及 fiscalQuarter 到 fiscalMonth 的遷移計畫。

### 1.1 主要變更

- **單位策略**: 保持原始單位，不進行轉換
- **幣別識別**: 透過 `symbolCode` + `exchangeArea` 組合識別
- **fiscalMonth 取代 fiscalQuarter**: 統一使用 fiscalMonth 表示財務期間
- **regionalData 支援**: 儲存地區特有的財務指標

## 2. 資料架構設計

### 2.1 核心實體關聯

```
SymbolEntity (symbols)
    ├── id (UUID)
    ├── symbolCode (e.g., "2330", "AAPL")
    ├── exchangeArea (e.g., "TW", "US", "JP")
    └── 1:N → FundamentalDataEntity

FundamentalDataEntity (fundamental_data)
    ├── id (UUID)
    ├── symbolCode
    ├── exchangeArea
    ├── fiscalYear
    ├── fiscalMonth (1-12, 季報用 3,6,9,12)
    ├── reportType (quarterly/annual/monthly)
    ├── [財務數據欄位...]
    └── regionalData (JSONB)
```

### 2.2 財務期間規範

#### 季度報告 (Quarterly)
- Q1: fiscalMonth = 3
- Q2: fiscalMonth = 6
- Q3: fiscalMonth = 9
- Q4: fiscalMonth = 12

#### 年度報告 (Annual)
- fiscalMonth = 12

#### 月度報告 (Monthly)
- fiscalMonth = 1-12 (對應實際月份)

## 3. 單位處理策略

### 3.1 原則：保持原始單位

不同地區的財務資料保持其原始單位，不進行轉換：

| 地區 | 原始單位 | 幣別 | 範例 |
|------|---------|------|------|
| US | 千美元 (Thousands USD) | USD | revenue: 391035000 = 391,035M USD |
| JP | 百萬日圓 (Million JPY) | JPY | totalAssets: 2201 = 2,201M JPY |
| TW | 千台幣 (Thousands TWD) | TWD | revenue: 839253664 = 839,253M TWD |

### 3.2 幣別識別

透過 `exchangeArea` 欄位識別幣別：
- `US` → USD
- `JP` → JPY
- `TW`/`TPE` → TWD

## 4. 資料欄位映射

### 4.1 必要欄位

所有地區都必須提供的欄位：

```typescript
interface RequiredFields {
  symbolCode: string;         // 股票代碼
  exchangeArea: string;       // 交易所地區
  reportDate: Date;           // 報告日期
  fiscalYear: number;         // 財務年度
  fiscalMonth: number;        // 財務月份
  reportType: string;         // 報告類型
  dataSource: string;         // 資料來源
  lastUpdated: Date;          // 更新時間
}
```

### 4.2 財務資料欄位

#### 損益表 (Income Statement)
- revenue (營業收入)
- costOfGoodsSold (銷貨成本)
- grossProfit (毛利)
- operatingIncome (營業利益)
- netIncome (淨利)
- eps (每股盈餘)
- dilutedEPS (稀釋每股盈餘)
- ebitda (EBITDA)

#### 資產負債表 (Balance Sheet)
- totalAssets (總資產)
- totalLiabilities (總負債)
- shareholdersEquity (股東權益)
- bookValuePerShare (每股淨值)
- cashAndEquivalents (現金及約當現金)
- currentAssets (流動資產)
- currentLiabilities (流動負債)

#### 現金流量表 (Cash Flow)
- operatingCashFlow (營運現金流)
- investingCashFlow (投資現金流)
- financingCashFlow (融資現金流)
- freeCashFlow (自由現金流)
- capex (資本支出)

### 4.3 地區特有資料

儲存在 `regionalData` JSONB 欄位中：

```typescript
// US 特有
regionalData: {
  basicAverageShares: number;
  dilutedAverageShares: number;
  pretaxIncome: number;
  taxProvision: number;
}

// JP 特有
regionalData: {
  equityRatio: number;
  capital: number;
  interestBearingDebt: number;
  currentReceivables: number;
}
```

## 5. FiscalQuarter 遷移計畫

### 5.1 程式碼變更

#### FundamentalAnalysisService 修改
- 移除所有 `fiscalQuarter` 參數
- 新增 `getQuarterFromMonth()` 輔助函數
- 更新聚合邏輯使用 `fiscalMonth`

#### 測試檔案更新
- 將測試中的 `fiscalQuarter: 1` 改為 `fiscalMonth: 3`
- 更新期望值和斷言

### 5.2 資料庫 Migration

Migration 檔案 `1754414349000-add-fundamental-data-fields.ts` 已包含：
- 移除 `fiscal_quarter` 欄位
- 新增 `regional_data` JSONB 欄位
- 更新相關索引

執行命令：
```bash
npm run db:migration:run
```

## 6. 資料匯入流程

### 6.1 匯入腳本使用

```bash
# 單檔案匯入
npx tsx scripts/import-fundamental-data.ts \
  --file output/yahoo-finance-us-income-statement-AAPL_20250809.json

# 批量匯入
npx tsx scripts/import-fundamental-data.ts \
  --dir output/ \
  --pattern "*income-statement*"
```

### 6.2 匯入流程

1. **讀取 JSON**: 解析 crawler 輸出檔案
2. **驗證欄位**: 檢查必要欄位完整性
3. **轉換格式**: 
   - 不進行單位轉換
   - fiscalMonth 驗證 (季報: 3,6,9,12)
   - exchangeArea 標準化
4. **資料存儲**: 使用 upsert 避免重複

### 6.3 錯誤處理

- 缺少必要欄位：記錄警告並跳過
- fiscalMonth 無效：拒絕匯入
- 資料庫錯誤：記錄錯誤並繼續處理其他資料

## 7. 測試與驗證

### 7.1 單元測試

```bash
# 執行 FundamentalAnalysisService 測試
npm run test -- fundamental-analysis.service.spec.ts

# 執行整合測試
npm run test -- fundamental-scoring.integration.spec.ts
```

### 7.2 資料驗證檢查

- fiscalMonth 範圍檢查 (1-12)
- 季報 fiscalMonth 檢查 (3,6,9,12)
- 年報 fiscalMonth 檢查 (必須為 12)
- symbolCode + exchangeArea 唯一性

## 8. 實施時程

| 階段 | 任務 | 狀態 | 完成日期 |
|------|------|------|---------|
| 1 | fiscalQuarter 邏輯修正 | ✅ 完成 | 2025-08-10 |
| 2 | 測試檔案更新 | ✅ 完成 | 2025-08-10 |
| 3 | 資料匯入腳本 | ✅ 完成 | 2025-08-10 |
| 4 | 執行 Migration | 待執行 | - |
| 5 | 資料匯入測試 | 待執行 | - |
| 6 | 生產環境部署 | 待執行 | - |

## 9. 風險與緩解

### 9.1 識別的風險

1. **資料不一致**: 不同地區的報表結構差異
   - 緩解：使用 regionalData 儲存特有欄位

2. **單位混淆**: 不同單位可能造成計算錯誤
   - 緩解：明確標示 exchangeArea，前端顯示時標註單位

3. **fiscalMonth 遷移**: 既有資料可能需要轉換
   - 緩解：提供資料遷移腳本

### 9.2 回滾計畫

如需回滾：
1. 執行 `npm run db:migration:revert`
2. 恢復程式碼到前一版本
3. 重新部署應用程式

## 10. 成功指標

- ✅ 所有測試通過率 100%
- ✅ 資料匯入成功率 > 95%
- ✅ fiscalMonth 轉換正確率 100%
- ✅ 無資料遺失或損壞

## 11. 相關文檔

- [資料格式一致性檢查報告](./data-consistency-report.md)
- [FundamentalDataEntity 定義](../src/database/entities/fundamental-data.entity.ts)
- [匯入腳本](../scripts/import-fundamental-data.ts)
- [Migration 檔案](../../finance-strategy/src/database/migrations/1754414349000-add-fundamental-data-fields.ts)

## 12. 變更記錄

| 版本 | 日期 | 作者 | 變更內容 |
|------|------|------|----------|
| 1.0 | 2025-01-06 | System | 初始版本 |
| 2.0 | 2025-08-10 | System | fiscalMonth 遷移、單位策略更新 |

---

**批准**:
- 技術主管: _______________
- 產品經理: _______________
- 資料架構師: _______________