#!/usr/bin/env tsx
/**
 * 基本面資料匯入腳本
 * 將 crawler 產出的 JSON 資料匯入到 finance-strategy 資料庫
 * 
 * 使用方式:
 * npx tsx scripts/import-fundamental-data.ts --file output/yahoo-finance-us-income-statement-AAPL_20250809.json
 * npx tsx scripts/import-fundamental-data.ts --dir output/ --pattern "*income-statement*"
 */

import 'dotenv/config';
import { DataSource } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';
import { FundamentalDataEntity } from '../src/database/entities/fundamental-data.entity';
import { SymbolEntity } from '../src/database/entities/symbol.entity';
import { FiscalReportType } from '../src/common/shared-types/interfaces/fundamental-data.interface';
import { AssetType } from '../src/common/shared-types/interfaces/position.interface';

// 資料庫連線設定
const dataSource = new DataSource({
  type: 'postgres',
  host: process.env.POSTGRES_DB_IP || 'localhost',
  port: parseInt(process.env.POSTGRES_DB_PORT || '5432'),
  username: process.env.POSTGRES_DB_USER || 'postgres',
  password: process.env.POSTGRES_DB_PASSWORD || 'password',
  database: process.env.POSTGRES_DB_NAME_AHA_DEV || 'aha-dev',
  entities: [FundamentalDataEntity, SymbolEntity],
  synchronize: false,
  logging: ['error', 'warn'],
});

/**
 * 偵測地區並返回對應的交易所代碼
 */
function detectExchangeArea(exchangeArea: string): string {
  const mapping: Record<string, string> = {
    'US': 'US',
    'JP': 'JP',
    'TPE': 'TW',
    'TW': 'TW'
  };
  return mapping[exchangeArea] || exchangeArea;
}

/**
 * 獲取或創建 Symbol
 */
async function getOrCreateSymbol(
  symbolCode: string,
  exchangeArea: string
): Promise<string | null> {
  try {
    const symbolRepository = dataSource.getRepository(SymbolEntity);
    
    // 先查詢是否存在
    let symbol = await symbolRepository.findOne({
      where: {
        symbolCode: symbolCode,
        exchangeArea: exchangeArea
      }
    });
    
    // 如果不存在則創建
    if (!symbol) {
      symbol = symbolRepository.create({
        symbolCode: symbolCode,
        exchangeArea: exchangeArea,
        name: symbolCode, // 預設使用 symbolCode 作為名稱
        assetType: AssetType.EQUITY // 預設為股票
      });
      
      await symbolRepository.save(symbol);
      console.log(`✅ 創建新 Symbol: ${symbolCode} (${exchangeArea})`);
    }
    
    return symbol.id;
  } catch (error) {
    console.error(`❌ 獲取或創建 Symbol 失敗: ${symbolCode} (${exchangeArea})`, error);
    return null;
  }
}

/**
 * 驗證必要欄位
 */
function validateRequiredFields(record: any): boolean {
  const requiredFields = ['symbolCode', 'exchangeArea', 'reportDate', 'fiscalYear', 'reportType'];
  
  for (const field of requiredFields) {
    if (!record[field]) {
      console.warn(`缺少必要欄位: ${field}`, record);
      return false;
    }
  }
  
  // 驗證 fiscalMonth (季報必須是 3,6,9,12; 年報可以是任何月份，因為不同公司財年不同)
  if (record.reportType === 'quarterly') {
    if (![3, 6, 9, 12].includes(record.fiscalMonth)) {
      console.warn(`季報的 fiscalMonth 必須是 3,6,9,12，實際值: ${record.fiscalMonth}`);
      return false;
    }
  } else if (record.reportType === 'annual') {
    if (record.fiscalMonth < 1 || record.fiscalMonth > 12) {
      console.warn(`年報的 fiscalMonth 必須是 1-12，實際值: ${record.fiscalMonth}`);
      return false;
    }
  }
  
  return true;
}

