# 批處理系統指南

## 概述

批處理系統允許您使用單一配置模板處理多個相關的爬取任務，特別適用於需要爬取大量相似頁面的場景。

## 系統架構

### 設計原則

```
配置模板 + 數據源 = 多個執行配置 → 批量執行
```

1. **配置模板**：定義爬取邏輯和規則
2. **數據源**：提供變化的參數（如股票代碼、產品ID等）
3. **配置生成**：自動組合模板和數據源
4. **批量執行**：順序或並行執行所有配置

### 目錄結構

```
/crawler/
├── configs/
│   ├── templates/           # 配置模板目錄
│   │   └── *.json          # 不會被直接執行
│   ├── active/             # 生成的配置目錄
│   │   └── *.json          # 中間文件
│   └── *.json              # 執行配置（根目錄）
├── data/                   # 數據源目錄
│   └── *.json              # 純數據文件
├── scripts/                # 自動化腳本
│   ├── generate-*.js       # 配置生成器
│   └── run-*.js           # 批處理執行器
└── output/                 # 批處理結果
```

## 使用流程

### 第一步：創建配置模板

在 `configs/templates/` 目錄下創建模板文件：

```json
{
  "url": "https://example.com/api/${itemId}",
  "selectors": {
    "title": "h1",
    "content": ".content"
  },
  "variables": {
    "itemId": "${itemId}",
    "category": "${category}"
  },
  "export": {
    "formats": ["json"],
    "filename": "item_${itemId}"
  }
}
```

### 第二步：準備數據源

在 `data/` 目錄下創建數據文件：

```json
[
  {
    "itemId": "123",
    "category": "electronics",
    "name": "Product A"
  },
  {
    "itemId": "456", 
    "category": "books",
    "name": "Product B"
  }
]
```

### 第三步：創建配置生成器

```javascript
#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// 讀取模板
const templatePath = path.join(__dirname, '../configs/templates/product-template.json');
const template = JSON.parse(fs.readFileSync(templatePath, 'utf8'));

// 讀取數據源
const dataPath = path.join(__dirname, '../data/product-list.json');
const products = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

// 生成配置文件
products.forEach(product => {
  const config = JSON.parse(JSON.stringify(template));
  
  // 替換 URL 變數
  config.url = config.url.replace('${itemId}', product.itemId);
  
  // 更新變數
  config.variables.itemId = product.itemId;
  config.variables.category = product.category;
  
  // 更新導出設置
  config.export.filename = `product_${product.itemId}`;
  
  // 寫入配置文件
  const configFilename = `product-${product.itemId}.json`;
  const configPath = path.join(__dirname, '../configs', configFilename);
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  
  console.log(`✅ 已生成配置: ${configFilename}`);
});
```

### 第四步：創建批處理執行器

```javascript
#!/usr/bin/env node

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

async function runCrawler(configName) {
  return new Promise((resolve, reject) => {
    const child = spawn('npm', ['run', 'crawl', configName], {
      stdio: 'pipe',
      cwd: path.join(__dirname, '..')
    });
    
    child.on('close', (code) => {
      if (code === 0) {
        resolve({ configName, success: true });
      } else {
        resolve({ configName, success: false, code });
      }
    });
  });
}

async function main() {
  // 找到所有產品配置
  const configsDir = path.join(__dirname, '../configs');
  const configFiles = fs.readdirSync(configsDir)
    .filter(file => file.startsWith('product-') && file.endsWith('.json'))
    .map(file => file.replace('.json', ''));
  
  console.log(`📋 找到 ${configFiles.length} 個配置文件`);
  
  const results = [];
  
  for (const configName of configFiles) {
    console.log(`🚀 開始執行: ${configName}`);
    const result = await runCrawler(configName);
    results.push(result);
    
    if (result.success) {
      console.log(`✅ 完成: ${configName}`);
    } else {
      console.log(`❌ 失敗: ${configName}`);
    }
    
    // 延遲避免服務器壓力
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  // 結果統計
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  
  console.log(`\n🎉 批處理完成！`);
  console.log(`✅ 成功: ${successful} 個`);
  console.log(`❌ 失敗: ${failed} 個`);
}

main().catch(console.error);
```

## 實際案例：Yahoo Finance Japan

### 配置模板
`configs/templates/yahoo-finance-jp-performance.json`

```json
{
  "url": "https://finance.yahoo.co.jp/quote/${stockCode}/performance?styl=performance",
  "selectors": {
    "stockInfo": {
      "selector": "h1, .symbol",
      "transform": "cleanStockSymbol"
    },
    "structuredPerformanceData": {
      "selector": "table td, table th",
      "multiple": true,
      "transform": "structureFinancialDataFromAllTableCells"
    }
  },
  "variables": {
    "stockCode": "${stockCode}"
  },
  "export": {
    "formats": ["json"],
    "filename": "yahoo_finance_jp_${stockCode}"
  }
}
```

### 數據源
`data/yahoo-finance-jp-stockcodes.json`

```json
[
  {
    "stockCode": "7901.T",
    "companyName": "(株)マツモト",
    "sector": "小売業"
  },
  {
    "stockCode": "143A.T",
    "companyName": "イシン(株)",
    "sector": "食料品"
  }
]
```

### 執行命令

```bash
# 生成配置
node scripts/generate-batch-configs.js

# 執行批處理
node scripts/run-yahoo-finance-batch.js
```

## 進階功能

### 條件配置生成

