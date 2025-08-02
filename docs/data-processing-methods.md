# 資料處理方法指南：DataDriven vs Script

本文檔詳細說明 Universal Crawler 專案中兩種主要的變數替換和資料處理機制：**DataDriven 動態處理**和 **Script 批次生成**。

## 概述

Universal Crawler 提供兩種不同的方法來處理大量相似的爬蟲任務：

1. **DataDriven 機制**：執行時期動態處理，從前一個爬蟲的結果中提取資料，生成後續的爬蟲配置
2. **Script 機制**：建置時期批次生成，從固定的資料檔案讀取，預先生成所有需要的配置檔案

## DataDriven 動態處理機制

### 工作原理

DataDriven 機制允許你建立**串聯式的爬蟲流程**，其中前一個爬蟲的輸出結果自動成為下一個爬蟲的輸入資料。

### 配置結構

```typescript
interface DataDrivenConfig {
  enabled: boolean;           // 啟用 DataDriven 功能
  sourceConfig: string;       // 來源配置名稱
  sourceSelector: string;     // 從來源資料中選取的欄位
  urlTemplate: string;        // URL 模板，使用 {{item.field}} 語法
  templateVars?: Record<string, string>; // 模板變數對應
}
```

### 實際範例

以 MoneyDJ 資料爬取為例：

**步驟 1：先爬取產業清單** (`moneydj-industries.json`)
```json
{
  "url": "https://www.moneydj.com/z/zh/zha/zhtree.djhtm",
  "selectors": {
    "allSubIndustries": {
      "selector": "a[href*='zh00.djhtm']",
      "multiple": true,
      "extract": {
        "industryCode": {
          "attribute": "href",
          "transform": "extractIndustryCode"
        },
        "name": "text"
      }
    }
  }
}
```

**步驟 2：使用產業清單爬取股票** (`moneydj-stocks.json`)
```json
{
  "dataDriven": {
    "enabled": true,
    "sourceConfig": "moneydj-industries",
    "sourceSelector": "allSubIndustries",
    "urlTemplate": "https://www.moneydj.com/z/zh/zha/zh00.djhtm?a={{item.industryCode}}",
    "templateVars": {
      "industryCode": "{{item.industryCode}}",
      "industryName": "{{item.name}}"
    }
  },
  "url": "https://www.moneydj.com/z/zh/zha/zh00.djhtm?a={{industryCode}}",
  "selectors": {
    "companyInfo": {
      "selector": "table tr",
      "multiple": true,
      "extract": {
        "stockCode": {
          "selector": "td:first-child a",
          "transform": "extractStockCode"
        },
        "companyName": {
          "selector": "td:nth-child(2)"
        }
      }
    }
  },
  "variables": {
    "industryCode": "{{industryCode}}",
    "industryName": "{{industryName}}"
  }
}
```

### 執行流程

```bash
# 1. 先執行產業清單爬蟲
npm run crawl moneydj-industries
# 輸出：output/moneydj-industries_20250801123456.json

# 2. 執行 DataDriven 股票爬蟲
npm run crawl moneydj-stocks
# 系統自動：
# - 讀取 moneydj-industries 的輸出結果
# - 從 allSubIndustries 欄位提取產業清單
# - 為每個產業動態生成配置並執行爬蟲
```

### 程式碼處理流程

在 `EnhancedConfigManager.ts` 中的處理邏輯：

```typescript
// 1. 檢查是否為 DataDriven 配置
if (config.dataDriven?.enabled) {
  // 2. 讀取來源配置的輸出檔案
  const sourceFile = `output/${sourceConfig}_timestamp.json`;
  const sourceData = await fs.readJson(sourceFile);
  
  // 3. 提取目標資料陣列
  const dataArray = sourceData.results[0].data[sourceSelector];
  
  // 4. 為每個資料項目生成新配置
  return dataArray.map(item => {
    const newConfig = { ...config };
    
    // 5. 替換 URL 模板
    newConfig.url = urlTemplate.replace(/\{\{item\.(\w+)\}\}/g, 
      (match, key) => item[key] || match
    );
    
    // 6. 替換變數
    newConfig.variables = processTemplateVars(templateVars, item);
    
    return newConfig;
  });
}
```

