import 'dotenv/config';
import * as path from 'path';
import * as fs from 'fs-extra';
import { exec } from 'child_process';
import { promisify } from 'util';
import { OutputFileManager } from './OutputFileManager.js';
import { UnifiedFinancialData } from '../types/unified-financial-data.js';
import { RetryManager, RetryRecord } from './RetryManager.js';
import { DataValidator } from './DataValidator.js';
import { MarketRegion } from '../common/shared-types/interfaces/market-data.interface';
import { MarketRegionPathMapping, getDataTypePatterns } from '../common/constants/report';

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
  skipOhlcvImport?: boolean;
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
      regions: config.regions || Object.values(MarketRegionPathMapping),
      symbolCodes: config.symbolCodes || [],
      dataTypes: config.dataTypes || ['financials'], // Default to financials only
      skipConfigGeneration: config.skipConfigGeneration || false,
      skipCrawling: config.skipCrawling || false,
      skipAggregation: config.skipAggregation || false,
      skipSymbolImport: config.skipSymbolImport || false,
      skipFundamentalImport: config.skipFundamentalImport || false,
      skipOhlcvImport: config.skipOhlcvImport || false,
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
    console.log('\n' + '='.repeat(80));
    console.log('📦 Pipeline Orchestrator v3.0 - Starting');
    
    // 清理已成功的 retry 項目
    if (this.config.enableRetry) {
      console.log('\n🧹 Cleaning up successful retry items...');
      try {
        const cleaned = await this.retryManager.cleanupSuccessfulRetries(
          this.dataValidator,
          this.config.outputDir
        );
        if (cleaned > 0) {
          console.log(`  ✓ Cleaned ${cleaned} successful items from retry queue`);
        } else {
          console.log('  ✓ No successful items to clean from retry queue');
        }
      } catch (error) {
        console.warn(`  ⚠️ Failed to clean retry queue: ${(error as Error).message}`);
      }
    }
    
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
      if (!this.config.skipFundamentalImport) {
        console.log('\n💾 Step 5: Importing fundamental data to backend...');
        try {
          await this.importFundamentalData(unifiedData);
          console.log('  ✅ Fundamental data import completed');
        } catch (error) {
          console.error('  ❌ Fundamental data import failed:', (error as Error).message);
          result.errors.push(`Fundamental data import failed: ${(error as Error).message}`);
        }
      } else {
        console.log('\n💾 Step 5: Skipping fundamental data import (--skip-fundamental-import specified)');
      }

      // Step 5b: Import OHLCV historical data if history data type is requested
      if (!this.config.skipOhlcvImport && this.config.dataTypes.includes('history')) {
        console.log('\n📈 Step 5b: Importing OHLCV historical data to backend...');
        try {
          await this.importOhlcvData();
          console.log('  ✅ OHLCV data import completed');
        } catch (error) {
          console.error('  ❌ OHLCV data import failed:', (error as Error).message);
          result.errors.push(`OHLCV data import failed: ${(error as Error).message}`);
        }
      } else if (!this.config.skipOhlcvImport && !this.config.dataTypes.includes('history')) {
        console.log('\n📈 Step 5b: Skipping OHLCV import (history data type not requested)');
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
          // Success - remove all retry items for this symbol + region
          const region = this.extractRegionFromConfig(retry.configFile);
          const removedCount = await this.retryManager.removeAllRetryItemsForSymbol(retry.symbolCode, region);
          result.successful++;
          progress.status = 'completed';
          console.log(`    ✅ Retry successful: ${retry.symbolCode} ${retry.reportType}`);
          if (removedCount > 1) {
            console.log(`    🎯 Removed all ${removedCount} retry items for ${retry.symbolCode}/${region}`);
          }
        } else {
          // Still empty - provide detailed diagnostic information
          console.log(`    ❌ Retry still empty: ${retry.symbolCode} ${retry.reportType}`);
          console.log(`       Validation reason: ${validation.reason}`);
          console.log(`       Validation details: ${validation.details || 'No additional details'}`);
          console.log(`       Config file: ${retry.configFile}`);
          console.log(`       Current retry count: ${retry.retryCount}/${retry.maxRetries}`);
          
          // 檢查是否應該繼續重試
          if (retry.retryCount >= retry.maxRetries) {
            console.log(`       ⚠️ 已達最大重試次數，不再加入重試隊列`);
            result.failed++;
            progress.status = 'failed';
          } else {
            // Still can retry - update retry count
            await this.retryManager.addRetryItem(
              retry.configFile,
              retry.symbolCode,
              retry.reportType,
              retry.region,
              'empty_data'
            );
            result.failed++;
            progress.status = 'failed';
            console.log(`       🔄 加入重試隊列，下次重試`);
          }
        }
      } catch (error) {
        // Execution failed - provide detailed diagnostic information
        console.log(`    ❌ Retry execution failed: ${retry.symbolCode} ${retry.reportType}`);
        console.log(`       Error message: ${(error as Error).message}`);
        console.log(`       Config file: ${retry.configFile}`);
        console.log(`       Current retry count: ${retry.retryCount}/${retry.maxRetries}`);
        
        // 檢查是否應該繼續重試
        if (retry.retryCount >= retry.maxRetries) {
          console.log(`       ⚠️ 已達最大重試次數，不再加入重試隊列`);
          result.failed++;
          result.errors.push(`Retry failed ${retry.symbolCode}: ${(error as Error).message}`);
          progress.status = 'failed';
        } else {
          // Still can retry - update retry count
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
          console.log(`       🔄 加入重試隊列，下次重試`);
        }
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
                
                // 如果成功了，從 retry queue 中移除該 symbol + region 的所有項目
                const region = this.extractRegionFromConfig(configFile);
                const removedCount = await this.retryManager.removeAllRetryItemsForSymbol(
                  progress.symbol,
                  region
                );
                
                if (removedCount > 0) {
                  console.log(`    🎯 Symbol ${progress.symbol}/${region} 成功，已移除所有 ${removedCount} 個相關 retry 項目`);
                }
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
      console.log(`  🔍 Scanning output directory: ${this.config.outputDir}`);
      console.log(`  📁 Found ${outputFiles.length} output files`);
      
      if (outputFiles.length > 0) {
        console.log(`  📋 Sample files:`, outputFiles.slice(0, 3).map(f => path.basename(f)));
      }
      
      let processedFiles = 0;
      let validFiles = 0;
      
      for (const filePath of outputFiles) {
        const fileName = path.basename(filePath);
        
        // Process all yahoo-finance JSON files (not just TW)
        if (fileName.endsWith('.json') && fileName.includes('yahoo-finance')) {
          processedFiles++;
          try {
            const fileData = await fs.readJson(filePath);
            const results = fileData.results || [];
            
            console.log(`    🔍 Processing ${fileName}: has results=${!!fileData.results}, results.length=${results.length}`);
            
            if (results.length > 0) {
              validFiles++;
            }
            
            for (const result of results) {
              if (result.data) {
                // Extract different data types from crawler output
                const data = result.data;
                
                // 顯示可用的數據欄位
                const availableFields = Object.keys(data).filter(key => 
                  Array.isArray(data[key]) && data[key].length > 0
                );
                if (availableFields.length > 0) {
                  console.log(`      📊 Available data fields: ${availableFields.join(', ')}`);
                }
                
                // Extract all UnifiedFinancialData arrays (support different regions)
                const dataArrays = [
                  { name: 'revenueData', data: data.revenueData || [] },
                  { name: 'simpleEPSData', data: data.simpleEPSData || [] },
                  { name: 'dividendData', data: data.dividendData || [] },
                  { name: 'incomeStatementData', data: data.incomeStatementData || [] },
                  { name: 'independentCashFlowData', data: data.independentCashFlowData || [] },
                  { name: 'balanceSheetData', data: data.balanceSheetData || [] },
                  // US/JP data arrays
                  { name: 'financialData', data: data.financialData || [] },
                  { name: 'cashflowData', data: data.cashflowData || [] },
                  { name: 'performanceData', data: data.performanceData || [] }
                ];
                
                for (const { name, data: dataArray } of dataArrays) {
                  if (Array.isArray(dataArray) && dataArray.length > 0) {
                    console.log(`      ✅ Found ${dataArray.length} records in ${name}`);
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

      console.log(`  📈 Summary: processed ${processedFiles} files, ${validFiles} had data`);
      console.log(`  ✓ Collected ${allData.length} unified data records from crawler outputs`);
      
      if (allData.length === 0 && processedFiles > 0) {
        console.log(`  💡 Note: If no data was collected, the crawler outputs might not contain UnifiedFinancialData format.`);
        console.log(`  💡 Consider using: npm run import:fundamental:tw:quarterly instead`);
      }
      
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
      // 收集所有允許的檔案模式
      const allowedPatterns: string[] = [];
      for (const dataType of this.config.dataTypes) {
        const patterns = getDataTypePatterns(dataType);
        if (patterns.length > 0) {
          allowedPatterns.push(...patterns);
        }
      }
      
      // 如果沒有指定 data-types，預設允許所有
      if (allowedPatterns.length === 0) {
        console.warn('  ⚠️ No valid data types specified, will process all files');
      }
      
      // Debug mode: show patterns being used
      const isDebugMode = process.env.DEBUG_PIPELINE === 'true' || this.config.dataTypes.includes('debug');
      if (isDebugMode && allowedPatterns.length > 0) {
        console.log(`  🔍 Debug: Allowed patterns for ${region}: ${allowedPatterns.join(', ')}`);
      }
      
      // Get all JSON files recursively from config directory
      const configFiles = await this.getJsonFilesRecursively(this.config.configDir);
      
      for (const filePath of configFiles) {
        const fileName = path.basename(filePath);
        
        // 檢查是否為該 region 的檔案
        if (!fileName.startsWith(`yahoo-finance-${region}-`)) continue;
        
        // 如果有 data-types 過濾，檢查是否符合
        if (allowedPatterns.length > 0) {
          const matchesDataType = allowedPatterns.some(pattern => 
            fileName.includes(`-${pattern}-`)
          );
          
          // Debug info for filtering
          if (isDebugMode) {
            console.log(`  🔍 Debug: ${fileName} - Matches data type: ${matchesDataType ? 'Yes' : 'No'}`);
            if (!matchesDataType) {
              console.log(`     Available patterns: ${allowedPatterns.join(', ')}`);
            }
          }
          
          if (!matchesDataType) continue;
        }
        
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

    console.log(`  📁 Found ${files.length} config files matching filters`);
    if (files.length > 0 && this.config.dataTypes.length > 0) {
      console.log(`     Regions: ${this.config.regions.join(', ')}`);
      console.log(`     Data types: ${this.config.dataTypes.join(', ')}`);
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
   * Build fundamental import command based on configuration
   */
  private buildFundamentalImportCommand(): string {
    let command = 'npx tsx scripts/import-fundamental-api.ts';
    
    // 根據 dataTypes 決定 category
    if (this.config.dataTypes.includes('financials')) {
      command += ' --category quarterly';
    } else if (this.config.dataTypes.includes('history')) {
      command += ' --category daily';
    } else if (this.config.dataTypes.includes('metadata')) {
      command += ' --category metadata';
    }
    
    // 根據 regions 決定 market
    if (this.config.regions.length === 1) {
      command += ` --market ${this.config.regions[0]}`;
    }
    
    // 添加 API URL 參數
    if (this.config.apiUrl) {
      command += ` --api-url "${this.config.apiUrl}"`;
    }
    
    // 添加 API token 參數（優先使用 config，其次環境變數）
    const token = this.config.apiToken || process.env.BACKEND_API_TOKEN;
    if (token) {
      command += ` --token "${token}"`;
    }
    
    // 添加 verbose 模式以獲得更多輸出
    command += ' --verbose';
    
    return command;
  }

  /**
   * Import fundamental data using existing batch script
   */
  private async importFundamentalData(data: UnifiedFinancialData[]): Promise<void> {
    try {
      console.log(`  📊 執行基本面資料匯入...`);
      
      // 使用已存在的 import-fundamental-api.ts 腳本
      const importCommand = this.buildFundamentalImportCommand();
      console.log('  💡 執行命令:', importCommand);
      
      const { stdout, stderr } = await execAsync(importCommand, {
        cwd: process.cwd(),
        env: {
          ...process.env,
          // 環境變數作為備份，命令行參數優先
          BACKEND_API_URL: this.config.apiUrl || process.env.BACKEND_API_URL,
          BACKEND_API_TOKEN: this.config.apiToken || process.env.BACKEND_API_TOKEN,
        },
        maxBuffer: 1024 * 1024 * 20, // 20MB buffer for large outputs
        timeout: 300000, // 5 minutes timeout
      });
      
      // 檢查錯誤輸出（warnings 可以忽略）
      if (stderr && !stderr.includes('warning') && !stderr.includes('⚠️')) {
        console.warn(`  ⚠️ Import warnings: ${stderr}`);
      }
      
      // 解析成功結果
      if (stdout.includes('基本面資料匯入作業完成') || stdout.includes('import complete') || stdout.includes('Successfully imported')) {
        console.log('    ✅ 基本面資料匯入腳本執行成功');
        
        // 提取統計資訊
        const importedMatch = stdout.match(/成功匯入.*?(\d+).*?筆|Successfully imported (\d+)|imported (\d+)/i);
        if (importedMatch) {
          const count = importedMatch[1] || importedMatch[2] || importedMatch[3];
          console.log(`    📊 成功匯入: ${count} 筆基本面資料`);
        }
        
        // 提取處理檔案數量
        const filesMatch = stdout.match(/處理檔案.*?(\d+).*?個|processed (\d+) files/i);
        if (filesMatch) {
          const fileCount = filesMatch[1] || filesMatch[2];
          console.log(`    📁 處理檔案: ${fileCount} 個`);
        }
      } else {
        console.log('    ⚠️ 匯入腳本執行完成，請檢查後端日誌');
      }
      
    } catch (error) {
      throw new Error(`Failed to execute fundamental import script: ${(error as Error).message}`);
    }
  }

  /**
   * Import OHLCV historical data using the new import-ohlcv-api.ts script
   */
  private async importOhlcvData(): Promise<void> {
    try {
      console.log('  📈 檢查歷史數據檔案...');
      
      // Check if there are any history files to import
      const historyFiles = await this.findHistoryFiles();
      
      if (historyFiles.length === 0) {
        console.log('  📄 沒有找到歷史數據檔案，跳過 OHLCV 匯入');
        return;
      }
      
      console.log(`  📊 找到 ${historyFiles.length} 個歷史數據檔案`);
      console.log('  🚀 開始執行 OHLCV 匯入腳本...');
      
      // Construct the import command
      let importCommand = 'npx tsx scripts/import-ohlcv-api.ts --category daily';
      
      // 根據 regions 配置添加 market 參數
      if (this.config.regions.length === 1) {
        const marketMap: Record<string, string> = {
          'tw': 'tw',
          'us': 'us', 
          'jp': 'jp'
        };
        const market = marketMap[this.config.regions[0]];
        if (market) {
          importCommand += ` --market ${market}`;
          console.log(`  🎯 Restricting OHLCV import to market: ${market}`);
        }
      } else if (this.config.regions.length > 1) {
        console.log(`  📊 Multiple regions specified (${this.config.regions.join(', ')}), importing all OHLCV data`);
      }
      
      // Add API URL and token if available
      if (this.config.apiUrl) {
        importCommand += ` --api-url "${this.config.apiUrl}"`;
      }
      if (this.config.apiToken) {
        importCommand += ` --token "${this.config.apiToken}"`;
      }
      
      console.log('  💡 執行命令:', importCommand);
      
      // Execute the import script
      const { stdout, stderr } = await execAsync(importCommand, { 
        cwd: process.cwd(),
        maxBuffer: 1024 * 1024 * 10 // 10MB buffer for large outputs
      });

      // Check for errors in stderr (warnings are OK)
      if (stderr && !stderr.includes('warning') && !stderr.includes('⚠️')) {
        throw new Error(`OHLCV import script failed: ${stderr}`);
      }

      // Parse success results from stdout
      if (stdout.includes('OHLCV 歷史數據匯入作業完成')) {
        console.log('    ✅ OHLCV 匯入腳本執行成功');
        
        // Extract statistics if available
        const importedMatch = stdout.match(/總計匯入: (\d+) 筆/);
        const failedMatch = stdout.match(/總計失敗: (\d+) 筆/);
        const filesMatch = stdout.match(/處理檔案: (\d+) 個/);
        
        if (importedMatch) {
          console.log(`    📊 成功匯入: ${importedMatch[1]} 筆 OHLCV 數據`);
        }
        if (failedMatch && parseInt(failedMatch[1]) > 0) {
          console.log(`    ⚠️ 失敗記錄: ${failedMatch[1]} 筆`);
        }
        if (filesMatch) {
          console.log(`    📁 處理檔案: ${filesMatch[1]} 個`);
        }
        
      } else {
        console.log('    ⚠️ 腳本執行完成，請檢查輸出');
        console.log('    💡 詳細輸出:');
        console.log(stdout.split('\n').map(line => `    ${line}`).join('\n'));
      }

    } catch (error) {
      throw new Error(`Failed to execute OHLCV import script: ${(error as Error).message}`);
    }
  }

  /**
   * Find history files in the output directory
   */
  private async findHistoryFiles(): Promise<string[]> {
    const historyPatterns = [
      path.join(this.config.outputDir, 'daily', '**', 'history', '*.json'),
      path.join(this.config.outputDir, 'daily', '**', '*.json') // Alternative pattern
    ];
    
    let allFiles: string[] = [];
    
    for (const pattern of historyPatterns) {
      try {
        const files = await new Promise<string[]>((resolve, reject) => {
          // Using glob to find files
          const glob = require('glob');
          glob.glob(pattern, (err: any, matches: string[]) => {
            if (err) reject(err);
            else resolve(matches || []);
          });
        });
        allFiles = allFiles.concat(files);
      } catch (error) {
        // Ignore errors in file scanning
        console.log(`    📄 掃描模式 ${pattern} 無結果`);
      }
    }
    
    // Remove duplicates and filter for actual JSON files
    const uniqueFiles = [...new Set(allFiles)].filter(file => {
      try {
        return fs.existsSync(file) && file.endsWith('.json');
      } catch {
        return false;
      }
    });
    
    return uniqueFiles;
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
    if (record.exchangeArea === MarketRegion.TPE) {
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
  private extractRegionFromConfig(configPath: string): MarketRegion {
    // 從檔案路徑提取 region
    if (configPath.includes('/tw/')) return MarketRegion.TPE;
    if (configPath.includes('/us/')) return MarketRegion.US;
    if (configPath.includes('/jp/')) return MarketRegion.JP;
    
    // 從檔名提取
    const filename = path.basename(configPath);
    const match = filename.match(/yahoo-finance-(\w+)-/);
    if (match) {
      const region = match[1].toUpperCase();
      switch (region) {
        case 'TW': return MarketRegion.TPE;
        case 'US': return MarketRegion.US;
        case 'JP': return MarketRegion.JP;
      }
    }
    
    throw new Error(`Cannot extract region from config file: ${configPath}`);
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