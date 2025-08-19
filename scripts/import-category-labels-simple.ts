#!/usr/bin/env tsx
/**
 * 簡化的類別標籤同步腳本 - 純數據傳遞模式
 * 
 * 此腳本採用高效的批量處理方式：
 * 1. 讀取本地 category-symbol-mappings.json
 * 2. 一次性傳送到後端批量處理 API
 * 3. 顯示處理結果
 * 
 * 取代原有的逐筆 API 呼叫，大幅提升性能。
 * 
 * Usage:
 *   npx tsx scripts/sync-category-labels-simple.ts
 *   npx tsx scripts/sync-category-labels-simple.ts --dry-run
 */

// Load environment variables from .env file
import 'dotenv/config';

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import axios, { AxiosInstance } from 'axios';
import chalk from 'chalk';
import ora from 'ora';
// ApiClient 已移除，直接使用 axios

const __dirname = process.cwd();

// Type definitions (簡化版本，與後端 DTO 對應)
interface CategorySymbol {
  symbolCode: string;
  name: string;
}

interface CategoryMapping {
  category: string;
  categoryId: string;
  symbols: CategorySymbol[];
}

interface CategoryMappings {
  TPE?: CategoryMapping[];
  JP?: CategoryMapping[];
  US?: CategoryMapping[];
}

interface BulkSyncOptions {
  strategy?: 'replace' | 'merge';
  createMissingSymbols?: boolean;
  updateExistingRelations?: boolean;
  chunkSize?: number;
  enableProgressReport?: boolean;
}

interface BulkSyncRequest {
  TPE?: CategoryMapping[];
  JP?: CategoryMapping[];
  US?: CategoryMapping[];
  options?: BulkSyncOptions;
}

interface BulkSyncResponse {
  success: boolean;
  data: {
    labelsCreated: number;
    labelsReactivated: number;  // 新增：重新啟用的標籤數量
    symbolsCreated: number;     // 新增：創建的股票數量
    symbolsUpdated: number;
    relationsCreated: number;
    relationsRemoved: number;
    chunksProcessed: number;
    totalProcessingTime?: number;
    chunkDetails?: Record<string, {
      chunks: number;
      mappings: number;
      time: number;
    }>;
  };
  errors?: string[];
  message?: string;
}

class SimplifiedCategoryLabelSyncer {
  private apiClient: AxiosInstance;
  private isDryRun: boolean;
  private spinner: any;
  private chunkSize: number | undefined;
  private enableProgressReport: boolean;
  private args: string[];

  constructor(apiUrl: string, apiToken?: string, isDryRun = false, args: string[] = []) {
    this.isDryRun = isDryRun;
    this.args = args;
    
    // 解析命令列參數
    this.chunkSize = this.parseChunkSize(args);
    this.enableProgressReport = args.includes('--progress');
    
    const headers: any = {
      'Content-Type': 'application/json',
    };
    
    if (apiToken) {
      headers['Authorization'] = `Bearer ${apiToken}`;
    }
    
    this.apiClient = axios.create({
      baseURL: apiUrl,
      headers,
      timeout: 300000, // 5 分鐘
    });
  }

