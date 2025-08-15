# Universal Web Crawler 完整系統指南 (v3.0)

**專案**: 通用網路爬蟲系統  
**版本**: v3.0.0  
**更新日期**: 2025-08-14

## 🎯 系統概述

Universal Web Crawler v3.0 提供完整的財務數據爬取和匯入解決方案，支援：

- **三大市場**: 台灣 (TW)、美國 (US)、日本 (JP)
- **結構化目錄**: quarterly/daily/metadata 分類系統
- **精確匯入**: 按類別、市場、類型的精確數據匯入
- **完整流程**: 爬取 → 分類存儲 → API 匯入的一體化工作流程

### 系統架構

```
數據流向: 爬蟲配置 → 網站爬取 → 結構化存儲 → API 匯入 → 後端資料庫

crawler/
├── config-categorized/     # v3.0 分類爬蟲配置檔案
│   ├── quarterly/          # 季度數據配置
│   ├── daily/              # 每日數據配置
│   └── metadata/           # 元數據配置
├── output/                 # 結構化輸出目錄
│   ├── quarterly/          # 季度財務數據
│   │   ├── tw/balance/     # 台灣資產負債表
│   │   ├── tw/income/      # 台灣損益表
│   │   ├── tw/cash-flow/   # 台灣現金流量表
│   │   ├── us/financials/  # 美國財務數據
│   │   └── jp/financials/  # 日本財務數據
│   ├── daily/              # 每日數據
│   │   ├── tw-history/     # 台灣歷史價格
│   │   ├── us-history/     # 美國歷史價格
│   │   └── jp-history/     # 日本歷史價格
│   └── metadata/           # 元數據
│       ├── symbols/        # 股票代碼
│       └── labels/         # 分類標籤
└── src/                    # 爬蟲核心程式碼
```

## 🚀 快速開始

### 方法 1: 完整流程 (從零開始)

```bash
# 1. 環境準備
npm install
cp .env.example .env
# 編輯 .env 設置 BACKEND_API_TOKEN

# 2. 爬取台灣季度數據
npm run crawl:tw:quarterly

# 3. 匯入台灣季度數據
npm run import:fundamental:tw:quarterly

# 4. 設置輔助數據
npm run import:symbols
npm run sync:labels:chunk
```

### 方法 2: 快速設置 (使用現有數據)

```bash
# 跳過爬蟲，直接使用 output/ 現有數據
npm run setup:structured
```

### 方法 3: 增量更新

```bash
# 只爬取特定配置
npx tsx src/cli.ts --config config/active/test-eps.json

# 只匯入新數據
npx tsx scripts/import-fundamental-api.ts --category quarterly --market tw --dry-run
```

## 🔄 完整工作流程

### 階段 1: 數據爬取

#### 台灣市場數據爬取

```bash
# 季度財務數據
npm run crawl:tw:quarterly
# 輸出: output/quarterly/tw/balance/
#       output/quarterly/tw/income/
#       output/quarterly/tw/cash-flow/

# 每日歷史價格
npm run crawl:tw:daily
# 輸出: output/daily/tw-history/

# 元數據 (股票代碼、分類)
npm run crawl:tw:metadata
# 輸出: output/metadata/symbols/
#       output/metadata/labels/
```

#### 美國市場數據爬取

```bash
# 季度財務數據
npm run crawl:us:quarterly
# 輸出: output/quarterly/us/

# 每日歷史價格
npm run crawl:us:daily
# 輸出: output/daily/us-history/
```

#### 日本市場數據爬取

```bash
# 季度財務數據
npm run crawl:jp:quarterly
# 輸出: output/quarterly/jp/

# 每日歷史價格
npm run crawl:jp:daily
# 輸出: output/daily/jp-history/
```

### 階段 2: 數據匯入 (v3.0 結構化系統)

#### 按類別匯入

```bash
# 匯入所有季度財務數據
npm run import:fundamental:quarterly

# 匯入所有每日數據
npm run import:fundamental:daily

# 匯入所有元數據
npm run import:fundamental:metadata

# 批量匯入所有類別
npm run import:fundamental:batch
```

#### 按市場匯入

```bash
# 台灣所有數據
npm run import:fundamental:tw

# 美國所有數據
npm run import:fundamental:us

# 日本所有數據
npm run import:fundamental:jp
```

#### 組合精確匯入

```bash
# 台灣季度數據
npm run import:fundamental:tw:quarterly

# 美國季度數據
npm run import:fundamental:us:quarterly

# 日本季度數據
npm run import:fundamental:jp:quarterly
```

#### 按類型匯入

```bash
# 市場特定類型
npm run import:tw:balance-sheet        # 只匯入台灣資產負債表
npm run import:us:balance-sheet        # 只匯入美國資產負債表
npm run import:jp:balance-sheet        # 只匯入日本資產負債表
```

