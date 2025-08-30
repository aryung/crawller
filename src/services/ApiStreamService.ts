/**
 * API 串流服務
 * 負責將爬取結果即時發送到後端 API
 * 支援三種模式：file-only, api-only, both
 */

import { ApiErrorType, ERROR_ICONS, ERROR_MESSAGES } from '../common/constants/api-errors';
import { 
  ApiStreamOptions, 
  ApiSendResult, 
  ApiError, 
  ApiStreamStats,
  EmptyDataNotification 
} from '../common/interfaces/api-stream.interface';
import axios, { AxiosInstance, AxiosError } from 'axios';
import * as fs from 'fs-extra';
import { logger } from '../utils';
import { MarketRegion } from '../common/shared-types/interfaces/market-data.interface';
import { 
  CrawlerRawData, 
  FundamentalApiData, 
  RegionalData
} from '../common/shared-types/interfaces/crawler.interface';

export class ApiStreamService {
  private apiClient: AxiosInstance | null = null;
  private enabled: boolean;
  private retryAttempts: number;
  private retryDelayMs: number;
  private sendEmptyNotification: boolean;
  private treatEmptyAsSuccess: boolean;
  private checkConnectionFirst: boolean;
  private stats: ApiStreamStats;

  constructor(options: ApiStreamOptions = {}) {
    this.enabled = options.enabled || false;
    this.retryAttempts = options.retryAttempts || 3;
    this.retryDelayMs = options.retryDelayMs || 1000;
    this.sendEmptyNotification = options.sendEmptyNotification || false;
    this.treatEmptyAsSuccess = options.treatEmptyAsSuccess !== false; // 預設為 true
    this.checkConnectionFirst = options.checkConnectionFirst !== false; // 預設為 true
    
    // 初始化統計
    this.stats = {
      totalSent: 0,
      totalFailed: 0,
      totalEmpty: 0,
      totalSkipped: 0,
      errors: [],
      startTime: new Date(),
      endTime: new Date()
    };

    if (this.enabled && options.apiUrl) {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (options.apiToken) {
        headers['Authorization'] = `Bearer ${options.apiToken}`;
      }

      this.apiClient = axios.create({
        baseURL: options.apiUrl,
        headers,
        timeout: 30000,
      });

      logger.info(`🌐 API 串流服務已啟用: ${options.apiUrl}`);
    }
  }

  /**
   * 檢查 API 連接狀態
   */
  private async checkApiConnection(): Promise<boolean> {
    if (!this.apiClient) return false;

    try {
      const response = await this.apiClient.get('/crawler/health', { 
        timeout: 5000 
      });
      return response.status === 200;
    } catch (error) {
      const axiosError = error as AxiosError;
      
      if (axiosError.code === 'ECONNREFUSED') {
        logger.error(`❌ ${ERROR_MESSAGES.CONNECTION_REFUSED} (${this.apiClient.defaults.baseURL})`);
        logger.info(ERROR_MESSAGES.API_HEALTH_CHECK_TIP);
      } else if (axiosError.code === 'ETIMEDOUT') {
        logger.error(`❌ ${ERROR_MESSAGES.TIMEOUT_MESSAGE}`);
      } else {
        logger.error('❌ API 連接失敗:', axiosError.message);
      }
      return false;
    }
  }

  /**
   * 分類錯誤類型
   */
  private classifyError(error: any): ApiErrorType {
    if (error.code === 'ECONNREFUSED') {
      return ApiErrorType.CONNECTION_REFUSED;
    }
    if (error.code === 'ETIMEDOUT') {
      return ApiErrorType.TIMEOUT_ERROR;
    }
    if (error.code === 'ENOTFOUND') {
      return ApiErrorType.NETWORK_ERROR;
    }
    
    if (error.response) {
      const status = error.response.status;
      if (status === 401 || status === 403) {
        return ApiErrorType.AUTH_ERROR;
      }
      if (status >= 500) {
        return ApiErrorType.SERVER_ERROR;
      }
      if (status >= 400) {
        return ApiErrorType.CLIENT_ERROR;
      }
    }
    
    return ApiErrorType.NETWORK_ERROR;
  }