## Script 批次生成機制

### 工作原理

Script 機制在**建置時期**讀取固定的資料檔案，批次生成大量的獨立配置檔案，每個配置檔案對應一個爬蟲任務。

### 專案結構

```
configs/
├── templates/                    # 配置模板
│   ├── yahoo-finance-tw-dividend.json
│   ├── yahoo-finance-us-cashflow.json
│   └── ...
data/                            # 資料來源
├── yahoo-finance-tw-stockcodes.json
├── yahoo-finance-us-stockcodes.json
└── ...
scripts/                         # 生成腳本
├── generate-yahoo-tw-configs.js
├── generate-yahoo-us-configs.js
└── ...
```

### 模板檔案範例

**Template**: `configs/templates/yahoo-finance-tw-dividend.json`
```json
{
  "url": "https://tw.stock.yahoo.com/quote/${symbolCode}/dividend",
  "selectors": {
    "structuredDividendData": {
      "selector": "body",
      "transform": "structureTWDividendDataFromCells"
    }
  },
  "variables": {
    "symbolCode": "1101.TW",  // 預設值
    "baseUrl": "https://tw.stock.yahoo.com"
  },
  "export": {
    "formats": ["json", "csv"],
    "filename": "yahoo_finance_tw_dividend_${symbolCode}"
  }
}
```

**Data**: `data/yahoo-finance-tw-stockcodes.json`
```json
[
  {
    "stockCode": "2330.TW",
    "companyName": "台灣積體電路製造股份有限公司",
    "sector": "半導體業"
  },
  {
    "stockCode": "2317.TW", 
    "companyName": "鴻海精密工業股份有限公司",
    "sector": "電子零組件業"
  }
]
```

### 生成腳本範例

`scripts/generate-yahoo-tw-configs.js` 的核心邏輯：

```javascript
// 1. 讀取模板和資料
const template = JSON.parse(fs.readFileSync(templatePath, 'utf8'));
const stockCodes = JSON.parse(fs.readFileSync(stockCodesPath, 'utf8'));

// 2. 為每個股票代碼生成配置
stockCodes.forEach(stock => {
  const config = { ...template };
  
  // 3. 字串替換 URL
  config.url = config.url.replace('${symbolCode}', stock.stockCode);
  // "https://tw.stock.yahoo.com/quote/2330.TW/dividend"
  
  // 4. 更新變數
  config.variables = {
    ...config.variables,
    symbolCode: stock.stockCode,
    companyName: stock.companyName,
    sector: stock.sector
  };
  
  // 5. 替換檔案名稱
  config.export.filename = config.export.filename
    .replace('${symbolCode}', stock.stockCode.replace('.TW', '_TW'));
  
  // 6. 儲存配置檔案
  const fileName = `yahoo-finance-tw-dividend-${stock.stockCode.replace('.TW', '_TW')}.json`;
  fs.writeFileSync(path.join(configsDir, fileName), JSON.stringify(config, null, 2));
});
```

### 執行流程

```bash
# 1. 生成配置檔案
node scripts/generate-yahoo-tw-configs.js
# 輸出：configs/yahoo-finance-tw-dividend-2330_TW.json (15個檔案)

# 2. 執行個別爬蟲
npm run crawl yahoo-finance-tw-dividend-2330_TW

# 3. 或使用批次執行腳本
node scripts/run-yahoo-tw-dividend-batch.js
```

## 比較表格

| 特點             | DataDriven 機制                        | Script 機制                              |
| ---------------- | -------------------------------------- | ---------------------------------------- |
| **處理時機**     | 執行時期動態處理                       | 建置時期批次生成                         |
| **資料來源**     | 前一個爬蟲的輸出結果                   | 固定的 JSON 資料檔案                     |
| **配置檔案**     | 記憶體中動態生成，不產生實體檔案       | 產生實體 JSON 配置檔案到 configs/        |
| **變數語法**     | `{{item.field}}` 和 `{{variable}}`     | `${variable}` 字串替換                   |
| **串聯能力**     | 支援多層串聯，A→B→C                    | 單層處理，需手動管理相依性               |
| **適用情境**     | 動態資料，資料間有依賴關係             | 固定清單，批次處理                       |
| **靈活性**       | 高，可根據爬蟲結果動態調整             | 中，預先定義所有配置                     |
| **除錯難度**     | 較高，配置在記憶體中                   | 較低，可檢視生成的配置檔案               |
| **效能**         | 較高，按需生成                         | 中等，預先生成所有配置                   |
| **維護成本**     | 較高，需理解串聯邏輯                   | 較低，邏輯簡單直觀                       |