```javascript
// 根據條件生成不同配置
products.forEach(product => {
  const config = JSON.parse(JSON.stringify(template));
  
  if (product.category === 'electronics') {
    config.options.waitFor = 5000; // 電子產品頁面需要更長等待
  }
  
  if (product.premium) {
    config.headers['Authorization'] = 'Bearer premium-token';
  }
});
```

### 分組批處理

```javascript
// 按類別分組處理
const groupedProducts = products.reduce((groups, product) => {
  const category = product.category;
  if (!groups[category]) groups[category] = [];
  groups[category].push(product);
  return groups;
}, {});

for (const [category, items] of Object.entries(groupedProducts)) {
  console.log(`處理類別: ${category}`);
  for (const item of items) {
    await runCrawler(`product-${item.itemId}`);
  }
  // 類別間延遲
  await new Promise(resolve => setTimeout(resolve, 5000));
}
```

### 並行處理

```javascript
// 並行執行（注意服務器壓力）
const CONCURRENT_LIMIT = 3;

async function runBatchConcurrent(configNames) {
  const chunks = [];
  for (let i = 0; i < configNames.length; i += CONCURRENT_LIMIT) {
    chunks.push(configNames.slice(i, i + CONCURRENT_LIMIT));
  }
  
  for (const chunk of chunks) {
    const promises = chunk.map(configName => runCrawler(configName));
    const results = await Promise.all(promises);
    
    results.forEach(result => {
      console.log(`${result.success ? '✅' : '❌'} ${result.configName}`);
    });
    
    // 批次間延遲
    await new Promise(resolve => setTimeout(resolve, 3000));
  }
}
```

## 最佳實踐

### 1. 配置管理

```bash
# 建議的命名規則
configs/templates/
├── yahoo-finance-jp-performance.json      # 主模板
├── ecommerce-product-detail.json          # 電商產品
└── news-article-content.json              # 新聞文章

data/
├── yahoo-finance-jp-stockcodes.json       # 股票代碼
├── ecommerce-product-ids.json             # 產品ID
└── news-article-urls.json                 # 新聞URL
```

### 2. 錯誤處理

```javascript
async function runCrawlerWithRetry(configName, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await runCrawler(configName);
      if (result.success) return result;
      
      console.log(`重試 ${attempt}/${maxRetries}: ${configName}`);
      await new Promise(resolve => setTimeout(resolve, attempt * 2000));
    } catch (error) {
      if (attempt === maxRetries) throw error;
    }
  }
}
```

### 3. 進度追蹤

```javascript
class BatchProcessor {
  constructor(configNames) {
    this.configNames = configNames;
    this.results = [];
    this.currentIndex = 0;
  }
  
  async run() {
    for (const configName of this.configNames) {
      this.currentIndex++;
      console.log(`[${this.currentIndex}/${this.configNames.length}] 處理: ${configName}`);
      
      const result = await runCrawler(configName);
      this.results.push(result);
      
      this.logProgress();
      await this.delay();
    }
  }
  
  logProgress() {
    const success = this.results.filter(r => r.success).length;
    const failed = this.results.filter(r => !r.success).length;
    console.log(`進度: ${this.currentIndex}/${this.configNames.length} | 成功: ${success} | 失敗: ${failed}`);
  }
}
```

### 4. 資源管理

```javascript
// 監控系統資源
const os = require('os');

function checkSystemResources() {
  const freeMemory = os.freemem() / 1024 / 1024 / 1024; // GB
  const cpuLoad = os.loadavg()[0];
  
  if (freeMemory < 1) {
    console.warn('⚠️  記憶體不足，暫停處理');
    return false;
  }
  
  if (cpuLoad > os.cpus().length * 0.8) {
    console.warn('⚠️  CPU 負載過高，暫停處理');
    return false;
  }
  
  return true;
}
```

## 故障排除

### 常見問題

1. **配置文件衝突**
   - 確保 `templates/` 目錄中的模板不會被直接執行
   - 使用清晰的命名規則區分模板和執行配置

2. **數據源格式錯誤**
   - 驗證 JSON 格式正確性
   - 確保必要欄位完整

3. **批處理中斷**
   - 實施重試機制
   - 記錄處理進度
   - 支援斷點續傳

4. **性能問題**
   - 適當設置並發限制
   - 監控系統資源
   - 實施延遲策略

### 除錯技巧

```bash
# 測試單一配置
node scripts/generate-batch-configs.js
npm run crawl generated-config-name

# 檢查生成的配置
cat configs/generated-config-name.json

# 啟用詳細日誌
DEBUG=true node scripts/run-batch-processor.js
```

## 擴展功能

### 自定義批處理器

```javascript
class CustomBatchProcessor {
  constructor(options) {
    this.templatePath = options.templatePath;
    this.dataPath = options.dataPath;
    this.outputDir = options.outputDir;
    this.concurrency = options.concurrency || 1;
  }
  
  async generateConfigs() {
    // 自定義配置生成邏輯
  }
  
  async executeAll() {
    // 自定義執行邏輯
  }
  
  async cleanup() {
    // 清理臨時文件
  }
}
```

### 整合外部數據源

```javascript
// 從 API 獲取數據源
async function fetchDataSource(apiUrl) {
  const response = await fetch(apiUrl);
  const data = await response.json();
  
  // 轉換為標準格式
  return data.items.map(item => ({
    itemId: item.id,
    category: item.type,
    name: item.title
  }));
}
```

這個批處理系統提供了靈活且強大的批量處理能力，可以根據具體需求進行定制和擴展。

---

*最後更新：2025-07-31*