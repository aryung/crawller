#!/usr/bin/env tsx
/**
 * 爬蟲統計分析工具
 * 分析 TW/US/JP 三個市場的爬取結果統計
 */

import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import { glob } from 'glob';

interface MarketStats {
  market: string;
  categories: {
    [key: string]: {
      count: number;
      files: string[];
    };
  };
  total: number;
  expectedPerCategory: number;
  actualPerCategory: { [key: string]: number };
  successRate: number;
}

interface ErrorStats {
  total: number;
  byType: {
    [key: string]: number;
  };
  byMarket: {
    [key: string]: number;
  };
  byCategory: {
    [key: string]: number;
  };
}

class CrawlStatistics {
  private outputDir = path.join(process.cwd(), 'output');
  private errorLogPath = path.join(this.outputDir, 'errors.log');

  async analyzeMarket(market: 'tw' | 'us' | 'jp'): Promise<MarketStats> {
    console.log(chalk.cyan(`\n📊 分析 ${market.toUpperCase()} 市場數據...`));
    
    const quarterlyPath = path.join(this.outputDir, 'quarterly', market);
    const stats: MarketStats = {
      market: market.toUpperCase(),
      categories: {},
      total: 0,
      expectedPerCategory: 0,
      actualPerCategory: {},
      successRate: 0
    };

    // 檢查目錄是否存在
    if (!fs.existsSync(quarterlyPath)) {
      console.log(chalk.yellow(`  目錄不存在: ${quarterlyPath}`));
      return stats;
    }

    // 讀取實際的子目錄作為類別
    const categoryDirs = fs.readdirSync(quarterlyPath, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);

    console.log(chalk.gray(`  發現類別: ${categoryDirs.join(', ')}`));

    // 分析每個類別目錄
    for (const category of categoryDirs) {
      const categoryPath = path.join(quarterlyPath, category);
      try {
        const files = fs.readdirSync(categoryPath)
          .filter(file => file.endsWith('.json'));
        
        stats.categories[category] = {
          count: files.length,
          files: files.slice(0, 5) // 只保留前5個作為樣例
        };
        stats.actualPerCategory[category] = files.length;
        stats.total += files.length;
      } catch (error) {
        console.log(chalk.red(`  讀取 ${category} 目錄錯誤:`, error));
        stats.categories[category] = { count: 0, files: [] };
      }
    }

    // 計算預期數量（基於股票代碼檔案）
    const stockCodesPath = path.join(this.outputDir, `yahoo-${market}-sectors`);
    stats.expectedPerCategory = await this.getExpectedCount(stockCodesPath);
    
    // 計算成功率
    const expectedTotal = stats.expectedPerCategory * Object.keys(stats.categories).length;
    stats.successRate = expectedTotal > 0 ? (stats.total / expectedTotal) * 100 : 0;

    return stats;
  }

  private async getCategoriesForMarket(market: string): Promise<string[]> {
    const categoryMap: { [key: string]: string[] } = {
      'tw': ['balance-sheet', 'cash-flow-statement', 'income-statement', 'dividend', 'eps', 'history'],
      'us': ['balance-sheet', 'cash-flow-statement', 'income-statement', 'dividend', 'eps', 'financials'],
      'jp': ['balance-sheet', 'cash-flow-statement', 'income-statement', 'dividend', 'eps', 'performance']
    };
    return categoryMap[market] || [];
  }

  private async getExpectedCount(stockCodesPath: string): Promise<number> {
    try {
      // 嘗試讀取股票代碼檔案來獲取預期數量
      const files = await glob(path.join(stockCodesPath, '*.json'));
      if (files.length === 0) return 0;
      
      let totalStocks = 0;
      for (const file of files.slice(0, 3)) { // 取樣前3個檔案
        const content = await fs.promises.readFile(file, 'utf-8');
        const data = JSON.parse(content);
        if (Array.isArray(data)) {
          totalStocks += data.length;
        } else if (data.stocks && Array.isArray(data.stocks)) {
          totalStocks += data.stocks.length;
        }
      }
      
      // 返回平均值作為預期數量
      return files.length > 0 ? Math.round(totalStocks / Math.min(files.length, 3)) : 0;
    } catch (error) {
      return 0;
    }
  }