### 階段 3: 輔助數據設置

```bash
# 匯入股票代碼
npm run import:symbols

# 同步分類標籤
npm run sync:labels:chunk

# 完整設置 (股票 + 標籤 + 基本面數據)
npm run setup:structured
```

## 🔧 進階操作

### CLI 工具使用

#### 基本命令

```bash
# 列出所有配置
npm run list

# 執行特定配置
npx tsx src/cli.ts --config config/active/test.json

# 檢查 TypeScript 錯誤
npm run typecheck
```

#### Pipeline 系統

##### 完整執行流程解析

Pipeline 執行包含以下步驟：
1. **Step 1-3**: 配置生成 → 爬蟲執行 → 數據聚合
2. **Step 4**: 匯入股票代碼 (`importSymbolsFromMappings()`)
3. **Step 5**: 匯入基本面數據 (`importFundamentalData()`)
4. **Step 6**: 同步分類標籤 (`syncCategoryLabels()`)

##### 最佳實踐命令 ⭐

```bash
# 🚀 推薦：優化版完整流程 (避免重複匯入)
npm run pipeline:all

# 完整 Pipeline 流程 (包含爬蟲)
npm run pipeline:full

# 僅數據處理 (跳過爬蟲，使用現有輸出)
npm run setup:all

# 僅執行爬蟲 (不同步到後端)
npm run pipeline:crawl-only

# 查看 Pipeline 統計
npm run pipeline:stats
```

##### 效率最佳化說明

**為什麼推薦 `pipeline:all`？**

- **避免重複處理**: Step 6 的 `syncCategoryLabels()` 已包含 `createMissingSymbols: true`
- **自動股票創建**: Label sync 會自動創建不存在的股票，無需額外執行 symbol import
- **提升執行效率**: 跳過 Step 4 可節省 20-30% 的執行時間

```bash
# ❌ 不推薦：會重複處理股票創建
npm run pipeline:run

# ✅ 推薦：跳過重複的 symbol import
npm run pipeline:all
# 等同於：npm run pipeline:run --skip-symbol-import
```

### 自定義匯入參數

```bash
# 測試模式 (不實際匯入)
npx tsx scripts/import-fundamental-api.ts --category quarterly --market tw --dry-run

# 詳細模式 (顯示詳細處理資訊)
npx tsx scripts/import-fundamental-api.ts --category quarterly --verbose

# 特定類型匯入
npx tsx scripts/import-fundamental-api.ts --market us --type balance-sheet

# 自定義 API 地址和 Token
npx tsx scripts/import-fundamental-api.ts --api-url http://api.example.com --token YOUR_TOKEN
```

### 批次大小調整

```bash
# 小批次處理 (網路不穩定時)
npm run import:symbols:small
npm run sync:labels:chunk

# 極小批次處理 (大量數據或極慢網路)
npm run import:symbols -- --batch-size=5
npm run sync:labels -- --chunk-size=30
```

## 🛠️ 配置系統

### 配置檔案結構

```typescript
interface CrawlerConfig {
  templateType: string;           // 配置類型
  url: string;                   // 目標 URL
  variables?: Record<string, string>; // 變數替換
  actions?: Action[];            // 頁面操作 (點擊、輸入等)
  selectors: SelectorConfig;     // 資料選擇器
  excludeSelectors?: string[];   // 排除元素選擇器
  export?: ExportConfig;         // 輸出設定
  options?: CrawlerOptions;      // 爬蟲選項
}
```

### 選擇器最佳實踐

#### 六大核心原則

1. **結構化選擇器優先原則** ⭐
   - 使用 `nth-child()`, `nth-of-type()` 等結構化選擇器
   - 避免依賴文字內容的 `:contains()` 選擇器

2. **DOM 預處理 - Exclude Selector**
   - 使用 exclude 選擇器移除干擾元素
   - 只排除真正影響數據提取的元素

3. **禁止錯誤數據捉取**
   - 嚴禁使用通用選擇器捉取混雜資料
   - 每個欄位使用精確的選擇器

4. **獨立選擇器**
   - 每個最終輸出欄位使用獨立的 CSS 選擇器

5. **動態時間軸提取**
   - 禁止硬編碼時間，所有時間軸數據必須動態提取

6. **真實數值常數**
   - 使用 `src/const/finance.ts` 定義的常數進行驗證

#### 選擇器範例

