#!/usr/bin/env tsx
/**
 * 股票代碼自動更新腳本
 * 從現有的詳細資料檔案中提取股票代碼，更新到 stockcodes.json
 * 
 * 資料來源：
 * - 台灣：yahoo-tw-stock-details.json
 * - 日本：yahoo-jp-stock-details.json  
 * - 美國：yahoo-us-*.json
 * 
 * 使用方式：
 * npx tsx scripts/update-stockcodes.ts           # 更新所有市場
 * npx tsx scripts/update-stockcodes.ts --market=tw  # 只更新台灣
 * npx tsx scripts/update-stockcodes.ts --dry-run    # 預覽模式
 */

import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';

interface StockCode {
  stockCode: string;
  companyName: string;
  sector: string;
}

interface TWStockDetail {
  name: string;
  symbolCode: string;
}

interface JPStockDetail {
  name: string;
  symbolCode: string;
}

interface USStockData {
  symbol: string;
  sector: string;
  scraped_at?: string;
}

interface USDataFile {
  metadata?: any;
  data: USStockData[];
}

interface UpdateStats {
  added: number;
  updated: number;
  unchanged: number;
  total: number;
}

// 解析命令行參數
const args = process.argv.slice(2);
const marketArg = args.find(arg => arg.startsWith('--market='));
const selectedMarket = marketArg ? marketArg.split('=')[1] : 'all';
const isDryRun = args.includes('--dry-run');

const dataDir = path.join(__dirname, '../data');

console.log(chalk.blue('📊 股票代碼自動更新工具'));
console.log(chalk.gray('─'.repeat(50)));
console.log(`模式: ${isDryRun ? chalk.yellow('預覽模式') : chalk.green('更新模式')}`);
console.log(`市場: ${selectedMarket === 'all' ? '所有市場' : selectedMarket.toUpperCase()}`);
console.log();

/**
 * 產業分類映射表
 */
const TW_SECTOR_MAPPING: Record<string, string> = {
  '1': '水泥工業',
  '2': '食品工業',
  '3': '塑膠工業',
  '4': '紡織纖維',
  '5': '電機機械',
  '6': '電器電纜',
  '8': '玻璃陶瓷',
  '9': '造紙工業',
  '10': '鋼鐵工業',
  '11': '橡膠工業',
  '12': '汽車工業',
  '14': '建材營造',
  '15': '航運業',
  '16': '觀光事業',
  '17': '金融保險',
  '18': '貿易百貨',
  '20': '其他產業',
  '21': '化學工業',
  '22': '生技醫療',
  '23': '油電燃氣',
  '24': '半導體業',
  '25': '電腦及週邊設備業',
  '26': '光電業',
  '27': '通信網路業',
  '28': '電子零組件業',
  '29': '電子通路業',
  '30': '資訊服務業',
  '31': '其他電子業'
};

const JP_SECTOR_MAPPING: Record<string, string> = {
  '0050': '水産・農林業',
  '1050': '鉱業',
  '2050': '建設業',
  '3050': '食料品',
  '3100': '繊維製品',
  '3150': 'パルプ・紙',
  '3200': '化学',
  '3250': '医薬品',
  '3300': '石油・石炭製品',
  '3350': 'ゴム製品',
  '3400': 'ガラス・土石製品',
  '3450': '鉄鋼',
  '3500': '非鉄金属',
  '3550': '金属製品',
  '3600': '機械',
  '3650': '電気機器',
  '3700': '輸送用機器',
  '3750': '精密機器',
  '3800': 'その他製品',
  '4050': '電気・ガス業',
  '5050': '陸運業',
  '5100': '海運業',
  '5150': '空運業',
  '5200': '倉庫・運輸関連業',
  '5250': '情報・通信',
  '6050': '卸売業',
  '6100': '小売業',
  '7050': '銀行業',
  '7100': '証券業',
  '7150': '保険業',
  '7200': 'その他金融業',
  '8050': '不動産業',
  '9050': 'サービス業'
};

/**
 * 更新台灣股票代碼
 */
