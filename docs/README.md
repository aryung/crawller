# Universal Web Crawler 文件說明

## 目錄結構

```
/crawler/
├── configs/                     # 配置文件目錄
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
- 日本股票財務數據爬取
- 智能表格解析
- 單位自動轉換 (百万円 → 實際金額, % → 小數)
- 批處理多股票代碼

### 3. 批處理架構
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
npm run crawler list

# 執行單一配置
npm run crawl <config-name>

# 查看幫助
npm run crawler --help
```

## 詳細文件

- [Yahoo Finance Japan 使用指南](./yahoo-finance-japan.md)
- [配置文件說明](./configuration.md)
- [批處理系統指南](./batch-processing.md)
- [故障排除](./troubleshooting.md)

## 快速導航

### 新手入門
1. 閱讀本 README 了解基本概念
2. 查看 [配置文件說明](./configuration.md) 學習配置選項
3. 參考 [Yahoo Finance Japan 使用指南](./yahoo-finance-japan.md) 了解實際案例

### 進階使用
1. 閱讀 [批處理系統指南](./batch-processing.md) 了解批量處理
2. 查看 [故障排除](./troubleshooting.md) 解決問題
3. 研究 `src/` 目錄的原始碼

### 問題解決
1. 檢查 [故障排除指南](./troubleshooting.md)
2. 查看日誌檔案 `logs/error.log`
3. 啟用除錯模式進行診斷

## 文檔更新

本文檔會隨著專案更新而持續維護。如果發現內容過時或有遺漏，歡迎提出 Issue 或 Pull Request。

### 版本對應
- v1.0.0: 初始版本，包含基本功能和 Yahoo Finance Japan 專項功能
- 未來版本將在此處記錄重大變更

### 最新更新 (2025-07-31)
- ✅ Yahoo Finance Japan 智能表格解析
- ✅ 批處理架構實現
- ✅ 檔案命名格式優化 (yyyymmddhhmmss)
- ✅ 數據結構簡化
- ✅ 完整文件說明

## 聯繫信息

如有問題請參考相關文件或聯繫開發團隊。