/**
 * 轉換單筆資料為 Entity
 */
function convertToEntity(record: any, symbolId: string): FundamentalDataEntity | null {
  if (!validateRequiredFields(record)) {
    return null;
  }
  
  const entity = new FundamentalDataEntity();
  
  // 基本欄位
  entity.symbolId = symbolId;  // 設定 symbolId
  entity.symbolCode = record.symbolCode;
  entity.exchangeArea = detectExchangeArea(record.exchangeArea);
  entity.reportDate = new Date(record.reportDate);
  entity.fiscalYear = record.fiscalYear;
  entity.fiscalMonth = record.fiscalMonth;
  entity.reportType = record.reportType as FiscalReportType;
  entity.dataSource = record.dataSource || 'crawler';
  
  // 損益表欄位 (保持原始單位，不進行轉換)
  entity.revenue = record.revenue || null;
  entity.costOfGoodsSold = record.costOfGoodsSold || null;
  entity.grossProfit = record.grossProfit || null;
  entity.operatingExpenses = record.operatingExpenses || null;
  entity.operatingIncome = record.operatingIncome || null;
  entity.netIncome = record.netIncome || null;
  entity.ebitda = record.ebitda || null;
  entity.eps = record.eps || null;
  entity.dilutedEPS = record.dilutedEPS || null;
  
  // 資產負債表欄位
  entity.totalAssets = record.totalAssets || null;
  entity.totalLiabilities = record.totalLiabilities || null;
  entity.shareholdersEquity = record.shareholdersEquity || null;
  entity.bookValuePerShare = record.bookValuePerShare || null;
  entity.cashAndEquivalents = record.cashAndEquivalents || null;
  entity.totalDebt = record.totalDebt || null;
  entity.longTermDebt = record.longTermDebt || null;
  entity.shortTermDebt = record.shortTermDebt || null;
  entity.currentAssets = record.currentAssets || null;
  entity.currentLiabilities = record.currentLiabilities || null;
  entity.workingCapital = record.workingCapital || null;
  entity.inventory = record.inventory || null;
  entity.accountsReceivable = record.accountsReceivable || null;
  entity.accountsPayable = record.accountsPayable || null;
  entity.propertyPlantEquipment = record.propertyPlantEquipment || null;
  entity.intangibleAssets = record.intangibleAssets || null;
  entity.retainedEarnings = record.retainedEarnings || null;
  
  // 現金流量表欄位
  entity.operatingCashFlow = record.operatingCashFlow || null;
  entity.investingCashFlow = record.investingCashFlow || null;
  entity.financingCashFlow = record.financingCashFlow || null;
  entity.freeCashFlow = record.freeCashFlow || null;
  entity.netCashFlow = record.netCashFlow || null;
  entity.capex = record.capex || null;
  entity.debtIssuance = record.debtIssuance || null;
  entity.debtRepayment = record.debtRepayment || null;
  entity.dividendPayments = record.dividendPayments || null;
  
  // 財務比率
  entity.roe = record.roe || null;
  entity.roa = record.roa || null;
  entity.peRatio = record.peRatio || null;
  entity.pbRatio = record.pbRatio || null;
  entity.debtToEquity = record.debtToEquity || null;
  entity.currentRatio = record.currentRatio || null;
  entity.grossMargin = record.grossMargin || null;
  entity.operatingMargin = record.operatingMargin || null;
  entity.netMargin = record.netMargin || null;
  entity.dividendYield = record.dividendYield || null;
  
  // 其他欄位
  entity.sharesOutstanding = record.sharesOutstanding || null;
  entity.marketCap = record.marketCap || null;
  entity.dividendPerShare = record.dividendPerShare || null;
  
  // 地區特有數據
  entity.regionalData = record.regionalData || {};
  
  // 元數據
  entity.lastUpdated = record.lastUpdated ? new Date(record.lastUpdated) : new Date();
  
  return entity;
}