  async analyzeErrors(): Promise<ErrorStats> {
    console.log(chalk.cyan('\n🔍 分析錯誤日誌...'));
    
    const stats: ErrorStats = {
      total: 0,
      byType: {},
      byMarket: {},
      byCategory: {}
    };

    if (!fs.existsSync(this.errorLogPath)) {
      console.log(chalk.yellow('未找到錯誤日誌檔案'));
      return stats;
    }

    const content = await fs.promises.readFile(this.errorLogPath, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim());
    
    stats.total = lines.length;
    
    for (const line of lines) {
      // 分析錯誤類型
      if (line.includes('Network error')) {
        stats.byType['Network'] = (stats.byType['Network'] || 0) + 1;
      } else if (line.includes('Timeout')) {
        stats.byType['Timeout'] = (stats.byType['Timeout'] || 0) + 1;
      } else if (line.includes('Empty data')) {
        stats.byType['Empty Data'] = (stats.byType['Empty Data'] || 0) + 1;
      } else {
        stats.byType['Other'] = (stats.byType['Other'] || 0) + 1;
      }

      // 分析市場
      const markets = ['tw', 'us', 'jp'];
      for (const market of markets) {
        if (line.toLowerCase().includes(`-${market}-`)) {
          stats.byMarket[market.toUpperCase()] = (stats.byMarket[market.toUpperCase()] || 0) + 1;
          break;
        }
      }

      // 分析類別
      const categories = ['balance-sheet', 'cash-flow', 'income', 'dividend', 'eps', 'history', 'financials', 'performance'];
      for (const category of categories) {
        if (line.toLowerCase().includes(category)) {
          stats.byCategory[category] = (stats.byCategory[category] || 0) + 1;
          break;
        }
      }
    }

    return stats;
  }

  generateRetryCommands(stats: { tw: MarketStats; us: MarketStats; jp: MarketStats }, errors: ErrorStats): string[] {
    const commands: string[] = [];
    
    // 生成重試命令基於成功率
    for (const market of ['tw', 'us', 'jp'] as const) {
      const marketStats = stats[market];
      
      // 針對失敗率高的類別生成重試命令
      for (const [category, data] of Object.entries(marketStats.categories)) {
        const expectedCount = marketStats.expectedPerCategory;
        const actualCount = data.count;
        const failureRate = expectedCount > 0 ? ((expectedCount - actualCount) / expectedCount) * 100 : 0;
        
        if (failureRate > 10) { // 失敗率超過10%需要重試
          commands.push(`npm run crawl:${market}:quarterly -- --retry-failed --type=${category}`);
        }
      }
    }

    // 基於錯誤類型生成特定重試策略
    if (errors.byType['Timeout'] > 50) {
      commands.push('# 大量超時錯誤，建議增加超時時間:');
      commands.push('npm run crawl:quarterly -- --timeout=120000 --retry-failed');
    }

    if (errors.byType['Network'] > 100) {
      commands.push('# 大量網路錯誤，建議降低並發數:');
      commands.push('npm run crawl:quarterly -- --concurrent=1 --delay=5000 --retry-failed');
    }

    return commands;
  }

