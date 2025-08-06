#!/usr/bin/env tsx

import { BatchRunner } from './lib/batch-runner';

const runner = new BatchRunner({
  configPrefix: 'yahoo-finance-tw-income-statement-',
  displayName: 'Yahoo Finance Taiwan Income Statement',
  delayMs: 8000,
  estimatedTimePerItem: 15,
  tips: [
    '損益表數據格式: 「營收、毛利、營業利益、稅前淨利、稅後淨利」季度數據',
    '輸出格式: fiscalPeriod, revenue, grossProfit, operatingIncome, pretaxIncome, netIncome'
  ]
});

runner.run().catch(console.error);