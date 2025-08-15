#!/usr/bin/env node

import { program } from 'commander';
import { PipelineOrchestrator, PipelineConfig } from './pipeline/PipelineOrchestrator.js';
import chalk from 'chalk';
import ora from 'ora';

/**
 * CLI for running the complete crawler pipeline
 */
program
  .name('crawler-pipeline')
  .description('Universal Web Crawler Pipeline - From data sources to database')
  .version('1.0.0');

program
  .command('run')
  .description('Run the complete crawler pipeline')
  .option('-r, --regions <regions>', 'Comma-separated list of regions (tw,us,jp)', 'tw,us,jp')
  .option('-t, --data-types <types>', 'Comma-separated list of data types (financials,history)', 'financials')
  .option('-s, --symbols <symbols>', 'Comma-separated list of specific symbols to process')
  .option('-b, --batch-size <size>', 'Database import batch size', '100')
  .option('-c, --concurrent <count>', 'Maximum concurrent crawlers', '1')
  .option('--skip-config', 'Skip configuration generation')
  .option('--skip-crawl', 'Skip crawler execution')
  .option('--skip-aggregate', 'Skip data aggregation')
  .option('--skip-symbol-import', 'Skip symbol import to backend')
  .option('--skip-fundamental-import', 'Skip fundamental data import to backend')
  .option('--skip-ohlcv-import', 'Skip OHLCV historical data import to backend')
  .option('--skip-label-sync', 'Skip category label synchronization')
  .option('--api-url <url>', 'Backend API URL', process.env.BACKEND_API_URL || 'http://localhost:3000')
  .option('--api-token <token>', 'API authentication token', process.env.BACKEND_API_TOKEN)
  .option('--disable-retry', 'Disable retry mechanism')
  .option('--max-retries <count>', 'Maximum retry attempts per item', '3')
  .option('--retry-delay <ms>', 'Base delay between retries in milliseconds', '5000')
  .option('--retry-only', 'Only process retry queue, skip normal pipeline')
  .option('--clear-retries', 'Clear retry queue before starting')
  .option('--clean-days <days>', 'Clean files older than specified days', '7')
  .action(async (options) => {
    console.log(chalk.blue.bold('\n🚀 Universal Web Crawler Pipeline'));
    console.log(chalk.gray('=' .repeat(60)));

    const config: PipelineConfig = {
      regions: options.regions.split(',').map((r: string) => r.trim()),
      dataTypes: options.dataTypes.split(',').map((t: string) => t.trim()),
      symbolCodes: options.symbols ? options.symbols.split(',').map((s: string) => s.trim()) : [],
      batchSize: parseInt(options.batchSize),
      maxConcurrent: parseInt(options.concurrent),
      skipConfigGeneration: options.skipConfig,
      skipCrawling: options.skipCrawl,
      skipAggregation: options.skipAggregate,
      skipSymbolImport: options.skipSymbolImport,
      skipFundamentalImport: options.skipFundamentalImport,
      skipOhlcvImport: options.skipOhlcvImport,
      skipLabelSync: options.skipLabelSync,
      apiUrl: options.apiUrl,
      apiToken: options.apiToken,
      // Retry mechanism options
      enableRetry: !options.disableRetry,
      maxRetries: parseInt(options.maxRetries),
      retryDelay: parseInt(options.retryDelay),
      retryOnly: options.retryOnly,
      clearRetries: options.clearRetries,
    };

    const orchestrator = new PipelineOrchestrator(config);

    // Set up progress monitoring
    const spinner = ora('Initializing pipeline...').start();
    
    orchestrator.onProgress((progress) => {
      const percentage = Math.round((progress.current / progress.total) * 100);
      const statusIcon = progress.status === 'completed' ? '✓' :
                         progress.status === 'failed' ? '✗' :
                         progress.status === 'running' ? '⋯' : '○';
      
      spinner.text = `[${percentage}%] ${statusIcon} Processing ${progress.symbol} - ${progress.reportType}`;
      
      if (progress.status === 'failed') {
        spinner.fail(`Failed: ${progress.symbol} - ${progress.reportType}`);
        spinner.start('Continuing with next item...');
      }
    });

    try {
      // Clean old files if requested
      if (options.cleanDays) {
        spinner.text = 'Cleaning old files...';
        await orchestrator.cleanupOldFiles(parseInt(options.cleanDays));
      }

      spinner.text = 'Starting pipeline execution...';
      const result = await orchestrator.run();
      
      spinner.succeed('Pipeline completed successfully!');

      // Display results
      if (result.errors.length > 0) {
        console.log(chalk.yellow(`\n⚠️ Completed with ${result.errors.length} errors`));
      } else {
        console.log(chalk.green('\n✅ All operations completed successfully!'));
      }

    } catch (error) {
      spinner.fail('Pipeline failed!');
      console.error(chalk.red('Error:'), (error as Error).message);
      process.exit(1);
    }
  });