  async printReport() {
    const startTime = Date.now();
    
    // 收集三個市場的統計
    const stats = {
      tw: await this.analyzeMarket('tw'),
      us: await this.analyzeMarket('us'),
      jp: await this.analyzeMarket('jp')
    };
    
    // 分析錯誤
    const errors = await this.analyzeErrors();
    
    // 打印報告
    console.log(chalk.bold.green('\n' + '='.repeat(80)));
    console.log(chalk.bold.green('📈 爬蟲統計報告'));
    console.log(chalk.bold.green('='.repeat(80)));
    
    // 市場統計表格
    console.log(chalk.bold.cyan('\n📊 市場數據統計:'));
    console.log(chalk.gray('-'.repeat(80)));
    
    const markets = ['tw', 'us', 'jp'] as const;
    for (const market of markets) {
      const marketStats = stats[market];
      console.log(chalk.bold.yellow(`\n${market.toUpperCase()} 市場:`));
      console.log(`  總檔案數: ${chalk.green(marketStats.total)}`);
      console.log(`  預期每類別: ${chalk.yellow(marketStats.expectedPerCategory || '未知')}`);
      console.log(`  成功率: ${chalk[marketStats.successRate > 80 ? 'green' : marketStats.successRate > 50 ? 'yellow' : 'red'](marketStats.successRate.toFixed(1) + '%')}`);
      console.log('  類別分布:');
      
      for (const [category, data] of Object.entries(marketStats.categories)) {
        const status = data.count > 0 ? '✅' : '❌';
        const color = data.count > 500 ? 'green' : data.count > 100 ? 'yellow' : 'red';
        console.log(`    ${status} ${category}: ${chalk[color](data.count)} 檔案`);
      }
    }
    
    // 錯誤統計
    if (errors.total > 0) {
      console.log(chalk.bold.red('\n⚠️ 錯誤統計:'));
      console.log(chalk.gray('-'.repeat(80)));
      console.log(`  總錯誤數: ${chalk.red(errors.total)}`);
      
      if (Object.keys(errors.byType).length > 0) {
        console.log('  按類型:');
        for (const [type, count] of Object.entries(errors.byType)) {
          const percentage = ((count / errors.total) * 100).toFixed(1);
          console.log(`    - ${type}: ${chalk.yellow(count)} (${percentage}%)`);
        }
      }
      
      if (Object.keys(errors.byMarket).length > 0) {
        console.log('  按市場:');
        for (const [market, count] of Object.entries(errors.byMarket)) {
          const percentage = ((count / errors.total) * 100).toFixed(1);
          console.log(`    - ${market}: ${chalk.yellow(count)} (${percentage}%)`);
        }
      }
    }
    
    // 總結
    console.log(chalk.bold.cyan('\n📊 總體統計:'));
    console.log(chalk.gray('-'.repeat(80)));
    const totalFiles = stats.tw.total + stats.us.total + stats.jp.total;
    const avgSuccessRate = (stats.tw.successRate + stats.us.successRate + stats.jp.successRate) / 3;
    
    console.log(`  總檔案數: ${chalk.bold.green(totalFiles)}`);
    console.log(`  總錯誤數: ${chalk.bold.red(errors.total)}`);
    console.log(`  平均成功率: ${chalk.bold[avgSuccessRate > 80 ? 'green' : avgSuccessRate > 50 ? 'yellow' : 'red'](avgSuccessRate.toFixed(1) + '%')}`);
    
    // 建議的重試命令
    const retryCommands = this.generateRetryCommands(stats, errors);
    if (retryCommands.length > 0) {
      console.log(chalk.bold.yellow('\n🔄 建議的重試命令:'));
      console.log(chalk.gray('-'.repeat(80)));
      for (const command of retryCommands) {
        if (command.startsWith('#')) {
          console.log(chalk.gray(command));
        } else {
          console.log(chalk.cyan(`  ${command}`));
        }
      }
    }
    
    // 執行時間
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(chalk.gray(`\n⏱️ 分析耗時: ${duration} 秒`));
    console.log(chalk.bold.green('='.repeat(80)));
    
    // 進度檢查
    await this.checkOngoingProgress();
  }

