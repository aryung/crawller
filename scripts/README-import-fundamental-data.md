# 基本面資料匯入腳本說明文件

## 概述

`import-fundamental-data.ts` 是一個用於將爬蟲系統產出的財務數據 JSON 檔案匯入到 PostgreSQL 資料庫的工具腳本。支援多地區（美國、台灣、日本）的財務報表資料匯入，並自動處理 Symbol 關聯。

## 系統需求

- Node.js >= 18.0.0
- PostgreSQL 資料庫
- TypeORM 相關套件
- 已設定的 `.env` 環境變數檔案

## 環境變數設定

在專案根目錄的 `.env` 檔案中需要包含以下設定：

```bash
# 資料庫連線設定
POSTGRES_DB_IP=localhost           # 資料庫主機位址
POSTGRES_DB_PORT=30432             # 資料庫連接埠
POSTGRES_DB_USER=postgres          # 資料庫使用者名稱
POSTGRES_DB_PASSWORD=your_password # 資料庫密碼
POSTGRES_DB_NAME_AHA_DEV=aha-dev  # 目標資料庫名稱
```

## 使用方式

### 1. 單檔案匯入

匯入單一 JSON 檔案：

```bash
npx tsx scripts/import-fundamental-data.ts --file output/yahoo-finance-us-income-statement-AAPL_20250809.json
```

### 2. 批次匯入

匯入目錄下符合條件的多個檔案：

```bash
# 匯入所有 JSON 檔案
npx tsx scripts/import-fundamental-data.ts --dir output/

# 匯入特定模式的檔案（使用萬用字元）
npx tsx scripts/import-fundamental-data.ts --dir output/ --pattern "*income-statement*"

# 更多範例
npx tsx scripts/import-fundamental-data.ts --dir output/ --pattern "*2330_TW*"
npx tsx scripts/import-fundamental-data.ts --dir output/ --pattern "*cash-flow*"
```

## 支援的資料格式

### JSON 檔案結構

輸入的 JSON 檔案必須符合以下結構：

```json
{
  "results": [
    {
      "data": {
        "data": [
          {
            "symbolCode": "AAPL",
            "exchangeArea": "US",
            "reportDate": "2024-09-30",
            "fiscalYear": 2024,
            "fiscalMonth": 9,
            "reportType": "annual",
            "revenue": 383285000000,
            "netIncome": 94680000000,
            // ... 其他財務欄位
          }
        ]
      }
    }
  ]
}
```

### 支援的地區與交易所

| 地區 | 交易所代碼 | 範例股票代碼 | 報表類型 |
|------|------------|--------------|----------|
| 美國 | US | AAPL, GOOGL, MSFT | annual (年報) |
| 台灣 | TW | 2330.TW, 2454.TW | quarterly (季報) |
| 日本 | JP | 143A, 7203.T | annual (年報) |

### 財務報表類型

- **annual**: 年度報表
- **quarterly**: 季度報表
- **monthly**: 月度報表（營收）

## 功能特性

### 1. Symbol 自動管理

腳本會自動：
- 查詢 `symbols` 表中是否已存在該股票
- 若不存在，自動創建新的 Symbol 記錄
- 維護 `fundamental_data` 與 `symbols` 表之間的外鍵關聯

### 2. 資料驗證

匯入前會進行以下驗證：
- 必要欄位檢查（symbolCode, exchangeArea, reportDate, fiscalYear, reportType）
- 季報月份驗證（必須為 3, 6, 9, 12）
- 年報月份驗證（1-12）

### 3. 重複資料處理

使用 TypeORM 的 `save` 方法，會自動：
- 若資料不存在則新增
- 若資料已存在則更新（基於主鍵）

### 4. 錯誤處理

- 資料庫連線失敗時會顯示詳細錯誤訊息
- 單筆資料匯入失敗不影響其他資料
- 顯示每筆資料的匯入狀態

## 支援的財務欄位

### 損益表 (Income Statement)
- revenue (營業收入)
- costOfGoodsSold (銷貨成本)
- grossProfit (毛利)
- operatingIncome (營業利益)
- netIncome (淨利)
- eps (每股盈餘)
- dilutedEPS (稀釋每股盈餘)

### 資產負債表 (Balance Sheet)
- totalAssets (總資產)
- totalLiabilities (總負債)
- shareholdersEquity (股東權益)
- cashAndEquivalents (現金及約當現金)
- currentAssets (流動資產)
- currentLiabilities (流動負債)

### 現金流量表 (Cash Flow Statement)
- operatingCashFlow (營業現金流)
- investingCashFlow (投資現金流)
- financingCashFlow (融資現金流)
- freeCashFlow (自由現金流)

### 財務比率
- roe (股東權益報酬率)
- roa (資產報酬率)
- peRatio (本益比)
- currentRatio (流動比率)
- debtToEquity (負債權益比)

## 執行範例

### 範例 1：匯入美國股票年報

