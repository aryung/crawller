#!/usr/bin/env tsx

import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';
import axios, { AxiosInstance } from 'axios';
import { MarketRegion } from '../src/common/shared-types/interfaces/market-data.interface';
import { MarketRegionPathMapping } from '../src/common/constants/report';

// API configuration
const DEFAULT_API_URL = process.env.INTERNAL_AHA_API_URL || 'http://localhost:3000';
const DEFAULT_API_TOKEN = process.env.INTERNAL_AHA_API_TOKEN || '';

// 使用標準化的 MarketRegion enum 和路徑映射
// REGION_MAPPING 移除，使用 MarketRegionPathMapping

// Create axios instance
function createApiClient(apiUrl: string, token?: string): AxiosInstance {
  const headers: any = {
    'Content-Type': 'application/json',
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  return axios.create({
    baseURL: apiUrl,
    headers,
    timeout: 60000,
  });
}

// Convert history data to API format
function convertHistoryToApiFormat(historyData: any, market: string): any[] {
  if (!historyData.results || !Array.isArray(historyData.results)) {
    console.warn('[Transform Warning] Invalid history data structure');
    return [];
  }

  const apiRecords: any[] = [];
  // 從路徑映射反向查找 MarketRegion
  const marketPath = market.toLowerCase();
  const region = Object.keys(MarketRegionPathMapping).find(
    key => MarketRegionPathMapping[key as keyof typeof MarketRegionPathMapping] === marketPath
  ) as MarketRegion || MarketRegion.TPE;

  for (const result of historyData.results) {
    if (!result.data || !Array.isArray(result.data)) {
      console.warn('[Transform Warning] Missing valid data array');
      continue;
    }

    for (const record of result.data) {
      if (!record.symbolCode || !record.date || 
          record.open === undefined || record.high === undefined || 
          record.low === undefined || record.close === undefined || 
          record.volume === undefined) {
        console.warn(`[Transform Warning] Record missing required fields: ${JSON.stringify(record)}`);
        continue;
      }

      // Clean symbol code for Taiwan market (remove .TW/.TWO suffix if present)
      let cleanSymbolCode = record.symbolCode;
      if (region === 'TPE' && cleanSymbolCode.match(/\.TW[O]?$/)) {
        cleanSymbolCode = cleanSymbolCode.replace(/\.TW[O]?$/, '');
      }

      const apiRecord = {
        symbolCode: cleanSymbolCode,
        date: record.date,
        region: region,
        open: parseFloat(record.open),
        high: parseFloat(record.high),
        low: parseFloat(record.low),
        close: parseFloat(record.close),
        volume: parseInt(record.volume),
        openInterest: record.openInterest ? parseInt(record.openInterest) : 0,
      };

      if (isNaN(apiRecord.open) || isNaN(apiRecord.high) || 
          isNaN(apiRecord.low) || isNaN(apiRecord.close) || 
          isNaN(apiRecord.volume)) {
        console.warn(`[Transform Warning] Numeric format error: ${record.symbolCode}`);
        continue;
      }

      apiRecords.push(apiRecord);
    }
  }

  return apiRecords;
}

// Import single JSON file
async function importJsonFile(
  filePath: string, 
  apiClient: AxiosInstance,
  isDryRun: boolean = false,
  verbose: boolean = false
): Promise<{imported: number, failed: number, errors: string[]}> {
  const fileName = path.basename(filePath);
  console.log(`Processing file: ${fileName}`);
  
  if (verbose) {
    console.log(`   Path: ${filePath}`);
  }
  
  const result = { imported: 0, failed: 0, errors: [] as string[] };
  
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const jsonData = JSON.parse(content);
    
    const marketMatch = filePath.match(/daily[\/\\](\w+)[\/\\]history/);
    if (!marketMatch) {
      result.errors.push('Unable to extract market info from file path');
      console.error(`ERROR: ${result.errors[result.errors.length - 1]}`);
      return result;
    }
    
    const market = marketMatch[1];
    console.log(`File market: ${market}`);
    
    const apiRecords = convertHistoryToApiFormat(jsonData, market);
    
    if (apiRecords.length === 0) {
      const error = 'No valid historical data to import';
      result.errors.push(error);
      console.warn(`WARNING: ${error}`);
      return result;
    }
    
    console.log(`Conversion complete: ${apiRecords.length} records`);
    
    if (verbose && apiRecords.length > 0) {
      const sample = apiRecords[0];
      console.log(`   Sample record: ${sample.symbolCode} (${sample.region}) - ${sample.date}`);
      console.log(`   Price range: ${sample.low} - ${sample.high}, close: ${sample.close}`);
    }
    
    if (isDryRun) {
      console.log(`DRY-RUN: Would import ${apiRecords.length} OHLCV records`);
      result.imported = apiRecords.length;
    } else {
      try {
        const response = await apiClient.post('/market-data/ohlcv/import', apiRecords);
        
        if (response.data && response.data.success !== false) {
          const imported = response.data.imported || 0;
          const failed = response.data.failed || 0;
          console.log(`Successfully imported ${imported}, failed ${failed}`);
          result.imported = imported;
          result.failed = failed;
          
          if (response.data.errors && Array.isArray(response.data.errors)) {
            result.errors.push(...response.data.errors);
          }
        } else {
          const error = `API response failed: ${JSON.stringify(response.data, null, 2)}`;
          result.errors.push(error);
          console.error(`ERROR: ${error}`);
          result.failed = apiRecords.length;
        }
      } catch (error: any) {
        const errorMsg = error.response 
          ? `API error (${error.response.status}): ${JSON.stringify(error.response.data)}`
          : `Network error: ${error.message}`;
        result.errors.push(errorMsg);
        console.error(`ERROR: ${errorMsg}`);
        result.failed = apiRecords.length;
      }
    }
    
    return result;
  } catch (error) {
    const errorMsg = `File processing failed: ${(error as Error).message}`;
    result.errors.push(errorMsg);
    console.error(`ERROR: ${errorMsg}`);
    return result;
  }
}

