# 📋 Scripts 快速參考卡

## 🚀 最常用命令

```bash
# 日常更新三部曲
npm run sync:labels:chunk     # 1. 同步標籤
npm run import:symbols:small  # 2. 匯入股票
npm run import:fundamental:batch # 3. 匯入財務數據
```

## 📊 批次大小速查

| 命令 | 預設批次 | 安全批次 | 極限批次 |
|------|---------|----------|----------|
| `import:symbols` | 30 | 10 | 5 |
| `sync:labels` | 自動 | 100 | 50 |
| `import:fundamental` | 50 | 20 | 10 |

## 🔧 問題解決速查

### 413 Payload Too Large
```bash
npm run import:symbols:small      # 使用最小批次
npm run import:symbols -- --batch-size=5  # 自訂更小批次
```

### 404 API Not Found
```bash
# 系統會自動嘗試多個端點，通常無需手動處理
# 如仍有問題，檢查後端服務是否正常運行
```

### Token 過期/無效
```bash
# 1. 更新 .env 的 BACKEND_API_TOKEN
# 2. 重新執行命令（會自動讀取新 token）
```

### 網路不穩定
```bash
# 使用極小批次處理
npm run import:symbols -- --batch-size=5
npm run sync:labels -- --chunk-size=30
```

## 📝 環境變數

```bash
# .env 必要設定
BACKEND_API_URL=http://localhost:3000
BACKEND_API_TOKEN=eyJhbGciOiJIUzI1NiIs...
```

## 🎯 工作流程模板

### 初次設置
```bash
# 1. 環境準備
cp .env.example .env
./test-fixes.sh

# 2. 生成映射
npm run generate:mappings

# 3. 同步數據
npm run sync:labels:chunk
npm run import:symbols:small
npm run import:fundamental:batch
```

### 重置系統
```bash
# 軟重置（保留數據結構）
npm run clear:labels
npm run sync:labels:chunk

# 硬重置（完全清理）
npm run clear:labels:hard
npm run pipeline:full
```

### 分市場處理
```bash
# 台灣市場
npm run import:symbols:tpe
npm run clear:labels:tpe

# 美國市場
npm run import:symbols:us
npm run clear:labels:us

# 日本市場
npm run import:symbols:jp
npm run clear:labels:jp
```

## 📊 資料流向圖

```
輸入資料                    處理腳本                     輸出結果
─────────                  ─────────                   ─────────
爬蟲數據      ─────►  generate-mappings    ─────►  mappings.json
mappings.json ─────►  sync-labels         ─────►  後端標籤
mappings.json ─────►  import-symbols      ─────►  後端股票
output/*.json ─────►  import-fundamental  ─────►  後端財務數據
```

## 🔍 調試命令

```bash
# 預覽模式（不執行）
npm run import:symbols:dry
npm run sync:labels:dry
npm run clear:labels:dry

# 查看統計
npm run pipeline:stats

# 測試連接
./test-token-fix.sh
./test-fixes.sh
```

## ⚡ 效能優化

### 記憶體不足
```bash
NODE_OPTIONS="--max-old-space-size=4096" npm run import:symbols
```

### 超時問題
```bash
# 分批處理
npm run import:symbols:tpe --batch-size=10
npm run import:symbols:us --batch-size=10
npm run import:symbols:jp --batch-size=10
```

### 並行處理
```bash
# 同時執行多個市場（在不同終端）
npm run import:symbols:tpe &
npm run import:symbols:us &
npm run import:symbols:jp &
```

## 📌 重要提醒

1. **總是先 dry-run**：執行前先用 `--dry-run` 預覽
2. **從小批次開始**：不確定時用最小批次測試
3. **監控日誌**：注意錯誤訊息和重試次數
4. **定期更新 token**：避免認證問題
5. **分市場處理**：大數據量時分開處理

## 🆘 緊急聯絡

遇到無法解決的問題時：

1. 檢查 `scripts/README.md` 詳細文檔
2. 查看後端日誌 `@finance-strategy/logs/`
3. 執行 `./test-fixes.sh` 診斷問題
4. 檢查網路連接和後端服務狀態

---

最後更新：2025-01-13  
版本：1.0.0