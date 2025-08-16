# Site-based Concurrency 並行處理失效問題分析

**問題編號**: 20250816-issue-sitebased-concurrency-not-parallel  
**發現日期**: 2025-08-16  
**嚴重等級**: 高 (影響系統核心功能)  
**狀態**: 已分析，待修復

## 📋 問題摘要

執行 `npm run crawl:all:site` 6 小時後發現 US 市場數據幾乎沒有被爬取，雖然 Site-based Concurrency 設計目標是讓不同網站並行處理，但實際執行時仍是順序處理模式。

## 🔍 問題現象

### 執行數據統計

| 市場 | 配置檔案數 | 實際爬取 | 完成率 | 進度狀態 |
|------|-----------|---------|--------|----------|
| **JP** | 3,781 | 3,783 | 100% | ✅ 完成 |
| **TW** | 727 | 276 | 38% | ⚠️ 部分完成 |
| **US** | 3,873 | 3 | 0.08% | ❌ 幾乎未開始 |

### 進度檔案分析

```json
{
  "total": 35705,
  "completed": 4055,
  "failed": 0,
  "running": 2,
  "pending": 31648,
  "percentage": 11.36
}
```

**關鍵發現**：
- **JP history**: 3,781 個任務已完成
- **TW history**: 274 個任務已完成  
- **US history**: 0 個任務完成（全部 pending）
- 還有 2 個 TW 任務卡在 "running" 狀態

## 🐛 根本原因分析

### Site-based Concurrency 配置檢查

配置檔案 `src/common/constants/setting.ts` 顯示設計是正確的：

```typescript
export const SITE_CONCURRENCY_SETTINGS: Record<string, SiteConcurrencyConfig> = {
  'tw.stock.yahoo.com': {
    maxConcurrent: 2,
    delayBetweenRequests: 3000,
    // ...
  },
  'finance.yahoo.com': {        // US
    maxConcurrent: 2,
    delayBetweenRequests: 3000,
    // ...
  },
  'finance.yahoo.co.jp': {      // JP
    maxConcurrent: 2,
    delayBetweenRequests: 3000,
    // ...
  }
};
```

**理論上**：應該有 6 個並發請求同時運行（每個網站 2 個）

### BatchCrawlerManager 執行邏輯缺陷

檢查 `src/batch/BatchCrawlerManager.ts` 的 `executeBatch` 方法發現問題：

```typescript
// 問題代碼片段
let taskIndex = 0;
while (taskIndex < tasks.length && !this.shouldStop) {
  const task = tasks[taskIndex];
  
  // 🚨 問題：阻塞式等待
  if (!canExecute) {
    await this.delay(100);    // 等待當前網站有槽位
    continue;                 // 不會檢查下一個任務（可能是不同網站）
  }
  
  taskIndex++;                // 只有當前任務可執行時才前進
  this.executeTask(task, options);
}
```

### 問題核心

1. **線性遍歷任務列表**：
   - 系統按順序遍歷所有任務：JP tasks → TW tasks → US tasks
   - 使用單一 `taskIndex` 指針順序處理

2. **阻塞式等待機制**：
   - 當某個網站達到並發限制（如 JP 已有 2 個任務在執行）
   - 系統會在 `if (!canExecute)` 處等待 100ms
   - **不會跳過去檢查其他網站的任務**

3. **結果**：
   - JP 網站槽位滿時，系統等待而不檢查 TW/US 任務
   - 導致實際執行順序：JP (100%) → TW (38%) → US (0%)
   - Site-based Concurrency 變成了順序執行

## 📊 性能影響分析

### 實際執行時間對比

| 執行模式 | 預期時間 | 實際時間 | 效率 |
|---------|---------|---------|------|
| **理想並行** | 2-3 小時 | - | 100% |
| **當前實現** | 2-3 小時 | 6+ 小時 | 33% |
| **完全順序** | 8-10 小時 | - | 25% |

### 資源利用率

```
理想狀態: [JP: 2] [TW: 2] [US: 2] = 6 concurrent
實際狀態: [JP: 2] [TW: 0] [US: 0] = 2 concurrent (效率 33%)
```

## 🔧 解決方案

### 方案 1：循環檢查（最小改動）

修改任務遍歷邏輯，避免在單一網站處阻塞：

```typescript
private async executeBatch(configNames: string[], options: BatchOptions): Promise<void> {
  // ... 初始化任務 ...
  
  let taskIndex = 0;
  let skipCount = 0;  // 記錄連續跳過的次數
  
  while (taskIndex < tasks.length && !this.shouldStop) {
    const task = tasks[taskIndex];
    
    if (!canExecute) {
      skipCount++;
      
      // 如果連續跳過太多次，循環到下一個任務
      if (skipCount < tasks.length) {
        taskIndex = (taskIndex + 1) % tasks.length;
        continue;
      } else {
        // 所有任務都檢查過了，真的需要等待
        await this.delay(100);
        skipCount = 0;
        continue;
      }
    }
    
    skipCount = 0;
    taskIndex++;
    this.executeTask(task, options);
  }
}
```

