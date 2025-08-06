#!/usr/bin/env tsx

import { BatchRunner } from './lib/batch-runner';

// 解析命令行參數來決定執行哪個市場
const args = process.argv.slice(2);
const marketArg = args.find(arg => arg.startsWith('--market='));
const market = marketArg ? marketArg.split('=')[1] : 'all';

async function runMarketBatch(configPrefix: string, displayName: string): Promise<void> {
  const runner = new BatchRunner({
    configPrefix,
    displayName,
    delayMs: 8000,
    estimatedTimePerItem: 15
  });
  
  await runner.run();
}

async function main(): Promise<void> {
  console.log('🌍 Yahoo Finance Universal Batch Runner');
  console.log('========================================');
  
  switch (market.toLowerCase()) {
    case 'tw':
    case 'taiwan':
      await runMarketBatch('yahoo-finance-tw-', 'Yahoo Finance Taiwan All');
      break;
      
    case 'us':
    case 'usa':
      await runMarketBatch('yahoo-finance-us-', 'Yahoo Finance US All');
      break;
      
    case 'jp':
    case 'japan':
      await runMarketBatch('yahoo-finance-jp-', 'Yahoo Finance Japan All');
      break;
      
    case 'all':
      console.log('📍 執行所有市場批次爬蟲...\n');
      await runMarketBatch('yahoo-finance-tw-', 'Yahoo Finance Taiwan All');
      await runMarketBatch('yahoo-finance-us-', 'Yahoo Finance US All');
      await runMarketBatch('yahoo-finance-jp-', 'Yahoo Finance Japan All');
      break;
      
    default:
      console.log('❌ 未知的市場:', market);
      console.log('💡 可用選項: tw, us, jp, all');
      process.exit(1);
  }
}

main().catch(console.error);