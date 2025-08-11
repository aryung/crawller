# Scripts 腳本功能說明

本目錄包含所有與後端 API 整合的腳本，用於數據同步、標籤管理和股票匯入等功能。

## 📋 腳本總覽

| 腳本名稱 | 主要功能 | 批次大小 | API 端點 |
|---------|---------|----------|----------|
| `sync-category-labels-simple.ts` | 同步產業標籤 | 100-200 | `/label-industry/bulk-sync-mappings` |
| `clear-industry-labels.ts` | 清理產業標籤 | N/A | 多端點自動偵測 |
| `import-symbols.ts` | 匯入股票代碼 | 30 | 多端點自動偵測 |
| `import-fundamental-api.ts` | 匯入基本面數據 | 50 | `/fundamental-data/bulk-create` |
| `generate-category-symbol-mapping.ts` | 生成分類映射 | N/A | 本地處理 |

## 🔧 核心腳本詳解

### 1. sync-category-labels-simple.ts

**用途**：將本地的產業分類標籤同步到後端資料庫

**資料來源**：
- `data/category-symbol-mappings.json`

**主要功能**：
- 批量創建產業標籤
- 建立股票與標籤的關聯
- 支援分塊處理大數據量

**命令選項**：
```bash
# 基本使用
npx tsx scripts/sync-category-labels-simple.ts

# 選項參數
--dry-run              # 預覽模式，不執行實際同步
--chunk-size=100       # 設定分塊大小（預設根據數據量自動調整）
--progress             # 顯示進度報告
```

**分塊策略**：
```javascript
// 自動分塊邏輯
總數據量 < 200 項 → 不分塊
200-2000 項 → 分塊大小 200
2000-5000 項 → 分塊大小 150
5000-10000 項 → 分塊大小 100
> 10000 項 → 分塊大小 50
```

**範例輸出**：
```
🚀 簡化版類別標籤同步
📊 映射資料統計:
  🇹🇼 TPE: 28 個產業分類, 2454 個股票
  🇺🇸 US: 63 個產業分類, 4251 個股票
  🇯🇵 JP: 33 個產業分類, 1676 個股票
✅ 總計: 124 個產業分類, 8381 個股票

📦 載荷分析:
  • 預估大小: 0.48 MB
  • 建議策略: 分塊處理
  • 建議分塊大小: 100
```

---

### 2. clear-industry-labels.ts

**用途**：清理後端資料庫中的產業標籤

**功能特點**：
- 支援軟刪除（設為 inactive）和硬刪除（永久刪除）
- 可按市場過濾（TPE、US、JP）
- 可按名稱模式過濾
- 自動嘗試多個 API 端點

**命令選項**：
```bash
# 基本使用
npx tsx scripts/clear-industry-labels.ts --confirm

# 選項參數
--dry-run              # 預覽要刪除的標籤
--confirm              # 確認執行刪除（必需）
--force-hard-delete    # 硬刪除（永久刪除）
--market=TPE           # 只刪除特定市場標籤
--pattern="產業*"      # 只刪除符合模式的標籤
--api-url=http://...  # 指定 API URL
--api-token=...        # 指定認證 token
```

**API 端點嘗試順序**：
```javascript
// 硬刪除端點
[
  `/label-industry/labels/${id}/force-delete?hard=true`,
  `/labels/${id}/force-delete?hard=true`,
  `/label-industry/labels/${id}?hard=true`,
  `/labels/${id}?hard=true`
]

// 軟刪除端點
[
  `/label-industry/labels/${id}/force-delete`,
  `/labels/${id}/force-delete`,
  `/label-industry/labels/${id}`,
  `/labels/${id}`
]
```

**標籤解碼邏輯**：
```javascript
// 編碼格式: {MarketRegion}_{CategoryId}_{Name}
// 範例: TPE_1_水泥工業
{
  marketRegion: "TPE",
  categoryId: "1",
  name: "水泥工業"
}
```

---

### 3. import-symbols.ts

**用途**：批量匯入股票代碼到後端資料庫

**資料來源**：
- `data/category-symbol-mappings.json`

**主要功能**：
- 批量創建股票記錄
- 支援市場過濾
- 自動清理股票代碼後綴
- 智能批次處理

**命令選項**：
```bash
# 基本使用
npx tsx scripts/import-symbols.ts

# 選項參數
--dry-run              # 預覽模式
--market=TPE           # 只匯入特定市場（TPE/US/JP）
--batch-size=30        # 設定批次大小（預設 30）
--api-url=http://...  # 指定 API URL
--api-token=...        # 指定認證 token
```

**批次處理建議**：
```
數據量 < 100：批次 50-100
數據量 100-1000：批次 30-50
數據量 1000-5000：批次 20-30
數據量 > 5000：批次 10-20
網路不穩定：批次 5-10
```

**API 端點嘗試順序**：
```javascript
[
  '/symbols/bulk',
  '/symbols/bulk-create',
  '/symbols/batch-create',
  '/symbols'
]
```

**股票資料格式**：
```javascript
{
  symbolCode: "2330",          // 股票代碼（已清理後綴）
  name: "台積電",               // 股票名稱
  exchangeArea: "TPE",         // 交易所區域
  assetType: "EQUITY",         // 資產類型
  regionalData: {              // 區域特定資料
    originalSymbolCode: "2330.TW",
    category: "半導體業",
    categoryId: "24",
    market: "TPE"
  }
}
```