### 方案 2：按網站分組並行（推薦）

重構為真正的跨網站並行處理：

```typescript
private async executeBatch(configNames: string[], options: BatchOptions): Promise<void> {
  // 按網站分組任務
  const tasksByDomain = new Map<string, CrawlTask[]>();
  
  for (const task of tasks) {
    const domain = task.domain || 'default';
    if (!tasksByDomain.has(domain)) {
      tasksByDomain.set(domain, []);
    }
    tasksByDomain.get(domain)!.push(task);
  }
  
  // 為每個網站創建獨立的執行器
  const domainExecutors = Array.from(tasksByDomain.entries()).map(
    ([domain, domainTasks]) => this.processDomainTasks(domain, domainTasks, options)
  );
  
  // 並行執行所有網站的任務
  await Promise.all(domainExecutors);
}

private async processDomainTasks(
  domain: string,
  tasks: CrawlTask[],
  options: BatchOptions
): Promise<void> {
  const domainConfig = getSiteConcurrencyConfig(`https://${domain}`);
  const maxConcurrent = domainConfig.maxConcurrent;
  const activeTasks = new Set<Promise<void>>();
  
  for (const task of tasks) {
    if (this.shouldStop) break;
    
    // 等待該網站有可用槽位（只影響該網站）
    while (activeTasks.size >= maxConcurrent && !this.shouldStop) {
      // 等待任一任務完成
      await Promise.race(activeTasks);
    }
    
    // 執行任務
    const taskPromise = this.executeTaskAsync(task, options)
      .finally(() => activeTasks.delete(taskPromise));
    
    activeTasks.add(taskPromise);
  }
  
  // 等待該網站所有任務完成
  await Promise.all(activeTasks);
}
```

### 方案 3：智能任務隊列

實現動態任務調度（注意：避免短板效應）：

```typescript
private async executeBatch(configNames: string[], options: BatchOptions): Promise<void> {
  // 按網站分組待處理隊列
  const domainQueues = new Map<string, CrawlTask[]>();
  const processingTasks = new Set<Promise<void>>();
  
  // 分組初始化
  for (const task of tasks) {
    const domain = task.domain || 'default';
    if (!domainQueues.has(domain)) {
      domainQueues.set(domain, []);
    }
    domainQueues.get(domain)!.push(task);
  }
  
  // 為每個網站啟動調度器
  const schedulers = Array.from(domainQueues.entries()).map(
    ([domain, queue]) => this.scheduleDomainTasks(domain, queue, options)
  );
  
  await Promise.all(schedulers);
}
```

## 🚀 立即解決方案

### 臨時解決方案（無需改代碼）

分別執行各市場，實現真正的並行：

```bash
# 方法 1: 背景執行
npm run crawl:tw:site &
npm run crawl:us:site &  
npm run crawl:jp:site &

# 方法 2: 分別執行
npm run crawl:us:site    # 直接爬取 US 數據
```

### 恢復現有進度

```bash
# 恢復中斷的執行（會從 US 開始）
npx tsx src/cli.ts crawl-batch --resume=batch-all-all-all-20250816T091115
```

## 📈 預期修復效果

| 修復方案 | 開發成本 | 執行時間 | 資源利用率 | 穩定性 |
|---------|---------|---------|-----------|--------|
| **方案 1** | 低 | 4-5 小時 | 60% | 中 |
| **方案 2** | 中 | 2-3 小時 | 90% | 高 |
| **方案 3** | 高 | 2-3 小時 | 85% | 中 |
| **臨時方案** | 無 | 2-3 小時 | 95% | 高 |

## 📝 經驗教訓

### 設計問題

1. **設計與實現不符**：
   - Site-based Concurrency 的設計理念是正確的
   - 但實現時沒有考慮到任務調度的順序依賴

2. **缺乏端到端測試**：
   - 單元測試可能通過，但整體流程有問題
   - 需要增加集成測試驗證並行效果

3. **監控不足**：
   - 沒有實時監控各網站的執行狀態
   - 需要增加並發度量和警報

### 改進建議

1. **架構改進**：
   - 採用真正的並行調度設計
   - 網站間解耦，避免相互影響

2. **測試增強**：
   - 添加並行執行的集成測試
   - 模擬不同網站的響應時間差異

3. **監控強化**：
   - 實時顯示各網站的並發狀態
   - 添加執行效率指標

## 🔗 相關資源

- **配置檔案**: `src/common/constants/setting.ts`
- **核心邏輯**: `src/batch/BatchCrawlerManager.ts`
- **進度檔案**: `.progress/batch-all-all-all-20250816T091115.json`
- **相關文檔**: `docs/20250816-site-based-concurrency-guide.md`

## ✅ 行動項目

- [ ] 選擇修復方案並實施
- [ ] 增加並行執行的集成測試
- [ ] 添加實時監控儀表板
- [ ] 更新相關文檔和指南
- [ ] 驗證修復效果並收集性能數據

---

**文檔建立**: 2025-08-16  
**最後更新**: 2025-08-16  
**審查狀態**: 待審查