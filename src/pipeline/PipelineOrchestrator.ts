import * as path from 'path';
import * as fs from 'fs-extra';
import { exec } from 'child_process';
import { promisify } from 'util';
import { OutputFileManager } from './OutputFileManager.js';
import { UnifiedFinancialData } from '../types/unified-financial-data.js';
import { RetryManager, RetryRecord } from './RetryManager.js';
import { DataValidator } from './DataValidator.js';

const execAsync = promisify(exec);

export interface PipelineConfig {
  dataDir?: string;
  configDir?: string;
  outputDir?: string;
  scriptsDir?: string;
  batchSize?: number;
  maxConcurrent?: number;
  regions?: string[];
  symbolCodes?: string[];
  dataTypes?: string[]; // Support for different data types like 'financials', 'history', etc.
  skipConfigGeneration?: boolean;
  skipCrawling?: boolean;
  skipAggregation?: boolean;
  skipSymbolImport?: boolean;
  skipFundamentalImport?: boolean;
  skipLabelSync?: boolean;
  apiUrl?: string;
  apiToken?: string;
  // Retry mechanism options
  enableRetry?: boolean;
  maxRetries?: number;
  retryDelay?: number;
  retryOnly?: boolean;
  clearRetries?: boolean;
}

export interface PipelineResult {
  totalSymbols: number;
  totalConfigsGenerated: number;
  totalCrawlerRuns: number;
  successfulCrawls: number;
  failedCrawls: number;
  totalDataAggregated: number;
  errors: string[];
  duration: number;
  // Retry mechanism results
  retriesExecuted: number;
  retriesSuccessful: number;
  retriesFailed: number;
  newRetryItems: number;
}

export interface CrawlerProgress {
  current: number;
  total: number;
  symbol: string;
  reportType: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
}

/**
 * Orchestrates the complete crawler pipeline from data sources to database
 */
export class PipelineOrchestrator {
  private config: Required<PipelineConfig>;
  private fileManager: OutputFileManager;
  private progressCallback?: (progress: CrawlerProgress) => void;
  private retryManager: RetryManager;
  private dataValidator: DataValidator;

  constructor(config: PipelineConfig = {}) {
    this.config = {
      dataDir: config.dataDir || 'data',
      configDir: config.configDir || 'config-categorized',
      outputDir: config.outputDir || 'output',
      scriptsDir: config.scriptsDir || 'scripts',
      batchSize: config.batchSize || 100,
      maxConcurrent: config.maxConcurrent || 1,
      regions: config.regions || ['tw', 'us', 'jp'],
      symbolCodes: config.symbolCodes || [],
      dataTypes: config.dataTypes || ['financials'], // Default to financials only
      skipConfigGeneration: config.skipConfigGeneration || false,
      skipCrawling: config.skipCrawling || false,
      skipAggregation: config.skipAggregation || false,
      skipSymbolImport: config.skipSymbolImport || false,
      skipFundamentalImport: config.skipFundamentalImport || false,
      skipLabelSync: config.skipLabelSync || false,
      apiUrl: config.apiUrl || process.env.BACKEND_API_URL || 'http://localhost:3000',
      apiToken: config.apiToken || process.env.BACKEND_API_TOKEN || '',
      // Retry mechanism defaults
      enableRetry: config.enableRetry !== false, // Default to enabled
      maxRetries: config.maxRetries || 3,
      retryDelay: config.retryDelay || 5000,
      retryOnly: config.retryOnly || false,
      clearRetries: config.clearRetries || false,
    };

    this.fileManager = new OutputFileManager(this.config.outputDir, true); // Use structured layout

    // Initialize retry and validation systems
    this.retryManager = new RetryManager({
      retryFilePath: path.join(this.config.outputDir, 'pipeline-retries.json'),
      maxRetries: this.config.maxRetries,
      retryDelay: this.config.retryDelay,
    });
    this.dataValidator = new DataValidator();
  }

  /**
   * Set progress callback for monitoring
   */
  onProgress(callback: (progress: CrawlerProgress) => void): void {
    this.progressCallback = callback;
  }

