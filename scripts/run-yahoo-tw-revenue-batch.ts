#!/usr/bin/env tsx

import { BatchRunner } from './lib/batch-runner';

const runner = new BatchRunner({
  configPrefix: 'yahoo-finance-tw-revenue-',
  displayName: 'Yahoo Finance Taiwan Revenue',
  delayMs: 8000,
  estimatedTimePerItem: 15,
  tips: [
    '營收數據格式: 月營收數據與年增率',
    '輸出格式: month, revenue, yoy (年增率)'
  ]
});

runner.run().catch(console.error);