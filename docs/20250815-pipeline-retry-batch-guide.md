# Pipeline Retry & Batch 功能完整指南

**版本**: v3.0.0  
**更新日期**: 2025-08-15  
**適用系統**: Universal Web Crawler

## 🎯 概述

Universal Web Crawler v3.0 提供完整的重試機制和批次處理功能，確保大規模數據爬取的穩定性和可靠性。本指南詳細說明重試機制的工作原理、批次處理功能、以及最佳實踐。

## 📊 重試機制 (Retry System)

### 🗂️ 數據存儲

#### 重試記錄存儲位置
```
output/pipeline-retries.json
```

#### 重試記錄結構
```typescript
interface RetryRecord {
  configFile: string;        // 配置檔案路徑
  symbolCode: string;        // 股票代碼 (如: "2330", "AAPL")
  reportType: string;        // 報表類型 (eps, balance-sheet, cash-flow-statement)
  region: string;            // 市場區域 (TW, US, JP)
  timestamp: string;         // 記錄建立時間 (ISO格式)
  reason: 'empty_data' | 'execution_failed' | 'timeout';
  retryCount: number;        // 當前重試次數 (1-3)
  maxRetries: number;        // 最大重試次數 (預設: 3)
  lastRetryAt?: string;      // 最後重試時間
}
```

#### 重試記錄範例
```json
[
  {
    "configFile": "config-categorized/quarterly/tw/yahoo-finance-tw-eps-2330_TW.json",
    "symbolCode": "2330",
    "reportType": "eps",
    "region": "TW",
    "timestamp": "2025-08-15T10:30:00.000Z",
    "reason": "empty_data",
    "retryCount": 1,
    "maxRetries": 3,
    "lastRetryAt": "2025-08-15T10:35:00.000Z"
  }
]
```

### 🔄 重試觸發條件

#### 1. 空數據檢測 (empty_data)
```typescript
// 觸發條件
- 爬取成功但數據為空
- 財務數據陣列長度為 0
- 關鍵欄位缺失或無效

// 自動檢測項目
- fiscalPeriods: 期間數據
- eps/revenue/cash-flow 數值陣列
- 結構化數據格式驗證
```

#### 2. 執行失敗 (execution_failed)
```typescript
// 觸發條件
- 網頁載入失敗
- CSS 選擇器找不到元素
- JavaScript 執行錯誤
- 網路連接問題

// 錯誤類型
- Playwright 瀏覽器錯誤
- 頁面超時 (預設: 10分鐘)
- 記憶體不足
```

#### 3. 超時錯誤 (timeout)
```typescript
// 觸發條件
- 單個配置執行超過時間限制
- 網頁載入超時
- 數據處理超時

// 預設超時設定
- 頁面載入: 30秒
- 單個配置: 10分鐘
- 批次處理: 60分鐘
```

### ⚙️ 重試策略

#### 指數退避延遲 (Exponential Backoff)
```typescript
// 延遲計算公式
delay = baseDelay * Math.pow(2, retryCount - 1)

// 實際延遲時間
第1次重試: 5秒    (5000ms * 2^0)
第2次重試: 10秒   (5000ms * 2^1)
第3次重試: 20秒   (5000ms * 2^2)
```

#### 重試限制
- **最大重試次數**: 3次 (可配置)
- **最大隊列長度**: 1000項目
- **過期清理**: 7天自動清理
- **記憶體保護**: 大隊列自動分批處理

## 🔧 重試管理命令

### 基本重試命令

```bash
# 查看重試隊列狀態
npm run pipeline:retry-status

# 執行重試隊列
npm run pipeline:retry

# 清空重試隊列 (謹慎使用)
npm run pipeline:clear-retries

# 只執行重試 (跳過正常爬取)
npm run pipeline:retry-only

# 停用重試機制
npm run pipeline:no-retry
```

### 進階重試控制

```bash
# 自定義重試參數
npx tsx src/cli-pipeline.ts run --max-retries=5 --retry-delay=3000

# 重試特定區域
npx tsx src/cli-pipeline.ts retry --region=TW

# 重試特定類型
npx tsx src/cli-pipeline.ts retry --report-type=eps

# 查看重試統計
npx tsx src/cli-pipeline.ts retry-stats
```

### 重試狀態查詢

```bash
# 查看隊列概況
npm run pipeline:retry-status
# 輸出:
# 📊 重試隊列狀態:
# 總項目: 15
# 按區域: TW(8), US(5), JP(2)
# 按類型: eps(6), balance-sheet(4), cash-flow(5)
# 按原因: empty_data(10), execution_failed(3), timeout(2)

# 詳細重試記錄
npx tsx src/cli-pipeline.ts retry-status --detailed
```