  /**
   * Run the complete pipeline
   */
  async run(): Promise<PipelineResult> {
    const startTime = Date.now();
    const result: PipelineResult = {
      totalSymbols: 0,
      totalConfigsGenerated: 0,
      totalCrawlerRuns: 0,
      successfulCrawls: 0,
      failedCrawls: 0,
      totalDataAggregated: 0,
      errors: [],
      duration: 0,
      // Retry mechanism results
      retriesExecuted: 0,
      retriesSuccessful: 0,
      retriesFailed: 0,
      newRetryItems: 0,
    };

    try {
      console.log('🚀 Starting crawler pipeline...');

      // Handle retry management
      if (this.config.clearRetries) {
        console.log('\n🧹 Clearing retry queue...');
        const clearedCount = await this.retryManager.clearAllRetries();
        console.log(`  ✓ Cleared ${clearedCount} retry records`);
      }

      // Clean expired retries
      if (this.config.enableRetry) {
        await this.retryManager.cleanupExpiredRetries();
      }

      // Step 0: Execute retries if enabled and not skipped
      if (this.config.enableRetry && !this.config.skipCrawling) {
        console.log('\n🔄 Step 0: Processing retry queue...');
        const retryResult = await this.executeRetries();
        result.retriesExecuted = retryResult.total;
        result.retriesSuccessful = retryResult.successful;
        result.retriesFailed = retryResult.failed;
        result.errors.push(...retryResult.errors);
      }

      // If retry-only mode, skip normal pipeline steps
      if (this.config.retryOnly) {
        result.duration = Date.now() - startTime;
        console.log(`\n✅ Retry-only pipeline completed in ${(result.duration / 1000).toFixed(2)}s`);
        this.printRetrySummary(result);
        return result;
      }

      // Step 1: Generate configurations
      if (!this.config.skipConfigGeneration) {
        console.log('\n📝 Step 1: Generating configurations...');
        const configResult = await this.generateConfigurations();
        result.totalConfigsGenerated = configResult.totalGenerated;
        result.totalSymbols = configResult.uniqueSymbols;
        result.errors.push(...configResult.errors);
      }

      // Step 2: Execute crawlers
      if (!this.config.skipCrawling) {
        console.log('\n🕷️ Step 2: Executing crawlers...');
        const crawlResult = await this.executeCrawlers();
        result.totalCrawlerRuns = crawlResult.total;
        result.successfulCrawls = crawlResult.successful;
        result.failedCrawls = crawlResult.failed;
        result.newRetryItems = crawlResult.newRetryItems || 0;
        result.errors.push(...crawlResult.errors);
      }

      // Step 3: Collect crawler outputs directly (no aggregation needed for TW)
      let unifiedData: UnifiedFinancialData[] = [];
      if (!this.config.skipAggregation) {
        console.log('\n📊 Step 3: Collecting crawler outputs...');
        unifiedData = await this.collectUnifiedData();
        result.totalDataAggregated = unifiedData.length;
      }

      // Step 4: Import symbols to backend
      if (!this.config.skipSymbolImport) {
        console.log('\n📈 Step 4: Importing symbols to backend...');
        try {
          await this.importSymbolsFromMappings();
          console.log('  ✅ Symbol import completed');
        } catch (error) {
          console.error('  ❌ Symbol import failed:', (error as Error).message);
          result.errors.push(`Symbol import failed: ${(error as Error).message}`);
        }
      }

      // Step 5: Import fundamental data to backend
      if (!this.config.skipFundamentalImport && unifiedData.length > 0) {
        console.log('\n💾 Step 5: Importing fundamental data to backend...');
        try {
          await this.importFundamentalData(unifiedData);
          console.log('  ✅ Fundamental data import completed');
        } catch (error) {
          console.error('  ❌ Fundamental data import failed:', (error as Error).message);
          result.errors.push(`Fundamental data import failed: ${(error as Error).message}`);
        }
      } else if (!this.config.skipFundamentalImport) {
        console.log('\n💾 Step 5: No fundamental data to import (use: npm run import:fundamental:batch)');
      }

      // Step 6: Sync category labels
      if (!this.config.skipLabelSync) {
        console.log('\n🏷️  Step 6: Syncing category labels...');
        try {
          await this.syncCategoryLabels();
          console.log('  ✅ Label sync completed');
        } catch (error) {
          console.error('  ❌ Label sync failed:', (error as Error).message);
          result.errors.push(`Label sync failed: ${(error as Error).message}`);
        }
      }

      result.duration = Date.now() - startTime;
      console.log(`\n✅ Pipeline completed in ${(result.duration / 1000).toFixed(2)}s`);
      this.printSummary(result);

    } catch (error) {
      result.errors.push(`Pipeline error: ${(error as Error).message}`);
      console.error('❌ Pipeline failed:', error);
    } finally {
      // Cleanup
      // await this.importer.close();
    }

    return result;
  }