// Scan history data directories
async function scanHistoryDirectory(baseDir: string, options: {
  market?: string | null;
}): Promise<string[]> {
  let patterns: string[] = [];
  
  if (options.market) {
    patterns.push(path.join(baseDir, 'daily', options.market, 'history', '*.json'));
  } else {
    // 使用 MarketRegionPathMapping 生成所有市場的路徑
    patterns = Object.values(MarketRegionPathMapping).map(marketPath => 
      path.join(baseDir, 'daily', marketPath, 'history', '*.json')
    );
  }
  
  console.log(`Scan patterns:`, patterns);
  
  let allFiles: string[] = [];
  for (const pattern of patterns) {
    const files = await glob(pattern);
    allFiles = allFiles.concat(files);
  }
  
  const jsonFiles = allFiles.filter(file => {
    try {
      const stat = fs.statSync(file);
      return stat.isFile() && file.endsWith('.json');
    } catch (err) {
      return false;
    }
  }).sort();
  
  return jsonFiles;
}

// Main function
async function main() {
  console.log('OHLCV Historical Data API Import Tool v1.0 started');
  
  const args = process.argv.slice(2);
  const categoryIndex = args.indexOf('--category');
  const marketIndex = args.indexOf('--market');
  const fileIndex = args.indexOf('--file');
  const dirIndex = args.indexOf('--dir');
  const apiUrlIndex = args.indexOf('--api-url');
  const tokenIndex = args.indexOf('--token');
  const isDryRun = args.includes('--dry-run');
  const isVerbose = args.includes('--verbose') || args.includes('-v');
  
  const apiUrl = apiUrlIndex !== -1 ? args[apiUrlIndex + 1] : DEFAULT_API_URL;
  const token = tokenIndex !== -1 ? args[tokenIndex + 1] : DEFAULT_API_TOKEN;
  const category = categoryIndex !== -1 ? args[categoryIndex + 1] : null;
  const market = marketIndex !== -1 ? args[marketIndex + 1] : null;
  
  if (isDryRun) {
    console.log('Execution mode: DRY-RUN (no actual data import)');
  }
  
  if (isVerbose) {
    console.log('Verbose mode enabled');
  }
  
  if (!token) {
    console.warn('No API Token provided, ensure backend allows unauthenticated access or use --token parameter');
    console.log('   Or set environment variable INTERNAL_AHA_API_TOKEN');
  }
  
  let filesToImport: string[] = [];
  
  if (fileIndex !== -1 && args[fileIndex + 1]) {
    filesToImport = [args[fileIndex + 1]];
    console.log(`Single file mode: ${filesToImport[0]}`);
  } else if (category === 'daily' || market) {
    const baseDir = dirIndex !== -1 ? args[dirIndex + 1] : 'output';
    console.log(`History data directory mode: ${baseDir}`);
    if (market) {
      console.log(`   Market: ${market}`);
    } else {
      console.log(`   Market: All`);
    }
    
    filesToImport = await scanHistoryDirectory(baseDir, { market });
    console.log(`Found ${filesToImport.length} history data files`);
  } else {
    console.error('Please specify file or directory parameters');
    console.log('Usage:');
    console.log('  npx tsx scripts/import-ohlcv-api.ts --category daily');
    console.log('  npx tsx scripts/import-ohlcv-api.ts --market tw --dry-run');
    console.log('  npx tsx scripts/import-ohlcv-api.ts --market us --verbose');
    process.exit(1);
  }
  
  if (filesToImport.length === 0) {
    console.error('No matching files found');
    process.exit(1);
  }
  
  const apiClient = createApiClient(apiUrl, token);
  console.log(`API server: ${apiUrl}`);
  
  let totalImported = 0;
  let totalFailed = 0;
  const allErrors: string[] = [];
  let processedFiles = 0;
  
  console.log(`Starting to process ${filesToImport.length} files...`);
  
  for (const file of filesToImport) {
    console.log(`--- File ${processedFiles + 1}/${filesToImport.length} ---`);
    const result = await importJsonFile(file, apiClient, isDryRun, isVerbose);
    
    totalImported += result.imported;
    totalFailed += result.failed;
    allErrors.push(...result.errors);
    processedFiles++;
    
    if (isVerbose || result.errors.length > 0) {
      console.log(`File summary: imported ${result.imported}, failed ${result.failed}, errors ${result.errors.length}`);
    }
    
    console.log(`Overall progress: ${processedFiles}/${filesToImport.length} files processed`);
    
    if (!isDryRun && processedFiles < filesToImport.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  console.log('='.repeat(60));
  console.log('OHLCV Historical Data Import Operation Complete!');
  console.log('='.repeat(60));
  console.log(`Total imported: ${totalImported} OHLCV historical data records`);
  console.log(`Total failed: ${totalFailed} records`);
  console.log(`Files processed: ${processedFiles} files`);
  
  if (allErrors.length > 0) {
    console.log(`Total errors: ${allErrors.length}`);
    if (isVerbose) {
      console.log('Error details:');
      allErrors.forEach((error, index) => {
        console.log(`  ${index + 1}. ${error}`);
      });
    } else if (allErrors.length <= 5) {
      console.log('Error details:');
      allErrors.forEach((error, index) => {
        console.log(`  ${index + 1}. ${error}`);
      });
    } else {
      console.log('First 5 errors:');
      allErrors.slice(0, 5).forEach((error, index) => {
        console.log(`  ${index + 1}. ${error}`);
      });
      console.log(`  ... and ${allErrors.length - 5} more errors (use --verbose to see all)`);
    }
  }
  
  if (isDryRun) {
    console.log('This was DRY-RUN mode, no actual data import performed');
    console.log('   Remove --dry-run parameter to perform actual import');
  }
  
  if (totalFailed > 0) {
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error('Program execution failed:', error);
    process.exit(1);
  });
}