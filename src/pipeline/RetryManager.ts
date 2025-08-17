import * as fs from 'fs-extra';
import * as path from 'path';
import { MarketRegion } from '../common/shared-types/interfaces/market-data.interface';

export interface RetryRecord {
  configFile: string;
  symbolCode: string;
  reportType: string;
  region: MarketRegion;  // 使用 enum 而非 string
  timestamp: string;
  reason: 'empty_data' | 'execution_failed' | 'timeout';
  retryCount: number;
  maxRetries: number;
  lastRetryAt?: string;
}

export interface RetryManagerConfig {
  retryFilePath: string;
  maxRetries: number;
  retryDelay: number;
  cleanupDays: number;
}

/**
 * 管理爬蟲重試記錄和隊列
 * Manages crawler retry records and queue
 */
export class RetryManager {
  private config: RetryManagerConfig;

  constructor(config: Partial<RetryManagerConfig> = {}) {
    this.config = {
      retryFilePath: config.retryFilePath || path.join('output', 'pipeline-retries.json'),
      maxRetries: config.maxRetries || 3,
      retryDelay: config.retryDelay || 5000,
      cleanupDays: config.cleanupDays || 7,
    };
  }

  /**
   * 讀取重試記錄
   */
  async loadRetryRecords(): Promise<RetryRecord[]> {
    try {
      if (await fs.pathExists(this.config.retryFilePath)) {
        const data = await fs.readJson(this.config.retryFilePath);
        return Array.isArray(data) ? data : [];
      }
    } catch (error) {
      console.warn(`Warning: Failed to load retry records: ${(error as Error).message}`);
    }
    return [];
  }