program
  .command('stats')
  .description('Show current pipeline statistics')
  .action(async () => {
    console.log(chalk.blue.bold('\n📊 Pipeline Statistics'));
    console.log(chalk.gray('=' .repeat(60)));

    const orchestrator = new PipelineOrchestrator();
    
    try {
      const stats = await orchestrator.getStatistics();
      
      console.log(chalk.cyan('\n📁 Output Files:'));
      console.log(`  Total Files: ${stats.outputFiles.totalFiles}`);
      console.log(`  Total Size: ${(stats.outputFiles.totalSize / 1024 / 1024).toFixed(2)} MB`);
      console.log(`  Unique Symbols: ${stats.outputFiles.uniqueSymbols}`);
      console.log('  By Region:');
      for (const [region, count] of Object.entries(stats.outputFiles.byRegion)) {
        console.log(`    ${region}: ${count} files`);
      }
      
      console.log(chalk.cyan('\n💾 Database:'));
      console.log(`  Total Records: ${stats.database.totalRecords}`);
      console.log('  By Region:');
      for (const [region, count] of Object.entries(stats.database.byRegion)) {
        console.log(`    ${region}: ${count} records`);
      }
      console.log('  By Report Type:');
      for (const [type, count] of Object.entries(stats.database.byReportType)) {
        console.log(`    ${type}: ${count} records`);
      }
      
      if (stats.database.latestReportDate) {
        console.log(`  Latest Report: ${new Date(stats.database.latestReportDate).toLocaleDateString()}`);
      }
      
      // Show retry statistics
      try {
        const retryStats = await orchestrator.getRetryManager().getRetryStatistics();
        console.log(chalk.cyan('\n🔄 Retry Queue:'));
        console.log(`  Pending Items: ${retryStats.totalPending}`);
        if (retryStats.totalPending > 0) {
          console.log('  By Region:');
          for (const [region, count] of Object.entries(retryStats.byRegion)) {
            console.log(`    ${region}: ${count} items`);
          }
          console.log('  By Report Type:');
          for (const [type, count] of Object.entries(retryStats.byReportType)) {
            console.log(`    ${type}: ${count} items`);
          }
          console.log('  By Reason:');
          for (const [reason, count] of Object.entries(retryStats.byReason)) {
            console.log(`    ${reason}: ${count} items`);
          }
          if (retryStats.oldestRetry) {
            console.log(`  Oldest Item: ${new Date(retryStats.oldestRetry).toLocaleDateString()}`);
          }
        }
      } catch (error) {
        console.log(chalk.yellow('  ⚠️ Could not load retry statistics'));
      }
      
    } catch (error) {
      console.error(chalk.red('Error fetching statistics:'), (error as Error).message);
    }
  });

