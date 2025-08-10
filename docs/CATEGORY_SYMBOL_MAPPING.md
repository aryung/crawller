# 股票分類與代碼映射系統

## 概述

本系統用於整理和管理來自 Yahoo Finance 三個地區（台灣、日本、美國）的股票分類與代碼映射關係。系統會自動從原始數據檔案中提取股票資訊，並按照產業分類組織成結構化的 JSON 格式。

## 數據來源

### 台灣市場 (TPE)
- **檔案**: `data/yahoo-tw-stock-details.json`
- **格式**: 以數字代碼為鍵的分類結構
- **範例**:
  ```json
  {
    "1": [
      {"name": "台灣水泥", "symbolCode": "1101"},
      {"name": "亞洲水泥", "symbolCode": "1102"}
    ]
  }
  ```

### 日本市場 (JP)
- **檔案**: `data/yahoo-jp-stock-details.json`
- **格式**: 以 4 位數產業代碼為鍵的分類結構
- **範例**:
  ```json
  {
    "1050": [
      {"name": "日清製粉グループ本社", "symbolCode": "2002.T"},
      {"name": "日清オイリオグループ", "symbolCode": "2602.T"}
    ]
  }
  ```

### 美國市場 (US)
- **檔案**: `data/yahoo-us-*-20250809.json` (多個分類檔案)
- **格式**: 每個檔案代表一個產業分類
- **檔案列表**:
  - `yahoo-us-technology-20250809.json` - 科技業
  - `yahoo-us-financial-20250809.json` - 金融業
  - `yahoo-us-healthcare-20250809.json` - 醫療保健業
  - `yahoo-us-consumer-20250809.json` - 消費品業
  - `yahoo-us-industrial-20250809.json` - 工業
  - `yahoo-us-communication-20250809.json` - 通訊業
  - `yahoo-us-energy-20250809.json` - 能源業
  - `yahoo-us-realestate-20250809.json` - 房地產業
  - `yahoo-us-materials-20250809.json` - 材料業
  - `yahoo-us-utilities-20250809.json` - 公用事業
  - `yahoo-us-defensive-20250809.json` - 防禦性產業

## 使用方式

### 1. 生成分類映射

執行以下命令生成分類映射檔案：

```bash
# 使用 npm script
npm run generate:category-mapping

# 或直接執行腳本
npx tsx scripts/generate-category-symbol-mapping.ts
```

輸出檔案: `output/category-symbol-mappings.json`

### 2. 匯入股票到資料庫

```bash
# 匯入所有股票到資料庫
npm run import:symbols

# 或執行完整流程（生成映射 + 匯入資料庫）
npm run import:all
```

## 輸出格式說明

### 完整格式結構

```json
{
  "metadata": {
    "generatedAt": "2025-08-10T12:00:00.000Z",
    "statistics": {
      "TPE": {
        "categories": 50,
        "totalSymbols": 1700
      },
      "JP": {
        "categories": 30,
        "totalSymbols": 3800
      },
      "US": {
        "categories": 11,
        "totalSymbols": 500
      }
    }
  },
  "categoryMappings": {
    "TPE": [
      {
        "category": "水泥",
        "categoryId": "1",
        "symbols": [
          {"symbolCode": "1101", "name": "台灣水泥"},
          {"symbolCode": "1102", "name": "亞洲水泥"}
        ]
      }
    ],
    "JP": [
      {
        "category": "食料品",
        "categoryId": "1050",
        "symbols": [
          {"symbolCode": "2002.T", "name": "日清製粉グループ本社"}
        ]
      }
    ],
    "US": [
      {
        "category": "Technology",
        "categoryId": "technology",
        "symbols": [
          {"symbolCode": "AAPL", "name": "AAPL"},
          {"symbolCode": "MSFT", "name": "MSFT"}
        ]
      }
    ]
  }
}
```

### 欄位說明

- **metadata**: 檔案元數據
  - `generatedAt`: 生成時間
  - `statistics`: 各地區統計資訊