## 🚀 批次處理系統 (Batch Processing)

### 📋 crawl-batch 命令完整參數

```bash
npx tsx src/cli.ts crawl-batch [選項]

# 基本控制選項
--config <path>           配置檔案目錄 (預設: config-categorized)
--output <path>           輸出目錄 (預設: output)
--concurrent <num>        併發數量 (預設: 3)
--delay <ms>              請求間隔毫秒數 (預設: 5000)

# 範圍控制選項
--category <type>         指定類別 (daily|quarterly|metadata)
--market <region>         指定市場 (tw|us|jp)
--type <datatype>         指定數據類型 (eps|balance-sheet|financials等)
--start-from <num>        從第幾個開始執行 (預設: 0)
--limit <num>             限制執行數量

# 重試控制選項
--retry-attempts <num>    最大重試次數 (預設: 3)
--resume <id>             恢復指定進度ID的執行
--retry-failed <id>       只重試失敗的配置

# 狀態控制選項
--pause                   暫停當前執行
--status                  查看執行狀態
--stats                   顯示統計資訊
--error-report            生成錯誤報告
--performance-report      生成性能報告

# 調試選項
--progress-id <id>        指定進度ID
--verbose                 詳細日誌
```

### 🔄 斷點續傳機制

#### 進度追蹤
```typescript
// 進度記錄格式
interface BatchProgress {
  progressId: string;           // 唯一進度ID
  startTime: string;           // 開始時間
  totalConfigs: number;        // 總配置數量
  completedConfigs: number;    // 已完成數量
  failedConfigs: string[];     // 失敗配置列表
  currentConfig?: string;      // 當前處理配置
  estimatedTimeRemaining?: number;  // 預估剩餘時間
}
```

#### 續傳操作
```bash
# 查看進度狀態
npm run crawl:status
# 輸出進度ID和完成狀態

# 恢復指定進度
npx tsx src/cli.ts crawl-batch --resume=batch_20250815_103045

# 只重試失敗項目
npx tsx src/cli.ts crawl-batch --retry-failed=batch_20250815_103045

# 從特定位置繼續
npx tsx src/cli.ts crawl-batch --start-from=150 --category=quarterly
```

### 📊 批次狀態管理

#### 執行狀態查詢
```bash
# 基本狀態
npm run crawl:status

# 詳細統計
npm run crawl:stats

# 錯誤報告
npm run crawl:errors

# 性能報告
npx tsx src/cli.ts crawl-batch --performance-report
```

#### 狀態輸出範例
```
📊 批次執行狀態:
進度ID: batch_20250815_103045
開始時間: 2025-08-15 10:30:45
總配置: 500
已完成: 387 (77.4%)
失敗: 15 (3.0%)
當前處理: yahoo-finance-tw-eps-2330_TW.json
預估剩餘: 25分鐘

📈 區域分布:
TW: 200/250 (80%)
US: 150/200 (75%)
JP: 37/50 (74%)

🚫 失敗原因:
empty_data: 8
execution_failed: 5
timeout: 2
```

## 💡 最佳實踐

### 🎯 生產環境推薦配置

#### 大批量爬取策略
```bash
# 分階段執行 - 降低風險
npm run crawl:tw:quarterly --limit=100 --concurrent=2
# 檢查結果後繼續
npm run crawl:tw:quarterly --start-from=100 --limit=100

# 分類別執行 - 便於管理
npm run crawl:quarterly:eps       # 先爬取EPS數據
npm run crawl:quarterly:balance   # 再爬取資產負債表
npm run crawl:quarterly:cash-flow # 最後爬取現金流量表
```

#### 網路不穩定環境設定
```bash
# 降低併發，增加重試
npx tsx src/cli.ts crawl-batch \
  --concurrent=1 \
  --delay=10000 \
  --retry-attempts=5 \
  --category=quarterly
```

#### 記憶體使用最佳化
```bash
# 小批次處理
npx tsx src/cli.ts crawl-batch \
  --limit=50 \
  --concurrent=1 \
  --category=quarterly \
  --market=tw

# 分時段執行
# 上午: npm run crawl:tw:quarterly --limit=200
# 下午: npm run crawl:us:quarterly --limit=200
# 晚上: npm run crawl:jp:quarterly --limit=200
```

### ⚡ 性能優化指南

#### 併發數設定建議
```bash
# 本地開發環境
--concurrent=1    # 穩定測試
--concurrent=2    # 中等負載

# 伺服器環境 (8GB+ RAM)
--concurrent=3    # 推薦設定
--concurrent=5    # 高性能伺服器

# 雲端環境
--concurrent=2    # 避免IP封鎖
--delay=8000      # 增加請求間隔
```