function updateTWStockCodes(): UpdateStats {
  console.log(chalk.cyan('🇹🇼 處理台灣市場...'));
  
  const detailsPath = path.join(dataDir, 'yahoo-tw-stock-details.json');
  const stockCodesPath = path.join(dataDir, 'yahoo-finance-tw-stockcodes.json');
  
  if (!fs.existsSync(detailsPath)) {
    console.log(chalk.yellow('  ⚠️ 找不到 yahoo-tw-stock-details.json'));
    return { added: 0, updated: 0, unchanged: 0, total: 0 };
  }
  
  // 讀取詳細資料
  const details: Record<string, TWStockDetail[]> = JSON.parse(fs.readFileSync(detailsPath, 'utf-8'));
  
  // 讀取現有的 stockcodes（如果存在）
  let existingStocks: StockCode[] = [];
  const existingMap = new Map<string, StockCode>();
  
  if (fs.existsSync(stockCodesPath)) {
    existingStocks = JSON.parse(fs.readFileSync(stockCodesPath, 'utf-8'));
    existingStocks.forEach(stock => {
      existingMap.set(stock.stockCode, stock);
    });
  }
  
  // 提取所有股票
  const newStocks: StockCode[] = [];
  let addedCount = 0;
  let updatedCount = 0;
  let unchangedCount = 0;
  
  for (const [categoryId, stocks] of Object.entries(details)) {
    const sectorName = TW_SECTOR_MAPPING[categoryId] || `產業${categoryId}`;
    
    // Skip if not an array
    if (!Array.isArray(stocks)) {
      continue;
    }
    
    for (const stock of stocks) {
      const stockCode = `${stock.symbolCode}.TW`;
      const existing = existingMap.get(stockCode);
      
      const newStock: StockCode = {
        stockCode: stockCode,
        companyName: existing?.companyName || stock.name,
        sector: sectorName
      };
      
      if (!existing) {
        addedCount++;
        console.log(chalk.green(`    + ${stockCode} - ${stock.name}`));
      } else if (existing.sector !== sectorName) {
        updatedCount++;
        console.log(chalk.yellow(`    ~ ${stockCode} - 產業更新: ${existing.sector} → ${sectorName}`));
      } else {
        unchangedCount++;
      }
      
      newStocks.push(newStock);
    }
  }
  
  // 依股票代碼排序
  newStocks.sort((a, b) => a.stockCode.localeCompare(b.stockCode));
  
  if (!isDryRun && newStocks.length > 0) {
    fs.writeFileSync(stockCodesPath, JSON.stringify(newStocks, null, 2));
    console.log(chalk.green(`  ✅ 已更新 ${newStocks.length} 個台灣股票`));
  }
  
  return {
    added: addedCount,
    updated: updatedCount,
    unchanged: unchangedCount,
    total: newStocks.length
  };
}

/**
 * 更新日本股票代碼
 */
