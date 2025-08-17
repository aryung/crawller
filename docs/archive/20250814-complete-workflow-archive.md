# 爬蟲系統完整工作流程指南 (v3.0)

**專案**: Universal Web Crawler  
**版本**: v3.0.0  
**更新日期**: 2025-08-14

## 🎯 系統概述

Universal Web Crawler v3.0 提供完整的財務數據爬取和匯入解決方案，支援：

- **三大市場**: 台灣 (TW)、美國 (US)、日本 (JP)
- **結構化目錄**: quarterly/daily/metadata 分類系統
- **精確匯入**: 按類別、市場、類型的精確數據匯入
- **完整流程**: 爬取 → 分類存儲 → API 匯入的一體化工作流程

## 🏗️ 系統架構

### 數據流向

```
爬蟲配置 → 網站爬取 → 結構化存儲 → API 匯入 → 後端資料庫
   ↓           ↓           ↓           ↓          ↓
config-categorized/  網站數據  output/分類  HTTP API  PostgreSQL
```

### 目錄結構

```
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
├── scripts/                # 數據處理腳本
│   ├── import-fundamental-api.ts  # v3.0 匯入腳本
│   ├── sync-category-labels-simple.ts
│   └── import-symbols.ts
└── src/                    # 爬蟲核心程式碼
```

## 🚀 完整工作流程

### 階段 1: 環境準備

```bash
# 1. 安裝依賴
npm install

# 2. 設置環境變數
cp .env.example .env
# 編輯 .env 設置 BACKEND_API_TOKEN

# 3. 驗證環境
npm run typecheck
```

### 階段 2: 數據爬取

#### 2.1 台灣市場數據爬取

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

#### 2.2 美國市場數據爬取

```bash
# 季度財務數據
npm run crawl:us:quarterly
# 輸出: output/quarterly/us/

# 每日歷史價格
npm run crawl:us:daily
# 輸出: output/daily/us-history/
```

#### 2.3 日本市場數據爬取

```bash
# 季度財務數據
npm run crawl:jp:quarterly
# 輸出: output/quarterly/jp/

# 每日歷史價格
npm run crawl:jp:daily
# 輸出: output/daily/jp-history/
```

### 階段 3: 數據匯入 (v3.0 結構化系統)

#### 3.1 按類別匯入

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

#### 3.2 按市場匯入

```bash
# 台灣所有數據
npm run import:fundamental:tw

# 美國所有數據
npm run import:fundamental:us

# 日本所有數據
npm run import:fundamental:jp
```

#### 3.3 組合精確匯入

```bash
# 台灣季度數據
npm run import:fundamental:tw:quarterly

# 美國季度數據
npm run import:fundamental:us:quarterly

# 日本季度數據
npm run import:fundamental:jp:quarterly
```

#### 3.4 按類型匯入

```bash
# 市場特定類型
npm run import:tw:balance-sheet        # 只匯入台灣資產負債表
npm run import:us:balance-sheet        # 只匯入美國資產負債表
npm run import:jp:balance-sheet        # 只匯入日本資產負債表
```

### 階段 4: 輔助數據設置

```bash
# 匯入股票代碼
npm run import:symbols

# 同步分類標籤
npm run sync:labels:chunk

# 完整設置 (股票 + 標籤 + 基本面數據)
npm run setup:structured
```

## 🎯 快速操作模式

### 模式 1: 完整流程 (從零開始)

```bash
# 1. 爬取台灣季度數據
npm run crawl:tw:quarterly

# 2. 匯入台灣季度數據
npm run import:fundamental:tw:quarterly

# 3. 設置輔助數據
npm run import:symbols
npm run sync:labels:chunk
```

### 模式 2: 快速設置 (使用現有數據)

```bash
# 跳過爬蟲，直接使用 output/ 現有數據
npm run setup:structured
```

### 模式 3: 增量更新

```bash
# 只爬取特定股票的最新數據
npx tsx src/cli.ts --config config/active/test-eps.json

# 只匯入新爬取的數據
npx tsx scripts/import-fundamental-api.ts --category quarterly --market tw --dry-run
```

## 🔧 進階操作

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

## 📊 監控和診斷

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

### 3. 數據格式錯誤

**問題**: 數據驗證失敗
**解決方案**:
```bash
# 檢查數據格式
jq '.results[0].data.data[0]' output/quarterly/tw/balance/sample.json

# 使用詳細模式查看錯誤
npx tsx scripts/import-fundamental-api.ts --category quarterly --market tw --verbose
```

## 📋 最佳實踐

### 1. 開發環境

- 使用 `--dry-run` 測試匯入配置
- 使用 `--verbose` 診斷問題
- 定期執行 `npm run typecheck`

### 2. 生產環境

- 使用結構化命令進行批量操作
- 設置適當的批次大小
- 監控 API 回應和錯誤日誌

### 3. 數據品質

- 爬取後驗證數據完整性
- 匯入前檢查數據格式
- 定期清理過時數據

## 🔗 相關文檔

- [CLAUDE.md](./CLAUDE.md) - 開發協作指南
- [README.md](./README.md) - 專案概述和快速開始
- [package.json](./package.json) - 完整命令列表
- [scripts/README.md](./scripts/README.md) - 腳本詳細說明

---

**版本**: v3.0.0  
**狀態**: ✅ 生產就緒  
**最後更新**: 2025-08-14  
**維護者**: AHA 智投開發團隊