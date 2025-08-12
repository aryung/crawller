#!/usr/bin/env tsx
/**
 * Script to generate category-symbol mappings from various Yahoo Finance data sources
 * 
 * Data sources:
 * - Taiwan: data/yahoo-tw-stock-details.json
 * - Japan: data/yahoo-jp-stock-details.json  
 * - US: data/yahoo-us-*-20250809.json files
 * 
 * Output: output/category-symbol-mappings.json
 */

// Load environment variables
import 'dotenv/config';

import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const __dirname = process.cwd();

// Type definitions
interface Symbol {
  symbolCode: string;
  name: string;
}

interface CategoryMapping {
  category: string;
  categoryId: string;
  symbols: Symbol[];
}

interface CategoryMappings {
  TPE: CategoryMapping[];
  JP: CategoryMapping[];
  US: CategoryMapping[];
}

interface TWJPStockDetails {
  [categoryId: string]: Array<{
    name: string;
    symbolCode: string;
  }>;
}

interface USStockData {
  metadata: any;
  data: Array<{
    symbol: string;
    sector?: string;
  }>;
}

// Taiwan category ID to name mapping
// 基於台股實際分類結構，提供完整的分類ID對照表
const TW_CATEGORY_NAMES: Record<string, string> = {
  // 傳統產業
  '1': '水泥',
  '2': '食品',
  '3': '塑膠',
  '4': '紡織',
  '5': '電機',
  '6': '電器電纜',
  '7': '化學生技醫療',
  '8': '玻璃陶瓷',
  '9': '造紙',
  '10': '鋼鐵',
  '11': '橡膠',
  '12': '汽車',
  '13': '電子電機',
  '14': '建材營造',
  '15': '航運',
  '16': '觀光',
  '17': '金融保險',
  '18': '貿易百貨',
  '19': '化學原料',
  '20': '其他',
  '21': '化學',
  '22': '生技醫療',
  '23': '油電燃氣',
  '24': '半導體',
  '25': '電腦及週邊設備',
  '26': '光電',
  '27': '通信網路',
  '28': '電子零組件',
  '29': '電子通路',
  '30': '資訊服務',
  '31': '其他電子',
  '32': '文化創意',
  '33': '農業科技',
  '34': '電子商務',
  '35': '綠能環保',
  '36': '數位雲端',
  '37': '運動休閒',
  '38': '居家生活',
  '39': '存託憑證',
  '40': 'ETF',
  '41': '受益證券',
  '42': '資產股',
  '43': 'ETN',
  '44': '封閉型基金',
  '45': '開放型基金',
  '46': '期貨ETF',
  '47': '槓桿型ETF',
  '48': '反向型ETF',
  '49': '商品ETF',
  '51': '創新科技',
  '52': '新經濟',
  
  // 細分類別
  '93': '上櫃ETF',
  '94': '興櫃ETF',
  '95': '興櫃股票',
  '96': '興櫃創新',
  '97': '其他',
  '98': '存託憑證',
  '99': '認購權證',
  
  // 管理股票分類
  '80': '管理股票',
  '81': '中小企業',
  '82': '電機機械',
  '83': '化學生技醫療',
  '84': '半導體業',
  '85': '電腦及週邊',
  '86': '光電業',
  '87': '通信網路業',
  '88': '電子零組件業',
  '89': '電子通路業',
  '91': '其他電子業',
  '92': '文化創意業',
  
  // 特殊分類代碼
  '121': 'REIT',
  '122': '基礎建設基金',
  '123': '不動產基金',
  '124': '商品基金',
  '125': '債券基金',
  '126': '股票基金',
  '130': '電子工業',
  '138': '電子零組件製造業',
  '139': '電腦系統整合服務業',
  '140': '電子產品流通業',
  '141': '光電業',
  '142': '半導體業',
  '145': '生技醫療業',
  '151': '數位內容業',
  '153': '電信業',
  '154': '資訊軟體業',
  '155': '網路通訊業',
  '156': '文化創意業',
  '157': '觀光業',
  '158': '綠能環保業',
  '159': '農業科技業',
  '160': '電商業',
  '161': '居家生活業',
  '163': '運動休閒業',
  '165': '數位雲端業',
  '166': '物聯網業',
  '167': 'AI人工智慧業',
  '169': '5G通訊業',
  '170': '電動車業',
  '171': '生醫材料業',
  '172': '智慧機械業',
  '173': '太空科技業'
};

