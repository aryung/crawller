# CLI 使用範例

## 基本命令

### 1. 執行 MoneyDJ 爬蟲
```bash
# 使用基本配置
npm run crawl moneydj

# 使用完整配置
npm run crawl moneydj-links
```

### 2. 列出所有配置
```bash
npm run crawl list
```

### 3. 建立新配置
```bash
# 建立空白配置
npm run crawl create my-site

# 使用模板建立配置
npm run crawl create news-site --template news
npm run crawl create shop-site --template ecommerce
```

### 4. 驗證配置
```bash
npm run crawler validate moneydj
```

## 進階使用

### 批量執行多個配置
```bash
npm run crawl moneydj,yahoo-finance,google
```

### 指定輸出格式
```bash
npm run crawl moneydj --format xlsx
npm run crawl moneydj --format csv
```

### 使用 Playwright 引擎
```bash
npm run crawl moneydj --engine playwright
```

### 調整併發數量
```bash
npm run crawl moneydj --concurrent 5
```

### 啟用詳細日誌
```bash
npm run crawl moneydj --verbose
```

## MoneyDJ 專用範例

### 1. 基本產業列表抓取
```bash
npm run crawl moneydj
```
輸出檔案：
- `output/moneydj_industries.json`
- `output/moneydj_industries.csv`

### 2. 完整產業資訊抓取
```bash
npm run crawl moneydj-links --format xlsx
```
輸出檔案：
- `output/moneydj_complete_industries.xlsx`（包含統計工作表）
- `output/screenshots/` 目錄下的頁面截圖

### 3. 自定義輸出路徑
```bash
npm run crawl moneydj-links --output data --format json
```
輸出檔案：
- `data/moneydj_complete_industries.json`

## 配置檔案說明

### moneydj.json（基本版）
- 抓取所有產業連結
- 提取產業名稱、URL 和代碼
- 輸出 JSON 和 CSV 格式

### moneydj-links.json（完整版）
- 抓取完整的連結資訊
- 包含產業分類判斷
- 自定義轉換函式
- 多格式輸出
- 包含截圖功能

## 預期輸出結果

### JSON 格式範例
```json
{
  "exportDate": "2024-01-01T00:00:00.000Z",
  "totalResults": 1,
  "successCount": 1,
  "results": [
    {
      "url": "https://www.moneydj.com/Z/ZH/ZHA/ZHA.djhtm",
      "data": {
        "industries": [
          {
            "name": "水泥工業",
            "url": "https://www.moneydj.com/z/zh/zha/zh01.djhtm?a=C0101",
            "code": "C0101"
          }
        ]
      },
      "timestamp": "2024-01-01T00:00:00.000Z",
      "success": true
    }
  ]
}
```

### CSV 格式範例
| url | success | timestamp | industries |
|-----|---------|-----------|------------|
| https://www.moneydj.com/... | true | 2024-01-01T00:00:00.000Z | [產業資料] |

## 故障排除

### 1. 配置檔案不存在
```bash
❌ 請指定配置檔案名稱
💡 範例: npm run crawl moneydj
💡 或使用: npm run crawl --list 查看所有配置
```

**解決方案：**
- 使用 `npm run crawl list` 查看可用配置
- 使用 `npm run crawler create <name>` 建立新配置

### 2. 網站連線失敗
```bash
❌ 爬蟲失敗: Navigation timeout of 30000 ms exceeded
```

**解決方案：**
- 增加超時時間：修改配置檔案中的 `options.timeout`
- 切換引擎：使用 `--engine playwright`
- 檢查網路連線

### 3. 選擇器找不到元素
```bash
⚠️ Failed to extract value for selector
```

**解決方案：**
- 啟用截圖功能檢查頁面狀態
- 增加等待時間：修改 `options.waitFor`
- 使用瀏覽器開發者工具驗證選擇器

## 輸出檔案結構

```
output/
├── moneydj_industries_2024-01-01T00-00-00-000Z.json
├── moneydj_industries_2024-01-01T00-00-00-000Z.csv
├── crawl_report_2024-01-01T00-00-00-000Z.md
└── screenshots/
    └── screenshot_0_moneydj_com.png

configs/
├── moneydj.json
└── moneydj-links.json

logs/
├── error.log
└── combined.log
```

這樣您就可以直接使用 JSON 配置檔案來抓取 MoneyDJ 的產業資料，無需寫任何程式碼！