---

### 4. import-fundamental-api.ts

**用途**：匯入基本面財務數據

**資料來源**：
- `output/` 目錄下的爬蟲結果檔案

**支援的數據類型**：
- EPS（每股盈餘）
- 資產負債表
- 現金流量表
- 損益表
- 財務比率

**命令選項**：
```bash
# 基本使用
npx tsx scripts/import-fundamental-api.ts --file output/yahoo-finance-tw-eps-2330_TW.json

# 批量處理
npx tsx scripts/import-fundamental-api.ts --dir output/ --pattern "*eps*"

# 選項參數
--dry-run              # 預覽模式
--file=...            # 指定單一檔案
--dir=...             # 指定目錄
--pattern=...         # 檔案名稱模式
--batch-size=50       # 批次大小
```

---

### 5. generate-category-symbol-mapping.ts

**用途**：生成產業分類與股票的映射關係

**資料來源**：
- 台灣：`data/tw-listed-companies.json`
- 美國：Yahoo Finance 爬蟲數據
- 日本：Yahoo Finance 爬蟲數據

**輸出檔案**：
- `data/category-symbol-mappings.json`

**資料結構**：
```javascript
{
  "TPE": [
    {
      "category": "水泥工業",
      "categoryId": "1",
      "symbols": [
        { "symbolCode": "1101.TW", "name": "台泥" },
        { "symbolCode": "1102.TW", "name": "亞泥" }
      ]
    }
  ],
  "US": [...],
  "JP": [...]
}
```

## 🔄 資料處理流程

```
1. 爬蟲獲取數據
   ↓
2. generate-category-symbol-mapping.ts
   生成 category-symbol-mappings.json
   ↓
3. sync-category-labels-simple.ts
   同步標籤到後端
   ↓
4. import-symbols.ts
   匯入股票代碼
   ↓
5. import-fundamental-api.ts
   匯入財務數據
```

## 🛠️ 環境配置

所有腳本都會自動讀取 `.env` 檔案：

```bash
# .env 範例
BACKEND_API_URL=http://localhost:3000
BACKEND_API_TOKEN=eyJhbGciOiJIUzI1NiIs...
```

**Token 獲取方式**：
1. 使用測試帳號自動登入（localhost 環境）
2. 從 `.env` 檔案讀取
3. 命令列參數指定

## 🚨 常見問題處理

### HTTP 413 Payload Too Large

**問題**：請求資料量太大
**解決**：
```bash
# 減小批次大小
npm run import:symbols -- --batch-size=10
npm run sync:labels -- --chunk-size=50
```

### HTTP 404 Not Found

**問題**：API 端點不存在
**解決**：腳本會自動嘗試多個端點，通常能自動解決

### Token 過期

**問題**：認證 token 無效
**解決**：
1. 更新 `.env` 中的 `BACKEND_API_TOKEN`
2. 腳本會嘗試自動登入（localhost）

### 網路超時

**問題**：請求超時
**解決**：
```bash
# 使用更小的批次
npm run import:symbols -- --batch-size=5
```

## 📊 效能優化建議

1. **分市場處理**：
   ```bash
   npm run import:symbols:tpe
   npm run import:symbols:us
   npm run import:symbols:jp
   ```

2. **使用進度報告**：
   ```bash
   npm run sync:labels -- --progress
   ```

3. **先預覽再執行**：
   ```bash
   npm run import:symbols:dry
   npm run sync:labels:dry
   ```

4. **監控記憶體使用**：
   大數據量處理時，可能需要增加 Node.js 記憶體限制：
   ```bash
   NODE_OPTIONS="--max-old-space-size=4096" npm run import:symbols
   ```

## 📝 開發指南

### 新增腳本模板

```typescript
#!/usr/bin/env tsx
import 'dotenv/config';
import { ApiClient, createApiClient } from '../src/common/api-client';
import chalk from 'chalk';
import ora from 'ora';
import { program } from 'commander';

// CLI 設定
program
  .name('script-name')
  .description('腳本描述')
  .option('--dry-run', '預覽模式', false)
  .option('--api-url <url>', 'API URL', process.env.BACKEND_API_URL || 'http://localhost:3000')
  .option('--api-token <token>', 'API token', process.env.BACKEND_API_TOKEN)
  .parse();

const options = program.opts();

async function main() {
  // Token 處理
  let apiToken = process.env.BACKEND_API_TOKEN || options.apiToken;
  
  // 創建 API 客戶端
  const apiClient = createApiClient({
    apiUrl: options.apiUrl,
    apiToken: apiToken,
  });
  
  // 執行邏輯
  try {
    // ...
  } catch (error) {
    console.error(chalk.red('執行失敗'), error);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
```

### 測試腳本

```bash
# 單元測試
npm test scripts/*.test.ts

# 整合測試（使用測試資料庫）
TEST_MODE=true npm run import:symbols:dry
```

## 📚 相關文檔

- [主要 README](../README.md) - 專案總覽
- [API Client 文檔](../src/common/README.md) - API 客戶端說明
- [Pipeline 文檔](../src/pipeline/README.md) - Pipeline 架構說明

---

最後更新：2025-01-13