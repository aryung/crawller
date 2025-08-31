/**
 * 產業分類常數定義
 * 用於前後端共享的產業分類映射和名稱定義
 *
 * 注意：舊的 JP_CATEGORY_MAPPING 和 JP_INDUSTRIAL_NAMES 已移除，
 * 現在使用統一標籤格式 ${region}_${category}_${subcategory} 動態解析
 */

// 通用產業分組映射 - 與前端 INDUSTRY_CATEGORIES 完全一致
export const CATEGORY_GROUP_MAPPING = {
  tech: {
    name: '科技相關',
    icon: '📱',
    color: 'text-primary',
    description: '科技、電子、軟體等高科技產業',
    keywords: ['科技', '電子', '半導體', '軟體', '資訊', '通信', '光電'],
    labelNames: ['科技業'],
  },
  biotech: {
    name: '生技醫療',
    icon: '🏥',
    color: 'text-secondary',
    description: '生技、醫療、製藥相關產業',
    keywords: ['生技', '醫療', '製藥', '醫材', '健康', '生物'],
    labelNames: ['生技醫療'],
  },
  finance: {
    name: '金融保險',
    icon: '🏦',
    color: 'text-accent',
    description: '金融、銀行、保險等金融服務業',
    keywords: ['金融', '銀行', '保險', '證券', '投資', '信託'],
    labelNames: ['銀行業', '保險業', '證券業', '投信投顧業'],
  },
  manufacturing: {
    name: '傳統製造',
    icon: '🏭',
    color: 'text-info',
    description: '傳統製造業、工業、機械等',
    keywords: ['製造', '工業', '機械', '化工', '鋼鐵', '塑膠'],
    labelNames: ['鋼鐵工業', '機械工業', '汽車工業', '化學工業', '塑膠工業'],
  },
  consumer: {
    name: '消費服務',
    icon: '🛒',
    color: 'text-success',
    description: '消費品、零售、食品等消費相關產業',
    keywords: ['消費', '零售', '食品', '紡織', '觀光', '餐飲'],
    labelNames: ['食品工業', '紡織纖維', '百貨貿易', '觀光事業', '餐飲業'],
  },
  energy: {
    name: '能源公用',
    icon: '⚡',
    color: 'text-warning',
    description: '能源、電力、石油等公用事業',
    keywords: ['能源', '電力', '石油', '天然氣', '公用', '水電'],
    labelNames: ['電機電纜', '油電燃氣', '電子通路', '水泥工業'],
  },
  transport: {
    name: '運輸物流',
    icon: '🚛',
    color: 'text-neutral',
    description: '運輸、物流、航運等相關產業',
    keywords: ['運輸', '物流', '航運', '航空', '貨運', '快遞'],
    labelNames: ['航運業', '貨運業', '汽車貨運業'],
  },
  realestate: {
    name: '建材營造',
    icon: '🏗️',
    color: 'text-base-content',
    description: '建材、營造、房地產相關產業',
    keywords: ['建材', '營造', '房地產', '建築', '水泥', '鋼構'],
    labelNames: ['營建業', '玻璃陶瓷', '橡膠工業'],
  },
  others: {
    name: '其他產業',
    icon: '📂',
    color: 'text-base-content/60',
    description: '其他未分類的產業',
    keywords: [],
    labelNames: [],
  },
} as const;

// 類型定義
export type CategoryGroupId = keyof typeof CATEGORY_GROUP_MAPPING;

export interface CategoryGroup {
  name: string;
  icon: string;
  color: string;
  description: string;
  keywords: string[];
  labelNames: string[];
}
