# CLI 快速使用指南

## 🚀 快速開始

### 1. 查看可用配置
```bash
npm run list          # 簡短版本
# 或
npm run crawler list  # 完整版本
```

### 2. 執行 MoneyDJ 爬蟲
```bash
# 方法 1: 使用 crawl 命令
npm run crawl moneydj

# 方法 2: 使用 crawler 命令 (新功能!)
npm run crawler moneydj

# 完整版本
npm run crawl moneydj-links
npm run crawler moneydj-links  # 兩種方式都可以
```

### 3. 建立新配置
```bash
npm run crawler create my-site
```

### 4. 從 curl 命令建立配置
```bash
npm run curl2config "curl 'https://example.com' -H 'accept: text/html'"
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

### 🔥 **統一命令** (推薦)
```bash
# 執行爬蟲 - 兩種方式都可以！
npm run crawler moneydj         # 新功能: 直接執行

# 管理命令
npm run crawl list            # 列出配置
npm run crawl doctor          # 系統診斷
npm run crawl validate config # 驗證配置
npm run crawl create new-site # 建立配置
npm run curl2config "curl..."   # curl 轉換
```

### 📋 **簡化命令**
```bash
npm run list                    # 快速列出配置
npm run doctor                  # 快速診斷
npm run validate config         # 快速驗證
```

### ⚙️ **進階選項**
```bash
# 指定輸出格式
npm run crawl moneydj --format xlsx

# 使用 Playwright 引擎
npm run crawl moneydj --engine playwright

# 啟用詳細日誌
npm run crawl moneydj --verbose

# 跳過生成 Markdown 報告（兩種寫法都可以）
npm run crawl moneydj --skip-report
npm run crawl moneydj --no-report

# 直接執行方式也支援參數
npx tsx src/cli.ts moneydj --no-report
npx tsx src/cli.ts moneydj --skip-report
```

## 📂 輸出檔案

執行後會在 `output/` 目錄產生：
- JSON/CSV/Excel 資料檔案
- 統計報告（Markdown 格式）
- 截圖（如果啟用）

### 📊 **報告生成控制**

預設情況下，爬蟲執行完成後會自動生成 Markdown 格式的統計報告 (`crawl_report_*.md`)。如果不需要報告，可以使用以下任一參數：

```bash
# 方式 1: 使用 --skip-report
npm run crawl moneydj --skip-report
npx tsx src/cli.ts crawl moneydj --skip-report

# 方式 2: 使用 --no-report（更直觀）
npm run crawl moneydj --no-report
npx tsx src/cli.ts crawl moneydj --no-report

# 方式 3: 直接執行配置也支援
npx tsx src/cli.ts moneydj --no-report
npx tsx src/cli.ts moneydj --skip-report
```

**參數說明：**
- `--skip-report`: 傳統參數，跳過 MD 報告生成
- `--no-report`: 新增別名參數，功能相同但更直觀
- 兩個參數完全等效，可以任選一個使用

**執行結果差異：**
```bash
# 生成報告（預設）
📊 報告已生成: output/crawl_report_20250731172958.md

# 跳過報告
📊 已跳過 MD 報告生成（使用 --no-report）
```

## 🛠️ 診斷工具

### 系統診斷
```bash
npm run crawl doctor
```
檢查：
- 系統環境和依賴
- 瀏覽器引擎狀態
- 網路連線
- 檔案權限

## ❌ 故障排除

### 如果瀏覽器無法啟動
1. **執行診斷**：`npm run crawl doctor`
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
1. 檢查配置檔案：`npm run crawl list`
2. 驗證配置格式：`npm run crawl validate <config-name>`
3. 查看詳細日誌：`--verbose` 選項

## 🚀 現在開始

```bash
# 1. 先診斷系統
npm run crawl doctor

# 2. 執行爬蟲
npm run crawl moneydj

# 3. 如有問題，查看診斷建議
```

系統會自動選擇最適合的引擎，即使瀏覽器無法啟動也能正常工作！

## 📚 **命令快速參考**

| 功能 | 統一命令 | 簡化命令 | 說明 |
|------|----------|----------|------|
| **執行爬蟲** | `npm run crawl moneydj` | `npm run crawl moneydj` | 兩種方式都可以 ✨ |
| **跳過報告** | `npm run crawl moneydj --no-report` | `npx tsx src/cli.ts moneydj --no-report` | 不生成 MD 報告 🆕 |
| **列出配置** | `npm run crawl list` | `npm run list` | 顯示所有配置 |
| **系統診斷** | `npm run crawl doctor` | `npm run doctor` | 檢查系統狀態 |
| **驗證配置** | `npm run crawl validate config` | `npm run validate config` | 檢查配置正確性 |
| **建立配置** | `npm run crawl create name` | - | 新建配置檔案 |
| **curl轉換** | `npm run crawl curl2config "..."` | `npm run curl2config "..."` | 從 curl 建立配置 |

### 🆕 **CLI 參數支援**

| 參數 | 說明 | 範例 |
|------|------|------|
| `--skip-report` | 跳過 MD 報告生成（傳統） | `npm run crawl config --skip-report` |
| `--no-report` | 跳過 MD 報告生成（新別名）🆕 | `npm run crawl config --no-report` |
| `--verbose` | 啟用詳細日誌 | `npm run crawl config --verbose` |
| `--format xlsx` | 指定輸出格式 | `npm run crawl config --format xlsx` |
| `--concurrent 5` | 設定並發數量 | `npm run crawl config --concurrent 5` |

> **💡 提示**: 
> - `--skip-report` 和 `--no-report` 功能完全相同，任選一個使用
> - 直接執行方式 `npx tsx src/cli.ts config --no-report` 也完全支援所有參數
