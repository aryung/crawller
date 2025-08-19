# API 整合與數據匯入指南 (v3.1.1)

**專案**: Universal Web Crawler API Integration  
**版本**: v3.1.1  
**更新日期**: 2025-08-16

## 🎯 API 整合概述

Universal Web Crawler v3.1.1 提供完整的後端 API 整合解決方案，包含智慧批次處理和並發控制，支援：

- **結構化數據匯入**: quarterly/daily/metadata 分類匯入
- **批次處理優化**: 智能批次大小和重試機制
- **多端點支援**: 自動端點偵測和故障轉移
- **精確控制**: 按類別、市場、類型的精確匯入控制

## 🚀 快速匯入指令

### v3.0 結構化匯入命令

```bash
# 🎯 按類別匯入
npm run import:fundamental:quarterly    # 季度財務數據
npm run import:fundamental:daily        # 每日數據  
npm run import:fundamental:metadata     # 元數據
npm run import:fundamental:batch        # 批量匯入所有類別

# 🌍 按市場匯入
npm run import:fundamental:tw          # 台灣所有數據
npm run import:fundamental:us          # 美國所有數據
npm run import:fundamental:jp          # 日本所有數據

# 🎯 組合精確匯入
npm run import:fundamental:tw:quarterly # 台灣季度數據
npm run import:fundamental:us:quarterly # 美國季度數據
npm run import:fundamental:jp:quarterly # 日本季度數據

# 📊 市場特定類型匯入
npm run import:tw:balance-sheet        # 只匯入台灣資產負債表
npm run import:tw:cash-flow           # 只匯入台灣現金流量表
npm run import:us:balance-sheet        # 只匯入美國資產負債表
npm run import:us:financials          # 只匯入美國財務數據
npm run import:jp:balance-sheet        # 只匯入日本資產負債表
npm run import:jp:performance         # 只匯入日本績效數據

# 🚀 快速設置
npm run setup:structured               # 完整設置 (數據+股票+標籤)
npm run setup:tw                       # 台灣市場設置
```

### 進階匯入命令

```bash
# 直接使用腳本 (更多控制選項)
npx tsx scripts/import-fundamental-api.ts --category quarterly --market tw
npx tsx scripts/import-fundamental-api.ts --market us --type balance-sheet
npx tsx scripts/import-fundamental-api.ts --category metadata --verbose

# 測試模式
npx tsx scripts/import-fundamental-api.ts --category quarterly --market tw --dry-run

# 參數說明:
# --category: quarterly/daily/metadata
# --market: tw/us/jp
# --type: balance-sheet/income-statement/cash-flow-statement
# --dry-run: 測試模式，不實際匯入
# --verbose: 顯示詳細處理資訊
# --file: 匯入特定檔案
# --api-url: 自定義 API 地址
# --token: 自定義 API Token
```

## 📊 批次處理優化

### 智能批次大小策略

```bash
# 🚀 快速模式（網路良好）
npm run import:symbols         # 批次 30
npm run sync:labels           # 正常處理

# 🐢 安全模式（網路不穩或數據量大）
npm run import:symbols:small   # 批次 10
npm run sync:labels:chunk     # 分塊 100

# 🐌 極限模式（極大數據量或網路極差）
npm run import:symbols -- --batch-size=5
npm run sync:labels -- --chunk-size=30
```

### 批次大小建議表

| 數據量 | 建議批次大小 | 命令範例 |
|--------|-------------|----------|
| < 100 項 | 50-100 | `npm run import:symbols` |
| 100-1000 項 | 30-50 | `npm run import:symbols` |
| 1000-5000 項 | 20-30 | `npm run import:symbols -- --batch-size=20` |
| 5000-10000 項 | 10-20 | `npm run import:symbols:small` |
| > 10000 項 | 5-10 | `npm run import:symbols -- --batch-size=5` |

## 🔧 API 客戶端架構

### 自動端點偵測機制

系統會自動嘗試多個可能的 API 端點，確保相容性：

#### 股票匯入端點偵測
1. `/symbols/bulk`
2. `/symbols/bulk-create`  
3. `/symbols/batch-create`
4. `/symbols`

#### 標籤刪除端點偵測  
1. `/label-industry/labels/{id}`
2. `/labels/{id}`
3. `/label-industry/labels/{id}/force-delete`
4. `/labels/{id}/force-delete`

#### 基本面數據匯入端點
1. `/fundamental-data/bulk`
2. `/fundamental-data/batch`
3. `/fundamental-data`

### API 客戶端結構

```
src/common/api-client.ts     # 統一的 API 客戶端
├── 自動端點偵測
├── 批次處理優化
├── 錯誤重試機制
└── Token 管理

scripts/
├── import-symbols.ts        # 股票匯入（批次 30）
├── sync-category-labels-simple.ts  # 標籤同步（分塊 100）
├── clear-industry-labels.ts # 標籤清理（多端點嘗試）
└── import-fundamental-api.ts # 基本面數據匯入 (v3.0)
```

