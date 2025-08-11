#!/usr/bin/env tsx
/**
 * 股票代碼匯入腳本
 * 從 category-symbol-mappings.json 讀取股票資料並匯入到後端資料庫
 * 
 * 功能：
 * - 支援批量匯入股票代碼
 * - 支援 dry-run 模式預覽
 * - 支援市場過濾 (TPE, US, JP)
 * - 與後端 /symbols/bulk-create API 整合
 * 
 * 使用方式：
 * npx tsx scripts/import-symbols.ts
 * npx tsx scripts/import-symbols.ts --dry-run
 * npx tsx scripts/import-symbols.ts --market=TPE
 * npx tsx scripts/import-symbols.ts --api-url http://localhost:3000
 */

import 'dotenv/config';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { program } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { ApiClient, createApiClient } from '../src/common/api-client';

const __dirname = process.cwd();

// 類型定義
interface SymbolData {
  symbolCode: string;
  name: string;
}

interface CategoryMapping {
  category: string;
  categoryId: string;
  symbols: SymbolData[];
}

interface CategoryMappings {
  TPE?: CategoryMapping[];
  JP?: CategoryMapping[];
  US?: CategoryMapping[];
}

interface ImportConfig {
  apiUrl: string;
  apiToken?: string;
  isDryRun: boolean;
  market?: string;
  batchSize: number;
}

/**
 * 股票代碼匯入器
 */
class SymbolImporter {
  private apiClient: ApiClient;
  private config: ImportConfig;
  private spinner: any;

  constructor(config: ImportConfig) {
    this.config = config;
    this.apiClient = createApiClient({
      apiUrl: config.apiUrl,
      apiToken: config.apiToken,
    });
  }

  /**
   * 執行匯入
   */
  async import(): Promise<void> {
    try {
      console.log(chalk.blue('\n📈 股票代碼匯入器'));
      console.log(chalk.gray('─'.repeat(50)));
      console.log(`API URL: ${this.config.apiUrl}`);
      console.log(`模式: ${this.config.isDryRun ? chalk.yellow('DRY RUN') : chalk.green('LIVE')}`);
      console.log(`批次大小: ${this.config.batchSize}`);
      if (this.config.market) {
        console.log(`市場過濾: ${this.config.market}`);
      }

      // 1. 讀取映射資料
      this.spinner = ora('讀取 category-symbol-mappings.json...').start();
      const mappings = this.loadCategoryMappings();
      this.spinner.succeed('映射資料讀取完成');

      // 2. 轉換為股票資料
      const symbols = this.extractSymbols(mappings);
      console.log(chalk.cyan(`\n📊 股票統計:`));
      this.printSymbolStats(symbols);

      if (this.config.isDryRun) {
        console.log(chalk.yellow('\n🔍 DRY RUN 模式 - 不會進行實際匯入'));
        this.previewSymbols(symbols);
        return;
      }

      // 3. 批量匯入股票代碼
      await this.batchImportSymbols(symbols);

      console.log(chalk.green('\n✅ 股票代碼匯入完成！'));

    } catch (error) {
      if (this.spinner) {
        this.spinner.fail('匯入失敗');
      }
      console.error(chalk.red('\n❌ 匯入失敗:'));
      console.error(chalk.red((error as Error).message));
      throw error;
    }
  }

  /**
   * 讀取類別映射資料
   */
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