  /**
   * Generate configurations from data sources
   */
  private async generateConfigurations(): Promise<{
    totalGenerated: number;
    uniqueSymbols: number;
    errors: string[];
  }> {
    const result = {
      totalGenerated: 0,
      uniqueSymbols: new Set<string>(),
      errors: [] as string[],
    };

    for (const region of this.config.regions) {
      for (const dataType of this.config.dataTypes) {
        try {
          const scriptPath = path.join(
            this.config.scriptsDir,
            `generate-yahoo-${region}-configs.ts`
          );

          if (await fs.pathExists(scriptPath)) {
            console.log(`  Generating ${region.toUpperCase()} ${dataType} configurations...`);
            
            // Execute generation script with tsx and specific data type
            const command = `npx tsx ${scriptPath} --type=${dataType}`;
            const { stdout, stderr } = await execAsync(command);
            
            if (stderr) {
              result.errors.push(`${region} ${dataType} generation warning: ${stderr}`);
            }

            // Parse output to count generated configs
            const matches = stdout.match(/(\d+) 個配置文件/g);
            if (matches) {
              for (const match of matches) {
                const count = parseInt(match.match(/\d+/)?.[0] || '0');
                result.totalGenerated += count;
              }
            }
          } else {
            result.errors.push(`Script not found: ${scriptPath}`);
          }
        } catch (error) {
          result.errors.push(`Error generating ${region} ${dataType} configs: ${(error as Error).message}`);
        }
      }

      // Count unique symbols from data file (once per region)
      try {
        const dataFile = path.join(
          this.config.dataDir,
          `yahoo-finance-${region}-stockcodes.json`
        );
        if (await fs.pathExists(dataFile)) {
          const stockData = await fs.readJson(dataFile);
          for (const stock of stockData) {
            result.uniqueSymbols.add(stock.stockCode);
          }
        }
      } catch (error) {
        result.errors.push(`Error reading stock data for ${region}: ${(error as Error).message}`);
      }
    }

    console.log(`  ✓ Generated ${result.totalGenerated} configurations for ${result.uniqueSymbols.size} symbols`);
    return {
      ...result,
      uniqueSymbols: result.uniqueSymbols.size,
    };
  }