  /**
   * 儲存重試記錄
   */
  async saveRetryRecords(records: RetryRecord[]): Promise<void> {
    try {
      await fs.ensureDir(path.dirname(this.config.retryFilePath));
      await fs.writeJson(this.config.retryFilePath, records, { spaces: 2 });
    } catch (error) {
      console.error(`Error saving retry records: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * 添加重試項目到隊列
   */
  async addRetryItem(
    configFile: string,
    symbolCode: string,
    reportType: string,
    region: MarketRegion,
    reason: RetryRecord['reason']
  ): Promise<void> {
    const records = await this.loadRetryRecords();
    
    // 檢查是否已存在相同項目
    const existingIndex = records.findIndex(
      r => r.configFile === configFile && r.symbolCode === symbolCode && r.reportType === reportType
    );

    let isNewItem = false;
    let currentRetryCount = 1;

    if (existingIndex >= 0) {
      // 更新現有記錄
      const existing = records[existingIndex];
      
      // 修復：檢查是否已達到或超過最大重試次數
      if (existing.retryCount >= existing.maxRetries) {
        // 已達到最大重試次數，移除記錄
        records.splice(existingIndex, 1);
        console.log(`⚠️ ${symbolCode} ${reportType}: 已達到最大重試次數 (${existing.maxRetries})，移除重試隊列`);
        await this.saveRetryRecords(records);
        return;
      }
      
      // 還可以重試，更新記錄
      existing.retryCount++;
      existing.lastRetryAt = new Date().toISOString();
      existing.reason = reason;
      currentRetryCount = existing.retryCount;
      
      // 檢查更新後是否達到最大次數
      if (existing.retryCount >= existing.maxRetries) {
        console.log(`⚠️ ${symbolCode} ${reportType}: 更新後達到最大重試次數 (${existing.maxRetries})，將在下次檢查時移除`);
      }
    } else {
      // 創建新記錄
      isNewItem = true;
      const newRecord: RetryRecord = {
        configFile,
        symbolCode,
        reportType,
        region,
        timestamp: new Date().toISOString(),
        reason,
        retryCount: 1,
        maxRetries: this.config.maxRetries,
        lastRetryAt: new Date().toISOString(),
      };
      records.push(newRecord);
      currentRetryCount = 1;
    }

    await this.saveRetryRecords(records);
    
    if (isNewItem) {
      console.log(`📝 加入重試隊列: ${symbolCode} ${reportType} (${reason})`);
    } else {
      console.log(`🔄 更新重試記錄: ${symbolCode} ${reportType} (第 ${currentRetryCount} 次嘗試，${reason})`);
    }
  }

  /**
   * 獲取待重試項目列表
   */
  async getPendingRetries(): Promise<RetryRecord[]> {
    const records = await this.loadRetryRecords();
    return records.filter(r => r.retryCount <= r.maxRetries);
  }

  /**
   * 移除重試項目（成功後）
   */
  async removeRetryItem(configFile: string, symbolCode: string, reportType: string): Promise<boolean> {
    const records = await this.loadRetryRecords();
    const filteredRecords = records.filter(
      r => !(r.configFile === configFile && r.symbolCode === symbolCode && r.reportType === reportType)
    );

    if (filteredRecords.length !== records.length) {
      await this.saveRetryRecords(filteredRecords);
      console.log(`✅ 移除重試項目: ${symbolCode} ${reportType} (成功)`);
      return true;
    }
    
    return false;
  }

  /**
   * 移除特定 symbol + region 的所有 retry 項目
   * 當該 symbol 的任何報表成功時，移除所有相關的 retry 項目
   */
  async removeAllRetryItemsForSymbol(
    symbolCode: string, 
    region: MarketRegion
  ): Promise<number> {
    const records = await this.loadRetryRecords();
    const originalCount = records.length;
    
    // 直接比較 enum 值，不需要轉換
    const filteredRecords = records.filter(
      r => !(r.symbolCode === symbolCode && r.region === region)
    );
    
    const removedCount = originalCount - filteredRecords.length;
    
    if (removedCount > 0) {
      await this.saveRetryRecords(filteredRecords);
      console.log(`✅ 移除 ${symbolCode}/${region} 的所有 ${removedCount} 個 retry 項目`);
    }
    
    return removedCount;
  }

  /**
   * 清空所有重試記錄
   */
  async clearAllRetries(): Promise<number> {
    const records = await this.loadRetryRecords();
    const count = records.length;
    
    if (count > 0) {
      await this.saveRetryRecords([]);
      console.log(`🧹 清空 ${count} 個重試記錄`);
    }
    
    return count;
  }

  /**
   * 清理過期重試記錄
   */
  async cleanupExpiredRetries(): Promise<number> {
    const records = await this.loadRetryRecords();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.cleanupDays);

    const activeRecords = records.filter(r => {
      const recordDate = new Date(r.timestamp);
      return recordDate > cutoffDate;
    });

    const removedCount = records.length - activeRecords.length;
    
    if (removedCount > 0) {
      await this.saveRetryRecords(activeRecords);
      console.log(`🧹 清理 ${removedCount} 個過期重試記錄`);
    }

    return removedCount;
  }

  /**
   * 獲取重試統計信息
   */
  async getRetryStatistics(): Promise<{
    totalPending: number;
    byRegion: Record<string, number>;
    byReportType: Record<string, number>;
    byReason: Record<string, number>;
    oldestRetry?: string;
  }> {
    const records = await this.loadRetryRecords();
    const pending = records.filter(r => r.retryCount <= r.maxRetries);

    const stats = {
      totalPending: pending.length,
      byRegion: {} as Record<string, number>,
      byReportType: {} as Record<string, number>,
      byReason: {} as Record<string, number>,
      oldestRetry: undefined as string | undefined,
    };

    for (const record of pending) {
      stats.byRegion[record.region] = (stats.byRegion[record.region] || 0) + 1;
      stats.byReportType[record.reportType] = (stats.byReportType[record.reportType] || 0) + 1;
      stats.byReason[record.reason] = (stats.byReason[record.reason] || 0) + 1;
      
      if (!stats.oldestRetry || record.timestamp < stats.oldestRetry) {
        stats.oldestRetry = record.timestamp;
      }
    }

    return stats;
  }

  /**
   * 獲取重試延遲時間（指數退避）
   */
  calculateRetryDelay(retryCount: number): number {
    return this.config.retryDelay * Math.pow(2, retryCount - 1);
  }

  /**
   * 清理已經成功的 retry 項目
   * 掃描所有 retry 項目，驗證對應檔案，移除已成功的項目
   */
  async cleanupSuccessfulRetries(
    dataValidator: any, 
    outputDir: string
  ): Promise<number> {
    const records = await this.loadRetryRecords();
    const symbolRegionMap = new Map<string, Set<string>>();
    
    // 檢查每個 retry 項目
    for (const record of records) {
      try {
        const validation = await dataValidator.validateConfigOutput(
          record.configFile,
          outputDir
        );
        
        if (validation.isValid) {
          // 記錄成功的 symbol + region
          const key = `${record.symbolCode}|${record.region}`;
          if (!symbolRegionMap.has(key)) {
            symbolRegionMap.set(key, new Set());
          }
          symbolRegionMap.get(key)!.add(record.reportType);
        }
      } catch (error) {
        // 忽略驗證錯誤，繼續處理其他項目
        console.warn(`Validation error for ${record.symbolCode}/${record.region}: ${(error as Error).message}`);
      }
    }
    
    // 移除所有成功的 symbol + region 的項目
    let totalRemoved = 0;
    for (const [key, reportTypes] of symbolRegionMap.entries()) {
      const [symbolCode, regionStr] = key.split('|');
      const region = regionStr as MarketRegion;
      const removed = await this.removeAllRetryItemsForSymbol(symbolCode, region);
      totalRemoved += removed;
      
      if (removed > 0) {
        console.log(`🧹 ${symbolCode}/${region}: 發現 ${reportTypes.size} 個成功的報表，移除所有 ${removed} 個 retry 項目`);
      }
    }
    
    return totalRemoved;
  }
}