#!/usr/bin/env tsx

import { BatchRunner } from './lib/batch-runner';

const runner = new BatchRunner({
  configPrefix: 'yahoo-finance-us-financials-',
  displayName: 'Yahoo Finance US Financials',
  delayMs: 8000,
  estimatedTimePerItem: 15,
  tips: [
    'US Financials data format: Revenue, Net Income, EPS quarterly data',
    'Output format: fiscalPeriod, revenue, netIncome, eps'
  ]
});

runner.run().catch(console.error);