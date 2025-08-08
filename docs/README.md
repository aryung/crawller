# Universal Web Crawler 文件說明

## 目錄結構

```
/crawler/
├── config/                     # 配置文件目錄
│   ├── templates/              # 配置模板（不被執行）
│   │   └── *.json
│   ├── active/                 # 生成的實際配置
│   │   └── *.json
│   └── *.json                  # 根目錄配置文件（直接執行）
├── data/                       # 數據源目錄
│   └── *.json                  # 純數據文件
├── scripts/                    # 自動化腳本
│   ├── generate-*.js          # 配置生成器
│   └── run-*.js               # 批處理執行器
├── src/                        # 源代碼
├── output/                     # 輸出結果
├── logs/                       # 運行日誌
└── docs/                       # 說明文件
```

## 主要功能

### 1. 基本爬蟲功能
- 支援多種網站爬取
- 自動重試機制
- 代理支援
- 多種輸出格式 (JSON, CSV, Excel)

### 2. Yahoo Finance Japan 專項功能
- 支援 **Financials** 和 **Performance** 兩種數據類型
- 智能表格解析與數據類型自動檢測
- 單位自動轉換 (百万円 → 實際金額, % → 小數, 千株 → 實際股數)
- 批處理多股票代碼
- 雙重解析引擎架構

### 3. 股票爬蟲腳本功能 🆕
- **智能分頁策略**: 從單頁 20 股票提升到多頁 127+ 股票 (**6.35x 效率提升**)
- **日文格式支援**: 自動解析 "121～128 / 128件" 格式的分頁信息
- **數學計算分頁**: 基於總筆數自動計算頁數 (128筆 = 128/20 = 7頁)
- **多層容錯機制**: 網絡重試、空頁檢測、最大頁數保護
- **數據清理優化**: 智能清理股票名稱中的價格、百分比等無關信息
- **命令行參數**: 支援 `--test-mode`, `--max-pages`, `--category` 等參數

### 4. 批處理架構
- 配置模板系統
- 數據驅動生成
- 自動化執行腳本

## 快速開始

### 安裝依賴
```bash
npm install
```

### 基本使用
```bash
# 查看所有可用配置
npm run crawl list

# 執行單一配置
npm run crawl <config-name>

# 查看幫助
npm run crawl --help
```

## 詳細文件

### 用戶指南
- [Yahoo Finance Japan 使用指南](./yahoo-finance-japan.md) - 基本使用和配置說明
- [股票爬蟲腳本使用指南](./stock-scraper-usage-guide.md) - **股票爬蟲腳本專用操作指南** 🆕
- [配置文件說明](./configuration.md) - 配置選項詳解
- [批處理系統指南](./batch-processing.md) - 批量處理流程
- [CLI 使用說明](./cli-usage.md) - 命令列工具指南

### 開發者文檔
- [Yahoo Finance JP 開發指南](./yahoo-finance-jp-development.md) - **新功能開發流程**
- [故障排除](./troubleshooting.md) - 問題診斷和解決方案

## 快速導航

### 新手入門
1. 閱讀本 README 了解基本概念
2. 查看 [股票爬蟲腳本使用指南](./stock-scraper-usage-guide.md) 快速上手腳本操作 🆕
3. 參考 [Yahoo Finance Japan 使用指南](./yahoo-finance-japan.md) 了解實際案例
4. 查看 [配置文件說明](./configuration.md) 學習配置選項

### 進階使用
1. 閱讀 [批處理系統指南](./batch-processing.md) 了解批量處理
2. 查看 [故障排除](./troubleshooting.md) 解決問題
3. 研究 `src/` 目錄的原始碼

### 開發者流程
1. 閱讀 [Yahoo Finance JP 開發指南](./yahoo-finance-jp-development.md) 了解系統架構
2. 學習 Financials 和 Performance 兩種解析引擎
3. 掌握新數據類型擴展流程

### 問題解決
1. 檢查 [故障排除指南](./troubleshooting.md)
2. 查看日誌檔案 `logs/error.log`
3. 啟用除錯模式進行診斷

## 文檔更新

本文檔會隨著專案更新而持續維護。如果發現內容過時或有遺漏，歡迎提出 Issue 或 Pull Request。

### 版本對應
- v1.0.0: 初始版本，包含基本功能和 Yahoo Finance Japan 專項功能
- 未來版本將在此處記錄重大變更

### 最新更新 (2025-08-05) 🚀
- ✅ **智能分頁策略重大突破** - 股票爬蟲從單頁提升到多頁處理 (**6.35x 效率提升**)
- ✅ **日文格式分頁支援** - 支援 "121～128 / 128件" 格式的智能解析
- ✅ **數學計算分頁邏輯** - 基於總筆數自動計算頁數 (128筆 = 128/20 = 7頁)
- ✅ **多層 CSS 選擇器策略** - 解決數據提取空白問題
- ✅ **智能數據清理** - 自動清理股票名稱中的價格、百分比等無關信息
- ✅ **命令行參數支援** - 新增 `--test-mode`, `--max-pages`, `--category` 參數
- ✅ **容錯機制完善** - 網絡重試、連續空頁檢測、最大頁數保護
- ✅ **完整使用文檔** - 新增股票爬蟲腳本專用使用指南

### 上一版本更新 (2025-07-31)
- ✅ **雙重解析引擎架構** - 支援 Financials 和 Performance 兩種數據類型
- ✅ **智能數據類型檢測** - 自動識別並路由到適當的解析器  
- ✅ **完整單位轉換系統** - 百萬円、百分比、千株等單位正確轉換
- ✅ **檔案命名格式優化** - 統一使用 yyyymmddhhmmss 格式

## 聯繫信息

如有問題請參考相關文件或聯繫開發團隊。