/**
 * 匯入單個 JSON 檔案
 */
async function importJsonFile(filePath: string): Promise<number> {
  console.log(`📄 處理檔案: ${filePath}`);
  
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const jsonData = JSON.parse(content);
    
    // 檢查資料結構
    if (!jsonData.results || !Array.isArray(jsonData.results)) {
      console.error('❌ 無效的 JSON 結構，缺少 results 陣列');
      return 0;
    }
    
    let importCount = 0;
    
    for (const result of jsonData.results) {
      if (!result.data || !result.data.data || !Array.isArray(result.data.data)) {
        console.warn('⚠️ 跳過無效的 result 項目');
        continue;
      }
      
      // 處理每筆資料
      for (const record of result.data.data) {
        // 先獲取或創建 symbol
        const exchangeArea = detectExchangeArea(record.exchangeArea);
        const symbolId = await getOrCreateSymbol(
          record.symbolCode,
          exchangeArea
        );
        
        if (!symbolId) {
          console.error(`❌ 無法獲取 Symbol ID: ${record.symbolCode} (${exchangeArea})`);
          continue;
        }
        
        const entity = convertToEntity(record, symbolId);
        if (entity) {
          try {
            // 使用 upsert 避免重複
            await dataSource.manager.save(FundamentalDataEntity, entity);
            importCount++;
            console.log(`✅ 匯入成功: ${entity.symbolCode} - ${entity.fiscalYear}/${entity.fiscalMonth}`);
          } catch (error) {
            console.error(`❌ 匯入失敗: ${entity.symbolCode}`, error);
          }
        }
      }
    }
    
    return importCount;
  } catch (error) {
    console.error(`❌ 處理檔案失敗: ${filePath}`, error);
    return 0;
  }
}

/**
 * 主程式
 */
async function main() {
  console.log('🚀 基本面資料匯入工具啟動');
  
  // 解析命令列參數
  const args = process.argv.slice(2);
  const fileIndex = args.indexOf('--file');
  const dirIndex = args.indexOf('--dir');
  const patternIndex = args.indexOf('--pattern');
  
  let filesToImport: string[] = [];
  
  if (fileIndex !== -1 && args[fileIndex + 1]) {
    // 單檔案模式
    filesToImport = [args[fileIndex + 1]];
  } else if (dirIndex !== -1 && args[dirIndex + 1]) {
    // 目錄模式
    const dir = args[dirIndex + 1];
    const pattern = patternIndex !== -1 ? args[patternIndex + 1] : '*.json';
    const globPattern = path.join(dir, pattern);
    
    filesToImport = await glob(globPattern);
    console.log(`📁 找到 ${filesToImport.length} 個檔案符合條件`);
  } else {
    console.error('❌ 請指定 --file 或 --dir 參數');
    console.log('使用方式:');
    console.log('  單檔案: npx tsx scripts/import-fundamental-data.ts --file output/file.json');
    console.log('  多檔案: npx tsx scripts/import-fundamental-data.ts --dir output/ --pattern "*income*"');
    process.exit(1);
  }
  
  if (filesToImport.length === 0) {
    console.error('❌ 沒有找到符合條件的檔案');
    process.exit(1);
  }
  
  // 連接資料庫
  console.log('🔌 連接資料庫...');
  try {
    await dataSource.initialize();
    console.log('✅ 資料庫連接成功');
  } catch (error) {
    console.error('❌ 資料庫連接失敗:', error);
    process.exit(1);
  }
  
  // 匯入檔案
  let totalImported = 0;
  
  for (const file of filesToImport) {
    const count = await importJsonFile(file);
    totalImported += count;
  }
  
  // 關閉連接
  await dataSource.destroy();
  
  console.log(`\n✨ 匯入完成！共匯入 ${totalImported} 筆資料`);
}

// 執行主程式
main().catch(error => {
  console.error('❌ 程式執行錯誤:', error);
  process.exit(1);
});