function updateJPStockCodes(): UpdateStats {
  console.log(chalk.cyan('🇯🇵 處理日本市場...'));
  
  const detailsPath = path.join(dataDir, 'yahoo-jp-stock-details.json');
  const stockCodesPath = path.join(dataDir, 'yahoo-finance-jp-stockcodes.json');
  
  if (!fs.existsSync(detailsPath)) {
    console.log(chalk.yellow('  ⚠️ 找不到 yahoo-jp-stock-details.json'));
    return { added: 0, updated: 0, unchanged: 0, total: 0 };
  }
  
  // 讀取詳細資料
  const details: Record<string, JPStockDetail[]> = JSON.parse(fs.readFileSync(detailsPath, 'utf-8'));
  
  // 讀取現有的 stockcodes（如果存在）
  let existingStocks: StockCode[] = [];
  const existingMap = new Map<string, StockCode>();
  
  if (fs.existsSync(stockCodesPath)) {
    existingStocks = JSON.parse(fs.readFileSync(stockCodesPath, 'utf-8'));
    existingStocks.forEach(stock => {
      existingMap.set(stock.stockCode, stock);
    });
  }
  
  // 提取所有股票
  const newStocks: StockCode[] = [];
  let addedCount = 0;
  let updatedCount = 0;
  let unchangedCount = 0;
  
  for (const [categoryId, stocks] of Object.entries(details)) {
    const sectorName = JP_SECTOR_MAPPING[categoryId] || `業種${categoryId}`;
    
    // Skip if not an array
    if (!Array.isArray(stocks)) {
      continue;
    }
    
    for (const stock of stocks) {
      const stockCode = stock.symbolCode;
      const existing = existingMap.get(stockCode);
      
      const newStock: StockCode = {
        stockCode: stockCode,
        companyName: existing?.companyName || stock.name,
        sector: sectorName
      };
      
      if (!existing) {
        addedCount++;
        console.log(chalk.green(`    + ${stockCode} - ${stock.name}`));
      } else if (existing.sector !== sectorName) {
        updatedCount++;
        console.log(chalk.yellow(`    ~ ${stockCode} - 產業更新: ${existing.sector} → ${sectorName}`));
      } else {
        unchangedCount++;
      }
      
      newStocks.push(newStock);
    }
  }
  
  // 依股票代碼排序
  newStocks.sort((a, b) => a.stockCode.localeCompare(b.stockCode));
  
  if (!isDryRun && newStocks.length > 0) {
    fs.writeFileSync(stockCodesPath, JSON.stringify(newStocks, null, 2));
    console.log(chalk.green(`  ✅ 已更新 ${newStocks.length} 個日本股票`));
  }
  
  return {
    added: addedCount,
    updated: updatedCount,
    unchanged: unchangedCount,
    total: newStocks.length
  };
}

/**
 * 更新美國股票代碼
 */
function updateUSStockCodes(): UpdateStats {
  console.log(chalk.cyan('🇺🇸 處理美國市場...'));
  
  const stockCodesPath = path.join(dataDir, 'yahoo-finance-us-stockcodes.json');
  
  // 找出所有 yahoo-us-*.json 檔案
  const usFiles = fs.readdirSync(dataDir)
    .filter(file => file.startsWith('yahoo-us-') && file.endsWith('.json'))
    .filter(file => !file.includes('stockcodes') && !file.includes('sectors'));
  
  if (usFiles.length === 0) {
    console.log(chalk.yellow('  ⚠️ 找不到 yahoo-us-*.json 檔案'));
    return { added: 0, updated: 0, unchanged: 0, total: 0 };
  }
  
  console.log(chalk.gray(`  找到 ${usFiles.length} 個美國市場資料檔案`));
  
  // 讀取現有的 stockcodes（如果存在）
  let existingStocks: StockCode[] = [];
  const existingMap = new Map<string, StockCode>();
  
  if (fs.existsSync(stockCodesPath)) {
    existingStocks = JSON.parse(fs.readFileSync(stockCodesPath, 'utf-8'));
    existingStocks.forEach(stock => {
      existingMap.set(stock.stockCode, stock);
    });
  }
  
  // 收集所有股票（去重）
  const stockMap = new Map<string, StockCode>();
  let addedCount = 0;
  let updatedCount = 0;
  let unchangedCount = 0;
  
  for (const file of usFiles) {
    const filePath = path.join(dataDir, file);
    const fileData: USDataFile = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    
    if (fileData.data && Array.isArray(fileData.data)) {
      for (const stock of fileData.data) {
        if (!stock.symbol) continue;
        
        const existing = existingMap.get(stock.symbol);
        const currentStock = stockMap.get(stock.symbol);
        
        // 如果還沒有這個股票，或者有更新的產業資訊
        if (!currentStock || (stock.sector && stock.sector !== 'N/A')) {
          const newStock: StockCode = {
            stockCode: stock.symbol,
            companyName: existing?.companyName || stock.symbol, // 美國資料沒有公司名稱，暫用代碼
            sector: stock.sector || 'Technology'
          };
          
          if (!existing && !currentStock) {
            addedCount++;
            console.log(chalk.green(`    + ${stock.symbol} - ${stock.sector}`));
          } else if (existing && existing.sector !== stock.sector) {
            updatedCount++;
            console.log(chalk.yellow(`    ~ ${stock.symbol} - 產業更新: ${existing.sector} → ${stock.sector}`));
          } else if (!currentStock) {
            unchangedCount++;
          }
          
          stockMap.set(stock.symbol, newStock);
        }
      }
    }
  }
  
  // 轉換為陣列並排序
  const newStocks = Array.from(stockMap.values());
  newStocks.sort((a, b) => a.stockCode.localeCompare(b.stockCode));
  
  if (!isDryRun && newStocks.length > 0) {
    fs.writeFileSync(stockCodesPath, JSON.stringify(newStocks, null, 2));
    console.log(chalk.green(`  ✅ 已更新 ${newStocks.length} 個美國股票`));
  }
  
  return {
    added: addedCount,
    updated: updatedCount,
    unchanged: unchangedCount,
    total: newStocks.length
  };
}

