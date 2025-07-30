# 故障排除指南

## 常見問題與解決方案

### 1. WebSocket Hang Up 錯誤

**問題描述:**
```
Error: WebSocket connection failed: WebSocket is closed before the connection is established
```

**解決方案:**

1. **使用 --no-sandbox 參數** (已內建)
   ```typescript
   // 系統已自動加入這些參數
   args: ['--no-sandbox', '--disable-setuid-sandbox']
   ```

2. **切換到 Playwright**
   ```typescript
   const crawler = new UniversalCrawler({ usePlaywright: true });
   ```

3. **調整重試設定**
   ```typescript
   {
     options: {
       retries: 5,
       delay: 3000,
       timeout: 60000
     }
   }
   ```

### 2. 頁面載入超時

**問題描述:**
```
Error: Navigation timeout of 30000 ms exceeded
```

**解決方案:**

1. **增加超時時間**
   ```typescript
   {
     options: {
       timeout: 60000,  // 60秒
       waitFor: 5000    // 額外等待5秒
     }
   }
   ```

2. **使用更寬鬆的等待條件**
   ```typescript
   // 在 WebCrawler 中修改 waitUntil 參數
   await page.goto(url, { 
     waitUntil: 'domcontentloaded'  // 而不是 'networkidle2'
   });
   ```

3. **分步驟載入**
   ```typescript
   {
     options: {
       waitFor: 0,      // 先不等待
       timeout: 30000   // 較短的超時
     }
   }
   ```

### 3. 選擇器找不到元素

**問題描述:**
```
Error: Element not found for selector: .some-selector
```

**解決方案:**

1. **增加等待時間**
   ```typescript
   {
     options: {
       waitFor: 5000  // 等待元素載入
     }
   }
   ```

2. **使用更通用的選擇器**
   ```typescript
   {
     selectors: {
       // 不好的選擇器（太具體）
       title: 'div.container > header.main-header > h1.title-text',
       
       // 好的選擇器（通用）
       title: 'h1, .title, [data-title]'
     }
   }
   ```

3. **檢查元素是否動態載入**
   ```typescript
   {
     selectors: {
       dynamicContent: {
         selector: '.dynamic-content',
         waitFor: 3000  // 針對特定元素等待
       }
     }
   }
   ```

### 4. Cookie 設定失敗

**問題描述:**
```
Error: Failed to set cookies
```

**解決方案:**

1. **檢查 Cookie 格式**
   ```typescript
   {
     cookies: {
       enabled: true,
       // 正確格式
       cookieString: 'name1=value1; name2=value2; name3=value3',
       domain: 'example.com'
     }
   }
   ```

2. **驗證登入選擇器**
   ```typescript
   {
     cookies: {
       enabled: true,
       loginSelectors: {
         username: 'input[name="username"]',    // 確保選擇器正確
         password: 'input[type="password"]',    // 使用更通用的選擇器
         submit: 'button[type="submit"], input[type="submit"]'
       }
     }
   }
   ```

3. **增加登入等待時間**
   ```typescript
   {
     cookies: {
       enabled: true,
       loginUrl: 'https://example.com/login',
       waitAfterLogin: 5000,  // 登入後等待
       // ...其他設定
     }
   }
   ```

### 5. 記憶體不足或效能問題

**問題描述:**
```
Error: Cannot create browser: spawn ENOMEM
```

**解決方案:**

1. **停用不必要的功能**
   ```typescript
   {
     options: {
       headless: true,      // 使用無頭模式
       screenshot: false,   // 停用截圖
     }
   }
   ```

2. **限制併發數量**
   ```typescript
   const results = await crawler.crawlMultiple(configs, 1); // 一個一個執行
   ```

3. **及時清理資源**
   ```typescript
   try {
     const result = await crawler.crawl(config);
     // 處理結果
   } finally {
     await crawler.cleanup();  // 一定要清理
   }
   ```

4. **使用 Axios 模式處理簡單頁面**
   ```typescript
   // 對於不需要 JavaScript 的簡單頁面
   {
     url: 'https://simple-site.com',
     selectors: { title: 'h1' },
     // 不設定 cookies、screenshot 等複雜功能
   }
   ```

### 6. 資料提取結果為空

**問題描述:**
提取的資料全部為 null 或空字串。

**解決方案:**

1. **檢查頁面是否完全載入**
   ```typescript
   {
     options: {
       waitFor: 5000,  // 增加等待時間
       screenshot: true  // 啟用截圖來檢查頁面狀態
     }
   }
   ```

2. **使用頁面評估提取資料**
   ```typescript
   const extractor = new DataExtractor();
   const result = await extractor.extractByEvaluation(page, `
     return {
       title: document.querySelector('h1')?.textContent,
       content: document.querySelector('.content')?.textContent
     };
   `);
   ```

3. **檢查元素是否在 iframe 中**
   ```typescript
   // 如果內容在 iframe 中，需要特殊處理
   const frame = await page.frame('frame-name');
   const title = await frame.$eval('h1', el => el.textContent);
   ```