- **categoryMappings**: 分類映射主體
  - `TPE`: 台灣市場分類
  - `JP`: 日本市場分類
  - `US`: 美國市場分類
- **每個分類包含**:
  - `category`: 分類名稱（中文/日文/英文）
  - `categoryId`: 分類代碼
  - `symbols`: 股票陣列
    - `symbolCode`: 股票代碼
    - `name`: 股票名稱

## 台灣產業分類對照表

| 代碼 | 產業名稱 | 說明 |
|------|---------|------|
| 1 | 水泥 | 水泥工業 |
| 2 | 食品 | 食品工業 |
| 3 | 塑膠 | 塑膠工業 |
| 4 | 紡織 | 紡織纖維 |
| 5 | 電機 | 電機機械 |
| 6 | 電器電纜 | 電器電纜 |
| 8 | 玻璃陶瓷 | 玻璃陶瓷 |
| 9 | 造紙 | 造紙工業 |
| 10 | 鋼鐵 | 鋼鐵工業 |
| 11 | 橡膠 | 橡膠工業 |
| 12 | 汽車 | 汽車工業 |
| 14 | 建材營造 | 建材營造 |
| 15 | 航運 | 航運業 |
| 16 | 觀光 | 觀光事業 |
| 17 | 金融保險 | 金融保險 |
| 18 | 貿易百貨 | 貿易百貨 |
| 20 | 其他 | 其他產業 |
| 21 | 化學 | 化學工業 |
| 22 | 生技醫療 | 生技醫療業 |
| 23 | 油電燃氣 | 油電燃氣業 |
| 24 | 半導體 | 半導體業 |
| 25 | 電腦及週邊設備 | 電腦及週邊設備業 |
| 26 | 光電 | 光電業 |
| 27 | 通信網路 | 通信網路業 |
| 28 | 電子零組件 | 電子零組件業 |
| 29 | 電子通路 | 電子通路業 |
| 30 | 資訊服務 | 資訊服務業 |
| 31 | 其他電子 | 其他電子業 |

## 日本產業分類對照表

| 代碼 | 產業名稱 | 說明 |
|------|---------|------|
| 0050 | 建設・資材 | 建設資材業 |
| 1050 | 食料品 | 食品業 |
| 2050 | 繊維製品 | 纖維製品業 |
| 3050 | 紙・パルプ | 造紙業 |
| 4050 | 化学 | 化學工業 |
| 4502 | 医薬品 | 醫藥品業 |
| 5050 | 石油・石炭製品 | 石油煤炭製品 |
| 5100 | ゴム製品 | 橡膠製品 |
| 5150 | ガラス・土石製品 | 玻璃土石製品 |
| 5200 | 鉄鋼 | 鋼鐵業 |
| 5250 | 非鉄金属 | 非鐵金屬 |
| 5300 | 金属製品 | 金屬製品 |
| 6050 | 機械 | 機械業 |
| 6500 | 電気機器 | 電氣機器 |
| 7050 | 輸送用機器 | 運輸設備 |
| 7200 | 精密機器 | 精密儀器 |
| 7250 | その他製品 | 其他製品 |
| 8050 | 陸運業 | 陸運業 |
| 8550 | 海運業 | 海運業 |
| 8600 | 空運業 | 空運業 |
| 8650 | 証券・商品先物取引業 | 證券期貨業 |
| 8750 | 保険業 | 保險業 |
| 8800 | その他金融業 | 其他金融業 |
| 8850 | 不動産業 | 不動產業 |
| 9050 | サービス業 | 服務業 |
| 9500 | 電気・ガス業 | 電力瓦斯業 |
| 9550 | 情報・通信業 | 資訊通訊業 |

## API 使用範例

### 讀取映射檔案

```typescript
import { readFileSync } from 'fs';
import { join } from 'path';

// 讀取映射檔案
const mappingPath = join(__dirname, '../output/category-symbol-mappings.json');
const mappingData = JSON.parse(readFileSync(mappingPath, 'utf-8'));

// 取得所有台灣半導體股票
const semiconductors = mappingData.categoryMappings.TPE
  .find(cat => cat.categoryId === '24')
  ?.symbols || [];

console.log(`Found ${semiconductors.length} semiconductor stocks in Taiwan`);
```