```json
{
  "selectors": {
    // ✅ 好的做法：使用結構化選擇器
    "operatingCashFlow": {
      "selector": "section[data-testid*='table'] > div:nth-child(2) > div:nth-child(1) > div > div:nth-child(n+2)",
      "transform": "parseFinancialValue"
    },
    
    // ✅ 使用 :has() 選擇器精確定位
    "eps": {
      "selector": "tr:has(td:contains('每股盈餘')) td:last-child",
      "transform": "cleanEPSValue"
    }
  },
  
  // DOM 預處理 - 移除干擾元素
  "excludeSelectors": [
    ".financial-table .advertisement",
    "tr[data-ad-type]",
    ".data-section .sponsored-content"
  ]
}
```

### 配置生成器

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

## 🔍 監控和診斷

### 進度監控

```bash
# 查看匯入統計
npm run pipeline:stats

# 檢查輸出目錄結構
find output -name "*.json" | head -10

# 查看最新匯入日誌
tail -f logs/import-*.log
```

### 常見問題診斷

```bash
# 檢查環境配置
cat .env | grep BACKEND_API

# 測試 API 連接
npm run import:fundamental:quarterly --dry-run

# 驗證數據格式
npx tsx scripts/import-fundamental-api.ts --file output/quarterly/tw/balance/sample.json --verbose
```

## 🚨 故障排除

### 1. 爬蟲失敗

**問題**: 爬蟲配置執行失敗

**解決方案**:
```bash
# 檢查配置檔案
npm run list

# 測試單一配置
npx tsx src/cli.ts --config config/active/test.json

# 檢查網路連接
curl -I https://finance.yahoo.com
```

### 2. 匯入失敗

**問題**: API 匯入失敗

**解決方案**:
```bash
# 檢查 Token 有效性
echo $BACKEND_API_TOKEN

# 測試 API 連接
curl -H "Authorization: Bearer $BACKEND_API_TOKEN" http://localhost:3000/fundamental-data

# 使用 dry-run 模式診斷
npm run import:fundamental:tw:quarterly --dry-run
```

### 3. HTTP 413 Payload Too Large

**問題**: 一次性傳送的數據量太大

**解決方案**:
```bash
# 使用更小的批次大小
npm run import:symbols        # 預設批次大小 30
npm run import:symbols:small  # 批次大小 10（最小）
npm run sync:labels:chunk     # 分塊大小 100

# 自訂批次大小
npm run import:symbols -- --batch-size=20
npm run sync:labels -- --chunk-size=50
```

### 4. 數據格式錯誤

**問題**: 數據驗證失敗

**解決方案**:
```bash
# 檢查數據格式
jq '.results[0].data.data[0]' output/quarterly/tw/balance/sample.json

# 使用詳細模式查看錯誤
npx tsx scripts/import-fundamental-api.ts --category quarterly --market tw --verbose
```

### 5. 調試技巧

```bash
# 瀏覽器開發者工具測試選擇器
document.querySelectorAll("tr:has(td:contains('每股盈餘')) td:last-child");

# 使用調試轉換函數查看原始數據
{
  "fiscalPeriods": {
    "selector": "li div:first-child",
    "transform": "debugFieldExtraction"
  }
}

# 啟用詳細日誌
export DEBUG=crawler:*
npx tsx src/cli.ts --config config/active/test.json
```

### 批次大小建議

| 數據量 | 建議批次大小 | 命令範例 |
|--------|-------------|----------|
| < 100 項 | 50-100 | `npm run import:symbols` |
| 100-1000 項 | 30-50 | `npm run import:symbols` |
| 1000-5000 項 | 20-30 | `npm run import:symbols -- --batch-size=20` |
| 5000-10000 項 | 10-20 | `npm run import:symbols:small` |
| > 10000 項 | 5-10 | `npm run import:symbols -- --batch-size=5` |

## 📋 最佳實踐

### 開發環境

- 使用 `--dry-run` 測試匯入配置
- 使用 `--verbose` 診斷問題
- 定期執行 `npm run typecheck`

### 生產環境

- 使用結構化命令進行批量操作
- 設置適當的批次大小
- 監控 API 回應和錯誤日誌

### 數據品質

- 爬取後驗證數據完整性
- 匯入前檢查數據格式
- 定期清理過時數據

### 推薦工作流程

#### 首次設置（v3.0 優化版）

```bash
# 1. 環境準備
cp .env.example .env
# 編輯 .env 設置 BACKEND_API_TOKEN
./test-fixes.sh  # 驗證環境配置

# 2. 🚀 推薦：使用優化 Pipeline（避免重複匯入）
npm run pipeline:all
# 自動執行：配置生成 → 爬取 → 聚合 → 跳過重複symbol匯入 → 基本面數據 → 標籤同步

# 3. 或分步執行（細粒度控制）
npm run generate:mappings         # 生成類別映射
npm run import:fundamental:batch  # 匯入基本面數據
npm run import:labels:chunk       # 同步標籤（自動創建股票）

# 4. 傳統方式（相容性，但有重複處理）
npm run pipeline:full             # 包含重複的 symbol import
```

