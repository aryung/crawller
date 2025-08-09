# Yahoo Finance US Stock Sectors 爬蟲

## 🚀 版本說明

### 智能版本 (推薦) - `scrape-yahoo-us-sectors.js`
- 🔍 **自動偵測總筆數**：從頁面智能提取實際資料量
- 🎯 **支援多 Sectors**：可爬取不同產業類別
- 📊 **智能停止**：連續3頁沒資料自動停止
- 💾 **去重處理**：自動過濾重複股票

### 簡單版本 - `scrape-yahoo-us-simple.js`  
- 純 JavaScript，穩定可靠
- 固定爬取 Technology sector
- 適合快速測試使用

## 📋 功能特色

✨ **智能偵測**
- 自動偵測每個 Sector 的總筆數
- 動態計算需要爬取的頁數
- 不需預設 start/count 參數

📊 **多 Sector 支援**
- 11 個主要產業類別
- 可單獨或批次爬取
- 每個 Sector 獨立檔案儲存

🎯 **精確選擇器**
- Symbol: 第 2 列 (`td:nth-child(2)`)
- Sector: 第 14 列 (`td:nth-child(14)`)
- 使用結構化選擇器，符合 CLAUDE.md 原則

## 🎯 快速開始

### 基本使用

```bash
# 爬取 Technology sector（自動偵測筆數）
node scripts/scrape-yahoo-us-sectors.js --sector technology

# 爬取 Healthcare sector
node scripts/scrape-yahoo-us-sectors.js --sector healthcare

# 爬取 Financial Services
node scripts/scrape-yahoo-us-sectors.js --sector financial

# 限制最大頁數（用於測試）
node scripts/scrape-yahoo-us-sectors.js --sector technology --limit 10

# 爬取所有 sectors
node scripts/scrape-yahoo-us-sectors.js --all

# 顯示說明
node scripts/scrape-yahoo-us-sectors.js --help
```

### 可用的 Sectors

| 參數名稱 | 產業類別 | 說明 |
|---------|---------|------|
| `technology` | 科技 | 軟體、硬體、半導體等 |
| `financial` | 金融服務 | 銀行、保險、投資公司 |
| `healthcare` | 醫療保健 | 製藥、醫療設備、生技 |
| `consumer` | 週期性消費 | 零售、汽車、休閒 |
| `industrial` | 工業 | 製造、航空、物流 |
| `communication` | 通訊服務 | 電信、媒體、網路 |
| `energy` | 能源 | 石油、天然氣、再生能源 |
| `realestate` | 房地產 | REITs、地產開發 |
| `materials` | 基礎材料 | 化工、礦業、金屬 |
| `utilities` | 公用事業 | 電力、水務、瓦斯 |
| `defensive` | 防禦性消費 | 食品、日用品 |

### 背景執行

```bash
# 背景執行單一 sector
nohup node scripts/scrape-yahoo-us-sectors.js --sector healthcare > logs/healthcare.log 2>&1 &

# 背景執行所有 sectors
nohup node scripts/scrape-yahoo-us-sectors.js --all > logs/all-sectors.log 2>&1 &

# 查看進程
ps aux | grep scrape-yahoo-us-sectors
```

## 📊 智能偵測說明

### 偵測流程

1. **首次訪問**：不帶參數訪問第一頁
2. **提取總數**：從頁面尋找 "Showing 1-100 of X,XXX results"
3. **計算頁數**：Math.ceil(總筆數 / 100)
4. **智能停止**：連續3頁無資料自動停止

### 偵測範例輸出

```
🏢 開始爬取 TECHNOLOGY Sector
============================================================
🔍 偵測總筆數...
✅ 偵測到總筆數: 517
📄 預計需要爬取 6 頁
📄 爬取第 1 頁...
   ✅ 取得 100 筆資料
   進度: 17% | 累計: 100 筆
```

## 📁 輸出檔案

### 檔案命名格式

```
output/yahoo-us-sectors/
├── yahoo-us-technology-20250809.json
├── yahoo-us-healthcare-20250809.json
├── yahoo-us-financial-20250809.json
└── ...
```

### 資料格式

```json
{
  "metadata": {
    "sector_filter": "technology",
    "scraped_date": "2025-08-09T10:30:00Z",
    "total_pages_scraped": 6,
    "total_records": 517,
    "unique_stocks": 517,
    "duplicates_removed": 0,
    "detected_total_results": 517,
    "sectors_distribution": {
      "Technology": 517
    }
  },
  "data": [
    {
      "symbol": "NVDA",
      "sector": "Technology",
      "scraped_at": "2025-08-09T10:15:23Z"
    }
  ]
}
```

