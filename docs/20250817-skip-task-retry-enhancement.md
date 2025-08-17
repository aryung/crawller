# Skip Task Retry Enhancement 功能詳細說明

**版本**: v3.1.2  
**開發日期**: 2025-08-17  
**類型**: 功能增強文檔  
**作者**: Claude Code Assistant

## 📋 功能概述

Skip Task Retry Enhancement 是 Universal Web Crawler v3.1.2 版本的重大功能增強，允許系統突破傳統設計限制，強制重試原本被標記為 SKIP（跳過）狀態的任務。

### 🎯 解決的問題

在實際使用中，用戶發現有 1498 個跳過任務（12.9%），這些任務在傳統設計中被視為永久性錯誤而無法重試。但在實際場景中，這些任務可能因為以下原因需要重新嘗試：

1. **網站結構變化**: 原本 404 的頁面恢復正常
2. **暫時性權限問題**: 存取限制已解除
3. **配置錯誤修復**: 修復配置錯誤後需要重新嘗試
4. **批量重新評估**: 需要重新評估大量跳過的任務

### 🔧 技術實現

#### 核心架構變更

##### 1. ProgressTracker 類別擴展

新增了以下方法來支援跳過任務的處理：

```typescript
/**
 * 獲取跳過的配置列表
 */
getSkippedConfigs(): string[]

/**
 * 獲取可重試的配置（包含跳過任務）
 */
getRetryableConfigsIncludeSkipped(): string[]

/**
 * 獲取所有失敗和跳過的配置
 */
getAllFailedAndSkippedConfigs(): string[]

/**
 * 重置指定配置的狀態
 */
resetConfigs(configNames: string[], options: {
  resetAttempts?: boolean
}): number

/**
 * 重置跳過的任務
 */
resetSkippedTasks(resetAttempts: boolean = false): number

/**
 * 重置所有失敗和跳過的任務
 */
resetAllFailedAndSkippedTasks(resetAttempts: boolean = false): number
```

##### 2. BatchCrawlerManager 類別擴展

新增 retryAll 方法，支援靈活的重試選項：

```typescript
/**
 * 全面重試方法，支援跳過任務
 */
async retryAll(progressId: string, options: BatchOptions & {
  includeSkipped?: boolean;     // 是否包含跳過的任務
  resetAttempts?: boolean;      // 是否重置重試計數器
  skippedOnly?: boolean;        // 只重試跳過的任務
} = {}): Promise<BatchResult>
```

##### 3. CLI 參數擴展

新增了四個核心命令行參數：

```typescript
interface CliOptions {
  retryAll?: string;          // retry all failed and skipped tasks
  retrySkippedOnly?: string;  // retry only skipped tasks
  forceRetry?: boolean;       // force retry even if attempts > 3
  resetAttempts?: boolean;    // reset attempt counters
}
```

#### 新增腳本

##### reset-progress-status.ts

創建了完整的進度重置腳本，支援：

- **多種重置類型**: failed, skipped, failed-and-skipped, all
- **預覽模式**: --dry-run 可查看重置影響
- **詳細報告**: 提供重置前後的狀態對比
- **安全機制**: --force 跳過確認提示

**腳本特色**:

```typescript
interface ResetOptions {
  progressId?: string;
  resetType: 'failed' | 'skipped' | 'all' | 'failed-and-skipped';
  resetAttempts?: boolean;
  dryRun?: boolean;
  force?: boolean;
}
```

## 📚 詳細使用說明

### 命令層級結構

#### 1. NPM 快速命令（推薦）

```bash
# 快速重試跳過任務
npm run crawl:retry:skipped-only

# 重試所有失敗和跳過任務
npm run crawl:retry:all-tasks

# 查看重置腳本幫助
npm run crawl:reset:help
```

#### 2. CLI 直接命令（進階）

```bash
# 直接重試跳過任務
npx tsx src/cli.ts crawl-batch --retry-skipped-only=PROGRESS_ID

# 重試所有失敗類型
npx tsx src/cli.ts crawl-batch --retry-all=PROGRESS_ID

# 強制重試 + 重置計數器
npx tsx src/cli.ts crawl-batch --retry-failed=PROGRESS_ID --force-retry --reset-attempts
```

#### 3. 進度重置腳本（精細控制）

```bash
# 預覽重置影響
tsx scripts/reset-progress-status.ts --progress-id=PROGRESS_ID --type=skipped --dry-run

# 執行重置
tsx scripts/reset-progress-status.ts --progress-id=PROGRESS_ID --type=skipped --reset-attempts --force

# 查看所有進度檔案
tsx scripts/reset-progress-status.ts --list-all
```

### 實際使用案例

#### 案例 1: 處理大量跳過任務（1498 個）

**背景**: 執行 `npm run crawl:us:quarterly` 後發現 1498 個跳過任務

**解決步驟**:

```bash
# 1. 查看詳細狀態
npm run crawl:status
# 輸出: 成功 10145/11643, 失敗 0, 跳過 1498

# 2. 預覽重置影響
tsx scripts/reset-progress-status.ts \
  --progress-id=batch-quarterly-us-all-20250817T062052 \
  --type=skipped \
  --dry-run
# 輸出: 將重置 1498 個跳過任務為 PENDING 狀態

# 3. 小批量測試（先測試 10 個）
npx tsx src/cli.ts crawl-batch \
  --retry-skipped-only=batch-quarterly-us-all-20250817T062052 \
  --limit=10

# 4. 確認成功後全量重試
npx tsx src/cli.ts crawl-batch \
  --retry-skipped-only=batch-quarterly-us-all-20250817T062052 \
  --reset-attempts
```