#### 效率對比

| 執行方式 | 優點 | 缺點 | 推薦度 |
|---------|------|------|--------|
| `pipeline:all` | ✅ 無重複處理<br>✅ 執行時間短<br>✅ 自動化程度高 | - | ⭐⭐⭐⭐⭐ |
| `pipeline:full` | ✅ 完整性高<br>✅ 向後相容 | ❌ 重複處理<br>❌ 執行時間長 | ⭐⭐⭐ |
| 分步執行 | ✅ 精細控制<br>✅ 易於調試 | ❌ 手動操作多<br>❌ 容易遺漏 | ⭐⭐⭐⭐ |

## 🔄 重試與斷點續傳機制

v3.0 引入了強化的重試機制和批次處理功能，確保大規模爬取作業的穩定性。

### 重試機制 (Retry System)

#### 重試數據存儲
- **位置**: `output/pipeline-retries.json`
- **管理**: 由 `RetryManager` 自動管理
- **清理**: 7天自動清理過期記錄

#### 重試觸發條件
```bash
# 1. 空數據檢測 (empty_data)
- 爬取成功但返回空結果
- 財務數據陣列長度為 0
- 關鍵欄位缺失

# 2. 執行失敗 (execution_failed)  
- 網頁載入失敗
- CSS 選擇器錯誤
- 網路連接問題

# 3. 超時錯誤 (timeout)
- 頁面載入超時 (30秒)
- 配置執行超時 (10分鐘)
```

#### 重試命令
```bash
# 查看重試狀態
npm run pipeline:retry-status

# 執行重試隊列
npm run pipeline:retry

# 清空重試隊列 (謹慎使用)
npm run pipeline:clear-retries

# 只執行重試模式
npm run pipeline:retry-only

# 停用重試機制
npm run pipeline:no-retry
```

### 批次斷點續傳 (Batch Resume)

#### 斷點續傳機制
```bash
# 查看批次執行狀態
npm run crawl:status

# 查看執行統計
npm run crawl:stats

# 生成錯誤報告
npm run crawl:errors

# 恢復指定進度的執行
npx tsx src/cli.ts crawl-batch --resume=batch_20250815_103045

# 只重試失敗的配置
npx tsx src/cli.ts crawl-batch --retry-failed=batch_20250815_103045
```

#### 批次控制選項
```bash
# 限制執行範圍
npx tsx src/cli.ts crawl-batch --start-from=100 --limit=50

# 控制併發和延遲
npx tsx src/cli.ts crawl-batch --concurrent=2 --delay=8000

# 指定範圍爬取
npm run crawl:tw:quarterly --start-from=0 --limit=100
npm run crawl:us:quarterly --start-from=0 --limit=100
```

### 網路穩定性最佳化

#### 不穩定環境設定
```bash
# 低併發 + 高延遲
npx tsx src/cli.ts crawl-batch \
  --concurrent=1 \
  --delay=10000 \
  --retry-attempts=5

# 小批次處理
npx tsx src/cli.ts crawl-batch \
  --limit=20 \
  --category=quarterly
```

#### 記憶體最佳化
```bash
# 增加 Node.js 記憶體限制
NODE_OPTIONS="--max-old-space-size=4096" npm run crawl:quarterly

# 分階段執行
npm run crawl:tw:quarterly --limit=100
# 檢查結果後繼續下一批
npm run crawl:tw:quarterly --start-from=100 --limit=100
```

### 詳細使用指南

更多重試機制和批次處理的詳細說明，請參考：
**[Pipeline Retry & Batch 功能完整指南](pipeline-retry-batch-guide.md)**

#### 日常更新

```bash
# 使用現有爬蟲數據快速更新
npm run setup:all

# 或只更新特定部分
npm run sync:labels           # 只更新標籤
npm run import:fundamental:tw # 只更新台灣數據
```

#### 數據重置

```bash
# 完整重置流程
npm run clear:labels:hard     # 硬刪除所有標籤
npm run pipeline:full         # 重新執行完整流程
```

## 🔗 環境配置

### 必要環境變數

```bash
# .env 檔案範例
BACKEND_API_URL=http://localhost:3000
BACKEND_API_TOKEN=eyJhbGciOiJIUzI1NiIs...  # JWT Token
```

### 系統狀態檢查

```bash
# 查看 Pipeline 統計
npm run pipeline:stats

# 測試修復功能
./test-fixes.sh

# 測試 Token 配置
./test-token-fix.sh

# 測試 API 連接
npm run clear:labels:dry

# 檢查配置
cat .env | grep BACKEND_API
```

---

**版本**: v3.0.0  
**狀態**: ✅ 生產就緒  
**最後更新**: 2025-08-14  
**維護者**: AHA 智投開發團隊