# CLI 快速使用指南

## 🚀 快速開始

### 1. 查看可用配置
```bash
npm run crawler list
```

### 2. 執行 MoneyDJ 爬蟲
```bash
# 基本版本
npm run crawl moneydj

# 完整版本
npm run crawl moneydj-links
```

### 3. 建立新配置
```bash
npm run crawler create my-site
```

## 🛡️ 安全功能

### 優雅關閉
- **Ctrl+C** 一次：優雅關閉，等待當前任務完成
- **Ctrl+C** 兩次：強制終止

### 自動超時和快速回退
- 瀏覽器啟動超時：10 秒（快速失敗）
- 靜態網站優先使用 HTTP 模式（秒級完成）
- 智能引擎切換：Puppeteer → Playwright → HTTP
- 預設總體超時：10 分鐘
- 自動清理資源
- 進度即時顯示

## 📋 現有配置

- `moneydj` - MoneyDJ 基本產業列表
- `moneydj-links` - MoneyDJ 完整產業資訊（包含分類）

## 🔧 常用命令

```bash
# 列出所有配置
npm run crawler list

# 驗證配置
npm run crawler validate moneydj

# 指定輸出格式
npm run crawl moneydj --format xlsx

# 使用 Playwright 引擎
npm run crawl moneydj --engine playwright

# 啟用詳細日誌
npm run crawl moneydj --verbose
```

## 📂 輸出檔案

執行後會在 `output/` 目錄產生：
- JSON/CSV/Excel 資料檔案
- 統計報告
- 截圖（如果啟用）

## 🛠️ 診斷工具

### 系統診斷
```bash
npm run crawler doctor
```
檢查：
- 系統環境和依賴
- 瀏覽器引擎狀態
- 網路連線
- 檔案權限

## ❌ 故障排除

### 如果瀏覽器無法啟動
1. **執行診斷**：`npm run crawler doctor`
2. **檢查依賴**：確認 Puppeteer 正確安裝
3. **macOS 用戶**：安裝 Xcode Command Line Tools
   ```bash
   xcode-select --install
   ```

### 常見錯誤解決方案
- **WebSocket 錯誤**：系統會自動回退到 HTTP 模式
- **權限問題**：確保有檔案讀寫權限
- **網路超時**：檢查網路連線或增加超時時間

### 配置問題
1. 檢查配置檔案：`npm run crawler list`
2. 驗證配置格式：`npm run crawler validate <config-name>`
3. 查看詳細日誌：`--verbose` 選項

## 🚀 現在開始

```bash
# 1. 先診斷系統
npm run crawler doctor

# 2. 執行爬蟲
npm run crawl moneydj

# 3. 如有問題，查看診斷建議
```

系統會自動選擇最適合的引擎，即使瀏覽器無法啟動也能正常工作！