program
  .command('clean')
  .description('Clean old output files')
  .option('-d, --days <days>', 'Clean files older than specified days', '7')
  .action(async (options) => {
    console.log(chalk.blue.bold('\n🧹 Cleaning Old Files'));
    console.log(chalk.gray('=' .repeat(60)));

    const orchestrator = new PipelineOrchestrator();
    
    try {
      const days = parseInt(options.days);
      await orchestrator.cleanupOldFiles(days);
      console.log(chalk.green(`✅ Cleanup completed!`));
    } catch (error) {
      console.error(chalk.red('Error during cleanup:'), (error as Error).message);
    }
  });

// Retry management commands
program
  .command('retry')
  .description('Process retry queue only')
  .option('--max-retries <count>', 'Maximum retry attempts per item', '3')
  .option('--retry-delay <ms>', 'Base delay between retries in milliseconds', '5000')
  .action(async (options) => {
    console.log(chalk.blue.bold('\n🔄 Processing Retry Queue'));
    console.log(chalk.gray('=' .repeat(60)));

    const config: PipelineConfig = {
      retryOnly: true,
      enableRetry: true,
      maxRetries: parseInt(options.maxRetries),
      retryDelay: parseInt(options.retryDelay),
      skipConfigGeneration: true,
      skipAggregation: true,
      skipSymbolImport: true,
      skipFundamentalImport: true,
      skipOhlcvImport: true,
      skipLabelSync: true,
    };

    const orchestrator = new PipelineOrchestrator(config);

    const spinner = ora('Processing retry queue...').start();

    try {
      const result = await orchestrator.run();
      
      if (result.retriesExecuted === 0) {
        spinner.info('No items in retry queue');
      } else {
        spinner.succeed(`Processed ${result.retriesExecuted} retry items`);
        console.log(chalk.green(`✅ ${result.retriesSuccessful} successful, ${result.retriesFailed} failed`));
      }

    } catch (error) {
      spinner.fail('Retry processing failed!');
      console.error(chalk.red('Error:'), (error as Error).message);
      process.exit(1);
    }
  });

program
  .command('retry-status')
  .description('Show retry queue status')
  .action(async () => {
    console.log(chalk.blue.bold('\n📋 Retry Queue Status'));
    console.log(chalk.gray('=' .repeat(60)));

    const orchestrator = new PipelineOrchestrator();
    
    try {
      const retryStats = await orchestrator.getRetryManager().getRetryStatistics();
      const pendingRetries = await orchestrator.getRetryManager().getPendingRetries();
      
      console.log(chalk.cyan(`\n📊 總計: ${retryStats.totalPending} 個待重試項目`));
      
      if (retryStats.totalPending === 0) {
        console.log(chalk.green('✅ 重試隊列為空'));
        return;
      }

      console.log('\n📋 按區域分布:');
      for (const [region, count] of Object.entries(retryStats.byRegion)) {
        console.log(`  ${region}: ${count} 項目`);
      }

      console.log('\n📋 按報表類型分布:');
      for (const [type, count] of Object.entries(retryStats.byReportType)) {
        console.log(`  ${type}: ${count} 項目`);
      }

      console.log('\n📋 按失敗原因分布:');
      for (const [reason, count] of Object.entries(retryStats.byReason)) {
        const reasonMap: Record<string, string> = {
          'empty_data': '空數據',
          'execution_failed': '執行失敗',
          'timeout': '超時',
        };
        console.log(`  ${reasonMap[reason] || reason}: ${count} 項目`);
      }

      if (retryStats.oldestRetry) {
        console.log(`\n🕒 最舊項目: ${new Date(retryStats.oldestRetry).toLocaleString()}`);
      }

      console.log('\n📝 詳細列表:');
      for (const retry of pendingRetries.slice(0, 10)) {
        const age = Math.floor((Date.now() - new Date(retry.timestamp).getTime()) / (1000 * 60 * 60));
        console.log(`  ${retry.symbolCode} ${retry.reportType} (${retry.retryCount}/${retry.maxRetries}) - ${age}h ago`);
      }
      
      if (pendingRetries.length > 10) {
        console.log(`  ... 還有 ${pendingRetries.length - 10} 個項目`);
      }

      console.log(chalk.yellow('\n💡 使用 npm run pipeline:retry 執行重試'));
      
    } catch (error) {
      console.error(chalk.red('Error fetching retry status:'), (error as Error).message);
    }
  });