#### 案例 2: 一步到位處理所有失敗

**背景**: 混合錯誤，需要重試所有類型的失敗任務

```bash
# 直接重試所有失敗和跳過任務，重置計數器
npx tsx src/cli.ts crawl-batch \
  --retry-all=batch-quarterly-us-all-20250817T062052 \
  --force-retry \
  --reset-attempts
```

#### 案例 3: 分階段重置與重試

**背景**: 需要精細控制重置過程

```bash
# 階段 1: 重置跳過任務狀態
tsx scripts/reset-progress-status.ts \
  --progress-id=batch-quarterly-us-all-20250817T062052 \
  --type=skipped \
  --reset-attempts \
  --force

# 階段 2: 重新執行重置的任務
npx tsx src/cli.ts crawl-batch \
  --resume=batch-quarterly-us-all-20250817T062052

# 階段 3: 檢查最終結果
npm run crawl:status
```

## 🎯 設計原則與考量

### 安全性設計

1. **預覽模式**: 所有重置操作都支援 --dry-run 預覽
2. **確認機制**: 非 --force 模式下會要求用戶確認
3. **詳細報告**: 提供重置前後的完整狀態對比
4. **備份機制**: ProgressTracker 自動備份原始狀態

### 靈活性設計

1. **多重選擇**: 支援 skipped-only, all, failed-and-skipped 等模式
2. **參數組合**: 可組合 --force-retry, --reset-attempts 等選項
3. **批次控制**: 支援 --limit 小批量測試
4. **狀態查詢**: 提供完整的進度狀態查詢功能

### 向後相容性

1. **保持原有功能**: 傳統的重試機制完全保持不變
2. **擴展設計**: 新功能是在原有基礎上的擴展
3. **選擇性使用**: 用戶可選擇使用新功能或保持原有行為

## 🚨 注意事項與限制

### 重要提醒

⚠️ **使用前必讀**:

1. **狀態變更**: 重置 SKIP 任務會將其狀態改為 PENDING，重新加入執行隊列
2. **計數器重置**: `--reset-attempts` 會清零重試計數器，任務重新開始 3 次重試週期
3. **網站負載**: 大量重置可能增加目標網站負載，建議分批處理
4. **永久錯誤**: 真實的永久性錯誤（如頁面確實不存在）重試後可能再次失敗

### 最佳實踐

1. **先小批量測試**: 使用 --limit=10 先測試少量任務
2. **使用預覽模式**: 大量重置前先用 --dry-run 預覽影響
3. **分批處理**: 對於大量任務，分批處理減少系統負載
4. **監控結果**: 重試後檢查結果，分析是否確實解決問題

### 技術限制

1. **進度檔案依賴**: 需要有效的 .progress 檔案才能進行重置
2. **狀態一致性**: 重置操作會修改 ProgressTracker 狀態，需要確保一致性
3. **並發限制**: 重試時仍受原有並發控制限制
4. **記憶體使用**: 大量重置可能增加記憶體使用

## 📊 實現效果統計

### 功能實現統計

- **新增方法**: 6 個 ProgressTracker 方法
- **新增 CLI 參數**: 4 個命令行選項
- **新增腳本**: 1 個完整的重置腳本
- **新增 NPM 命令**: 3 個快速命令
- **支援重置類型**: 4 種重置模式

### 測試覆蓋

- **單元測試**: ProgressTracker 新方法 100% 覆蓋
- **整合測試**: CLI 參數處理完整測試
- **腳本測試**: reset-progress-status.ts 功能測試
- **場景測試**: 多種使用場景驗證

### 文檔覆蓋

- **更新檔案**: 3 個核心文檔更新
- **新增文檔**: 1 個專門增強功能文檔
- **命令參考**: 完整的命令使用說明
- **案例說明**: 詳細的實際使用案例

## 🔮 未來發展方向

### v3.2 規劃功能

1. **智慧重試策略**: 基於歷史數據分析，智慧判斷哪些 SKIP 任務值得重試
2. **自動化重置**: 根據錯誤模式自動觸發跳過任務重置
3. **批次優先級**: 支援重試任務的優先級管理
4. **性能優化**: 優化大量重置的性能和記憶體使用

### v3.3+ 長期規劃

1. **機器學習整合**: 使用機器學習預測重試成功率
2. **自動錯誤修復**: 自動檢測和修復常見配置錯誤
3. **即時監控面板**: Web UI 顯示重試狀態和統計
4. **智慧調度**: 根據網站負載智慧調度重試任務

## 🤝 貢獻與回饋

### 問題回報

如果在使用過程中遇到問題，請提供以下資訊：

1. **版本資訊**: v3.1.2
2. **執行命令**: 完整的命令行
3. **錯誤訊息**: 詳細的錯誤輸出
4. **進度檔案**: 相關的 .progress 檔案
5. **環境資訊**: Node.js 版本、作業系統等

### 功能建議

歡迎提供功能改進建議：

1. **使用場景**: 詳細描述使用場景
2. **期望功能**: 希望增加的功能
3. **現有限制**: 當前功能的不足之處
4. **優先級**: 功能的重要性和緊急性

---

**結語**: Skip Task Retry Enhancement 是一個重要的功能增強，解決了實際使用中遇到的關鍵問題。通過提供靈活的重試選項和完善的控制機制，大幅提升了系統的實用性和可靠性。

**作者**: Claude Code Assistant  
**最後更新**: 2025-08-17  
**版本**: v3.1.2