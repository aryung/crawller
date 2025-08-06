# 配置文件說明

## 概述

配置文件是爬蟲系統的核心，定義了爬取目標、數據提取規則、輸出格式等所有參數。本文檔詳細說明各種配置選項和最佳實踐。

## 基本配置結構

```json
{
  "url": "目標網址",
  "selectors": { 
    "欄位名": "CSS選擇器或配置對象"
  },
  "headers": {
    "HTTP標頭": "值"
  },
  "options": {
    "爬蟲選項": "值"
  },
  "variables": {
    "變數名": "變數值"
  },
  "export": {
    "輸出配置": "值"
  }
}
```

## 詳細配置選項

### 1. URL 配置

#### 靜態 URL
```json
{
  "url": "https://example.com/page"
}
```

#### 動態 URL（使用變數）
```json
{
  "url": "https://finance.yahoo.co.jp/quote/${stockCode}/performance",
  "variables": {
    "stockCode": "7901.T"
  }
}
```

#### URL 陣列（多頁面爬取）
```json
{
  "urls": [
    "https://example.com/page1",
    "https://example.com/page2",
    "https://example.com/page3"
  ]
}
```

### 2. 選擇器配置

#### 簡單選擇器
```json
{
  "selectors": {
    "title": "h1",
    "content": ".article-content",
    "price": ".price-value"
  }
}
```

#### 進階選擇器配置
```json
{
  "selectors": {
    "productInfo": {
      "selector": ".product-detail",
      "attribute": "data-product-id",
      "transform": "extractProductId",
      "multiple": false,
      "optional": true,
      "waitFor": 2000
    }
  }
}
```

#### 選擇器選項說明

| 選項 | 類型 | 說明 | 預設值 |
|-----|------|------|-------|
| `selector` | string | CSS 選擇器 | 必填 |
| `attribute` | string | 提取屬性值而非文本 | "text" |
| `transform` | string | 轉換函數名稱 | 無 |
| `multiple` | boolean | 是否提取多個元素 | false |
| `optional` | boolean | 是否為可選欄位 | false |
| `waitFor` | number | 等待時間（毫秒） | 0 |

#### 巢狀提取
```json
{
  "selectors": {
    "products": {
      "selector": ".product-item",
      "multiple": true,
      "extract": {
        "name": ".product-name",
        "price": {
          "selector": ".price",
          "attribute": "data-price",
          "transform": "parseFloat"
        },
        "specs": {
          "selector": ".spec-item",
          "multiple": true,
          "extract": {
            "key": ".spec-key",
            "value": ".spec-value"
          }
        }
      }
    }
  }
}
```

### 3. HTTP 標頭配置

#### 基本標頭
```json
{
  "headers": {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "zh-TW,zh;q=0.9,en;q=0.8",
    "Accept-Encoding": "gzip, deflate, br",
    "Cache-Control": "no-cache"
  }
}
```

#### 認證標頭
```json
{
  "headers": {
    "Authorization": "Bearer your-token-here",
    "X-API-Key": "your-api-key"
  }
}
```

#### 自定義標頭
```json
{
  "headers": {
    "X-Custom-Header": "custom-value",
    "Referer": "https://example.com/from-page"
  }
}
```

### 4. 爬蟲選項配置

```json
{
  "options": {
    "timeout": 30000,
    "retries": 3,
    "headless": true,
    "screenshot": false,
    "encoding": "utf-8",
    "domainDelay": 2000,
    "waitFor": 3000,
    "viewport": {
      "width": 1920,
      "height": 1080
    },
    "proxy": {
      "server": "http://proxy-server:8080",
      "username": "proxy-user",
      "password": "proxy-pass"
    }
  }
}
```

#### 選項說明

| 選項 | 類型 | 說明 | 預設值 |
|-----|------|------|-------|
| `timeout` | number | 請求超時時間（毫秒） | 30000 |
| `retries` | number | 重試次數 | 3 |
| `headless` | boolean | 無頭模式 | true |
| `screenshot` | boolean | 是否截圖 | false |
| `encoding` | string | 頁面編碼 | "utf-8" |
| `domainDelay` | number | 域名間延遲（毫秒） | 2000 |
| `waitFor` | number | 頁面載入等待時間 | 3000 |