### 查詢特定分類的股票

```typescript
function getStocksByCategory(region: 'TPE' | 'JP' | 'US', categoryId: string) {
  const category = mappingData.categoryMappings[region]
    .find(cat => cat.categoryId === categoryId);
  
  if (!category) {
    console.log(`Category ${categoryId} not found in ${region}`);
    return [];
  }
  
  console.log(`${category.category}: ${category.symbols.length} stocks`);
  return category.symbols;
}

// 使用範例
const techStocks = getStocksByCategory('US', 'technology');
const foodStocks = getStocksByCategory('JP', '1050');
```

### 搜尋股票代碼

```typescript
function findStock(symbolCode: string) {
  for (const region of ['TPE', 'JP', 'US'] as const) {
    for (const category of mappingData.categoryMappings[region]) {
      const stock = category.symbols.find(s => s.symbolCode === symbolCode);
      if (stock) {
        return {
          region,
          category: category.category,
          categoryId: category.categoryId,
          ...stock
        };
      }
    }
  }
  return null;
}

// 使用範例
const tsmc = findStock('2330');
console.log(tsmc);
// Output: { region: 'TPE', category: '半導體', categoryId: '24', symbolCode: '2330', name: '台積電' }
```

### 統計分析

```typescript
function getStatistics() {
  const stats = {
    TPE: { categories: 0, totalSymbols: 0, avgPerCategory: 0 },
    JP: { categories: 0, totalSymbols: 0, avgPerCategory: 0 },
    US: { categories: 0, totalSymbols: 0, avgPerCategory: 0 }
  };
  
  for (const region of ['TPE', 'JP', 'US'] as const) {
    const categories = mappingData.categoryMappings[region];
    stats[region].categories = categories.length;
    stats[region].totalSymbols = categories.reduce(
      (sum, cat) => sum + cat.symbols.length, 0
    );
    stats[region].avgPerCategory = Math.round(
      stats[region].totalSymbols / stats[region].categories
    );
  }
  
  return stats;
}
```

## 維護指南

### 更新數據源

1. **更新股票列表**:
   - 執行相應的爬蟲腳本更新原始數據
   - 重新執行 `npm run generate:category-mapping`

2. **新增產業分類**:
   - 編輯 `scripts/generate-category-symbol-mapping.ts`
   - 在對應的分類對照表中新增項目
   - 重新生成映射檔案

### 處理重複股票

美國市場的股票可能出現在多個分類檔案中，腳本會自動去重：
- 以股票代碼為唯一識別
- 保留第一次出現的記錄
- 在 metadata 中記錄去重統計

### 資料驗證

執行腳本後會顯示統計資訊，用於驗證：
- 各地區的分類數量
- 各分類的股票數量
- 總股票數量

### 錯誤處理

- 缺少數據檔案時會顯示警告但不會中斷執行
- 無效的分類代碼會使用預設名稱
- 空分類會被自動跳過

## 常見問題

### Q: 為什麼美國股票的 name 和 symbolCode 相同？
A: 美國的原始數據只包含股票代碼，沒有公司名稱。可以考慮整合其他數據源補充公司名稱。

### Q: 如何新增其他市場的數據？
A: 在 `CategorySymbolMapper` 類中新增對應的處理方法，並在 `CategoryMappings` 介面中新增對應的屬性。

### Q: 分類代碼的命名規則是什麼？
A: 
- 台灣：數字代碼 (1-99)
- 日本：4位數字代碼
- 美國：英文名稱（小寫，用連字符分隔）

## 相關檔案

- **腳本**: `scripts/generate-category-symbol-mapping.ts`
- **輸出**: `output/category-symbol-mappings.json`
- **匯入腳本**: `scripts/import-symbols.ts`
- **實體定義**: `src/database/entities/symbol.entity.ts`

## 更新記錄

- **2025-08-10**: 初始版本，支援台灣、日本、美國三個市場的分類映射