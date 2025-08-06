#!/usr/bin/env tsx

import { BatchRunner } from './lib/batch-runner';

// 通用的 financials 批次執行器 (適用於 JP 市場)
const runner = new BatchRunner({
  configPrefix: 'yahoo-finance-jp-financials-',
  displayName: 'Yahoo Finance Japan Financials',
  delayMs: 8000,
  estimatedTimePerItem: 15,
  tips: [
    'JP Financials data format: Revenue, Operating Income, Net Income quarterly data',
    'Output format: fiscalPeriod, revenue, operatingIncome, netIncome'
  ]
});

runner.run().catch(console.error);