### 5. 變數配置

#### 基本變數
```json
{
  "variables": {
    "stockCode": "7901.T",
    "baseUrl": "https://finance.yahoo.co.jp",
    "currentDate": "{{timestamp}}"
  }
}
```

#### 內建變數

| 變數 | 說明 | 範例 |
|-----|------|------|
| `{{timestamp}}` | 當前時間戳 | "2025-07-31T08:00:00.000Z" |
| `{{date}}` | 當前日期 | "2025-07-31" |
| `{{random}}` | 隨機數 | "1627123456789" |

### 6. 輸出配置

```json
{
  "export": {
    "formats": ["json", "csv", "xlsx"],
    "filename": "crawl_results_${stockCode}",
    "path": "./custom-output",
    "separate": true
  }
}
```

#### 輸出選項說明

| 選項 | 類型 | 說明 | 預設值 |
|-----|------|------|-------|
| `formats` | array | 輸出格式陣列 | ["json"] |
| `filename` | string | 文件名模板 | 自動生成 |
| `path` | string | 輸出路徑 | "./output" |
| `separate` | boolean | 每種格式分別匯出 | false |

## 進階配置

### 1. 轉換函數配置

#### 內建轉換函數
```json
{
  "selectors": {
    "price": {
      "selector": ".price",
      "transform": "parseFloat"
    },
    "date": {
      "selector": ".date",
      "transform": "parseDate"
    },
    "text": {
      "selector": ".content",
      "transform": "cleanText"
    }
  }
}
```

#### 自定義轉換函數
```json
{
  "selectors": {
    "financialData": {
      "selector": "table td",
      "multiple": true,
      "transform": "structureFinancialDataFromAllTableCells"
    }
  }
}
```

### 2. 條件配置

#### 基於 URL 的條件配置
```json
{
  "selectors": {
    "title": {
      "selector": "h1",
      "conditions": {
        "urlContains": "news",
        "then": {
          "selector": ".news-title"
        },
        "else": {
          "selector": ".page-title"
        }
      }
    }
  }
}
```

### 3. 配置繼承

```json
{
  "inherits": "base-config.json",
  "url": "https://specific-site.com",
  "selectors": {
    "additionalField": ".extra-content"
  }
}
```

## 配置範例

### 1. 新聞網站爬取

```json
{
  "url": "https://news.example.com/article/${articleId}",
  "selectors": {
    "title": "h1.article-title",
    "author": ".author-name",
    "publishDate": {
      "selector": ".publish-date",
      "attribute": "datetime",
      "transform": "parseDate"
    },
    "content": {
      "selector": ".article-content p",
      "multiple": true,
      "transform": "joinText"
    },
    "tags": {
      "selector": ".tag",
      "multiple": true
    },
    "comments": {
      "selector": ".comment",
      "multiple": true,
      "extract": {
        "user": ".comment-user",
        "text": ".comment-text",
        "timestamp": {
          "selector": ".comment-time",
          "transform": "parseDate"
        }
      }
    }
  },
  "headers": {
    "User-Agent": "NewsBot/1.0",
    "Accept": "text/html,application/xhtml+xml"
  },
  "options": {
    "waitFor": 2000,
    "screenshot": true
  },
  "variables": {
    "articleId": "12345"
  },
  "export": {
    "formats": ["json", "csv"],
    "filename": "news_article_${articleId}"
  }
}
```

### 2. 電商產品爬取

```json
{
  "url": "https://shop.example.com/product/${productId}",
  "selectors": {
    "productName": "h1.product-title",
    "price": {
      "selector": ".price .current",
      "transform": "parseFloat"
    },
    "originalPrice": {
      "selector": ".price .original",
      "transform": "parseFloat",
      "optional": true
    },
    "inStock": {
      "selector": ".stock-status",
      "transform": "isInStock"
    },
    "images": {
      "selector": ".product-image img",
      "multiple": true,
      "attribute": "src"
    },
    "specifications": {
      "selector": ".spec-table tr",
      "multiple": true,
      "extract": {
        "key": "td:first-child",
        "value": "td:last-child"
      }
    },
    "reviews": {
      "selector": ".review-item",
      "multiple": true,
      "extract": {
        "rating": {
          "selector": ".rating",
          "attribute": "data-rating",
          "transform": "parseInt"
        },
        "comment": ".review-text",
        "reviewer": ".reviewer-name"
      }
    }
  },
  "headers": {
    "User-Agent": "Mozilla/5.0 (compatible; ShopBot/1.0)",
    "Accept": "text/html,application/xhtml+xml"
  },
  "options": {
    "waitFor": 3000,
    "domainDelay": 5000
  },
  "variables": {
    "productId": "ABC123"
  },
  "export": {
    "formats": ["json"],
    "filename": "product_${productId}"
  }
}
```

