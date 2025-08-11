import * as path from 'path';
import * as fs from 'fs-extra';
import { exec } from 'child_process';
import { promisify } from 'util';
import { OutputFileManager } from './OutputFileManager.js';
import { UnifiedFinancialData } from '../types/unified-financial-data.js';

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
  skipDatabaseImport?: boolean;
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
  // private importer: DatabaseImporter;
  private progressCallback?: (progress: CrawlerProgress) => void;

  constructor(config: PipelineConfig = {}) {
    this.config = {
      dataDir: config.dataDir || 'data',
      configDir: config.configDir || 'config',
      outputDir: config.outputDir || 'output',
      scriptsDir: config.scriptsDir || 'scripts',
      batchSize: config.batchSize || 100,
      maxConcurrent: config.maxConcurrent || 1,
      regions: config.regions || ['tw', 'us', 'jp'],
      symbolCodes: config.symbolCodes || [],
      skipConfigGeneration: config.skipConfigGeneration || false,
      skipCrawling: config.skipCrawling || false,
      skipAggregation: config.skipAggregation || false,
      skipDatabaseImport: config.skipDatabaseImport || true, // Default to skip now
    };

    this.fileManager = new OutputFileManager(this.config.outputDir);
    // this.importer = new DatabaseImporter();
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

      // Step 4: API Import (Manual)
      if (!this.config.skipDatabaseImport && unifiedData.length > 0) {
        console.log('\n💾 Step 4: Data ready for API import');
        console.log('  ℹ️  Use the following command to import to backend:');
        console.log('     npm run import:fundamental:batch');
        console.log('  📁 Output files are ready in ./output/ directory');
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
          `generate-yahoo-${region}-configs.js`
        );

        if (await fs.pathExists(scriptPath)) {
          console.log(`  Generating ${region.toUpperCase()} configurations...`);
          
          // Execute generation script
          const { stdout, stderr } = await execAsync(`node ${scriptPath}`);
          
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
   * Collect all crawled UnifiedFinancialData directly from output files
   */
  private async collectUnifiedData(): Promise<UnifiedFinancialData[]> {
    const allData: UnifiedFinancialData[] = [];
    
    try {
      // Get all output files  
      const outputFiles = await fs.readdir(this.config.outputDir);
      
      for (const file of outputFiles) {
        if (file.endsWith('.json') && file.includes('yahoo-finance-tw')) {
          const filePath = path.join(this.config.outputDir, file);
          
          try {
            const fileData = await fs.readJson(filePath);
            const results = fileData.results || [];
            
            for (const result of results) {
              if (result.data) {
                // Extract different data types from Taiwan crawler output
                const data = result.data;
                
                // Extract all UnifiedFinancialData arrays
                const dataArrays = [
                  data.revenueData || [],
                  data.simpleEPSData || [],
                  data.dividendData || [],
                  data.incomeStatementData || [],
                  data.independentCashFlowData || [],
                  data.balanceSheetData || []
                ];
                
                for (const dataArray of dataArrays) {
                  if (Array.isArray(dataArray)) {
                    allData.push(...dataArray);
                  }
                }
              }
            }
          } catch (error) {
            console.warn(`  ⚠️ Failed to process file ${file}: ${(error as Error).message}`);
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
   * Get all config files to process
   */
  private async getConfigFiles(): Promise<string[]> {
    const files: string[] = [];
    
    for (const region of this.config.regions) {
      const pattern = new RegExp(`^yahoo-finance-${region}-.*\\.json$`);
      const configFiles = await fs.readdir(this.config.configDir);
      
      for (const file of configFiles) {
        if (pattern.test(file)) {
          // Apply symbol filter if specified - 精確匹配
          if (this.config.symbolCodes.length > 0) {
            const hasSymbol = this.config.symbolCodes.some(symbol => {
              const normalizedSymbol = symbol.replace('.', '_');
              // 從檔名中提取符號部分進行精確比較
              const symbolMatch = file.match(/yahoo-finance-\w+-[\w-]+-([A-Z0-9_]+)\.json/);
              return symbolMatch && symbolMatch[1] === normalizedSymbol;
            });
            if (!hasSymbol) continue;
          }
          
          files.push(path.join(this.config.configDir, file));
        }
      }
    }

    return files;
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
}