  async sync(): Promise<BulkSyncResponse | null> {
    try {
      console.log(chalk.blue('🚀 簡化版類別標籤同步'));
      console.log(chalk.gray('─'.repeat(50)));

      // 1. 讀取本地映射資料
      this.spinner = ora('讀取 category-symbol-mappings.json...').start();
      const mappings = this.loadCategoryMappings();
      this.spinner.succeed(`已讀取映射資料`);

      // 2. 統計資料
      this.printMappingsSummary(mappings);

      if (this.isDryRun) {
        console.log(chalk.yellow('\n🔍 DRY RUN 模式 - 不會進行實際同步'));
        return null;
      }

      // 3. 檢測載荷大小並決定分塊策略
      const payloadInfo = this.analyzePayloadSize(mappings);
      console.log(chalk.cyan(`\n📦 載荷分析:`));
      console.log(`  • 預估大小: ${payloadInfo.estimatedSizeMB.toFixed(2)} MB`);
      console.log(`  • 建議策略: ${payloadInfo.needsChunking ? chalk.yellow('分塊處理') : chalk.green('單一請求')}`);
      
      if (payloadInfo.needsChunking) {
        console.log(`  • 建議分塊大小: ${payloadInfo.recommendedChunkSize}`);
      }

      // 4. 前端分塊處理並發送多個請求
      const startTime = Date.now();
      let response: BulkSyncResponse;

      if (payloadInfo.needsChunking || this.chunkSize) {
        // 前端分塊處理
        const chunkSize = this.chunkSize || payloadInfo.recommendedChunkSize;
        console.log(chalk.yellow(`\n🧩 啟用前端分塊處理 (分塊大小: ${chunkSize})`));
        
        response = await this.processWithFrontendChunking(mappings, chunkSize);
      } else {
        // 單一請求處理
        this.spinner = ora('批量同步到後端...').start();
        
        const options: BulkSyncOptions = {
          strategy: 'merge',
          createMissingSymbols: true,  // 啟用自動創建股票功能
          updateExistingRelations: true,
        };

        const request: BulkSyncRequest = {
          ...mappings,
          options,
        };

        const apiResponse = await this.apiClient.post('/label-industry/bulk-sync-mappings', request);
        response = apiResponse.data;
        this.spinner.succeed(`批量同步完成`);
      }

      const duration = Date.now() - startTime;
      console.log(chalk.green(`\n⏱️  總耗時: ${duration}ms`));

      // 5. 顯示結果
      this.printSyncResults(response);

      return response;
    } catch (error) {
      if (this.spinner) {
        this.spinner.fail('同步失敗');
      }

      console.error(chalk.red('\n❌ 同步失敗:'));
      
      if (error.response) {
        console.error(chalk.red(`HTTP ${error.response.status}: ${error.response.statusText}`));
        if (error.response.data) {
          console.error(chalk.red(JSON.stringify(error.response.data, null, 2)));
        }
      } else {
        console.error(chalk.red(error.message));
      }

      throw error;
    }
  }

  private loadCategoryMappings(): CategoryMappings {
    const mappingFile = join(__dirname, 'data/category-symbol-mappings.json');
    
    if (!existsSync(mappingFile)) {
      throw new Error(`找不到映射檔案: ${mappingFile}`);
    }

    const fileContent = JSON.parse(readFileSync(mappingFile, 'utf-8'));
    
    // 支援兩種格式：直接的 mappings 物件或包含 categoryMappings 的物件
    const mappings: CategoryMappings = fileContent.categoryMappings || fileContent;

    if (!mappings || typeof mappings !== 'object') {
      throw new Error('映射檔案格式錯誤');
    }

    return mappings;
  }

  private printMappingsSummary(mappings: CategoryMappings): void {
    console.log(chalk.cyan('\n📊 映射資料統計:'));
    
    let totalCategories = 0;
    let totalSymbols = 0;

    for (const [market, categories] of Object.entries(mappings)) {
      if (!categories || !Array.isArray(categories)) {
        continue;
      }

      const marketSymbols = categories.reduce((sum, cat) => sum + cat.symbols.length, 0);
      totalCategories += categories.length;
      totalSymbols += marketSymbols;

      console.log(`  ${this.getMarketFlag(market)} ${market}: ${categories.length} 個產業分類, ${marketSymbols} 個股票`);
    }

    console.log(chalk.green(`\n✅ 總計: ${totalCategories} 個產業分類, ${totalSymbols} 個股票`));
  }

