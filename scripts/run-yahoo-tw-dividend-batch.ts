#!/usr/bin/env tsx

import { BatchRunner } from './lib/batch-runner';

const runner = new BatchRunner({
  configPrefix: 'yahoo-finance-tw-dividend-',
  displayName: 'Yahoo Finance Taiwan Dividend',
  delayMs: 8000,
  estimatedTimePerItem: 15,
  tips: [
    '股利數據格式: 「現金股利、股票股利、合計」年度數據',
    '輸出格式: year, cashDividend, stockDividend, totalDividend, yieldRate'
  ]
});

runner.run().catch(console.error);