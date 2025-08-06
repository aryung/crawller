#!/usr/bin/env node

import 'reflect-metadata';
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
  .option('-s, --symbols <symbols>', 'Comma-separated list of specific symbols to process')
  .option('-b, --batch-size <size>', 'Database import batch size', '100')
  .option('-c, --concurrent <count>', 'Maximum concurrent crawlers', '1')
  .option('--skip-config', 'Skip configuration generation')
  .option('--skip-crawl', 'Skip crawler execution')
  .option('--skip-aggregate', 'Skip data aggregation')
  .option('--skip-db', 'Skip database import')
  .option('--clean-days <days>', 'Clean files older than specified days', '7')
  .action(async (options) => {
    console.log(chalk.blue.bold('\n🚀 Universal Web Crawler Pipeline'));
    console.log(chalk.gray('=' .repeat(60)));

    const config: PipelineConfig = {
      regions: options.regions.split(',').map((r: string) => r.trim()),
      symbolCodes: options.symbols ? options.symbols.split(',').map((s: string) => s.trim()) : [],
      batchSize: parseInt(options.batchSize),
      maxConcurrent: parseInt(options.concurrent),
      skipConfigGeneration: options.skipConfig,
      skipCrawling: options.skipCrawl,
      skipAggregation: options.skipAggregate,
      skipDatabaseImport: options.skipDb,
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

// Examples command
program
  .command('examples')
  .description('Show example commands')
  .action(() => {
    console.log(chalk.blue.bold('\n📚 Example Commands'));
    console.log(chalk.gray('=' .repeat(60)));
    
    console.log(chalk.cyan('\n# Run complete pipeline for Taiwan stocks:'));
    console.log('  npx tsx src/cli-pipeline.ts run --regions tw');
    
    console.log(chalk.cyan('\n# Run for specific symbols:'));
    console.log('  npx tsx src/cli-pipeline.ts run --symbols 2330.TW,2454.TW');
    
    console.log(chalk.cyan('\n# Skip config generation (use existing configs):'));
    console.log('  npx tsx src/cli-pipeline.ts run --skip-config');
    
    console.log(chalk.cyan('\n# Run crawlers with higher concurrency:'));
    console.log('  npx tsx src/cli-pipeline.ts run --concurrent 3');
    
    console.log(chalk.cyan('\n# Skip database import (only crawl and aggregate):'));
    console.log('  npx tsx src/cli-pipeline.ts run --skip-db');
    
    console.log(chalk.cyan('\n# View statistics:'));
    console.log('  npx tsx src/cli-pipeline.ts stats');
    
    console.log(chalk.cyan('\n# Clean files older than 30 days:'));
    console.log('  npx tsx src/cli-pipeline.ts clean --days 30');
  });

program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}