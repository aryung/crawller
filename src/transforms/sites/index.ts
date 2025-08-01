/**
 * 網站特定轉換函數管理器
 * 負責加載和管理不同網站的特定轉換函數
 */

import { moneydjTransforms, registerMoneyDJTransforms } from './moneydj';
import { yahooFinanceJPTransforms, registerYahooFinanceJPTransforms } from './yahoo-finance-jp';
import { yahooFinanceUSTransforms, registerYahooFinanceUSTransforms } from './yahoo-finance-us';
import { yahooFinanceTWTransforms } from './yahoo-finance-tw';

export interface SiteTransforms {
  [transformName: string]: (value: any, context?: any) => any;
}

export interface SiteTransformRegistry {
  [siteName: string]: SiteTransforms;
}

/**
 * 網站特定轉換註冊表
 */
export const siteTransforms: SiteTransformRegistry = {
  moneydj: moneydjTransforms as any,
  'yahoo-finance-jp': yahooFinanceJPTransforms as any,
  'yahoo-finance-us': yahooFinanceUSTransforms as any,
  'yahoo-finance-tw': yahooFinanceTWTransforms as any
};

/**
 * 根據 URL 檢測網站類型
 */
export function detectSiteFromUrl(url: string): string | null {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();
    
    if (hostname.includes('moneydj.com')) {
      return 'moneydj';
    }
    
    if (hostname.includes('finance.yahoo.co.jp')) {
      return 'yahoo-finance-jp';
    }
    
    if (hostname.includes('finance.yahoo.com')) {
      return 'yahoo-finance-us';
    }
    
    if (hostname.includes('tw.stock.yahoo.com')) {
      return 'yahoo-finance-tw';
    }
    
    // 可以在這裡添加其他網站的檢測邏輯
    // if (hostname.includes('example.com')) {
    //   return 'example';
    // }
    
    return null;
  } catch {
    return null;
  }
}

/**
 * 獲取網站特定轉換函數
 */
export function getSiteTransform(siteName: string, transformName: string): Function | null {
  return siteTransforms[siteName]?.[transformName] || null;
}

/**
 * 獲取網站的所有轉換函數
 */
export function getSiteTransforms(siteName: string): SiteTransforms | null {
  return siteTransforms[siteName] || null;
}

/**
 * 列出所有支援的網站
 */
export function listSupportedSites(): string[] {
  return Object.keys(siteTransforms);
}

/**
 * 列出特定網站的所有轉換函數
 */
export function listSiteTransforms(siteName: string): string[] {
  const transforms = siteTransforms[siteName];
  return transforms ? Object.keys(transforms) : [];
}

/**
 * 註冊新的網站轉換函數集
 */
export function registerSiteTransforms(siteName: string, transforms: SiteTransforms): void {
  siteTransforms[siteName] = transforms;
}

/**
 * 將網站特定轉換合併到全域轉換註冊表
 */
export function mergeSiteTransformsToGlobal(globalRegistry: any, siteName?: string): void {
  if (siteName) {
    // 只合併特定網站的轉換
    const transforms = siteTransforms[siteName];
    if (transforms) {
      Object.entries(transforms).forEach(([name, fn]) => {
        globalRegistry[name] = fn;
      });
    }
  } else {
    // 合併所有網站轉換
    Object.values(siteTransforms).forEach(transforms => {
      Object.entries(transforms).forEach(([name, fn]) => {
        globalRegistry[name] = fn;
      });
    });
  }
}