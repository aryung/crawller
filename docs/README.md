# 文檔目錄

## API 參考

### [API 參考文檔](./api/README.md)
完整的 API 文檔，包含所有類別、方法和介面的詳細說明。

主要內容：
- `UniversalCrawler` 主類別
- `WebCrawler` 和 `PlaywrightCrawler` 爬蟲引擎
- `ConfigManager` 配置管理
- `DataExtractor` 資料提取
- `CookieManager` Cookie 管理
- `DataExporter` 資料匯出

## 使用指南

### [配置指南](./guides/configuration.md)
詳細的配置選項說明和最佳實踐。

主要內容：
- 基本配置結構
- URL 和選擇器配置
- HTTP 標頭設定
- Cookie 配置
- 爬蟲選項
- 完整配置範例
- 配置檔案管理

### [故障排除指南](./guides/troubleshooting.md)
常見問題的診斷和解決方案。

主要內容：
- WebSocket 連線問題
- 頁面載入超時
- 選擇器問題
- Cookie 設定失敗
- 效能和記憶體問題
- 反爬蟲機制
- 除錯技巧

## 快速導航

### 新手入門
1. 閱讀 [README.md](../README.md) 了解基本概念
2. 查看 [examples/](../examples/) 目錄的範例程式
3. 參考 [配置指南](./guides/configuration.md) 學習配置選項

### 進階使用
1. 閱讀 [API 參考](./api/README.md) 了解詳細介面
2. 查看 [故障排除](./guides/troubleshooting.md) 解決問題
3. 研究 `src/` 目錄的原始碼

### 問題解決
1. 檢查 [故障排除指南](./guides/troubleshooting.md)
2. 查看日誌檔案 `logs/error.log`
3. 啟用除錯模式進行診斷

## 常用連結

- [專案 README](../README.md) - 專案概述和快速開始
- [範例程式](../examples/) - 實用的程式範例
- [配置範例](../examples/config-management.ts) - 配置管理範例
- [API 測試](../examples/basic-usage.ts) - 基本 API 使用

## 文檔更新

本文檔會隨著專案更新而持續維護。如果發現內容過時或有遺漏，歡迎提出 Issue 或 Pull Request。

### 版本對應
- v1.0.0: 初始版本，包含基本功能
- 未來版本將在此處記錄重大變更

### 貢獻指南
如果你想貢獻文檔：

1. Fork 專案
2. 在 `docs/` 目錄下新增或修改文檔
3. 確保範例程式可以正常執行
4. 提交 Pull Request

文檔撰寫原則：
- 使用清晰的標題結構
- 提供實用的程式範例
- 包含錯誤處理說明
- 保持內容簡潔明瞭