  async checkOngoingProgress() {
    const progressDir = path.join(process.cwd(), '.progress');
    if (fs.existsSync(progressDir)) {
      const files = await glob(path.join(progressDir, '*.json'));
      if (files.length > 0) {
        console.log(chalk.bold.yellow('\n⏳ 進行中的批次任務:'));
        console.log(chalk.gray('-'.repeat(80)));
        
        for (const file of files.slice(0, 5)) { // 只顯示前5個
          try {
            const content = await fs.promises.readFile(file, 'utf-8');
            const progress = JSON.parse(content);
            const name = path.basename(file, '.json');
            const percentage = ((progress.completed || 0) / (progress.total || 1) * 100).toFixed(1);
            console.log(`  ${name}: ${chalk.yellow(percentage + '%')} (${progress.completed}/${progress.total})`);
          } catch (error) {
            // 忽略錯誤的進度檔案
          }
        }
        
        if (files.length > 5) {
          console.log(chalk.gray(`  ... 還有 ${files.length - 5} 個進行中的任務`));
        }
        
        console.log(chalk.cyan('\n  查看詳細進度: npm run crawl:status'));
        console.log(chalk.cyan('  恢復批次任務: npm run crawl:resume'));
      }
    }
  }
}

// 命令列參數處理
function parseArguments() {
  const args = process.argv.slice(2);
  const options = {
    market: null as string | null,
    category: null as string | null,
    errorsOnly: false,
    summary: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--market' && i + 1 < args.length) {
      options.market = args[i + 1].toLowerCase();
      i++;
    } else if (arg === '--category' && i + 1 < args.length) {
      options.category = args[i + 1].toLowerCase();
      i++;
    } else if (arg === '--errors-only') {
      options.errorsOnly = true;
    } else if (arg === '--summary') {
      options.summary = true;
    }
  }

  return options;
}

// 主程序
async function main() {
  const options = parseArguments();
  const stats = new CrawlStatistics();

  if (options.errorsOnly) {
    // 只顯示錯誤分析
    const errors = await stats.analyzeErrors();
    console.log(chalk.bold.red('\n⚠️ 錯誤統計報告'));
    console.log(chalk.gray('='.repeat(80)));
    console.log(`總錯誤數: ${chalk.red(errors.total)}`);
    
    if (Object.keys(errors.byType).length > 0) {
      console.log('\n按類型分組:');
      for (const [type, count] of Object.entries(errors.byType)) {
        const percentage = ((count / errors.total) * 100).toFixed(1);
        console.log(`  ${type}: ${chalk.yellow(count)} (${percentage}%)`);
      }
    }
    return;
  }

  if (options.summary) {
    // 簡化摘要
    const tw = await stats.analyzeMarket('tw');
    const us = await stats.analyzeMarket('us');
    const jp = await stats.analyzeMarket('jp');
    const totalFiles = tw.total + us.total + jp.total;
    
    console.log(chalk.bold.cyan('\n📊 爬蟲數據摘要'));
    console.log(chalk.gray('-'.repeat(50)));
    console.log(`TW: ${chalk.green(tw.total)} 檔案 (${tw.successRate.toFixed(1)}%)`);
    console.log(`US: ${chalk.green(us.total)} 檔案 (${us.successRate.toFixed(1)}%)`);
    console.log(`JP: ${chalk.green(jp.total)} 檔案 (${jp.successRate.toFixed(1)}%)`);
    console.log(`總計: ${chalk.bold.green(totalFiles)} 檔案`);
    return;
  }

  if (options.market) {
    // 只分析特定市場
    if (!['tw', 'us', 'jp'].includes(options.market)) {
      console.error(chalk.red('錯誤: 市場必須是 tw, us 或 jp'));
      process.exit(1);
    }
    const marketStats = await stats.analyzeMarket(options.market as 'tw' | 'us' | 'jp');
    console.log(chalk.bold.yellow(`\n📊 ${options.market.toUpperCase()} 市場統計`));
    console.log(chalk.gray('='.repeat(50)));
    console.log(`總檔案數: ${chalk.green(marketStats.total)}`);
    console.log(`成功率: ${chalk[marketStats.successRate > 80 ? 'green' : 'yellow'](marketStats.successRate.toFixed(1) + '%')}`);
    
    for (const [category, data] of Object.entries(marketStats.categories)) {
      const color = data.count > 500 ? 'green' : data.count > 100 ? 'yellow' : 'red';
      console.log(`  ${category}: ${chalk[color](data.count)} 檔案`);
    }
    return;
  }

  // 完整報告
  await stats.printReport();
}

// 執行
main().catch(console.error);