// Japan category ID to name mapping
// 基於Yahoo Finance Japan的實際分類結構，提供完整的分類ID對照表
const JP_CATEGORY_NAMES: Record<string, string> = {
  // 基礎材料・建設
  '0050': '建設・資材',
  '1050': '食料品', 
  '2050': '繊維製品',
  '3050': '紙・パルプ',
  '3100': '化学製品',
  '3150': '化学・合成繊維',
  '3200': '医薬品',
  '3250': '石油・石炭製品',
  '3300': 'ゴム製品',
  '3350': 'ガラス・土石製品',
  '3400': '鉄鋼',
  '3450': '非鉄金属',
  '3500': '金属製品',
  
  // 産業・製造業
  '3550': '機械',
  '3600': '電気機器',
  '3650': '輸送用機器',
  '3700': '精密機器',
  '3750': 'その他製品',
  '3800': '電気・ガス業',
  
  // 従来定義されている分類も保持
  '4050': '化学',
  '4502': '医薬品',
  '5050': '石油・石炭製品',
  '5100': 'ゴム製品',
  '5150': 'ガラス・土石製品',
  '5200': '鉄鋼',
  '5250': '非鉄金属',
  '5300': '金属製品',
  '6050': '機械',
  '6100': '電気機器',
  '6500': '電気機器',
  '7050': '輸送用機器',
  '7100': '精密機器',
  '7150': 'その他製品',
  '7200': '精密機器',
  '7250': 'その他製品',
  '7750': '電気・ガス業',
  
  // 運輸・流通・サービス
  '8050': '陸運業',
  '8550': '海運業',
  '8600': '空運業',
  '8650': '証券・商品先物取引業',
  '8750': '保険業',
  '8800': 'その他金融業',
  '8850': '不動産業',
  '9050': 'サービス業',
  '9500': '電気・ガス業',
  '9550': '情報・通信業'
};

class CategorySymbolMapper {
  private categoryMappings: CategoryMappings = {
    TPE: [],
    JP: [],
    US: []
  };

  /**
   * Process Taiwan stock data
   */
  processTaiwanData(): void {
    console.log('\n📊 Processing Taiwan (TPE) data...');
    const filePath = join(__dirname, 'data/yahoo-tw-stock-details.json');
    
    if (!existsSync(filePath)) {
      console.warn('⚠️  Taiwan data file not found:', filePath);
      return;
    }

    const fileContent = readFileSync(filePath, 'utf-8');
    const data: TWJPStockDetails = JSON.parse(fileContent);
    
    // Process each category
    for (const categoryId in data) {
      if (Array.isArray(data[categoryId]) && data[categoryId].length > 0) {
        const categoryName = TW_CATEGORY_NAMES[categoryId] || `產業${categoryId}`;
        
        const symbols: Symbol[] = data[categoryId].map(stock => ({
          symbolCode: stock.symbolCode,
          name: stock.name
        }));

        this.categoryMappings.TPE.push({
          category: categoryName,
          categoryId: categoryId,
          symbols: symbols
        });

        console.log(`  ✅ ${categoryName} (${categoryId}): ${symbols.length} symbols`);
      }
    }

    console.log(`  Total Taiwan categories: ${this.categoryMappings.TPE.length}`);
  }

  /**
   * Process Japan stock data
   */
  processJapanData(): void {
    console.log('\n📊 Processing Japan (JP) data...');
    const filePath = join(__dirname, 'data/yahoo-jp-stock-details.json');
    
    if (!existsSync(filePath)) {
      console.warn('⚠️  Japan data file not found:', filePath);
      return;
    }

    const fileContent = readFileSync(filePath, 'utf-8');
    const data: TWJPStockDetails = JSON.parse(fileContent);
    
    // Process each category
    for (const categoryId in data) {
      if (Array.isArray(data[categoryId]) && data[categoryId].length > 0) {
        const categoryName = JP_CATEGORY_NAMES[categoryId] || `産業${categoryId}`;
        
        const symbols: Symbol[] = data[categoryId].map(stock => ({
          symbolCode: stock.symbolCode,
          name: stock.name
        }));

        this.categoryMappings.JP.push({
          category: categoryName,
          categoryId: categoryId,
          symbols: symbols
        });

        console.log(`  ✅ ${categoryName} (${categoryId}): ${symbols.length} symbols`);
      }
    }

    console.log(`  Total Japan categories: ${this.categoryMappings.JP.length}`);
  }