### 3. API 數據爬取

```json
{
  "url": "https://api.example.com/v1/data",
  "method": "POST",
  "body": {
    "query": "financial data",
    "limit": 100
  },
  "selectors": {
    "results": {
      "selector": "$.data.results",
      "multiple": true,
      "extract": {
        "id": "$.id",
        "name": "$.name",
        "value": {
          "selector": "$.value",
          "transform": "parseFloat"
        }
      }
    },
    "metadata": {
      "selector": "$.metadata",
      "extract": {
        "total": "$.total",
        "page": "$.page"
      }
    }
  },
  "headers": {
    "Content-Type": "application/json",
    "Authorization": "Bearer ${apiToken}",
    "X-API-Version": "v1"
  },
  "variables": {
    "apiToken": "your-api-token-here"
  },
  "export": {
    "formats": ["json"],
    "filename": "api_data_{{timestamp}}"
  }
}
```

## 配置驗證

### 配置檢查清單

- [ ] URL 格式正確且可訪問
- [ ] 選擇器能夠匹配目標元素
- [ ] HTTP 標頭設置合理
- [ ] 超時和重試設置適當
- [ ] 輸出格式和路徑正確
- [ ] 變數替換正常工作

### 測試配置

```bash
# 測試單一配置
npm run crawl your-config-name

# 啟用除錯模式
DEBUG=true npm run crawl your-config-name

# 檢查配置語法
node -e "console.log(JSON.parse(require('fs').readFileSync('config/your-config.json')))"
```

## 最佳實踐

### 1. 命名規範

```
配置文件命名規則：
- 網站名-功能-標識.json
- 例如：yahoo-finance-jp-performance.json
- 例如：ecommerce-product-detail.json
```

### 2. 選擇器穩定性

```json
{
  "selectors": {
    "title": "h1, .title, .page-title, [data-testid='title']"
  }
}
```

使用多個備選選擇器提高穩定性。

### 3. 錯誤處理

```json
{
  "selectors": {
    "price": {
      "selector": ".price",
      "optional": true,
      "transform": "parseFloat",
      "default": 0
    }
  }
}
```

### 4. 性能優化

```json
{
  "options": {
    "waitFor": 2000,
    "domainDelay": 3000,
    "timeout": 30000,
    "retries": 2
  }
}
```

根據網站特性調整等待時間和重試策略。

### 5. 安全考量

```json
{
  "headers": {
    "User-Agent": "合理的瀏覽器標識",
    "Referer": "合適的來源頁面"
  },
  "options": {
    "domainDelay": 2000
  }
}
```

避免過於頻繁的請求，使用合理的標頭信息。

## 故障排除

### 常見問題

1. **選擇器無法匹配**
   - 檢查頁面結構是否變更
   - 使用瀏覽器開發者工具確認選擇器
   - 考慮動態內容載入延遲

2. **編碼問題**
   - 設置正確的 `encoding` 選項
   - 檢查 HTTP 回應標頭

3. **反爬蟲限制**
   - 增加 `domainDelay` 延遲
   - 使用合理的 `User-Agent`
   - 考慮使用代理

4. **數據提取不完整**
   - 增加 `waitFor` 等待時間
   - 檢查是否需要滾動頁面
   - 確認選擇器的 `multiple` 設置

### 除錯技巧

```bash
# 啟用詳細日誌
DEBUG=* npm run crawl config-name

# 啟用截圖
# 在配置中設置 "screenshot": true

# 檢查生成的選擇器
node -e "
const config = require('./config/your-config.json');
console.log('Selectors:', Object.keys(config.selectors));
"
```

---

*最後更新：2025-07-31*