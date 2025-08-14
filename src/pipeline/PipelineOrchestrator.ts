import * as path from 'path';
import * as fs from 'fs-extra';
import { exec } from 'child_process';
import { promisify } from 'util';
import { OutputFileManager } from './OutputFileManager.js';
import { UnifiedFinancialData } from '../types/unified-financial-data.js';
import { ApiClient, createApiClient } from '../common/api-client.js';

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
  skipConfigGeneration?: boolean;
  skipCrawling?: boolean;
  skipAggregation?: boolean;
  skipSymbolImport?: boolean;
  skipFundamentalImport?: boolean;
  skipLabelSync?: boolean;
  apiUrl?: string;
  apiToken?: string;
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
  private apiClient: ApiClient;
  private progressCallback?: (progress: CrawlerProgress) => void;

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
      skipConfigGeneration: config.skipConfigGeneration || false,
      skipCrawling: config.skipCrawling || false,
      skipAggregation: config.skipAggregation || false,
      skipSymbolImport: config.skipSymbolImport || false,
      skipFundamentalImport: config.skipFundamentalImport || false,
      skipLabelSync: config.skipLabelSync || false,
      apiUrl: config.apiUrl || process.env.BACKEND_API_URL || 'http://localhost:3000',
      apiToken: config.apiToken || process.env.BACKEND_API_TOKEN || '',
    };

    this.fileManager = new OutputFileManager(this.config.outputDir, true); // Use structured layout
    this.apiClient = createApiClient({
      apiUrl: this.config.apiUrl,
      apiToken: this.config.apiToken,
    });
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
    };

    try {
      console.log('🚀 Starting crawler pipeline...');

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
      try {
        const scriptPath = path.join(
          this.config.scriptsDir,
          `generate-yahoo-${region}-configs.ts`
        );

        if (await fs.pathExists(scriptPath)) {
          console.log(`  Generating ${region.toUpperCase()} configurations...`);
          
          // Execute generation script with tsx
          const { stdout, stderr } = await execAsync(`npx tsx ${scriptPath}`);
          
          if (stderr) {
            result.errors.push(`${region} generation warning: ${stderr}`);
          }

          // Parse output to count generated configs
          const matches = stdout.match(/(\d+) 個配置文件/g);
          if (matches) {
            for (const match of matches) {
              const count = parseInt(match.match(/\d+/)?.[0] || '0');
              result.totalGenerated += count;
            }
          }

          // Count unique symbols from data file
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
        } else {
          result.errors.push(`Script not found: ${scriptPath}`);
        }
      } catch (error) {
        result.errors.push(`Error generating ${region} configs: ${(error as Error).message}`);
      }
    }

    console.log(`  ✓ Generated ${result.totalGenerated} configurations for ${result.uniqueSymbols.size} symbols`);
    return {
      ...result,
      uniqueSymbols: result.uniqueSymbols.size,
    };
  }

  /**
   * Execute crawlers sequentially for all configurations
   */
  private async executeCrawlers(): Promise<{
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

            result.successful++;
            progress.status = 'completed';
          } catch (error) {
            result.failed++;
            result.errors.push(
              `Failed to crawl ${path.basename(configFile)}: ${(error as Error).message}`
            );
            progress.status = 'failed';
          }

          if (this.progressCallback) {
            this.progressCallback(progress);
          }
        })
      );
    }

    console.log(`  ✓ Crawling complete: ${result.successful} successful, ${result.failed} failed`);
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
   * Print pipeline execution summary
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
    console.log(`Data Aggregated:      ${result.totalDataAggregated} records`);
    
    console.log('\n💡 Next Steps:');
    console.log('  - Run: npm run import:fundamental:batch');
    console.log('  - Or import specific regions: npm run import:fundamental:us');
    
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
   * Import symbols from category mappings
   */
  private async importSymbolsFromMappings(): Promise<void> {
    const { readFileSync, existsSync } = await import('fs');
    
    // Try new metadata location first, fallback to data directory
    let mappingFile = path.join(this.config.outputDir, 'metadata', 'category-symbol-mappings.json');
    
    if (!existsSync(mappingFile)) {
      mappingFile = path.join(this.config.dataDir, 'category-symbol-mappings.json');
      
      if (!existsSync(mappingFile)) {
        throw new Error(`找不到映射檔案，嘗試了:\n  - output/metadata/category-symbol-mappings.json\n  - data/category-symbol-mappings.json`);
      }
    }

    const fileContent = JSON.parse(readFileSync(mappingFile, 'utf-8'));
    const mappings = fileContent.categoryMappings || fileContent;

    // 轉換為股票資料
    const symbolsMap = new Map<string, any>();
    
    for (const [market, categories] of Object.entries(mappings)) {
      if (!categories || !Array.isArray(categories)) continue;
      
      for (const category of categories as any[]) {
        for (const symbol of category.symbols) {
          const key = `${symbol.symbolCode}_${market}`;
          
          if (!symbolsMap.has(key)) {
            symbolsMap.set(key, {
              symbolCode: this.cleanSymbolCode(symbol.symbolCode, market),
              name: symbol.name,
              exchangeArea: this.mapMarketToExchangeArea(market),
              assetType: 'EQUITY',
              regionalData: {
                originalSymbolCode: symbol.symbolCode,
                category: category.category,
                categoryId: category.categoryId,
                market: market,
              }
            });
          }
        }
      }
    }

    const symbols = Array.from(symbolsMap.values());
    console.log(`  📊 準備匯入 ${symbols.length} 個股票代碼`);

    // 批量匯入
    await this.apiClient.importSymbols(symbols, (current, total, message) => {
      console.log(`    ${message}`);
    });
  }

  /**
   * Import fundamental data using existing output files
   */
  private async importFundamentalData(data: UnifiedFinancialData[]): Promise<void> {
    console.log(`  📊 準備匯入 ${data.length} 筆基本面資料`);
    
    // 轉換資料格式為後端 API 預期格式
    const convertedData = data.map(record => this.convertToApiFormat(record));
    
    // 批量匯入
    await this.apiClient.importFundamental(convertedData, (current, total, message) => {
      console.log(`    ${message}`);
    });
  }

  /**
   * Sync category labels
   */
  private async syncCategoryLabels(): Promise<void> {
    const { readFileSync, existsSync } = await import('fs');
    
    // Try new metadata location first, fallback to data directory
    let mappingFile = path.join(this.config.outputDir, 'metadata', 'category-symbol-mappings.json');
    
    if (!existsSync(mappingFile)) {
      mappingFile = path.join(this.config.dataDir, 'category-symbol-mappings.json');
      
      if (!existsSync(mappingFile)) {
        throw new Error(`找不到映射檔案，嘗試了:\n  - output/metadata/category-symbol-mappings.json\n  - data/category-symbol-mappings.json`);
      }
    }

    const fileContent = JSON.parse(readFileSync(mappingFile, 'utf-8'));
    const mappings = fileContent.categoryMappings || fileContent;

    console.log(`  📊 準備同步標籤映射`);
    
    // 使用現有的標籤同步邏輯
    const result = await this.apiClient.syncLabels(mappings, {
      strategy: 'merge',
      createMissingSymbols: false,
      updateExistingRelations: true,
    });

    if (result.success) {
      console.log(`    ✅ 同步成功: ${result.data?.labelsCreated || 0} 標籤, ${result.data?.relationsCreated || 0} 關係`);
    } else {
      throw new Error(`標籤同步失敗: ${result.message}`);
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
}