  /**
   * Process US stock data from multiple sector files
   */
  processUSData(): void {
    console.log('\n📊 Processing US data...');
    const dataDir = join(__dirname, 'data');
    
    // Find all US sector files
    const files = readdirSync(dataDir);
    const usFiles = files.filter(f => 
      f.startsWith('yahoo-us-') && 
      f.endsWith('-20250809.json') &&
      f !== 'yahoo-us-sectors-20250809.json' // Exclude the sectors summary file
    );
    
    console.log(`  Found ${usFiles.length} US sector files`);
    
    for (const fileName of usFiles) {
      const filePath = join(dataDir, fileName);
      const fileContent = readFileSync(filePath, 'utf-8');
      const data: USStockData = JSON.parse(fileContent);
      
      // Extract category name from filename
      // e.g., "yahoo-us-technology-20250809.json" -> "technology"
      const categoryMatch = fileName.match(/yahoo-us-(.+)-\d+\.json$/);
      if (!categoryMatch) continue;
      
      const categoryId = categoryMatch[1];
      const categoryName = this.formatCategoryName(categoryId);
      
      if (data.data && Array.isArray(data.data)) {
        // Remove duplicates and create symbol list
        const uniqueSymbols = new Map<string, Symbol>();
        
        for (const stock of data.data) {
          if (stock.symbol && !uniqueSymbols.has(stock.symbol)) {
            uniqueSymbols.set(stock.symbol, {
              symbolCode: stock.symbol,
              name: stock.symbol // US data doesn't have company names
            });
          }
        }
        
        const symbols = Array.from(uniqueSymbols.values());
        
        this.categoryMappings.US.push({
          category: categoryName,
          categoryId: categoryId,
          symbols: symbols
        });

        console.log(`  ✅ ${categoryName}: ${symbols.length} unique symbols (from ${data.data.length} records)`);
      }
    }

    console.log(`  Total US categories: ${this.categoryMappings.US.length}`);
  }

  /**
   * Format category name from file name
   */
  private formatCategoryName(categoryId: string): string {
    // Capitalize first letter and replace underscores
    return categoryId
      .split(/[-_]/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Save mappings to JSON file
   */
  saveMappings(): void {
    console.log('\n💾 Saving category-symbol mappings...');
    
    // Save to data directory instead of output
    const outputPath = join(__dirname, 'data', 'category-symbol-mappings.json');
    
    // Calculate statistics
    const stats = {
      TPE: {
        categories: this.categoryMappings.TPE.length,
        totalSymbols: this.categoryMappings.TPE.reduce((sum, cat) => sum + cat.symbols.length, 0)
      },
      JP: {
        categories: this.categoryMappings.JP.length,
        totalSymbols: this.categoryMappings.JP.reduce((sum, cat) => sum + cat.symbols.length, 0)
      },
      US: {
        categories: this.categoryMappings.US.length,
        totalSymbols: this.categoryMappings.US.reduce((sum, cat) => sum + cat.symbols.length, 0)
      }
    };
    
    const output = {
      metadata: {
        generatedAt: new Date().toISOString(),
        statistics: stats
      },
      categoryMappings: this.categoryMappings
    };
    
    writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf-8');
    
    console.log(`  ✅ Saved to: ${outputPath}`);
    console.log('\n📊 Summary:');
    console.log(`  Taiwan: ${stats.TPE.categories} categories, ${stats.TPE.totalSymbols} symbols`);
    console.log(`  Japan: ${stats.JP.categories} categories, ${stats.JP.totalSymbols} symbols`);
    console.log(`  US: ${stats.US.categories} categories, ${stats.US.totalSymbols} symbols`);
    console.log(`  Total: ${stats.TPE.totalSymbols + stats.JP.totalSymbols + stats.US.totalSymbols} symbols`);
  }

  /**
   * Run the complete mapping process
   */
  run(): void {
    console.log('🚀 Starting category-symbol mapping generation...');
    console.log('================================================');
    
    this.processTaiwanData();
    this.processJapanData();
    this.processUSData();
    this.saveMappings();
    
    console.log('\n✅ Category-symbol mapping generation completed!');
  }
}

// Main execution
if (import.meta.url === `file://${__filename}`) {
  const mapper = new CategorySymbolMapper();
  mapper.run();
}

export { CategorySymbolMapper };