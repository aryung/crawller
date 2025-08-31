export enum LabelType {
  SYSTEM_DEFINED = 'SYSTEM_DEFINED',
  USER_CUSTOM = 'USER_CUSTOM',
}

// 注意：舊的 TW_CATEGORY_NAMES 和 JP_CATEGORY_NAMES 映射表已移除
// 現在使用統一標籤格式 ${region}_${category}_${subcategory} 動態解析
// 所有分類信息直接從標籤名稱中提取，無需額外映射表
