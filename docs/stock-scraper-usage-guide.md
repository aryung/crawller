# 股票爬蟲腳本使用指南

## 📋 概述

本指南專門介紹如何使用股票爬蟲腳本 (`scrape-yahoo-jp-stock-details.js` 和 `scrape-yahoo-tw-stock-details.js`) 進行大規模股票數據採集。這些腳本支援智能分頁處理、批量數據提取，並提供豐富的命令行參數配置。

## 🚀 快速開始

### 安裝依賴
```bash
cd /Users/aryung/Downloads/Workshop/crawler
npm install
```

### 基本執行
```bash
# Yahoo Japan 股票爬蟲
npx tsx scripts/scrape-yahoo-jp-stock-details.ts

# Yahoo Taiwan 股票爬蟲 (如果存在)
npx tsx scripts/scrape-yahoo-tw-stock-details.ts
```

## 🔧 Yahoo Japan 股票爬蟲詳解

### 腳本概述
- **文件位置**: `scripts/scrape-yahoo-jp-stock-details.js`
- **核心功能**: 智能分頁處理，從單頁 20 股票提升到多頁 127+ 股票
- **處理模式**: 基於總筆數計算的智能分頁策略

### 命令行參數

#### 1. 基本參數
```bash
# 限制處理分類數量
npx tsx scripts/scrape-yahoo-jp-stock-details.ts --limit=5

# 指定特定分類 ID
npx tsx scripts/scrape-yahoo-jp-stock-details.ts --category=food

# 設置並發數量 (建議保持 1 避免 IP 封鎖)
npx tsx scripts/scrape-yahoo-jp-stock-details.ts --concurrent=1
```

#### 2. 分頁控制參數
```bash
# 限制最大頁數
npx tsx scripts/scrape-yahoo-jp-stock-details.ts --max-pages=5

# 測試模式 (只處理前 2 頁)
npx tsx scripts/scrape-yahoo-jp-stock-details.ts --test-mode
```

#### 3. 參數組合使用
```bash
# 測試特定分類的前 3 頁
npx tsx scripts/scrape-yahoo-jp-stock-details.ts --category=food --test-mode --max-pages=3

# 批量處理前 10 個分類，每個分類最多 7 頁
npx tsx scripts/scrape-yahoo-jp-stock-details.ts --limit=10 --max-pages=7
```

### 輸出結果

#### 控制台輸出範例
```bash
🔍 Yahoo Japan 股票詳細資料爬蟲啟動
====================================
🎯 指定分類: food
🧪 測試模式: 只處理前 2 頁
⚡ 並發數量: 1
📄 最大頁數: 2

📄 開始處理分類: 食品 (ID: food)
🔗 基礎 URL: https://finance.yahoo.co.jp/stocks/search/?sector=food&page=1

📊 智能分頁計算:
   總筆數: 128 件
   每頁筆數: 20
   計算頁數: 7 頁
   當前頁: 1

✅ 第 1 頁: 20 支股票 (累計: 20)
✅ 第 2 頁: 20 支股票 (累計: 40)

🎯 食品 完成: 預期 7 頁，實際處理 2 頁，提取 40 支股票

✅ 日股爬取完成！
====================================
📄 結果文件: /output/yahoo-jp-stock-details_2025-08-05T08-30-15.json
📊 處理分類: 1
✅ 成功分類: 1
📄 總處理頁數: 2
🎯 總股票數: 40
```

#### 輸出文件結構
```json
{
  "food": [
    {
      "name": "(株)ニップン",
      "symbolCode": "2001.T"
    },
    {
      "name": "日清製粉グループ本社(株)",
      "symbolCode": "2002.T"
    }
  ],
  "_metadata": {
    "food": {
      "categoryName": "食品",
      "totalPages": 2,
      "expectedPages": 7,
      "totalStocks": 40,
      "scrapedAt": "2025-08-05T08:30:15.000Z",
      "paginationMethod": "smartPagination"
    }
  }
}
```