  /**
   * 從映射資料中提取股票資料
   */
  private extractSymbols(mappings: CategoryMappings): Map<string, any> {
    const symbolsMap = new Map<string, any>();

    for (const [market, categories] of Object.entries(mappings)) {
      // 市場過濾
      if (this.config.market && market !== this.config.market) {
        continue;
      }

      if (!categories || !Array.isArray(categories)) {
        continue;
      }

      for (const category of categories) {
        for (const symbol of category.symbols) {
          const key = `${symbol.symbolCode}_${market}`;
          
          // 避免重複
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

    return symbolsMap;
  }

  /**
   * 清理股票代碼
   */
  private cleanSymbolCode(symbolCode: string, market: string): string {
    // 只清理台灣股票的後綴
    if (market === 'TPE') {
      return symbolCode.replace(/\.TW[O]?$/, '');
    }
    
    // 日本和美國股票保持原始格式
    return symbolCode;
  }

  /**
   * 映射市場代碼到交易所區域
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
   * 顯示股票統計
   */
  private printSymbolStats(symbols: Map<string, any>): void {
    const statsByMarket = new Map<string, number>();
    
    for (const symbol of symbols.values()) {
      const market = symbol.regionalData.market;
      statsByMarket.set(market, (statsByMarket.get(market) || 0) + 1);
    }

    for (const [market, count] of statsByMarket) {
      const flag = this.getMarketFlag(market);
      console.log(`  ${flag} ${market}: ${chalk.yellow(count)} 個股票`);
    }

    console.log(chalk.green(`\n✅ 總計: ${chalk.yellow(symbols.size)} 個股票`));
  }

  /**
   * 預覽股票資料（dry-run 模式）
   */
  private previewSymbols(symbols: Map<string, any>): void {
    console.log(chalk.cyan('\n📋 股票預覽 (前 10 筆):'));
    console.log(chalk.gray('─'.repeat(70)));

    let count = 0;
    for (const [key, symbol] of symbols) {
      if (count >= 10) break;
      
      const flag = this.getMarketFlag(symbol.regionalData.market);
      console.log(`${count + 1}. ${flag} ${symbol.symbolCode} - ${symbol.name}`);
      console.log(`   交易所: ${symbol.exchangeArea}, 分類: ${symbol.regionalData.category}`);
      count++;
    }

    if (symbols.size > 10) {
      console.log(chalk.gray(`   ... 以及其他 ${symbols.size - 10} 個股票`));
    }
  }

  /**
   * 批量匯入股票代碼
   */
  private async batchImportSymbols(symbols: Map<string, any>): Promise<void> {
    const symbolsArray = Array.from(symbols.values());
    const totalBatches = Math.ceil(symbolsArray.length / this.config.batchSize);

    console.log(chalk.cyan(`\n🚀 開始批量匯入 (${totalBatches} 個批次)`));

    let successCount = 0;
    let failureCount = 0;
    const errors: string[] = [];

    for (let i = 0; i < symbolsArray.length; i += this.config.batchSize) {
      const batch = symbolsArray.slice(i, i + this.config.batchSize);
      const batchNum = Math.floor(i / this.config.batchSize) + 1;

      this.spinner = ora(`處理批次 ${batchNum}/${totalBatches} (${batch.length} 個股票)...`).start();

      try {
        const result = await this.apiClient.importSymbols(batch, (current, total, message) => {
          this.spinner.text = `批次 ${batchNum}/${totalBatches}: ${message}`;
        });

        if (result.success) {
          successCount += batch.length;
          this.spinner.succeed(`批次 ${batchNum}/${totalBatches} 完成 (${batch.length} 個股票)`);
        } else {
          failureCount += batch.length;
          this.spinner.fail(`批次 ${batchNum}/${totalBatches} 失敗`);
          if (result.errors) {
            errors.push(...result.errors);
          }
        }
      } catch (error) {
        failureCount += batch.length;
        const errorMsg = `批次 ${batchNum} 失敗: ${(error as Error).message}`;
        errors.push(errorMsg);
        this.spinner.fail(errorMsg);
      }

      // 批次間延遲，避免對後端造成過大壓力
      if (i + this.config.batchSize < symbolsArray.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    // 顯示匯入結果
    console.log(chalk.blue('\n📊 匯入結果統計:'));
    console.log(chalk.gray('─'.repeat(30)));
    console.log(chalk.green(`✅ 成功: ${successCount} 個股票`));
    
    if (failureCount > 0) {
      console.log(chalk.red(`❌ 失敗: ${failureCount} 個股票`));
      
      if (errors.length > 0) {
        console.log(chalk.red('\n錯誤詳情:'));
        errors.slice(0, 5).forEach(error => {
          console.log(chalk.red(`  • ${error}`));
        });
        
        if (errors.length > 5) {
          console.log(chalk.red(`  • ... 以及其他 ${errors.length - 5} 個錯誤`));
        }
      }
    }
  }

  /**
   * 獲取市場旗幟
   */
  private getMarketFlag(market: string): string {
    const flags: Record<string, string> = {
      TPE: '🇹🇼',
      US: '🇺🇸',
      JP: '🇯🇵',
    };
    return flags[market] || '🌐';
  }
}

// CLI 設置
program
  .name('import-symbols')
  .description('匯入股票代碼到後端資料庫')
  .option('--dry-run', '預覽模式，不執行實際匯入', false)
  .option('--market <market>', '指定市場 (TPE, US, JP)')
  .option('--api-url <url>', '後端 API URL', process.env.BACKEND_API_URL || 'http://localhost:3000')
  .option('--api-token <token>', 'API 認證 token', process.env.BACKEND_API_TOKEN)
  .option('--batch-size <size>', '批次大小', '30')
  .parse();

const options = program.opts();

// 主執行函數
async function main() {
  // 優先使用環境變數中的 token
  let apiToken = process.env.BACKEND_API_TOKEN || options.apiToken;
  
  console.log(chalk.blue('🔐 API Token 狀態檢查:'));
  if (apiToken) {
    console.log(chalk.green(`  ✅ 找到 API Token: ${apiToken.substring(0, 20)}...`));
  } else {
    console.log(chalk.yellow('  ⚠️  沒有找到 API Token，將嘗試自動登入'));
  }
  
  // 只有在完全沒有 token 時才嘗試自動登入
  if (!apiToken && options.apiUrl.includes('localhost')) {
    try {
      console.log(chalk.yellow('🔄 嘗試自動登入...'));
      const axios = require('axios');
      const loginResponse = await axios.post(`${options.apiUrl}/auth/auto-login`, {
        email: 'aryung@gmail.com',
        name: 'Test User',
      });
      apiToken = loginResponse.data.accessToken;
      console.log(chalk.green('✅ 自動登入成功'));
    } catch (error) {
      console.log(chalk.red('❌ 自動登入失敗，將嘗試無認證請求'));
      console.log(chalk.gray(`   錯誤: ${(error as any).message}`));
    }
  }
  
  // 驗證 API 連接（如果有 token）
  if (apiToken) {
    try {
      console.log(chalk.blue('🔍 驗證 API 連接...'));
      const axios = require('axios');
      const testResponse = await axios.get(`${options.apiUrl}/auth/profile`, {
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
  
  const config: ImportConfig = {
    apiUrl: options.apiUrl,
    apiToken: apiToken,
    isDryRun: options.dryRun,
    market: options.market,
    batchSize: parseInt(options.batchSize) || 30,
  };

  const importer = new SymbolImporter(config);

  try {
    await importer.import();
    console.log(chalk.green('\n🎉 股票代碼匯入程序執行完成！'));
    process.exit(0);
  } catch (error: any) {
    console.error(chalk.red('\n💥 執行失敗！'));
    
    // 提供詳細的錯誤資訊
    if (error.response) {
      console.error(chalk.red(`HTTP ${error.response.status}: ${error.response.statusText}`));
      if (error.response.status === 413) {
        console.error(chalk.yellow('\n💡 建議: 資料量太大，請減少批次大小'));
        console.error(chalk.yellow('   可嘗試: --batch-size=20 或 --batch-size=10'));
      } else if (error.response.status === 404) {
        console.error(chalk.yellow('\n💡 建議: API 端點不存在'));
        console.error(chalk.yellow('   請確認後端是否支援 /symbols/bulk-create 或 /symbols/bulk 端點'));
      }
    } else {
      console.error(error);
    }
    
    process.exit(1);
  }
}

// 直接執行時啟動
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { SymbolImporter };