program
  .command('clear-retries')
  .description('Clear all retry queue items')
  .option('-f, --force', 'Force clear without confirmation')
  .action(async (options) => {
    console.log(chalk.blue.bold('\n🧹 Clear Retry Queue'));
    console.log(chalk.gray('=' .repeat(60)));

    const orchestrator = new PipelineOrchestrator();
    
    try {
      const retryStats = await orchestrator.getRetryManager().getRetryStatistics();
      
      if (retryStats.totalPending === 0) {
        console.log(chalk.green('✅ 重試隊列已經是空的'));
        return;
      }

      if (!options.force) {
        console.log(chalk.yellow(`⚠️ 即將清空 ${retryStats.totalPending} 個重試項目`));
        console.log(chalk.yellow('使用 --force 選項確認清空'));
        return;
      }

      const clearedCount = await orchestrator.getRetryManager().clearAllRetries();
      console.log(chalk.green(`✅ 已清空 ${clearedCount} 個重試項目`));
      
    } catch (error) {
      console.error(chalk.red('Error clearing retries:'), (error as Error).message);
    }
  });

// Examples command
program
  .command('examples')
  .description('Show example commands')
  .action(() => {
    console.log(chalk.blue.bold('\n📚 Example Commands'));
    console.log(chalk.gray('=' .repeat(60)));
    
    console.log(chalk.cyan('\n# Run complete pipeline for Taiwan stocks:'));
    console.log('  npx tsx src/cli-pipeline.ts run --regions tw');
    
    console.log(chalk.cyan('\n# Run historical data pipeline for all regions:'));
    console.log('  npx tsx src/cli-pipeline.ts run --data-types history');
    
    console.log(chalk.cyan('\n# Run both financials and historical data:'));
    console.log('  npx tsx src/cli-pipeline.ts run --data-types financials,history');
    
    console.log(chalk.cyan('\n# Run for specific symbols:'));
    console.log('  npx tsx src/cli-pipeline.ts run --symbols 2330.TW,2454.TW');
    
    console.log(chalk.cyan('\n# Skip config generation (use existing config):'));
    console.log('  npx tsx src/cli-pipeline.ts run --skip-config');
    
    console.log(chalk.cyan('\n# Run crawlers with higher concurrency:'));
    console.log('  npx tsx src/cli-pipeline.ts run --concurrent 3');
    
    console.log(chalk.cyan('\n# Skip database import (only crawl and aggregate):'));
    console.log('  npx tsx src/cli-pipeline.ts run --skip-db');
    
    console.log(chalk.cyan('\n# View statistics:'));
    console.log('  npx tsx src/cli-pipeline.ts stats');
    
    console.log(chalk.cyan('\n# Clean files older than 30 days:'));
    console.log('  npx tsx src/cli-pipeline.ts clean --days 30');
    
    console.log(chalk.cyan('\n# Retry management:'));
    console.log('  npx tsx src/cli-pipeline.ts retry-status');
    console.log('  npx tsx src/cli-pipeline.ts retry');
    console.log('  npx tsx src/cli-pipeline.ts clear-retries --force');
    
    console.log(chalk.cyan('\n# Run with retry options:'));
    console.log('  npx tsx src/cli-pipeline.ts run --retry-only');
    console.log('  npx tsx src/cli-pipeline.ts run --disable-retry');
    console.log('  npx tsx src/cli-pipeline.ts run --max-retries 5');
  });

program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}