### 智能分頁策略說明

#### 工作原理
1. **首頁分析**: 從首頁解析 "121～128 / 128件" 格式獲取總筆數
2. **頁數計算**: 總筆數 ÷ 每頁 20 筆 = 總頁數
3. **直接訪問**: 直接訪問 `page=1`, `page=2`, ..., `page=N` 的 URL
4. **數據提取**: 每頁提取股票代碼和公司名稱

#### 支援的分頁格式
- `"121～128 / 128件"` - 日文標準格式
- `"1～20 / 161件"` - 多頁分類格式  
- `"1-20 of 128"` - 英文備用格式

#### 分頁邏輯示例
```javascript
// 實際計算過程
總筆數: 128 件
每頁筆數: 20 (Yahoo Finance Japan 固定)
計算: Math.ceil(128 / 20) = Math.ceil(6.4) = 7 頁

// URL 訪問順序
page=1 → 提取 1-20 股票
page=2 → 提取 21-40 股票
...
page=7 → 提取 121-128 股票 (最後8支)
```

## 🎯 數據品質控制

### 公司名稱清理
腳本會自動清理公司名稱中的無關信息：

```javascript
清理前: "2001東証プライム日清製粉グループ本社1,787.5+15.0(+0.85%)8/5"
清理後: "日清製粉グループ本社(株)"

清理項目:
- 股票代碼 (2001)
- 交易所標記 (東証プライム)  
- 價格信息 (1,787.5)
- 漲跌幅 (+15.0, +0.85%)
- 日期 (8/5)
```

### 數據驗證
```javascript
// 股票代碼格式驗證
有效格式: "2001.T", "7203.T", "143A.T"
無效格式: "2001", "ABC", "12345.T"

// 公司名稱驗證
有效長度: 1-50 字符
排除詞語: ["詳細", "株価", "チャート", "時系列"]
```

## 🔍 除錯與故障排除

### 啟用詳細日誌
```bash
# 顯示所有調試信息
DEBUG=true npx tsx scripts/scrape-yahoo-jp-stock-details.ts --test-mode
```

### 常見問題

#### 1. 無法檢測分頁信息
**症狀**: 顯示 `{"hasMore":false,"method":"singlePage"}`

**排查步驟**:
```bash
# 1. 檢查網站是否可訪問
curl -I "https://finance.yahoo.co.jp/stocks/search/?sector=food"

# 2. 使用測試模式檢查
npx tsx scripts/scrape-yahoo-jp-stock-details.ts --category=food --test-mode

# 3. 檢查分類 ID 是否正確
# 確認 category ID 存在於分類數據文件中
```

#### 2. 提取股票數量為 0
**症狀**: `本頁提取完成: 0 支股票`

**解決方案**:
```bash
# 檢查 CSS 選擇器是否適用
# 腳本已內建多層選擇器策略，通常會自動修復

# 如果持續出現，檢查網站結構是否變更
# 查看輸出日誌中的選擇器測試結果
```

#### 3. 網絡超時錯誤
**症狀**: `timeout` 或 `connection refused`

**解決方案**:
```bash
# 1. 增加請求間隔
# 腳本預設 2 秒間隔，可在代碼中調整

# 2. 使用測試模式減少負載
npx tsx scripts/scrape-yahoo-jp-stock-details.ts --test-mode

# 3. 分批處理
npx tsx scripts/scrape-yahoo-jp-stock-details.ts --limit=3
```

#### 4. 分類數據文件不存在
**症狀**: `找不到日股分類數據文件`

**解決方案**:
```bash
# 先運行分類爬蟲
npx tsx scripts/scrape-yahoo-jp-stock-categories.ts

# 確認輸出文件存在
ls -la output/yahoo-jp-stock-categories*.json
```

## 📊 性能優化建議

### 最佳實踐設置
```bash
# 推薦配置：單線程、適度限制
npx tsx scripts/scrape-yahoo-jp-stock-details.ts \
  --concurrent=1 \
  --max-pages=10 \
  --limit=5
```

