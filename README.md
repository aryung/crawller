# Crawller - 無狀態爬蟲系統

一個支援現代網站（React/SPA）的結構化資料提取爬蟲系統，提供 CLI 工具和 HTTP API 介面。

## ✨ 特色

- 🚀 **現代網站支援** - 處理 React、Vue、Angular 等 SPA 網站
- 📊 **智能解析** - 自動表格偵測和結構化資料提取  
- 🧹 **資料清理** - 自動標準化格式（"---" → null, "0.00" → 0）
- ⚙️ **配置驅動** - 靈活的選擇器和清理規則配置
- 🎯 **無狀態設計** - 適合微服務和容器化部署
- 💻 **雙軌介面** - CLI 工具 + HTTP API
- 📁 **多種格式** - 支援 JSON、CSV 輸出

## 🚀 快速開始

### 安裝

```bash
# 本地開發
git clone <repository>
cd crawller
npm install
npm run build

# 全域安裝 (如果發布到 npm)
npm install -g crawller
```

### CLI 使用

```bash
# 基本爬取
crawller crawl --url "https://example.com" --selector "table td"

# 使用配置檔案
crawller crawl --config examples/basic-config.json --output result.json

# 動態網站支援
crawller crawl --url "https://spa-site.com" --wait ".data-table" --normalize

# 產生範例配置
crawller example --file my-config.json
```

### API 服務

```bash
# 啟動 API 服務器
npm run server

# 執行爬取請求
curl -X POST http://localhost:3000/crawl \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "selectors": {"data": ["td"]},
    "cleaning": {"normalize": true}
  }'
```

### 程式庫整合

```javascript
import { Crawller } from 'crawller';

const crawler = new Crawller();
const result = await crawler.crawl({
  url: 'https://example.com',
  selectors: { data: ['td'] },
  cleaning: { normalize: true }
});

console.log(`抓取到 ${result.data.length} 筆資料`);
await crawler.close();
```

## 📋 配置範例

### 基本表格爬取
```json
{
  "url": "https://example.com/data",
  "selectors": {
    "container": "table",
    "data": ["td"],
    "headers": ["th"]
  },
  "cleaning": {
    "normalize": true
  }
}
```

### 動態網站支援
```json
{
  "url": "https://spa-site.com/data",
  "selectors": {
    "data": [".item-title", ".item-price"]
  },
  "waitOptions": {
    "selector": ".data-loaded",
    "timeout": 15000
  },
  "cleaning": {
    "normalize": true,
    "prefix": ["/^\\s*\\$\\s*/"],
    "suffix": ["/\\s*USD\\s*$/"]
  }
}
```

## 📚 詳細文檔

- **[使用指南](docs/USAGE.md)** - 完整的使用說明和範例
- **[API 文檔](docs/API.md)** - HTTP API 詳細文檔  
- **[架構設計](docs/ARCHITECTURE.md)** - 系統架構和設計理念
- **[範例集合](docs/EXAMPLES.md)** - 各種實際使用場景範例

## 🔧 開發指令

```bash
npm run build          # 編譯 TypeScript
npm run cli            # 執行 CLI（開發模式）
npm run server         # 啟動 API 服務器
npm test              # 執行測試
npm run lint          # 程式碼檢查
```

## 🎯 主要特性

### 支援的網站類型
- ✅ 靜態 HTML 網站
- ✅ React/Vue/Angular SPA 應用
- ✅ 動態載入內容的網站
- ✅ 需要等待的異步內容

### 資料清理功能
- **自動標準化**: `"123"` → `123`, `"---"` → `null`
- **格式清理**: 移除貨幣符號、百分比符號等
- **空值處理**: 統一處理各種空值表示

### 輸出格式
- **JSON**: 結構化資料，適合程式處理
- **CSV**: 表格格式，適合數據分析

## 📄 授權

MIT License

## 🤝 貢獻

歡迎提交 Issue 和 Pull Request！請參考 [ARCHITECTURE.md](docs/ARCHITECTURE.md) 了解系統設計。