  /**
   * Execute retries from retry queue
   */
  private async executeRetries(): Promise<{
    total: number;
    successful: number;
    failed: number;
    errors: string[];
  }> {
    const result = {
      total: 0,
      successful: 0,
      failed: 0,
      errors: [] as string[],
    };

    const pendingRetries = await this.retryManager.getPendingRetries();
    result.total = pendingRetries.length;

    if (pendingRetries.length === 0) {
      console.log('  ✓ No items in retry queue');
      return result;
    }

    console.log(`  Found ${pendingRetries.length} items in retry queue`);

    for (let i = 0; i < pendingRetries.length; i++) {
      const retry = pendingRetries[i];
      
      const progress: CrawlerProgress = {
        current: i + 1,
        total: pendingRetries.length,
        symbol: retry.symbolCode,
        reportType: retry.reportType,
        status: 'running',
      };

      if (this.progressCallback) {
        this.progressCallback(progress);
      }

      console.log(`  🔄 [${i + 1}/${pendingRetries.length}] Retrying ${retry.symbolCode} ${retry.reportType} (第 ${retry.retryCount} 次)`);

      try {
        // Add delay for retries (exponential backoff)
        const delay = this.retryManager.calculateRetryDelay(retry.retryCount);
        if (delay > 0) {
          console.log(`    ⏳ Waiting ${delay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }

        // Execute crawler for this retry
        const { stderr } = await execAsync(
          `npx tsx src/cli.ts --config ${retry.configFile}`,
          { cwd: process.cwd() }
        );

        if (stderr && !stderr.includes('warning')) {
          throw new Error(stderr);
        }

        // Validate the output
        const validation = await this.dataValidator.validateConfigOutput(retry.configFile, this.config.outputDir);
        
        if (validation.isValid) {
          // Success - remove from retry queue
          await this.retryManager.removeRetryItem(retry.configFile, retry.symbolCode, retry.reportType);
          result.successful++;
          progress.status = 'completed';
          console.log(`    ✅ Retry successful: ${retry.symbolCode} ${retry.reportType}`);
        } else {
          // Still empty - update retry count
          await this.retryManager.addRetryItem(
            retry.configFile,
            retry.symbolCode,
            retry.reportType,
            retry.region,
            'empty_data'
          );
          result.failed++;
          progress.status = 'failed';
          console.log(`    ❌ Retry still empty: ${retry.symbolCode} ${retry.reportType} - ${validation.reason}`);
        }
      } catch (error) {
        // Execution failed - update retry count
        await this.retryManager.addRetryItem(
          retry.configFile,
          retry.symbolCode,
          retry.reportType,
          retry.region,
          'execution_failed'
        );
        result.failed++;
        result.errors.push(`Retry failed ${retry.symbolCode}: ${(error as Error).message}`);
        progress.status = 'failed';
        console.log(`    ❌ Retry execution failed: ${retry.symbolCode} ${retry.reportType}`);
      }

      if (this.progressCallback) {
        this.progressCallback(progress);
      }
    }

    console.log(`  ✓ Retries complete: ${result.successful} successful, ${result.failed} failed`);
    return result;
  }

  /**
   * Execute crawlers sequentially for all configurations
   */
  private async executeCrawlers(): Promise<{
    total: number;
    successful: number;
    failed: number;
    errors: string[];
    newRetryItems?: number;
  }> {
    const result = {
      total: 0,
      successful: 0,
      failed: 0,
      errors: [] as string[],
      newRetryItems: 0,
    };

    // Get all generated config files
    const configFiles = await this.getConfigFiles();
    result.total = configFiles.length;

    console.log(`  Found ${configFiles.length} configurations to process`);

    // Process in batches
    for (let i = 0; i < configFiles.length; i += this.config.maxConcurrent) {
      const batch = configFiles.slice(i, i + this.config.maxConcurrent);
      
      await Promise.all(
        batch.map(async (configFile, batchIndex) => {
          const progress: CrawlerProgress = {
            current: i + batchIndex + 1,
            total: configFiles.length,
            symbol: this.extractSymbolFromConfig(configFile),
            reportType: this.extractReportTypeFromConfig(configFile),
            status: 'running',
          };

          if (this.progressCallback) {
            this.progressCallback(progress);
          }

          try {
            // Execute crawler for this config
            const configName = path.basename(configFile, '.json');
            console.log(`  [${progress.current}/${progress.total}] Crawling ${configName}...`);
            
            const { stderr } = await execAsync(
              `npx tsx src/cli.ts --config ${configFile}`,
              { cwd: process.cwd() }
            );

            if (stderr && !stderr.includes('warning')) {
              throw new Error(stderr);
            }

            // Validate output if retry mechanism is enabled
            if (this.config.enableRetry) {
              const validation = await this.dataValidator.validateConfigOutput(configFile, this.config.outputDir);
              
              if (validation.isValid) {
                result.successful++;
                progress.status = 'completed';
              } else {
                // Add to retry queue for empty data
                await this.retryManager.addRetryItem(
                  configFile,
                  progress.symbol,
                  progress.reportType,
                  this.extractRegionFromConfig(configFile),
                  'empty_data'
                );
                result.newRetryItems++;
                result.successful++; // Still count as successful execution, just empty data
                progress.status = 'completed';
                console.log(`    ⚠️ Empty data detected, added to retry queue: ${progress.symbol} ${progress.reportType}`);
              }
            } else {
              result.successful++;
              progress.status = 'completed';
            }
          } catch (error) {
            result.failed++;
            result.errors.push(
              `Failed to crawl ${path.basename(configFile)}: ${(error as Error).message}`
            );
            progress.status = 'failed';

            // Add execution failure to retry queue if enabled
            if (this.config.enableRetry) {
              await this.retryManager.addRetryItem(
                configFile,
                progress.symbol,
                progress.reportType,
                this.extractRegionFromConfig(configFile),
                'execution_failed'
              );
              result.newRetryItems++;
            }
          }

          if (this.progressCallback) {
            this.progressCallback(progress);
          }
        })
      );
    }

    console.log(`  ✓ Crawling complete: ${result.successful} successful, ${result.failed} failed`);
    
    if (this.config.enableRetry && result.newRetryItems > 0) {
      console.log(`  📝 Added ${result.newRetryItems} items to retry queue`);
    }
    
    return result;
  }

  /**
   * Collect all crawled UnifiedFinancialData directly from output files (supports structured layout)
   */
  private async collectUnifiedData(): Promise<UnifiedFinancialData[]> {
    const allData: UnifiedFinancialData[] = [];
    
    try {
      // Get all output JSON files recursively
      const outputFiles = await this.getJsonFilesRecursively(this.config.outputDir);
      
      for (const filePath of outputFiles) {
        const fileName = path.basename(filePath);
        
        // Process all yahoo-finance JSON files (not just TW)
        if (fileName.endsWith('.json') && fileName.includes('yahoo-finance')) {
          try {
            const fileData = await fs.readJson(filePath);
            const results = fileData.results || [];
            
            for (const result of results) {
              if (result.data) {
                // Extract different data types from crawler output
                const data = result.data;
                
                // Extract all UnifiedFinancialData arrays (support different regions)
                const dataArrays = [
                  data.revenueData || [],
                  data.simpleEPSData || [],
                  data.dividendData || [],
                  data.incomeStatementData || [],
                  data.independentCashFlowData || [],
                  data.balanceSheetData || [],
                  // US/JP data arrays
                  data.financialData || [],
                  data.cashflowData || [],
                  data.performanceData || []
                ];
                
                for (const dataArray of dataArrays) {
                  if (Array.isArray(dataArray)) {
                    allData.push(...dataArray);
                  }
                }
              }
            }
          } catch (error) {
            console.warn(`  ⚠️ Failed to process file ${path.relative(this.config.outputDir, filePath)}: ${(error as Error).message}`);
          }
        }
      }

      console.log(`  ✓ Collected ${allData.length} unified data records from crawler outputs`);
    } catch (error) {
      console.error('  ❌ Data collection error:', error);
    }

    return allData;
  }


  /**
   * Get all config files to process (supports both flat and categorized structures)
   */
  private async getConfigFiles(): Promise<string[]> {
    const files: string[] = [];
    
    for (const region of this.config.regions) {
      const pattern = new RegExp(`^yahoo-finance-${region}-.*\\.json$`);
      
      // Get all JSON files recursively from config directory
      const configFiles = await this.getJsonFilesRecursively(this.config.configDir);
      
      for (const filePath of configFiles) {
        const fileName = path.basename(filePath);
        
        if (pattern.test(fileName)) {
          // Apply symbol filter if specified - 精確匹配
          if (this.config.symbolCodes.length > 0) {
            const hasSymbol = this.config.symbolCodes.some(symbol => {
              const normalizedSymbol = symbol.replace('.', '_');
              // 從檔名中提取符號部分進行精確比較
              const symbolMatch = fileName.match(/yahoo-finance-\w+-[\w-]+-([A-Z0-9_]+)\.json/);
              return symbolMatch && symbolMatch[1] === normalizedSymbol;
            });
            if (!hasSymbol) continue;
          }
          
          files.push(filePath);
        }
      }
    }

    return files;
  }

  /**
   * Recursively get all JSON files from a directory
   */
  private async getJsonFilesRecursively(dir: string): Promise<string[]> {
    const results: string[] = [];
    
    try {
      if (!(await fs.pathExists(dir))) {
        return results;
      }
      
      const items = await fs.readdir(dir, { withFileTypes: true });
      
      for (const item of items) {
        const fullPath = path.join(dir, item.name);
        
        if (item.isDirectory()) {
          // Skip certain directories
          if (item.name === 'active' || item.name === 'templates') {
            continue;
          }
          // Recursively scan subdirectories
          results.push(...await this.getJsonFilesRecursively(fullPath));
        } else if (item.isFile() && item.name.endsWith('.json')) {
          results.push(fullPath);
        }
      }
    } catch (error) {
      console.warn(`Warning: Failed to scan directory ${dir}: ${(error as Error).message}`);
    }
    
    return results;
  }

  /**
   * Extract symbol code from config filename
   */
  private extractSymbolFromConfig(configPath: string): string {
    const filename = path.basename(configPath);
    const match = filename.match(/yahoo-finance-\w+-[\w-]+-([A-Z0-9_]+)\.json/);
    return match ? match[1].replace('_', '.') : 'unknown';
  }

  /**
   * Extract report type from config filename
   */
  private extractReportTypeFromConfig(configPath: string): string {
    const filename = path.basename(configPath);
    const match = filename.match(/yahoo-finance-\w+-([\w-]+)-[A-Z0-9_]+\.json/);
    return match ? match[1] : 'unknown';
  }


  /**
   * Clean up old output files before running
   */
  async cleanupOldFiles(daysToKeep: number = 7): Promise<void> {
    console.log(`\n🧹 Cleaning up files older than ${daysToKeep} days...`);
    const deletedCount = await this.fileManager.cleanOldFiles(daysToKeep);
    console.log(`  ✓ Deleted ${deletedCount} old files`);
  }

  /**
   * Get current pipeline statistics via API
   */
  async getStatistics(): Promise<{
    outputFiles: any;
    database: any;
  }> {
    const outputStats = await this.fileManager.getStatistics();
    
    // Get database statistics from backend API instead of direct database access
    let dbStats: any = {
      totalRecords: 0,
      byRegion: {},
      byReportType: {},
      latestReportDate: null,
    };
    
    try {
      const axios = require('axios');
      const apiUrl = process.env.BACKEND_API_URL || 'http://localhost:3000';
      const token = process.env.BACKEND_API_TOKEN;
      
      const headers: any = {
        'Content-Type': 'application/json',
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const response = await axios.get(`${apiUrl}/fundamental-data/statistics`, {
        headers,
        timeout: 10000,
      });
      
      if (response.data) {
        dbStats = response.data;
      }
    } catch (error) {
      console.warn('⚠️ Failed to fetch database statistics from API:', (error as Error).message);
      console.log('   Using default empty statistics');
    }

    return {
      outputFiles: outputStats,
      database: dbStats,
    };
  }

  /**
   * Import symbols from category mappings using existing batch script
   */
  private async importSymbolsFromMappings(): Promise<void> {
    try {
      console.log('  🚀 使用批次腳本匯入股票代碼...');
      
      // 使用現有的 import-symbols.ts 腳本，它已經有完整的批次處理
      const { stdout, stderr } = await execAsync(
        `npx tsx scripts/import-symbols.ts --batch-size=30`,
        { cwd: process.cwd() }
      );

      // 檢查錯誤輸出
      if (stderr && !stderr.includes('warning')) {
        throw new Error(`Stock import script failed: ${stderr}`);
      }

      // 解析成功結果
      if (stdout.includes('股票代碼匯入完成')) {
        console.log('    ✅ 批次腳本執行成功');
      } else {
        console.log('    ⚠️ 腳本執行完成，請檢查輸出');
      }

    } catch (error) {
      throw new Error(`Failed to execute symbol import script: ${(error as Error).message}`);
    }
  }

  /**
   * Import fundamental data using existing batch script
   */
  private async importFundamentalData(data: UnifiedFinancialData[]): Promise<void> {
    console.log(`  📊 準備匯入 ${data.length} 筆基本面資料`);
    console.log('  💡 建議使用: npm run import:fundamental:batch');
    console.log('  📄 跳過直接匯入，使用獨立批次腳本以獲得更好的分塊處理');
  }

  /**
   * Sync category labels using existing batch script
   */
  private async syncCategoryLabels(): Promise<void> {
    try {
      console.log('  🏷️ 使用批次腳本同步標籤...');
      
      // 使用現有的 import-category-labels-simple.ts 腳本，它已經有完整的分塊處理和股票創建功能
      const { stdout, stderr } = await execAsync(
        `npx tsx scripts/import-category-labels-simple.ts --chunk-size=100 --progress`,
        { cwd: process.cwd() }
      );

      // 檢查錯誤輸出
      if (stderr && !stderr.includes('warning')) {
        throw new Error(`Label sync script failed: ${stderr}`);
      }

      // 解析成功結果
      if (stdout.includes('批量同步成功完成')) {
        console.log('    ✅ 批次腳本執行成功');
      } else {
        console.log('    ⚠️ 腳本執行完成，請檢查輸出');
      }

    } catch (error) {
      throw new Error(`Failed to execute label sync script: ${(error as Error).message}`);
    }
  }

  /**
   * Convert UnifiedFinancialData to API format
   */
  private convertToApiFormat(record: UnifiedFinancialData): any {
    // 清理 symbolCode
    let cleanSymbolCode = record.symbolCode;
    if (record.exchangeArea === 'TPE') {
      cleanSymbolCode = cleanSymbolCode.replace(/\.TW[O]?$/, '');
    }

    // 先展開所有屬性，再覆蓋特定欄位
    return {
      ...record,
      symbolCode: cleanSymbolCode,
      reportType: record.reportType || 'annual'
    };
  }

  /**
   * Clean symbol code based on market
   */
  private cleanSymbolCode(symbolCode: string, market: string): string {
    if (market === 'TPE') {
      return symbolCode.replace(/\.TW[O]?$/, '');
    }
    return symbolCode;
  }

  /**
   * Map market code to exchange area
   */
  private mapMarketToExchangeArea(market: string): string {
    const mapping: Record<string, string> = {
      'TPE': 'TPE',
      'US': 'US', 
      'JP': 'JP'
    };
    return mapping[market] || market;
  }

  /**
   * Extract region code from config filename
   */
  private extractRegionFromConfig(configPath: string): string {
    const filename = path.basename(configPath);
    const match = filename.match(/yahoo-finance-(\w+)-/);
    return match ? match[1].toUpperCase() : 'UNKNOWN';
  }

  /**
   * Get retry manager instance for external access
   */
  getRetryManager(): RetryManager {
    return this.retryManager;
  }

  /**
   * Get data validator instance for external access
   */
  getDataValidator(): DataValidator {
    return this.dataValidator;
  }

  /**
   * Print retry-specific summary
   */
  private printRetrySummary(result: PipelineResult): void {
    console.log('\n' + '='.repeat(60));
    console.log('🔄 Retry Pipeline Summary');
    console.log('='.repeat(60));
    console.log(`Retries Executed:     ${result.retriesExecuted}`);
    console.log(`  - Successful:       ${result.retriesSuccessful}`);
    console.log(`  - Failed:           ${result.retriesFailed}`);
    console.log(`Duration:             ${(result.duration / 1000).toFixed(2)}s`);
    
    if (result.errors.length > 0) {
      console.log(`\n⚠️ Errors (${result.errors.length}):`);
      result.errors.slice(0, 5).forEach(err => console.log(`  - ${err}`));
      if (result.errors.length > 5) {
        console.log(`  ... and ${result.errors.length - 5} more errors`);
      }
    }
    
    console.log('='.repeat(60));
  }

  /**
   * Enhanced summary that includes retry information
   */
  private printSummary(result: PipelineResult): void {
    console.log('\n' + '='.repeat(60));
    console.log('📈 Pipeline Execution Summary');
    console.log('='.repeat(60));
    console.log(`Total Symbols:        ${result.totalSymbols}`);
    console.log(`Configs Generated:    ${result.totalConfigsGenerated}`);
    console.log(`Crawler Runs:         ${result.totalCrawlerRuns}`);
    console.log(`  - Successful:       ${result.successfulCrawls}`);
    console.log(`  - Failed:           ${result.failedCrawls}`);
    
    if (this.config.enableRetry) {
      console.log(`Retry Operations:     ${result.retriesExecuted}`);
      console.log(`  - Successful:       ${result.retriesSuccessful}`);
      console.log(`  - Failed:           ${result.retriesFailed}`);
      console.log(`New Retry Items:      ${result.newRetryItems}`);
    }
    
    console.log(`Data Aggregated:      ${result.totalDataAggregated} records`);
    
    console.log('\n💡 Next Steps:');
    console.log('  - Run: npm run import:fundamental:batch');
    console.log('  - Or import specific regions: npm run import:fundamental:us');
    
    if (this.config.enableRetry && result.newRetryItems > 0) {
      console.log('  - Retry empty data: npm run pipeline:retry');
    }
    
    console.log(`Duration:             ${(result.duration / 1000).toFixed(2)}s`);
    
    if (result.errors.length > 0) {
      console.log(`\n⚠️ Errors (${result.errors.length}):`);
      result.errors.slice(0, 10).forEach(err => console.log(`  - ${err}`));
      if (result.errors.length > 10) {
        console.log(`  ... and ${result.errors.length - 10} more errors`);
      }
    }
    
    console.log('='.repeat(60));
  }
}