  /**
   * 從檔案路徑發送資料到 API
   */
  async sendFromFile(filePath: string): Promise<boolean> {
    if (!this.enabled || !this.apiClient) {
      return false;
    }

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const jsonData = JSON.parse(content);
      
      return await this.sendData(jsonData);
    } catch (error) {
      logger.error(`❌ 讀取檔案失敗: ${filePath}`, error);
      return false;
    }
  }

  /**
   * 直接從記憶體發送資料到 API（純串流模式）
   */
  async sendFromMemory(data: any): Promise<boolean> {
    if (!this.enabled || !this.apiClient) {
      return false;
    }

    // 包裝成統一的 results 陣列格式
    const wrappedData = {
      exportDate: new Date().toISOString(),
      totalResults: 1,
      successCount: 1,
      results: [data]
    };

    return await this.sendData(wrappedData);
  }

  /**
   * 發送資料到 API
   */
  private async sendData(jsonData: any): Promise<boolean> {
    if (!this.apiClient) {
      return false;
    }

    // 重置統計
    this.stats = {
      totalSent: 0,
      totalFailed: 0,
      totalEmpty: 0,
      totalSkipped: 0,
      errors: [],
      startTime: new Date(),
      endTime: new Date()
    };

    // 檢查 API 連接（如果啟用）
    if (this.checkConnectionFirst) {
      const isApiAvailable = await this.checkApiConnection();
      if (!isApiAvailable) {
        this.stats.errors.push({
          type: ApiErrorType.CONNECTION_REFUSED,
          message: ERROR_MESSAGES.CONNECTION_REFUSED,
          timestamp: new Date()
        });
        this.logSummary();
        return false;
      }
    }

    // 檢查資料結構
    if (!jsonData.results || !Array.isArray(jsonData.results)) {
      logger.warn('⚠️ 資料格式不正確，缺少 results 陣列');
      return false;
    }

    // 處理每個結果
    for (const [index, crawlResult] of jsonData.results.entries()) {
      await this.processCrawlResult(crawlResult, index);
    }

    this.stats.endTime = new Date();
    this.logSummary();
    
    return this.stats.totalFailed === 0 && this.stats.errors.length === 0;
  }

  /**
   * 處理單個爬取結果
   */
  private async processCrawlResult(crawlResult: any, index: number): Promise<void> {
    // 檢查數據結構 - 統一使用單層 data 結構（應該直接是陣列）
    if (!crawlResult.data) {
      this.stats.totalSkipped++;
      logger.warn(`⚠️ 結果 ${index + 1}: 缺少 data 屬性`);
      return;
    }

    // data 應該直接是陣列
    if (!Array.isArray(crawlResult.data)) {
      this.stats.totalSkipped++;
      logger.warn(`⚠️ 結果 ${index + 1}: data 不是陣列`);
      return;
    }

    // 處理空數據
    if (crawlResult.data.length === 0) {
      this.stats.totalEmpty++;
      logger.info(`📭 結果 ${index + 1}: ${ERROR_MESSAGES.EMPTY_DATA_INFO}`);
      
      if (this.sendEmptyNotification) {
        await this.notifyEmptyData(crawlResult);
      }
      return;
    }

    // 轉換並驗證資料
    const validRecords: FundamentalApiData[] = [];
    for (const record of crawlResult.data) {
      if (this.validateRecord(record)) {
        const converted = this.convertToApiFormat(record);
        validRecords.push(converted);
      }
    }

    if (validRecords.length === 0) {
      this.stats.totalSkipped++;
      logger.debug(`⏭️ 結果 ${index + 1}: 沒有有效資料`);
      return;
    }

    // 發送到 API
    const result = await this.sendToApiWithRetry(validRecords, index);
    if (result.success) {
      this.stats.totalSent += result.count;
    } else {
      this.stats.totalFailed += validRecords.length;
      if (result.error) {
        this.stats.errors.push(result.error);
      }
    }
  }

  /**
   * 發送到 API（含重試機制）
   */
  private async sendToApiWithRetry(
    records: FundamentalApiData[], 
    index: number
  ): Promise<ApiSendResult> {
    if (!this.apiClient) {
      return { success: false, count: 0 };
    }
    
    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        const response = await this.apiClient.post('/fundamental-data/import', records);
        
        // 檢查後端回應
        if (response.data) {
          // 處理成功情況
          if (response.data.success === true || response.data.imported > 0) {
            const imported = response.data.imported || records.length;
            logger.debug(`✅ API 發送成功: ${imported} 筆資料`);
            return { success: true, count: imported };
          }
          
          // 處理業務邏輯錯誤（後端返回 success: false）
          if (response.data.success === false) {
            const errorMessages = response.data.errors || ['資料驗證失敗'];
            const errorMessage = Array.isArray(errorMessages) 
              ? errorMessages.join(', ') 
              : errorMessages;
            
            logger.error(`❌ 資料驗證失敗: ${errorMessage}`);
            return {
              success: false,
              count: 0,
              error: {
                type: ApiErrorType.VALIDATION_ERROR,
                message: errorMessage,
                data: records.length,
                timestamp: new Date()
              }
            };
          }
        }
        
        // 如果沒有明確的成功或失敗狀態，視為成功（向後相容）
        const imported = response.data?.imported || records.length;
        logger.debug(`✅ API 發送完成: ${imported} 筆資料`);
        return { success: true, count: imported };
        
      } catch (error: any) {
        const errorType = this.classifyError(error);
        
        // 如果是連接錯誤，不需要重試
        if (errorType === ApiErrorType.CONNECTION_REFUSED) {
          logger.error(`❌ ${ERROR_MESSAGES.CONNECTION_REFUSED}，停止重試`);
          return { 
            success: false, 
            count: 0, 
            error: { 
              type: errorType, 
              message: ERROR_MESSAGES.CONNECTION_REFUSED,
              timestamp: new Date()
            }
          };
        }
        
        // 認證錯誤也不需要重試
        if (errorType === ApiErrorType.AUTH_ERROR) {
          logger.error(`❌ ${ERROR_MESSAGES.AUTH_FAILED}，停止重試`);
          return { 
            success: false, 
            count: 0, 
            error: { 
              type: errorType, 
              message: ERROR_MESSAGES.AUTH_FAILED,
              timestamp: new Date()
            }
          };
        }
        
        // 其他錯誤繼續重試
        if (attempt === this.retryAttempts) {
          const errorMessage = this.getErrorMessage(errorType, error);
          logger.error(`❌ API 發送失敗 (嘗試 ${attempt}/${this.retryAttempts}): ${errorMessage}`);
          return { 
            success: false, 
            count: 0, 
            error: { 
              type: errorType, 
              message: errorMessage, 
              data: records.length,
              timestamp: new Date()
            }
          };
        } else {
          logger.warn(`⚠️ API 發送失敗，重試中... (${attempt}/${this.retryAttempts})`);
          await this.delay(this.retryDelayMs * attempt);
        }
      }
    }
    
    return { success: false, count: 0 };
  }

  /**
   * 取得錯誤訊息
   */
  private getErrorMessage(errorType: ApiErrorType, error: any): string {
    switch (errorType) {
      case ApiErrorType.CONNECTION_REFUSED:
        return ERROR_MESSAGES.CONNECTION_REFUSED;
      case ApiErrorType.TIMEOUT_ERROR:
        return ERROR_MESSAGES.TIMEOUT_MESSAGE;
      case ApiErrorType.AUTH_ERROR:
        return ERROR_MESSAGES.AUTH_FAILED;
      case ApiErrorType.NETWORK_ERROR:
        return ERROR_MESSAGES.NETWORK_ISSUE;
      case ApiErrorType.SERVER_ERROR:
        return ERROR_MESSAGES.SERVER_ISSUE;
      case ApiErrorType.CLIENT_ERROR:
        return ERROR_MESSAGES.CLIENT_ISSUE;
      case ApiErrorType.VALIDATION_ERROR:
        return ERROR_MESSAGES.VALIDATION_FAILED;
      default:
        return error.message || '未知錯誤';
    }
  }

  /**
   * 通知空數據
   */
  private async notifyEmptyData(crawlResult: any): Promise<void> {
    if (!this.apiClient) return;

    try {
      const notification: EmptyDataNotification = {
        symbolCode: this.extractSymbolFromUrl(crawlResult.url),
        dataType: this.extractDataTypeFromUrl(crawlResult.url),
        reportType: 'quarterly',
        timestamp: crawlResult.timestamp || new Date().toISOString(),
        url: crawlResult.url
      };

      await this.apiClient.post('/fundamental-data/empty-notification', notification);
      logger.debug(`📮 已通知空數據: ${notification.symbolCode}`);
    } catch (error) {
      logger.warn('⚠️ 空數據通知失敗', error);
    }
  }

  /**
   * 從 URL 提取股票代碼
   */
  private extractSymbolFromUrl(url: string): string {
    const match = url.match(/quote\/([^\/]+)\//);
    return match ? match[1].replace('.TW', '') : 'UNKNOWN';
  }

  /**
   * 從 URL 提取數據類型
   */
  private extractDataTypeFromUrl(url: string): string {
    const parts = url.split('/');
    return parts[parts.length - 1] || 'unknown';
  }

  /**
   * 輸出統計摘要
   */
  private logSummary(): void {
    console.log('\n' + '='.repeat(60));
    console.log('📊 API 發送統計報告');
    console.log('='.repeat(60));
    console.log(`✅ 成功發送: ${this.stats.totalSent} 筆`);
    console.log(`❌ 發送失敗: ${this.stats.totalFailed} 筆`);
    console.log(`📭 空數據: ${this.stats.totalEmpty} 筆`);
    console.log(`⏭️ 跳過: ${this.stats.totalSkipped} 筆`);
    
    const duration = (this.stats.endTime.getTime() - this.stats.startTime.getTime()) / 1000;
    console.log(`⏱️ 執行時間: ${duration.toFixed(2)} 秒`);
    
    if (this.stats.errors.length > 0) {
      console.log('\n錯誤詳情:');
      const errorGroups = this.groupErrorsByType(this.stats.errors);
      
      for (const [type, errorList] of Object.entries(errorGroups)) {
        const errorType = type as ApiErrorType;
        console.log(`\n${ERROR_ICONS[errorType]} ${type}:`);
        
        if (errorType === ApiErrorType.CONNECTION_REFUSED) {
          console.log(`  ${ERROR_MESSAGES.API_HEALTH_CHECK_TIP}`);
        } else if (errorType === ApiErrorType.VALIDATION_ERROR) {
          console.log(`  💡 提示: 資料格式或內容不符合後端要求`);
          errorList.forEach((err: ApiError) => {
            console.log(`  - ${err.message}`);
            if (err.data) {
              console.log(`    影響資料: ${err.data} 筆`);
            }
          });
        } else if (errorType === ApiErrorType.AUTH_ERROR) {
          console.log(`  💡 提示: 請檢查 BACKEND_API_TOKEN 環境變數是否正確`);
          errorList.forEach((err: ApiError) => {
            console.log(`  - ${err.message}`);
          });
        } else {
          errorList.forEach((err: ApiError) => {
            console.log(`  - ${err.message}`);
            if (err.data) {
              console.log(`    影響資料: ${err.data} 筆`);
            }
          });
        }
      }
    }
    
    console.log('='.repeat(60) + '\n');
  }

  /**
   * 按類型分組錯誤
   */
  private groupErrorsByType(errors: ApiError[]): Record<string, ApiError[]> {
    return errors.reduce((groups, error) => {
      const type = error.type;
      if (!groups[type]) {
        groups[type] = [];
      }
      groups[type].push(error);
      return groups;
    }, {} as Record<string, ApiError[]>);
  }

  /**
   * 轉換爬蟲資料為 API 格式
   */
  private convertToApiFormat(record: CrawlerRawData): FundamentalApiData {
    // 清理 symbolCode - 只清理台灣股票後綴
    let cleanSymbolCode = record.symbolCode;
    if (record.exchangeArea === MarketRegion.TPE) {
      cleanSymbolCode = cleanSymbolCode.replace(/\.TW[O]?$/, '');
    }

    const converted: FundamentalApiData = {
      symbolCode: cleanSymbolCode,
      exchangeArea: record.exchangeArea,
      reportDate: record.reportDate,
      fiscalYear: record.fiscalYear,
      fiscalMonth: record.fiscalMonth,
      reportType: record.reportType || 'annual',
      dataSource: record.dataSource,
      lastUpdated: record.lastUpdated,

      // Income Statement
      revenue: record.revenue,
      costOfGoodsSold: record.costOfGoodsSold,
      grossProfit: record.grossProfit,
      operatingExpenses: record.operatingExpenses,
      operatingIncome: record.operatingIncome,
      netIncome: record.netIncome,
      ebitda: record.ebitda,
      eps: record.eps,
      dilutedEPS: record.dilutedEPS,

      // Balance Sheet
      totalAssets: record.totalAssets,
      currentAssets: record.currentAssets,
      totalLiabilities: record.totalLiabilities,
      currentLiabilities: record.currentLiabilities,
      shareholdersEquity: record.shareholdersEquity,
      totalDebt: record.totalDebt,
      longTermDebt: record.longTermDebt,
      shortTermDebt: record.shortTermDebt,
      cashAndEquivalents: record.cashAndEquivalents,
      bookValuePerShare: record.bookValuePerShare,
      sharesOutstanding: record.sharesOutstanding,

      // Cash Flow
      operatingCashFlow: record.operatingCashFlow,
      investingCashFlow: record.investingCashFlow,
      financingCashFlow: record.financingCashFlow,
      freeCashFlow: record.freeCashFlow,
      capex: record.capex,
      debtIssuance: record.debtIssuance,
      debtRepayment: record.debtRepayment,
      dividendPayments: record.dividendPayments,
    };

    // 處理 regionalData
    const regionalData: RegionalData = {};

    // US market specific fields
    if (record.exchangeArea === MarketRegion.US && record.regionalData) {
      Object.assign(regionalData, {
        basicAverageShares: record.regionalData.basicAverageShares,
        dilutedAverageShares: record.regionalData.dilutedAverageShares,
        pretaxIncome: record.regionalData.pretaxIncome,
        taxProvision: record.regionalData.taxProvision,
        interestIncome: record.regionalData.interestIncome,
        interestExpense: record.regionalData.interestExpense,
        netTangibleAssets: record.regionalData.netTangibleAssets,
        totalCapitalization: record.regionalData.totalCapitalization,
        commonStockEquity: record.regionalData.commonStockEquity,
        netDebt: record.regionalData.netDebt,
      });
    }

    // TW market specific fields
    if (record.exchangeArea === MarketRegion.TPE) {
      if (record.monthlyRevenue) regionalData.monthlyRevenue = record.monthlyRevenue;
      if (record.yoyGrowth) regionalData.yoyGrowth = record.yoyGrowth;
      if (record.momGrowth) regionalData.momGrowth = record.momGrowth;
    }

    // JP market specific fields
    if (record.exchangeArea === MarketRegion.JP && record.regionalData) {
      if (record.regionalData.operatingProfit) {
        regionalData.operatingProfit = record.regionalData.operatingProfit;
      }
      if (record.regionalData.ordinaryProfit) {
        regionalData.ordinaryProfit = record.regionalData.ordinaryProfit;
      }
    }

    if (Object.keys(regionalData).length > 0) {
      converted.regionalData = regionalData;
    }

    return converted;
  }

  /**
   * 驗證記錄格式
   */
  private validateRecord(record: unknown): record is CrawlerRawData {
    if (!record || typeof record !== 'object') {
      return false;
    }

    const obj = record as Record<string, unknown>;
    const requiredFields = ['symbolCode', 'exchangeArea', 'reportDate', 'fiscalYear'];

    for (const field of requiredFields) {
      if (!obj[field]) {
        return false;
      }
    }

    if (!Object.values(MarketRegion).includes(obj.exchangeArea as MarketRegion)) {
      return false;
    }

    return true;
  }

  /**
   * 延遲函數
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 檢查服務是否啟用
   */
  isEnabled(): boolean {
    return this.enabled && this.apiClient !== null;
  }

  /**
   * 取得 API 統計資訊
   */
  getStats(): ApiStreamStats & { enabled: boolean; apiUrl?: string } {
    return {
      ...this.stats,
      enabled: this.enabled,
      apiUrl: this.apiClient?.defaults.baseURL,
    };
  }
}

// 匯出介面供外部使用
export { ApiStreamOptions } from '../common/interfaces/api-stream.interface';