## 🔐 環境配置

### 必要環境變數

```bash
# .env 檔案配置
INTERNAL_AHA_API_URL=http://localhost:3000
INTERNAL_AHA_API_TOKEN=eyJhbGciOiJIUzI1NiIs...  # JWT Token

# 開發環境
NODE_ENV=development

# 生產環境 (可選)
INTERNAL_AHA_API_URL=https://api.aha.credit
NODE_ENV=production
```

### Token 管理

```bash
# 檢查 Token 有效性
echo $INTERNAL_AHA_API_TOKEN

# 測試 API 連接
curl -H "Authorization: Bearer $INTERNAL_AHA_API_TOKEN" \
     $INTERNAL_AHA_API_URL/fundamental-data

# 自動登入獲取新 Token (後端系統)
curl -X POST "$INTERNAL_AHA_API_URL/auth/auto-login" \
     -H "Content-Type: application/json" \
     -d '{"email": "admin@example.com"}'
```

## 📁 結構化目錄掃描

### v3.0 目錄架構

```
output/
├── quarterly/          # 季度財務數據
│   ├── tw/            # 台灣市場  
│   │   ├── balance/   # 資產負債表
│   │   ├── income/    # 損益表
│   │   └── cash-flow/ # 現金流量表
│   ├── us/            # 美國市場
│   └── jp/            # 日本市場
├── daily/             # 每日數據
│   ├── tw-history/    # 台灣歷史價格
│   ├── us-history/    # 美國歷史價格
│   └── jp-history/    # 日本歷史價格
└── metadata/          # 元數據
    ├── symbols/       # 股票代碼
    └── labels/        # 分類標籤
```

### 智能檔案掃描

```typescript
// 自動檢測檔案類型和市場
interface FileClassification {
  category: 'quarterly' | 'daily' | 'metadata';
  market?: 'tw' | 'us' | 'jp';
  type?: string;
  files: string[];
}

// 範例：自動分類匯入
const scanResults = [
  {
    category: 'quarterly',
    market: 'tw', 
    type: 'balance-sheet',
    files: ['output/quarterly/tw/balance/2330.json', '...']
  },
  {
    category: 'metadata',
    market: undefined,
    type: 'symbols',
    files: ['output/metadata/symbols/tw-symbols.json', '...']
  }
];
```

## 🚨 故障排除

### 1. HTTP 413 Payload Too Large

**問題**: 一次性傳送的數據量太大

**自動檢測**: 系統會自動檢測 413 錯誤並切換到更小批次

**手動解決**:
```bash
# 使用預設的小批次命令
npm run import:symbols:small  # 批次大小 10
npm run sync:labels:chunk     # 分塊大小 100

# 自定義更小的批次
npm run import:symbols -- --batch-size=5
npm run sync:labels -- --chunk-size=30

# 極端情況：逐筆處理
npm run import:symbols -- --batch-size=1
```

### 2. API 端點 404/403 錯誤

**問題**: API 端點不存在或權限不足

**自動處理**: 系統會自動嘗試多個端點格式

**手動檢查**:
```bash
# 檢查 Token 有效性
echo $INTERNAL_AHA_API_TOKEN

# 測試 API 連接
npm run import:fundamental:quarterly --dry-run

# 檢查後端 API 狀態
curl -I $INTERNAL_AHA_API_URL/health
```

### 3. Token 過期或無效

**錯誤提示**: `Token 可能已過期或無效`

**解決方案**:
```bash
# 1. 更新 .env 中的 INTERNAL_AHA_API_TOKEN
vi .env

# 2. 重新獲取 Token (從後端系統)
curl -X POST "$INTERNAL_AHA_API_URL/auth/auto-login" \
     -H "Content-Type: application/json" \
     -d '{"email": "your-admin-email@example.com"}'

# 3. 驗證新 Token
curl -H "Authorization: Bearer $NEW_TOKEN" \
     $INTERNAL_AHA_API_URL/fundamental-data
```

### 4. 數據格式驗證錯誤

**問題**: 匯入的數據格式不符合後端預期

**診斷步驟**:
```bash
# 1. 檢查數據格式
jq '.results[0].data.data[0]' output/quarterly/tw/balance/sample.json

# 2. 使用詳細模式查看錯誤
npx tsx scripts/import-fundamental-api.ts \
    --category quarterly --market tw --verbose

# 3. 單檔案測試
npx tsx scripts/import-fundamental-api.ts \
    --file output/quarterly/tw/balance/2330.json --verbose

# 4. 檢查後端 API schema
curl -H "Authorization: Bearer $INTERNAL_AHA_API_TOKEN" \
     $INTERNAL_AHA_API_URL/api-docs
```

### 5. 網路連接問題