  /**
   * 前端分塊處理
   */
  private async processWithFrontendChunking(
    mappings: CategoryMappings,
    chunkSize: number
  ): Promise<BulkSyncResponse> {
    const allChunks: { market: string; chunk: CategoryMapping[]; chunkIndex: number }[] = [];
    const totalStats: BulkSyncResponse['data'] = {
      labelsCreated: 0,
      labelsReactivated: 0,
      symbolsCreated: 0,
      symbolsUpdated: 0,
      relationsCreated: 0,
      relationsRemoved: 0,
      chunksProcessed: 0,
      chunkDetails: {},
    };

    // 為每個市場創建分塊
    for (const [market, categories] of Object.entries(mappings)) {
      if (!categories || !Array.isArray(categories)) continue;

      const marketChunks = this.createMarketChunks(categories, chunkSize);
      marketChunks.forEach((chunk, index) => {
        allChunks.push({
          market,
          chunk,
          chunkIndex: index,
        });
      });

      console.log(`  • ${this.getMarketFlag(market)} ${market}: ${marketChunks.length} 個分塊`);
    }

    console.log(chalk.cyan(`\n📊 總共 ${allChunks.length} 個分塊需要處理`));

    // 逐個處理分塊
    const errors: string[] = [];
    for (let i = 0; i < allChunks.length; i++) {
      const { market, chunk, chunkIndex } = allChunks[i];
      const chunkMappingCount = chunk.reduce((sum, cat) => sum + cat.symbols.length, 0);

      this.spinner = ora(`處理分塊 ${i + 1}/${allChunks.length}: ${market} #${chunkIndex + 1} (${chunkMappingCount} 個映射)`).start();

      try {
        const request: BulkSyncRequest = {
          [market]: chunk,
          options: {
            strategy: 'merge',
            createMissingSymbols: true,  // 啟用自動創建股票功能
            updateExistingRelations: true,
          },
        };

        const responseData = await this.apiClient.post('/label-industry/bulk-sync-mappings', request);
        const response = responseData;
        
        if (response.data.success) {
          const data = response.data.data;
          totalStats.labelsCreated += data.labelsCreated;
          totalStats.labelsReactivated += data.labelsReactivated;
          totalStats.symbolsCreated += data.symbolsCreated;
          totalStats.symbolsUpdated += data.symbolsUpdated;
          totalStats.relationsCreated += data.relationsCreated;
          totalStats.relationsRemoved += data.relationsRemoved;
          totalStats.chunksProcessed++;

          // 記錄市場詳情
          if (!totalStats.chunkDetails) {
            totalStats.chunkDetails = {};
          }
          if (!totalStats.chunkDetails[market]) {
            totalStats.chunkDetails[market] = { chunks: 0, mappings: 0, time: 0 };
          }
          totalStats.chunkDetails[market].chunks++;
          totalStats.chunkDetails[market].mappings += chunkMappingCount;
          totalStats.chunkDetails[market].time += response.data.data.totalProcessingTime || 0;

          this.spinner.succeed(`完成分塊 ${i + 1}/${allChunks.length}: +${data.labelsCreated} 標籤${data.labelsReactivated > 0 ? `(+${data.labelsReactivated} 重新啟用)` : ''}, +${data.symbolsCreated} 股票, +${data.relationsCreated} 關係`);
        } else {
          this.spinner.fail(`分塊 ${i + 1}/${allChunks.length} 處理失敗`);
          if (response.data.errors) {
            errors.push(...response.data.errors);
          }
        }
      } catch (error) {
        this.spinner.fail(`分塊 ${i + 1}/${allChunks.length} 請求失敗: ${error.response?.status || error.message}`);
        errors.push(`${market} 分塊 #${chunkIndex + 1}: ${error.message}`);
      }

      // 分塊間稍作延遲避免過載
      if (i < allChunks.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    return {
      success: errors.length === 0,
      data: totalStats,
      errors: errors.length > 0 ? errors : undefined,
      message: `前端分塊處理完成：${totalStats.chunksProcessed}/${allChunks.length} 個分塊成功，${totalStats.labelsCreated} 標籤${totalStats.labelsReactivated > 0 ? `(+${totalStats.labelsReactivated} 重新啟用)` : ''}，${totalStats.symbolsCreated} 新股票，${totalStats.symbolsUpdated} 個股票`,
    };
  }

  /**
   * 為單一市場創建分塊
   */
  private createMarketChunks(categories: CategoryMapping[], chunkSize: number): CategoryMapping[][] {
    const chunks: CategoryMapping[][] = [];
    let currentChunk: CategoryMapping[] = [];
    let currentChunkMappingCount = 0;

    for (const category of categories) {
      const categoryMappingCount = category.symbols.length;
      
      // 如果加入當前類別會超過分塊大小，先完成當前分塊
      if (currentChunkMappingCount + categoryMappingCount > chunkSize && currentChunk.length > 0) {
        chunks.push([...currentChunk]);
        currentChunk = [];
        currentChunkMappingCount = 0;
      }

      // 如果單個類別就超過分塊大小，需要分割股票
      if (categoryMappingCount > chunkSize) {
        const symbolChunks = this.splitArray(category.symbols, chunkSize);
        
        for (const symbolChunk of symbolChunks) {
          chunks.push([{
            ...category,
            symbols: symbolChunk,
          }]);
        }
      } else {
        // 正常情況，加入當前分塊
        currentChunk.push(category);
        currentChunkMappingCount += categoryMappingCount;
      }
    }

    // 加入最後一個分塊（如果有內容）
    if (currentChunk.length > 0) {
      chunks.push([...currentChunk]);
    }

    return chunks;
  }

  /**
   * 分割陣列成多個分塊
   */
  private splitArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * 解析分塊大小參數
   */
  private parseChunkSize(args: string[]): number | undefined {
    const chunkSizeArg = args.find(arg => arg.startsWith('--chunk-size='));
    if (chunkSizeArg) {
      const size = parseInt(chunkSizeArg.split('=')[1], 10);
      return isNaN(size) ? undefined : Math.max(30, Math.min(size, 500));
    }
    return undefined;
  }

  /**
   * 分析載荷大小
   */
  private analyzePayloadSize(mappings: CategoryMappings): {
    estimatedSizeMB: number;
    needsChunking: boolean;
    recommendedChunkSize: number;
    totalMappings: number;
  } {
    let totalMappings = 0;
    let estimatedSize = 0;

    for (const [market, categories] of Object.entries(mappings)) {
      if (!categories || !Array.isArray(categories)) continue;
      
      for (const category of categories) {
        totalMappings += category.symbols.length;
        // 估算每個映射關係的大小：股票代碼(8) + 名稱(20) + JSON 結構(30) ≈ 58 bytes
        estimatedSize += category.symbols.length * 58;
      }
      // 加上類別結構的大小
      estimatedSize += categories.length * 100;
    }

    const estimatedSizeMB = estimatedSize / (1024 * 1024);
    const needsChunking = estimatedSizeMB > 0.3 || totalMappings > 200;
    
    // 動態計算建議分塊大小 - 更保守的策略
    let recommendedChunkSize = 200;
    if (totalMappings > 5000) {
      recommendedChunkSize = 100;
    } else if (totalMappings > 10000) {
      recommendedChunkSize = 50;
    } else if (totalMappings > 2000) {
      recommendedChunkSize = 150;
    }

    return {
      estimatedSizeMB,
      needsChunking,
      recommendedChunkSize,
      totalMappings,
    };
  }

  private printSyncResults(result: BulkSyncResponse): void {
    console.log(chalk.blue('\n📈 同步結果:'));
    console.log(chalk.gray('─'.repeat(30)));

    if (result.success) {
      console.log(chalk.green(`✅ 同步成功`));
      
      if (result.message) {
        console.log(chalk.cyan(`📝 ${result.message}`));
      }

      const { data } = result;
      console.log(`📊 處理統計:`);
      console.log(`  • 創建標籤: ${chalk.yellow(data.labelsCreated)} 個`);
      if (data.labelsReactivated > 0) {
        console.log(`  • 重新啟用標籤: ${chalk.green(data.labelsReactivated)} 個`);
      }
      if (data.symbolsCreated > 0) {
        console.log(`  • 創建股票: ${chalk.cyan(data.symbolsCreated)} 個`);
      }
      console.log(`  • 更新股票: ${chalk.yellow(data.symbolsUpdated)} 個`);
      console.log(`  • 創建關係: ${chalk.yellow(data.relationsCreated)} 個`);
      console.log(`  • 移除關係: ${chalk.yellow(data.relationsRemoved)} 個`);

      // 顯示分塊處理詳情
      if (data.chunksProcessed && data.chunksProcessed > 1) {
        console.log(chalk.cyan(`\n🧩 分塊處理詳情:`));
        console.log(`  • 處理分塊: ${chalk.yellow(data.chunksProcessed)} 個`);
        console.log(`  • 總處理時間: ${chalk.yellow(data.totalProcessingTime || 0)} ms`);
        
        if (data.chunkDetails) {
          for (const [market, details] of Object.entries(data.chunkDetails)) {
            const flag = this.getMarketFlag(market);
            console.log(`  • ${flag} ${market}: ${details.chunks} 分塊, ${details.mappings} 映射, ${details.time}ms`);
          }
        }
      }

      if (result.errors && result.errors.length > 0) {
        console.log(chalk.yellow(`\n⚠️  ${result.errors.length} 個警告:`));
        result.errors.slice(0, 5).forEach(error => {
          console.log(chalk.yellow(`  • ${error}`));
        });
        
        if (result.errors.length > 5) {
          console.log(chalk.yellow(`  • ... 以及 ${result.errors.length - 5} 個更多警告`));
        }
      }
    } else {
      console.log(chalk.red('❌ 同步失敗'));
      
      if (result.errors && result.errors.length > 0) {
        console.log(chalk.red('錯誤列表:'));
        result.errors.forEach(error => {
          console.log(chalk.red(`  • ${error}`));
        });
      }
    }
  }

  private getMarketFlag(market: string): string {
    const flags: Record<string, string> = {
      TPE: '🇹🇼',
      US: '🇺🇸',
      JP: '🇯🇵',
    };
    return flags[market] || '🌐';
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');

  // API 配置
  const apiUrl = process.env.INTERNAL_AHA_API_URL || 'http://localhost:3000';
  // 優先使用環境變數中的 token
  let apiToken = process.env.INTERNAL_AHA_API_TOKEN;

  console.log(chalk.blue('🔐 API Token 狀態檢查:'));
  if (apiToken) {
    console.log(chalk.green(`  ✅ 找到 API Token: ${apiToken.substring(0, 20)}...`));
  } else {
    console.log(chalk.yellow('  ⚠️  沒有找到 API Token，將嘗試自動登入'));
  }

  // 只有在完全沒有 token 時才嘗試自動登入
  if (!apiToken && apiUrl.includes('localhost')) {
    try {
      console.log(chalk.yellow('🔄 嘗試自動登入...'));
      
      const loginResponse = await axios.post(`${apiUrl}/auth/auto-login`, {
        email: 'aryung@gmail.com',
        name: 'Test User',
      });
      
      apiToken = loginResponse.data.accessToken;
      console.log(chalk.green('✅ 自動登入成功'));
    } catch (error) {
      console.log(chalk.red('❌ 自動登入失敗，將不使用認證繼續執行'));
      console.log(chalk.gray(`   錯誤: ${(error as any).message}`));
    }
  }
  
  // 驗證 API 連接（如果有 token）
  if (apiToken) {
    try {
      console.log(chalk.blue('🔍 驗證 API 連接...'));
      const testResponse = await axios.get(`${apiUrl}/auth/profile`, {
        headers: { 'Authorization': `Bearer ${apiToken}` },
        timeout: 5000
      });
      console.log(chalk.green(`  ✅ API 連接正常，用戶: ${testResponse.data?.email || 'unknown'}`));
    } catch (error: any) {
      console.log(chalk.yellow(`  ⚠️  API 連接測試失敗: ${error.response?.status} ${error.response?.statusText || error.message}`));
      if (error.response?.status === 401) {
        console.log(chalk.red('  🚫 Token 可能已過期或無效'));
      }
    }
  }

  // 解析其他參數
  const chunkSize = args.find(arg => arg.startsWith('--chunk-size='))?.split('=')[1];
  const enableProgress = args.includes('--progress');

  // 顯示執行配置
  console.log(chalk.blue('📋 執行配置:'));
  console.log(`  • API URL: ${apiUrl}`);
  console.log(`  • 模式: ${isDryRun ? chalk.yellow('DRY RUN') : chalk.green('LIVE')}`);
  console.log(`  • 認證: ${apiToken ? chalk.green('已配置') : chalk.yellow('無')}`);
  console.log(`  • 分塊大小: ${chunkSize || chalk.gray('自動')}`);
  console.log(`  • 進度報告: ${enableProgress ? chalk.green('啟用') : chalk.gray('停用')}`);
  console.log();

  // 執行同步
  const syncer = new SimplifiedCategoryLabelSyncer(apiUrl, apiToken, isDryRun, args);
  
  try {
    const result = await syncer.sync();
    
    if (result && result.success) {
      console.log(chalk.green('\n🎉 批量同步成功完成！'));
      console.log(chalk.gray('比起逐筆處理，這種方式大幅提升了效能：'));
      console.log(chalk.gray('  • API 請求數: 數千次 → 1次'));
      console.log(chalk.gray('  • 處理時間: 數分鐘 → 數秒'));
      console.log(chalk.gray('  • 錯誤率: 較高 → 更低'));
    }
    
    process.exit(0);
  } catch (error) {
    console.error(chalk.red('\n💥 執行失敗！'));
    process.exit(1);
  }
}

// Execute if run directly
if (require.main === module) {
  main().catch(console.error);
}

export { SimplifiedCategoryLabelSyncer };