### 大規模採集策略
```bash
# 分批執行，避免 IP 封鎖
# 第一批：前 5 個分類
npx tsx scripts/scrape-yahoo-jp-stock-details.ts --limit=5

# 等待 30 分鐘後執行第二批
# (手動或使用 cron job)
```

### 監控建議
1. **檢查輸出質量**: 定期驗證提取的股票代碼格式
2. **監控成功率**: 關注 "成功分類" 數量
3. **性能追蹤**: 記錄每個分類的處理時間
4. **數據完整性**: 比較預期頁數和實際處理頁數

## 🔧 進階使用

### 自定義分類處理
```bash
# 1. 查看可用分類
cat output/yahoo-jp-stock-categories_*.json | jq 'keys'

# 2. 處理特定分類
npx tsx scripts/scrape-yahoo-jp-stock-details.ts --category=construction

# 3. 批量處理特定類型
# 在腳本中修改分類過濾邏輯
```

### 結合其他腳本
```bash
# 1. 先獲取分類
npx tsx scripts/scrape-yahoo-jp-stock-categories.ts

# 2. 再處理詳細數據
npx tsx scripts/scrape-yahoo-jp-stock-details.ts

# 3. 後續數據處理
# 使用輸出文件進行進一步分析
```

### 數據格式轉換
```bash
# 使用 jq 提取特定分類股票列表
cat output/yahoo-jp-stock-details_*.json | jq '.food'

# 提取所有股票代碼
cat output/yahoo-jp-stock-details_*.json | jq -r '.food[]?.symbolCode'

# 統計各分類股票數量
cat output/yahoo-jp-stock-details_*.json | jq '._metadata | to_entries[] | {category: .key, count: .value.totalStocks}'
```

## 📁 輸出文件管理

### 文件命名規則
```
格式: yahoo-jp-stock-details_YYYY-MM-DDTHH-MM-SS.json
範例: yahoo-jp-stock-details_2025-08-05T08-30-15.json
時區: 本地時區
```

### 文件結構說明
```json
{
  "分類ID": [
    {
      "name": "公司名稱",
      "symbolCode": "股票代碼.T"
    }
  ],
  "_metadata": {
    "分類ID": {
      "categoryName": "分類中文名",
      "totalPages": "實際處理頁數",
      "expectedPages": "計算的總頁數",
      "totalStocks": "提取股票總數",
      "scrapedAt": "ISO 8601 時間戳",
      "paginationMethod": "smartPagination"
    }
  }
}
```

### 文件清理建議
```bash
# 保留最新的 5 個結果文件
ls -t output/yahoo-jp-stock-details_*.json | tail -n +6 | xargs rm

# 按日期歸檔
mkdir -p archive/$(date +%Y-%m)
mv output/yahoo-jp-stock-details_2025-08-*.json archive/2025-08/
```

## 🌐 Yahoo Taiwan 股票爬蟲 (如適用)

如果存在 Taiwan 股票爬蟲腳本，使用方法類似：

```bash
# 基本執行
npx tsx scripts/scrape-yahoo-tw-stock-details.ts

# 參數可能包括
npx tsx scripts/scrape-yahoo-tw-stock-details.ts --limit=10 --test-mode
```

具體參數和功能需要根據實際腳本實現進行調整。

## 📞 支援與聯繫

### 問題報告
1. **檢查日誌**: 查看控制台輸出和詳細日誌
2. **測試模式**: 使用 `--test-mode` 進行快速診斷
3. **網絡檢查**: 確認目標網站可正常訪問
4. **文檔參考**: 查閱本指南和開發文檔

### 功能請求
- 新增分類支援
- 額外數據欄位提取
- 性能優化建議
- 輸出格式擴展

---

**最後更新**: 2025-08-05  
**適用版本**: v2.1.0  
**核心功能**: 智能分頁策略，6.35x 數據提取效率提升 🚀