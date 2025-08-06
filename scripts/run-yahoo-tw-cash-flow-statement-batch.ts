#!/usr/bin/env tsx

import { BatchRunner } from './lib/batch-runner';

const runner = new BatchRunner({
  configPrefix: 'yahoo-finance-tw-cash-flow-statement-',
  displayName: 'Yahoo Finance Taiwan Cash Flow Statement',
  delayMs: 8000,
  estimatedTimePerItem: 15,
  tips: [
    '現金流量表數據格式: 「營業、投資、融資、自由、淨現金流」季度數據',
    '輸出格式: fiscalPeriod, operatingCashFlow, investingCashFlow, financingCashFlow, freeCashFlow, netCashFlow'
  ]
});

runner.run().catch(console.error);