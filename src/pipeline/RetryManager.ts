import * as fs from 'fs-extra';
import * as path from 'path';

export interface RetryRecord {
  configFile: string;
  symbolCode: string;
  reportType: string;
  region: string;
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
    region: string,
    reason: RetryRecord['reason']
  ): Promise<void> {
    const records = await this.loadRetryRecords();
    
    // 檢查是否已存在相同項目
    const existingIndex = records.findIndex(
      r => r.configFile === configFile && r.symbolCode === symbolCode && r.reportType === reportType
    );

    if (existingIndex >= 0) {
      // 更新現有記錄
      const existing = records[existingIndex];
      if (existing.retryCount < existing.maxRetries) {
        existing.retryCount++;
        existing.lastRetryAt = new Date().toISOString();
        existing.reason = reason;
      } else {
        // 達到最大重試次數，移除記錄
        records.splice(existingIndex, 1);
        console.log(`⚠️ ${symbolCode} ${reportType}: 達到最大重試次數 (${existing.maxRetries})，移除重試隊列`);
        await this.saveRetryRecords(records);
        return;
      }
    } else {
      // 創建新記錄
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
    }

    await this.saveRetryRecords(records);
    console.log(`📝 添加重試項目: ${symbolCode} ${reportType} (第 ${records.find(r => r.symbolCode === symbolCode && r.reportType === reportType)?.retryCount} 次嘗試)`);
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
  async removeRetryItem(configFile: string, symbolCode: string, reportType: string): Promise<void> {
    const records = await this.loadRetryRecords();
    const filteredRecords = records.filter(
      r => !(r.configFile === configFile && r.symbolCode === symbolCode && r.reportType === reportType)
    );

    if (filteredRecords.length !== records.length) {
      await this.saveRetryRecords(filteredRecords);
      console.log(`✅ 移除重試項目: ${symbolCode} ${reportType} (成功)`);
    }
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
}