### 7. 圖片或媒體載入問題

**問題描述:**
截圖中圖片未載入完成。

**解決方案:**

1. **等待圖片載入**
   ```typescript
   {
     options: {
       waitFor: 3000,  // 給圖片載入時間
     }
   }
   ```

2. **自定義等待條件**
   ```typescript
   // 在爬蟲中加入自定義等待
   await page.waitForFunction(() => {
     const images = document.querySelectorAll('img');
     return Array.from(images).every(img => img.complete);
   });
   ```

### 8. 反爬蟲機制觸發

**問題描述:**
被網站識別為機器人並封鎖。

**解決方案:**

1. **設定真實的 User Agent**
   ```typescript
   {
     options: {
       userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
     }
   }
   ```

2. **加入隨機延遲**
   ```typescript
   {
     options: {
       delay: Math.random() * 3000 + 2000  // 2-5秒隨機延遲
     }
   }
   ```

3. **模擬人類行為**
   ```typescript
   // 在頁面中加入滑鼠移動、點擊等行為
   await page.mouse.move(100, 100);
   await page.mouse.move(200, 200);
   ```

### 9. 字元編碼問題

**問題描述:**
提取的中文內容顯示為亂碼。

**解決方案:**

1. **設定正確的標頭**
   ```typescript
   {
     headers: {
       'Accept-Charset': 'utf-8',
       'Accept-Language': 'zh-TW,zh;q=0.9'
     }
   }
   ```

2. **檢查頁面編碼**
   ```typescript
   const encoding = await page.evaluate(() => document.characterSet);
   console.log('頁面編碼:', encoding);
   ```

### 10. SSL 憑證錯誤

**問題描述:**
```
Error: SSL certificate problem: self signed certificate
```

**解決方案:**

1. **忽略 SSL 錯誤** (已內建)
   ```typescript
   // 系統已自動設定
   ignoreHTTPSErrors: true
   ```

2. **檢查網站 SSL 狀態**
   ```bash
   curl -I https://example.com
   ```

## 除錯技巧

### 1. 啟用除錯模式

```typescript
const crawler = new UniversalCrawler();

// 啟用詳細日誌
process.env.DEBUG = 'crawler:*';

const result = await crawler.crawl({
  url: 'https://example.com',
  options: {
    headless: false,  // 顯示瀏覽器視窗
    screenshot: true  // 保存截圖
  }
});
```

### 2. 檢查頁面內容

```typescript
// 在 DataExtractor 中加入內容檢查
const content = await page.content();
console.log('頁面 HTML:', content.substring(0, 1000));

const title = await page.title();
console.log('頁面標題:', title);
```

### 3. 測試選擇器

```typescript
// 在瀏覽器控制台中測試選擇器
const elements = document.querySelectorAll('your-selector');
console.log('找到元素數量:', elements.length);
console.log('元素內容:', Array.from(elements).map(el => el.textContent));
```

### 4. 逐步執行

```typescript
const crawler = new UniversalCrawler();

try {
  console.log('1. 開始爬蟲...');
  const result = await crawler.crawl(config);
  
  console.log('2. 爬蟲完成，檢查結果...');
  console.log('成功:', result.success);
  console.log('資料:', Object.keys(result.data));
  
  if (result.screenshot) {
    console.log('3. 保存截圖...');
    await crawler.saveScreenshots([result]);
  }
  
} catch (error) {
  console.error('錯誤詳情:', error);
}
```

## 效能優化建議

### 1. 選擇合適的引擎

```typescript
// 簡單靜態頁面：使用 Axios
const simpleConfig = {
  url: 'https://simple-static-site.com',
  selectors: { title: 'h1' }
  // 不設定 cookies、screenshot 等
};

// 複雜動態頁面：使用 Puppeteer/Playwright
const complexConfig = {
  url: 'https://spa-application.com',
  cookies: { enabled: true },
  options: { waitFor: 5000 }
};
```

### 2. 批量處理優化

```typescript
// 控制併發數量
const results = await crawler.crawlMultiple(configs, 2);

// 分批處理大量 URL
const batchSize = 10;
for (let i = 0; i < urls.length; i += batchSize) {
  const batch = urls.slice(i, i + batchSize);
  const batchResults = await crawler.crawlMultiple(batch, 3);
  // 處理結果...
}
```

### 3. 記憶體管理

```typescript
// 及時清理
const crawler = new UniversalCrawler();

for (const config of configs) {
  const result = await crawler.crawl(config);
  // 立即處理和保存結果
  await processResult(result);
  
  // 定期清理
  if (processedCount % 10 === 0) {
    await crawler.cleanup();
  }
}
```

如果以上解決方案都無法解決你的問題，請檢查：

1. 系統資源（記憶體、CPU）
2. 網路連線狀況
3. 目標網站的訪問限制
4. 依賴套件版本相容性

需要更多協助可以查看日誌檔案 `logs/error.log` 獲得詳細錯誤資訊。