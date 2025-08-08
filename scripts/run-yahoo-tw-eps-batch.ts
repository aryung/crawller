#!/usr/bin/env tsx

import { BatchRunner } from './lib/batch-runner';

const runner = new BatchRunner({
  configPrefix: 'yahoo-finance-tw-eps-',
  displayName: 'Yahoo Finance Taiwan EPS',
  delayMs: 8000,
  estimatedTimePerItem: 15,
  tips: [
    'EPS 數據格式: 每股盈餘季度/年度數據',
    '輸出格式: fiscalPeriod, eps (精度控制到2位小數)'
  ]
});

runner.run().catch(console.error);