## 最佳實踐指南

### 何時使用 DataDriven 機制

✅ **適用情境**：
- 需要先取得清單，再逐項處理的場景
- 資料間有依賴關係 (如：產業→股票→財報)
- 資料是動態變化的，無法預先定義
- 需要建立多層串聯的爬蟲流程

📝 **實際案例**：
- 電商網站：類別頁面→商品清單→商品詳情
- 新聞網站：首頁→分類頁→文章詳情
- 股票網站：產業清單→股票清單→個股資料

### 何時使用 Script 機制

✅ **適用情境**：
- 資料清單是固定的、已知的
- 需要批次處理大量相似任務
- 要求高穩定性和可預測性
- 需要離線生成配置供後續使用

📝 **實際案例**：
- 已知股票代碼的財務資料爬取
- 固定地區列表的天氣資料
- 預定義商品 ID 的價格監控

### 混合使用策略

在複雜專案中，可以結合兩種方法：

```mermaid
graph LR
    A[Script: 生成基礎股票列表] --> B[DataDriven: 動態取得產業分類]
    B --> C[DataDriven: 串聯取得詳細資料]
    C --> D[Script: 批次處理特定分析]
```

## 故障排除

### DataDriven 常見問題

**Q: 找不到來源配置檔案**
```
Error: Data source file not found for source config: moneydj-industries
```
**A**: 確保先執行來源配置：
```bash
npm run crawl moneydj-industries  # 先執行
npm run crawl moneydj-stocks      # 再執行
```

**Q: sourceSelector 沒有回傳陣列**
```
Error: Source selector 'allSubIndustries' did not return an array
```
**A**: 檢查 sourceSelector 是否正確對應來源資料的欄位名稱。

### Script 常見問題

**Q: 模板檔案找不到**
```
Error: 沒有找到 Yahoo Finance Taiwan 模板文件
```
**A**: 確認 `configs/templates/` 目錄下有對應的模板檔案。

**Q: 資料檔案格式錯誤**
```
Error: 找不到台灣股票代碼數據文件
```
**A**: 檢查 `data/` 目錄下是否有正確的 JSON 資料檔案。

## 進階技巧

### DataDriven 進階用法

**條件處理**：
```json
{
  "dataDriven": {
    "enabled": true,
    "sourceConfig": "base-config",
    "sourceSelector": "filteredItems",
    "urlTemplate": "{{#if item.isActive}}https://active.com/{{item.id}}{{else}}https://inactive.com/{{item.id}}{{/if}}"
  }
}
```

**多變數替換**：
```json
{
  "templateVars": {
    "category": "{{item.category}}",
    "subcategory": "{{item.subcategory}}",
    "timestamp": "{{now}}",
    "index": "{{@index}}"
  }
}
```

### Script 進階用法

**條件生成**：
```javascript
stockCodes.forEach((stock, index) => {
  // 只處理特定條件的股票
  if (stock.sector === '半導體業') {
    // 生成配置...
  }
});
```

**批次分組**：
```javascript
// 將股票分組，每組生成一個配置
const chunks = chunkArray(stockCodes, 10);
chunks.forEach((chunk, index) => {
  // 生成批次配置...
});
```

## 總結

選擇合適的資料處理方法是成功爬蟲專案的關鍵：

- **DataDriven** 適合動態、串聯的複雜資料流程
- **Script** 適合固定、批次的大量相似任務

理解兩種方法的特點和適用場景，能夠讓你在不同情境下做出最佳選擇，建構高效穩定的爬蟲系統。