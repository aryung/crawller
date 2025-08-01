# Yahoo Finance US Cash Flow 批量處理指南

## 📋 目錄

1. [快速開始](#快速開始)
2. [批量配置生成](#批量配置生成)
3. [批量執行](#批量執行)
4. [監控與日誌](#監控與日誌)
5. [故障排除](#故障排除)
6. [最佳實踐](#最佳實踐)

---

## 快速開始

### 🚀 一鍵批量執行

```bash
# 1. 生成所有配置檔案
node scripts/generate-yahoo-us-configs.js --type=cashflow

# 2. 執行批量爬取
node scripts/run-yahoo-us-cashflow-batch.js

# 3. 檢查結果
ls output/yahoo_finance_us_cashflow_*.json
```

### 📊 支援的美國股票

目前支援 **15 隻美國龍頭股票**：

| 股票代碼 | 公司名稱 | 行業 |
|---------|---------|------|
| **AAPL** | Apple Inc. | Technology |
| **MSFT** | Microsoft Corporation | Technology |
| **GOOGL** | Alphabet Inc. (Class A) | Technology |
| **AMZN** | Amazon.com Inc. | Consumer Discretionary |
| **NVDA** | NVIDIA Corporation | Technology |
| **TSLA** | Tesla Inc. | Consumer Discretionary |
| **META** | Meta Platforms Inc. | Technology |
| **BRK-B** | Berkshire Hathaway Inc. | Financial Services |
| **JPM** | JPMorgan Chase & Co. | Financial Services |
| **V** | Visa Inc. | Financial Services |
| **JNJ** | Johnson & Johnson | Healthcare |
| **WMT** | Walmart Inc. | Consumer Staples |
| **UNH** | UnitedHealth Group Inc. | Healthcare |
| **PG** | The Procter & Gamble Company | Consumer Staples |
| **HD** | The Home Depot Inc. | Consumer Discretionary |

---

## 批量配置生成

### 🔧 配置生成器

**生成所有 Cash Flow 配置**：
```bash
node scripts/generate-yahoo-us-configs.js --type=cashflow
```

**生成所有美國股票配置**：
```bash
node scripts/generate-yahoo-us-configs.js
```

### 📁 生成的檔案結構

```
configs/
├── active/
│   ├── yahoo-finance-us-cashflow-AAPL.json      # Apple 現金流配置
│   ├── yahoo-finance-us-cashflow-MSFT.json      # Microsoft 現金流配置
│   ├── yahoo-finance-us-cashflow-GOOGL.json     # Alphabet 現金流配置
│   └── ...                                      # 其他股票配置
├── templates/
│   └── yahoo-finance-us-cashflow.json           # 現金流模板
└── yahoo-finance-us-cashflow-*.json             # 執行用配置（複製到根目錄）
```

### 📋 配置檔案範例

每個生成的配置包含以下資訊：

```json
{
  "templateType": "us-cashflow",
  "url": "https://finance.yahoo.com/quote/AAPL/cash-flow/",
  "variables": {
    "stockCode": "AAPL"
  },
  "stockInfo": {
    "stockCode": "AAPL",
    "companyName": "Apple Inc.",
    "sector": "Technology"
  },
  "actions": [
    {
      "type": "click",
      "selector": "button[data-testid=\"QUARTERLY\"], button[data-testid=\"Quarterly\"], .Quarterly, button[aria-label*=\"Quarterly\"], [data-icon=\"quarterly\"]"
    }
  ],
  "selectors": {
    "stockInfo": {
      "selector": "h1, .symbol",
      "transform": "cleanStockSymbol"
    },
    "structuredCashFlowData": {
      "selector": "table td, table th",
      "multiple": true,
      "transform": "structureUSCashFlowDataFromCells"
    }
  },
  "export": {
    "filename": "yahoo_finance_us_cashflow_AAPL"
  },
  "options": {
    "timeout": 30000,
    "retries": 3,
    "waitFor": 5000,
    "headless": true
  }
}
```

---

## 批量執行

### 🎯 執行批量處理

**完整批量執行**：
```bash
node scripts/run-yahoo-us-cashflow-batch.js
```

**限制執行數量**（測試用）：
```bash
# 只執行前 3 個配置
node scripts/run-yahoo-us-cashflow-batch.js --limit=3

# 只執行前 5 個配置
node scripts/run-yahoo-us-cashflow-batch.js --limit=5
```

### ⏱️ 執行時間預估

| 股票數量 | 預估時間 | 說明 |
|---------|---------|------|
| 3 個 | ~2 分鐘 | 測試用 |
| 5 個 | ~3 分鐘 | 小批量 |
| 全部 (15個) | ~8 分鐘 | 完整批量 |

**注意**：每個請求間隔 8 秒，避免過於頻繁的請求。

### 📊 批量執行輸出

```bash
🎯 Yahoo Finance US Cash Flow 批處理爬蟲
=============================================
📊 找到 15 個配置文件
⏱️  預估執行時間: 8 分鐘

📈 進度: 1/15
🚀 開始執行: yahoo-finance-us-cashflow-AAPL
✅ 完成: yahoo-finance-us-cashflow-AAPL
⏱️  等待 8 秒...

📈 進度: 2/15
🚀 開始執行: yahoo-finance-us-cashflow-MSFT
✅ 完成: yahoo-finance-us-cashflow-MSFT
⏱️  等待 8 秒...

...

🎉 批處理執行完成！
===================
✅ 成功: 14 個
❌ 失敗: 1 個
📊 總計: 15 個

📄 執行結果已保存到: logs/yahoo-us-cashflow-batch-2025-08-01T10-30-15-123Z.json
📁 輸出文件位置: output/
```

---

## 監控與日誌

### 📊 執行結果監控

**實時監控**：
```bash
# 查看輸出目錄
watch -n 5 'ls -la output/yahoo_finance_us_cashflow_*.json'

# 查看最新日誌
tail -f logs/yahoo-us-cashflow-batch-*.json
```

**檢查成功率**：
```bash
# 統計成功的配置數量
ls output/yahoo_finance_us_cashflow_*.json | wc -l

# 統計總配置數量
ls configs/yahoo-finance-us-cashflow-*.json | wc -l
```

### 📋 日誌結構

批量執行會自動生成詳細的執行日誌：

```json
{
  "timestamp": "2025-08-01T10:30:15.123Z",
  "totalConfigs": 15,
  "successCount": 14,
  "failCount": 1,
  "results": [
    {
      "configName": "yahoo-finance-us-cashflow-AAPL",
      "success": true,
      "output": "執行成功的詳細輸出..."
    },
    {
      "configName": "yahoo-finance-us-cashflow-FAILED",
      "success": false,
      "error": "錯誤詳細信息...",
      "code": 1
    }
  ]
}
```

### 📁 輸出檔案檢查

**驗證數據完整性**：
```bash
# 檢查所有輸出檔案的大小
ls -lh output/yahoo_finance_us_cashflow_*.json

# 檢查特定股票的現金流數據
cat output/yahoo_finance_us_cashflow_AAPL.json | jq '.structuredCashFlowData[0]'
```

**預期的數據結構**：
```json
{
  "stockInfo": "Apple Inc. (AAPL)",
  "structuredCashFlowData": [
    {
      "fiscalPeriod": "9/30/2024",
      "operatingCashFlow": 29991000000,
      "investingCashFlow": -26968000000,
      "financingCashFlow": -26024000000,
      "endCashPosition": 29943000000,
      "capitalExpenditure": 11185000000,
      "freeCashFlow": 18806000000
    }
  ]
}
```

---

## 故障排除

### 🚨 常見問題

#### 1. 配置檔案未找到
**錯誤**：`❌ 沒有找到配置文件`

**解決方案**：
```bash
# 重新生成配置檔案
node scripts/generate-yahoo-us-configs.js --type=cashflow

# 確認檔案生成成功
ls configs/yahoo-finance-us-cashflow-*.json
```

#### 2. Quarterly 按鈕點擊失敗
**錯誤**：`無法找到 Quarterly 按鈕`

**檢查**：Yahoo Finance 可能更新了按鈕選擇器

**解決方案**：
```bash
# 檢查當前的按鈕選擇器
npm run crawl yahoo-finance-us-cashflow-AAPL

# 如需更新選擇器，編輯模板
vi configs/templates/yahoo-finance-us-cashflow.json
```

#### 3. 數據解析失敗
**錯誤**：`structuredCashFlowData: []`

**診斷步驟**：
```bash
# 1. 啟用截圖模式
# 在配置中設置 "headless": false

# 2. 檢查頁面載入
# 增加 waitFor 時間

# 3. 檢查選擇器
# 確認表格選擇器是否正確
```

### 🔧 除錯模式

**啟用詳細日誌**：
```bash
export DEBUG=crawler:*
node scripts/run-yahoo-us-cashflow-batch.js --limit=1
```

**單一配置測試**：
```bash
# 測試特定股票
npm run crawl yahoo-finance-us-cashflow-AAPL

# 檢查輸出
cat output/yahoo_finance_us_cashflow_AAPL.json | jq
```

---

## 最佳實踐

### 📋 執行建議

1. **測試先行**：
   ```bash
   # 先測試少量配置
   node scripts/run-yahoo-us-cashflow-batch.js --limit=3
   
   # 確認無誤後執行完整批量
   node scripts/run-yahoo-us-cashflow-batch.js
   ```

2. **分批執行**：
   ```bash
   # 分批執行避免過載
   node scripts/run-yahoo-us-cashflow-batch.js --limit=5
   # 等待完成後繼續下一批
   ```

3. **定期更新**：
   ```bash
   # 每週更新股票代碼列表
   vi data/yahoo-finance-us-stockcodes.json
   
   # 重新生成配置
   node scripts/generate-yahoo-us-configs.js --type=cashflow
   ```

### 🔄 自動化腳本

**每日自動執行**（Cron 範例）：
```bash
# 新增到 crontab
# 每日早上 9:00 執行
0 9 * * * cd /path/to/crawler && node scripts/run-yahoo-us-cashflow-batch.js

# 每週一重新生成配置
0 8 * * 1 cd /path/to/crawler && node scripts/generate-yahoo-us-configs.js --type=cashflow
```

### 📊 數據驗證

**自動化驗證腳本**：
```bash
#!/bin/bash
# validate-cashflow-data.sh

echo "🔍 驗證現金流數據完整性"

# 檢查檔案數量
expected=15
actual=$(ls output/yahoo_finance_us_cashflow_*.json 2>/dev/null | wc -l)

if [ $actual -eq $expected ]; then
    echo "✅ 檔案數量正確: $actual/$expected"
else
    echo "❌ 檔案數量不足: $actual/$expected"
fi

# 檢查數據結構
for file in output/yahoo_finance_us_cashflow_*.json; do
    if jq -e '.structuredCashFlowData[0].fiscalPeriod' "$file" > /dev/null 2>&1; then
        echo "✅ $(basename $file): 數據結構正確"
    else
        echo "❌ $(basename $file): 數據結構異常"
    fi
done
```

---

## 📈 數據應用範例

### 現金流分析

**載入和分析數據**：
```python
import json
import pandas as pd
from glob import glob

# 載入所有現金流數據
cashflow_files = glob('output/yahoo_finance_us_cashflow_*.json')
all_data = []

for file in cashflow_files:
    with open(file, 'r') as f:
        data = json.load(f)
        stock_code = data['stockInfo'].split('(')[1].split(')')[0]
        
        for period_data in data['structuredCashFlowData']:
            period_data['stockCode'] = stock_code
            all_data.append(period_data)

# 轉換為 DataFrame
df = pd.DataFrame(all_data)

# 分析現金流健康度
df['cashflow_health'] = (
    df['operatingCashFlow'] > 0
) & (
    df['freeCashFlow'] > 0
)

# 找出現金流最佳的公司
top_companies = df.groupby('stockCode').agg({
    'operatingCashFlow': 'mean',
    'freeCashFlow': 'mean',
    'cashflow_health': 'sum'
}).sort_values('freeCashFlow', ascending=False)

print("現金流表現最佳的公司:")
print(top_companies.head())
```

---

*最後更新：2025-08-01*  
*版本：v1.0.0*