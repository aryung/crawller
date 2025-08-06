#!/usr/bin/env tsx

import { BatchRunner } from './lib/batch-runner';

const runner = new BatchRunner({
  configPrefix: 'yahoo-finance-us-cashflow-',
  displayName: 'Yahoo Finance US Cash Flow',
  delayMs: 8000,
  estimatedTimePerItem: 15,
  tips: [
    'US Cash Flow data format: Operating, Investing, Financing cash flows',
    'Output format: fiscalPeriod, operatingCashFlow, investingCashFlow, financingCashFlow'
  ]
});

runner.run().catch(console.error);