**問題**: 網路不穩定導致請求失敗

**自動重試**: 系統內建重試機制 (最多 3 次)

**手動優化**:
```bash
# 使用更小的批次和更長的超時
npm run import:symbols -- --batch-size=10 --timeout=60000

# 分步執行避免超時
npm run import:symbols:tpe  # 先匯入台灣
npm run import:symbols:us   # 再匯入美國  
npm run import:symbols:jp   # 最後匯入日本
```

## 📊 監控和診斷

### 執行狀態監控

```bash
# 查看匯入統計
npm run pipeline:stats

# 實時監控匯入進度  
watch -n 5 'ls -la output/quarterly/tw/balance/*.json | wc -l'

# 檢查最新匯入日誌
tail -f logs/import-*.log

# 查看 API 回應日誌
tail -f logs/api-client-*.log
```

### 數據完整性檢查

```bash
# 統計已匯入的檔案數量
find output -name "*.json" -type f | wc -l

# 檢查特定市場的數據
ls -la output/quarterly/tw/balance/*.json | wc -l
ls -la output/quarterly/us/*.json | wc -l
ls -la output/quarterly/jp/*.json | wc -l

# 驗證數據結構
for file in output/quarterly/tw/balance/*.json; do
    if jq -e '.results[0].data' "$file" > /dev/null 2>&1; then
        echo "✅ $(basename $file): 數據結構正確"
    else  
        echo "❌ $(basename $file): 數據結構異常"
    fi
done
```

### 性能監控

```bash
# API 回應時間統計
grep "API Response Time" logs/api-client-*.log | \
    awk '{print $NF}' | sort -n | tail -10

# 批次處理統計
grep "Batch processed" logs/import-*.log | \
    awk '{print $4, $6}' | tail -10

# 錯誤率統計  
grep "ERROR" logs/import-*.log | wc -l
grep "SUCCESS" logs/import-*.log | wc -l
```

## 🔄 完整工作流程範例

### 場景 1: 新系統設置

```bash
# 1. 環境準備
cp .env.example .env
# 編輯 .env 設置 INTERNAL_AHA_API_TOKEN

# 2. 驗證環境
./test-fixes.sh

# 3. 完整設置（推薦分步執行）
npm run sync:labels:chunk        # 同步標籤
npm run import:symbols:small     # 匯入股票代碼
npm run import:fundamental:batch # 匯入基本面數據

# 或一次性執行
npm run setup:structured
```

### 場景 2: 日常更新

```bash
# 使用現有爬蟲數據快速更新
npm run setup:structured

# 或分別更新各部分
npm run sync:labels           # 只更新標籤
npm run import:fundamental:tw # 只更新台灣數據
```

### 場景 3: 特定數據更新

```bash
# 只更新台灣季度財務數據
npm run import:fundamental:tw:quarterly

# 只更新美國資產負債表
npx tsx scripts/import-fundamental-api.ts \
    --market us --type balance-sheet

# 只更新特定股票
npx tsx scripts/import-fundamental-api.ts \
    --file output/quarterly/tw/balance/2330.json
```

### 場景 4: 大數據量處理

```bash
# 針對 8000+ 股票的處理方案
# 分市場處理
npm run import:symbols:tpe -- --batch-size=20  # 台灣市場
npm run import:symbols:us -- --batch-size=20   # 美國市場  
npm run import:symbols:jp -- --batch-size=20   # 日本市場

# 使用最小批次（網路不穩定時）
npm run import:symbols -- --batch-size=5

# 分塊同步標籤
npm run sync:labels -- --chunk-size=50
```

## 📋 最佳實踐

### API 整合最佳實踐

1. **測試先行**: 
   - 先用 `--dry-run` 模式測試
   - 小批次驗證後再執行完整匯入

2. **批次優化**:
   - 根據數據量選擇適當批次大小
   - 網路不穩定時使用更小批次

3. **錯誤處理**:
   - 監控 API 回應和錯誤日誌
   - 設置適當的重試和超時參數

4. **環境管理**:
   - 定期更新 API Token
   - 使用環境變數管理不同環境配置

5. **數據驗證**:
   - 匯入前檢查數據格式
   - 匯入後驗證數據完整性

### 開發環境

```bash
# 開發時使用測試模式
export NODE_ENV=development
npm run import:fundamental:quarterly -- --dry-run --verbose

# 啟用調試日誌
export DEBUG=api:*
npm run import:symbols:small
```

### 生產環境

```bash
# 生產環境配置
export NODE_ENV=production
export INTERNAL_AHA_API_URL=https://api.aha.credit

# 使用穩定的批次大小
npm run import:symbols:small
npm run sync:labels:chunk

# 監控執行結果
npm run pipeline:stats
```

---

**版本**: v3.0.0  
**狀態**: ✅ 生產就緒  
**最後更新**: 2025-08-14  
**維護者**: AHA 智投開發團隊