## 📊 實際資料統計

根據實測結果（2025-08-09）：

| Sector | 實際唯一股票數 | 說明 |
|--------|--------------|------|
| Technology | ~517 | 包含軟體、硬體、半導體 |
| Healthcare | ~1,200+ | 製藥、醫療設備、生技 |
| Financial | ~1,500+ | 銀行、保險、投資 |
| Consumer | ~800+ | 零售、汽車、休閒 |
| Industrial | ~600+ | 製造、航空、物流 |
| Others | 各異 | 其他產業類別 |

**注意**：Yahoo Finance 可能顯示重複資料，實際唯一股票數會少於總筆數。

## ⏱️ 執行時間估算

| 任務 | 預估時間 | 說明 |
|------|---------|------|
| 單一 Sector（~500 股） | 1-2 分鐘 | 如 Technology |
| 單一 Sector（~1500 股） | 3-5 分鐘 | 如 Financial |
| 所有 11 個 Sectors | 20-30 分鐘 | 批次執行 |

## 🔧 故障排除

### 常見問題

**Q: 無法偵測總筆數？**
- 爬蟲會繼續執行，最多爬取 100 頁
- 連續 3 頁無資料會自動停止

**Q: 某個 Sector 沒有資料？**
```bash
# 檢查 URL 是否正確
curl -I "https://finance.yahoo.com/research-hub/screener/sec-ind_sec-largest-equities_[sector-name]"
```

**Q: 爬取速度很慢？**
- 正常現象，每頁間隔 2-5 秒避免封鎖
- 可用 `--limit` 參數測試較少頁數

**Q: 重複資料很多？**
- Yahoo Finance 本身的問題
- 爬蟲會自動去重，只保留唯一股票

## 📊 監控進度

### 即時監控

```bash
# 如果使用 nohup 背景執行
tail -f logs/healthcare.log

# 查看所有 sectors 進度
tail -f logs/all-sectors.log

# 統計已完成的檔案
ls -lh output/yahoo-us-sectors/yahoo-us-*.json | wc -l
```

### 使用監控腳本

```bash
# 監控簡單版本
bash scripts/monitor-scraping.sh
```

## 🛑 停止執行

```bash
# 找到進程
ps aux | grep scrape-yahoo-us-sectors

# 停止爬蟲
kill <PID>

# 強制停止
kill -9 <PID>
```

## 🔄 批次處理範例

### 爬取特定幾個 Sectors

```bash
#!/bin/bash
# save as: scrape-selected-sectors.sh

SECTORS=("technology" "healthcare" "financial")

for sector in "${SECTORS[@]}"; do
  echo "爬取 $sector..."
  node scripts/scrape-yahoo-us-sectors.js --sector $sector
  echo "等待 10 秒..."
  sleep 10
done

echo "完成所有 sectors!"
```

### 合併所有 JSON 檔案

```bash
#!/bin/bash
# 合併所有 sector 資料為一個檔案

jq -s '
  {
    metadata: {
      merged_date: now | todate,
      total_sectors: length,
      total_stocks: [.[] | .data | length] | add
    },
    sectors: [.[] | {
      sector: .metadata.sector_filter,
      stocks: .metadata.unique_stocks,
      data: .data
    }]
  }
' output/yahoo-us-sectors/yahoo-us-*.json > output/yahoo-us-sectors/all-sectors-merged.json
```

## 🎯 注意事項

1. **智能偵測**：不是所有頁面都能成功偵測總筆數
2. **資料重複**：Yahoo Finance 本身會返回重複資料
3. **速率限制**：保持 2-5 秒間隔避免被封鎖
4. **Sector 差異**：不同 Sector 資料量差異很大

## 📝 技術細節

### 偵測方法
- 搜尋頁面文字模式
- 支援多種格式：
  - "of X,XXX results"
  - "Showing 1-100 of X,XXX"
  - "total: X,XXX"

### 停止條件
- 達到偵測的總頁數
- 連續 3 頁無資料
- 達到 `--limit` 設定的頁數

### 去重邏輯
- 以 Symbol 為主鍵
- 保留第一次出現的記錄
- 統計並顯示移除的重複數

## 🔄 更新歷史

- **2025-08-09 v2.0**: 新增智能偵測版本
  - 自動偵測總筆數
  - 支援多 Sector 爬取
  - 智能停止機制
- **2025-08-09 v1.0**: 簡單版本
  - 修正選擇器位置
  - Technology sector 爬取成功