/**
 * 顯示統計資訊
 */
function showStats(market: string, stats: UpdateStats): void {
  if (stats.total === 0) return;
  
  console.log(chalk.blue(`\n📊 ${market} 統計：`));
  console.log(`  • 新增: ${chalk.green(stats.added)}`);
  console.log(`  • 更新: ${chalk.yellow(stats.updated)}`);
  console.log(`  • 未變: ${chalk.gray(stats.unchanged)}`);
  console.log(`  • 總計: ${chalk.cyan(stats.total)}`);
}

/**
 * 主程式
 */
async function main() {
  const allStats = {
    tw: { added: 0, updated: 0, unchanged: 0, total: 0 },
    jp: { added: 0, updated: 0, unchanged: 0, total: 0 },
    us: { added: 0, updated: 0, unchanged: 0, total: 0 }
  };
  
  try {
    // 根據選擇的市場執行更新
    if (selectedMarket === 'all' || selectedMarket === 'tw') {
      allStats.tw = updateTWStockCodes();
    }
    
    if (selectedMarket === 'all' || selectedMarket === 'jp') {
      allStats.jp = updateJPStockCodes();
    }
    
    if (selectedMarket === 'all' || selectedMarket === 'us') {
      allStats.us = updateUSStockCodes();
    }
    
    // 顯示總統計
    console.log(chalk.blue('\n📈 總結'));
    console.log(chalk.gray('─'.repeat(50)));
    
    if (selectedMarket === 'all' || selectedMarket === 'tw') {
      showStats('台灣', allStats.tw);
    }
    if (selectedMarket === 'all' || selectedMarket === 'jp') {
      showStats('日本', allStats.jp);
    }
    if (selectedMarket === 'all' || selectedMarket === 'us') {
      showStats('美國', allStats.us);
    }
    
    const totalAdded = allStats.tw.added + allStats.jp.added + allStats.us.added;
    const totalUpdated = allStats.tw.updated + allStats.jp.updated + allStats.us.updated;
    const totalAll = allStats.tw.total + allStats.jp.total + allStats.us.total;
    
    if (totalAll > 0) {
      console.log(chalk.blue('\n🎯 總計'));
      console.log(`  • 新增股票: ${chalk.green(totalAdded)}`);
      console.log(`  • 更新股票: ${chalk.yellow(totalUpdated)}`);
      console.log(`  • 總股票數: ${chalk.cyan(totalAll)}`);
      
      if (isDryRun) {
        console.log(chalk.yellow('\n⚠️ 預覽模式 - 未進行實際更新'));
        console.log(chalk.gray('移除 --dry-run 參數以執行實際更新'));
      } else {
        console.log(chalk.green('\n✅ 股票代碼更新完成！'));
        console.log(chalk.gray('現在可以執行配置生成：'));
        console.log(chalk.cyan('  npm run generate:yahoo-tw-configs'));
        console.log(chalk.cyan('  npm run generate:yahoo-jp-configs'));
        console.log(chalk.cyan('  npm run generate:yahoo-us-configs'));
      }
    } else {
      console.log(chalk.yellow('\n⚠️ 沒有找到可更新的股票資料'));
    }
    
  } catch (error) {
    console.error(chalk.red('\n❌ 更新失敗:'), error);
    process.exit(1);
  }
}

// 執行主程式
main().catch(console.error);