#### 重試策略調整
```bash
# 穩定網路環境
--retry-attempts=2 --retry-delay=3000

# 不穩定網路環境
--retry-attempts=5 --retry-delay=10000

# 快速測試環境
--retry-attempts=1 --retry-delay=1000
```

## 🔧 故障排除手冊

### 🚨 常見問題診斷

#### 1. 重試隊列過大
```bash
# 症狀: 重試隊列累積 > 100項目
npm run pipeline:retry-status
# 顯示: 總項目: 150+

# 解決方案
# 1. 檢查失敗原因
npm run crawl:errors

# 2. 暫停新增重試
npm run pipeline:no-retry

# 3. 分批處理重試
npm run pipeline:retry --limit=20

# 4. 清理過期記錄
npx tsx src/cli-pipeline.ts cleanup-expired-retries
```

#### 2. 配置文件錯誤
```bash
# 症狀: execution_failed 錯誤頻繁
# 解決方案
# 1. 驗證配置文件
npm run validate config-categorized/quarterly/tw/problematic-config.json

# 2. 測試單一配置
npx tsx src/cli.ts --config config-categorized/quarterly/tw/test-config.json

# 3. 檢查選擇器有效性
npx tsx src/cli.ts validate --detailed
```

#### 3. 網路超時問題
```bash
# 症狀: timeout 錯誤集中出現
# 解決方案
# 1. 增加超時時間
npx tsx src/cli.ts crawl-batch --timeout=20000

# 2. 降低併發數
npx tsx src/cli.ts crawl-batch --concurrent=1

# 3. 增加請求間隔
npx tsx src/cli.ts crawl-batch --delay=15000
```

#### 4. 記憶體不足問題
```bash
# 症狀: 程序意外終止，記憶體錯誤
# 解決方案
# 1. 限制批次大小
npx tsx src/cli.ts crawl-batch --limit=20

# 2. 增加 Node.js 記憶體限制
NODE_OPTIONS="--max-old-space-size=4096" npm run crawl:quarterly

# 3. 分階段執行
npm run crawl:tw:quarterly --start-from=0 --limit=100
npm run crawl:tw:quarterly --start-from=100 --limit=100
```

### 📊 監控和維護

#### 定期檢查清單
```bash
# 每日檢查
npm run pipeline:retry-status       # 檢查重試隊列
npm run crawl:stats                 # 檢查批次狀態

# 每週維護
npm run pipeline:clear-retries      # 清理過期重試 (謹慎)
npm run crawl:errors                # 分析錯誤模式

# 每月維護
find output/ -name "*.json" -mtime +30 -delete  # 清理舊數據
npm run configs:validate:all        # 驗證配置文件
```

#### 日誌分析指南
```bash
# 查看執行日誌
tail -f logs/pipeline-*.log

# 分析錯誤模式
grep "ERROR" logs/pipeline-*.log | sort | uniq -c

# 監控重試情況
grep "添加重試項目" logs/pipeline-*.log | wc -l

# 追蹤性能問題
grep "執行時間" logs/pipeline-*.log | awk '{print $NF}' | sort -n
```

## 🔗 相關文檔

- **[完整系統指南](20250814-complete-system-guide.md)** - 系統概述和快速開始
- **[API 整合指南](20250814-api-integration-guide.md)** - 數據匯入和批次處理
- **[開發參考手冊](20250814-development-reference.md)** - 技術細節和開發流程
- **[CLAUDE.md](../CLAUDE.md)** - Claude 協作指南

## ❓ 常見問題 FAQ

### Q: 重試機制會影響正常爬取嗎？
**A**: 不會。重試機制在背景運行，不影響新的爬取任務。可以使用 `--disable-retry` 完全停用。

### Q: 如何確保批次處理不會重複爬取？
**A**: 系統會檢查輸出檔案是否已存在，並驗證數據完整性。使用 `--force` 可強制重新爬取。

### Q: 重試隊列的數據會永久保存嗎？
**A**: 重試記錄會自動清理 7 天前的過期項目。可以使用 `npm run pipeline:clear-retries` 手動清理。

### Q: 如何在雲端環境中避免 IP 封鎖？
**A**: 使用 `--concurrent=1 --delay=10000` 降低請求頻率，並考慮使用代理服務器。

### Q: 批次處理中斷後如何恢復？
**A**: 使用 `npm run crawl:status` 查看進度ID，然後用 `--resume=progress_id` 恢復執行。

---

**最後更新**: 2025-08-15  
**文檔版本**: v3.0.0  
**維護者**: Universal Web Crawler Team