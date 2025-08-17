# 爬蟲統計分析完整指南

**版本**: v3.1.2  
**更新日期**: 2025-08-17  
**作者**: Claude Code Assistant

## 📊 快速統計命令

### 基本統計命令

```bash
# 快速統計（最快，只顯示總數）
npm run stats:quick

# 完整統計報告（包含所有市場、錯誤分析、建議命令）
npm run stats

# 簡化摘要（三個市場的基本數據）
npm run stats:summary
```

### 按市場分析

```bash
# 台灣市場統計
npm run stats:tw

# 美國市場統計
npm run stats:us

# 日本市場統計
npm run stats:jp
```

### 專項分析

```bash
# 只顯示錯誤分析
npm run stats:errors

# 按類別分析（季度/每日數據）
npm run stats:quarterly
npm run stats:daily
```

## 📈 統計報告內容

### 1. 市場數據統計
- **總檔案數**: 每個市場的 JSON 檔案總數
- **類別分布**: 按數據類型（balance, cash, income 等）的檔案數量
- **成功率**: 基於預期數量的完成百分比

### 2. 錯誤分析
- **總錯誤數**: 錯誤日誌中的總錯誤條目
- **按類型分類**: Network, Timeout, Empty Data, Other
- **按市場分類**: TW, US, JP 的錯誤分布
- **按類別分類**: balance-sheet, cash-flow 等的錯誤分布

### 3. 進行中任務
- **批次任務進度**: 顯示當前執行中的爬取任務
- **完成百分比**: 每個批次的完成進度
- **恢復建議**: 提供續傳和重試命令

### 4. 重試建議
- **失敗率分析**: 自動識別高失敗率的類別
- **網路優化**: 基於錯誤類型提供並發度和超時調整建議
- **重試命令**: 生成針對性的重試指令

## 🎯 實際使用案例

### 日常監控工作流程

```bash
# 1. 快速檢查總體狀況
npm run stats:quick

# 2. 如果發現異常，查看詳細摘要
npm run stats:summary

# 3. 分析特定市場問題
npm run stats:tw  # 檢查台灣市場

# 4. 深入分析錯誤原因
npm run stats:errors

# 5. 執行完整報告獲取重試建議
npm run stats
```

### 問題診斷工作流程

```bash
# 1. 發現爬取失敗多，先看錯誤統計
npm run stats:errors

# 2. 確認是哪個市場的問題
npm run stats:us  # 例如檢查美國市場

# 3. 查看完整報告獲取建議
npm run stats

# 4. 根據建議執行重試
npm run crawl:quarterly -- --timeout=120000 --retry-failed
```

### 性能優化工作流程

```bash
# 1. 定期執行完整報告
npm run stats

# 2. 分析各市場完成度
npm run stats:summary

# 3. 識別低效率的類別
npm run stats:tw  # 查看各類別檔案數

# 4. 根據建議調整爬取策略
# 例如：降低並發度、增加超時時間
```

## 📋 輸出格式說明

### 市場統計格式
```
TW 市場:
  總檔案數: 4362
  成功率: 85.2%
  類別分布:
    ✅ balance: 727 檔案
    ✅ cash: 727 檔案
    ❌ income: 45 檔案  # 紅色表示數量較少
```

### 錯誤統計格式
```
⚠️ 錯誤統計:
  總錯誤數: 2121
  按類型:
    - Timeout: 375 (17.7%)    # 超時錯誤
    - Network: 1200 (56.6%)   # 網路錯誤
    - Other: 546 (25.7%)      # 其他錯誤
```

### 重試建議格式
```
🔄 建議的重試命令:
# 大量超時錯誤，建議增加超時時間:
  npm run crawl:quarterly -- --timeout=120000 --retry-failed

# 大量網路錯誤，建議降低並發數:
  npm run crawl:quarterly -- --concurrent=1 --delay=5000 --retry-failed
```

## 🔧 高級用法

### 組合使用
```bash
# 先快速檢查，再詳細分析
npm run stats:quick && npm run stats:tw

# 錯誤分析後立即查看完整報告
npm run stats:errors && npm run stats
```

### 定時監控
```bash
# 每小時執行一次快速統計
*/60 * * * * cd /path/to/crawler && npm run stats:quick

# 每天生成完整報告
0 9 * * * cd /path/to/crawler && npm run stats > daily-stats.log
```

### 結果過濾
```bash
# 只查看成功的市場
npm run stats:summary | grep "100.0%"

# 只查看有錯誤的部分
npm run stats:errors | grep -A 5 "按類型"
```

## 💡 提示與技巧

1. **定期清理**: 統計大量檔案時可能較慢，建議定期清理舊的輸出檔案
2. **錯誤日誌**: `output/errors.log` 包含詳細錯誤信息，可配合統計結果分析
3. **進度檔案**: `.progress/` 目錄的進度檔案會影響統計結果，注意及時清理
4. **重試建議**: 統計報告會根據錯誤模式自動生成重試策略建議

## 🔗 相關文檔

- **[完整系統指南](20250814-complete-system-guide.md)** - 系統概述和監控診斷
- **[Pipeline Retry & Batch 功能指南](20250815-pipeline-retry-batch-guide.md)** - 重試機制和故障排除
- **[Batch Crawler 重試機制指南](20250816-batch-crawler-retry-guide.md)** - 批量處理和錯誤分析

---

**更新日期**: 2025-08-17  
**版本**: v3.1.2  
**作者**: Claude Code Assistant