```bash
# 匯入 Apple 的年度財報
npx tsx scripts/import-fundamental-data.ts --file output/yahoo-finance-us-income-statement-AAPL_20250809.json

# 輸出：
🚀 基本面資料匯入工具啟動
🔌 連接資料庫...
✅ 資料庫連接成功
📄 處理檔案: output/yahoo-finance-us-income-statement-AAPL_20250809.json
✅ 創建新 Symbol: AAPL (US)
✅ 匯入成功: AAPL - 2024/9
✅ 匯入成功: AAPL - 2023/9
✅ 匯入成功: AAPL - 2022/9
✅ 匯入成功: AAPL - 2021/9

✨ 匯入完成！共匯入 4 筆資料
```

### 範例 2：批次匯入台灣股票季報

```bash
# 匯入所有台積電的財報
npx tsx scripts/import-fundamental-data.ts --dir output/ --pattern "*2330_TW*"

# 輸出：
🚀 基本面資料匯入工具啟動
📁 找到 3 個檔案符合條件
🔌 連接資料庫...
✅ 資料庫連接成功
📄 處理檔案: output/yahoo-finance-tw-income-statement-2330_TW_20250810.json
✅ 匯入成功: 2330.TW - 2025/3
✅ 匯入成功: 2330.TW - 2024/12
[... 更多季度資料 ...]

✨ 匯入完成！共匯入 20 筆資料
```

### 範例 3：匯入日本股票資料

```bash
# 匯入日本股票財報
npx tsx scripts/import-fundamental-data.ts --file output/yahoo-finance-jp-performance-143A_T_20250809.json

# 輸出：
🚀 基本面資料匯入工具啟動
🔌 連接資料庫...
✅ 資料庫連接成功
📄 處理檔案: output/yahoo-finance-jp-performance-143A_T_20250809.json
✅ 創建新 Symbol: 143A (JP)
✅ 匯入成功: 143A - 2025/3
✅ 匯入成功: 143A - 2024/3
✅ 匯入成功: 143A - 2023/3

✨ 匯入完成！共匯入 3 筆資料
```

## 資料庫查詢驗證

匯入後可使用以下 SQL 查詢驗證資料：

```sql
-- 查看匯入的資料總覽
SELECT 
  exchange_area,
  symbol_code,
  report_type,
  COUNT(*) as record_count,
  MIN(fiscal_year || '-' || fiscal_month) as earliest_period,
  MAX(fiscal_year || '-' || fiscal_month) as latest_period
FROM fundamental_data
GROUP BY exchange_area, symbol_code, report_type
ORDER BY exchange_area, symbol_code;

-- 查看特定股票的財務數據
SELECT 
  fiscal_year,
  fiscal_month,
  revenue,
  net_income,
  eps,
  operating_cash_flow
FROM fundamental_data
WHERE symbol_code = '2330.TW'
ORDER BY fiscal_year DESC, fiscal_month DESC
LIMIT 10;

-- 查看 symbols 表
SELECT * FROM symbols 
WHERE symbol_code IN ('AAPL', '2330.TW', '143A');
```

## 故障排除

### 1. 資料庫連線失敗

錯誤訊息：
```
Error: connect ECONNREFUSED 127.0.0.1:5432
```

解決方法：
- 檢查 `.env` 檔案中的資料庫設定
- 確認 PostgreSQL 服務正在運行
- 確認連接埠號正確（預設為 30432）

### 2. 環境變數未載入

錯誤訊息：
```
Error: Database "undefined" does not exist
```

解決方法：
- 確認專案根目錄有 `.env` 檔案
- 檢查環境變數名稱是否正確（POSTGRES_DB_*）
- 確認已安裝 dotenv 套件

### 3. Symbol ID 錯誤

錯誤訊息：
```
Error: null value in column "symbol_id" violates not-null constraint
```

解決方法：
- 確認 symbols 表存在且結構正確
- 檢查 UUID 擴充功能是否已安裝（CREATE EXTENSION IF NOT EXISTS "uuid-ossp"）

### 4. JSON 格式錯誤

錯誤訊息：
```
❌ 無效的 JSON 結構，缺少 results 陣列
```

解決方法：
- 確認 JSON 檔案格式符合預期結構
- 使用 JSON 驗證工具檢查檔案格式

## 注意事項

1. **資料單位**：所有金額數據保持原始單位，不進行轉換
2. **時區處理**：報表日期使用 UTC 時區儲存
3. **效能考量**：大量資料匯入時建議分批處理
4. **資料備份**：匯入前建議先備份資料庫

## 開發與維護

### 檔案位置
- 主程式：`/scripts/import-fundamental-data.ts`
- Entity 定義：`/src/database/entities/`
- 介面定義：`/src/common/shared-types/interfaces/`

### 相關檔案
- `fundamental-data.entity.ts`: 基本面資料表結構
- `symbol.entity.ts`: 股票代號表結構
- `fundamental-data.interface.ts`: 資料型別定義

## 版本歷史

- **v1.1.0** (2025-08-10)
  - 新增 Symbol 自動查詢/創建功能
  - 修正環境變數載入問題
  - 支援多地區資料格式

- **v1.0.0** (2025-08-09)
  - 初始版本
  - 基本匯入功能

## 聯絡資訊

如有問題或建議，請聯繫開發團隊。

---

最後更新：2025-08-10