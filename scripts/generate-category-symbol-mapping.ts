#!/usr/bin/env tsx
/**
 * Script to generate category-symbol mappings from various Yahoo Finance data sources
 *
 * Data sources:
 * - Taiwan: data/yahoo-tw-stock-details.json
 * - Japan: data/yahoo-jp-stock-details.json
 * - US: data/yahoo-us-*-20250809.json files
 *
 * Output: output/metadata/category-symbol-mappings.json
 */

// Load environment variables
import 'dotenv/config';
import {
  TW_CATEGORY_NAMES,
  JP_CATEGORY_NAMES,
} from '../src/common/shared-types';

import {
  readFileSync,
  writeFileSync,
  readdirSync,
  existsSync,
  mkdirSync,
} from 'fs';
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

// US 市場細分類映射表
interface USSubcategoryMapping {
  [mainCategory: string]: {
    [subCategory: string]: {
      keywords: string[];
      priority: number; // 匹配優先級
    };
  };
}

// JP 市場分類合併映射表
interface JPCategoryConsolidation {
  [categoryName: string]: {
    targetCategoryId: string;
    sourceCategoryIds: string[];
  };
}

// 統一標籤格式 - 廣類別映射器
interface BroaderCategoryMapping {
  [region: string]: {
    [originalCategoryId: string]: {
      mainCategory: string;
      subCategory: string;
    };
  };
}

class CategorySymbolMapper {
  private categoryMappings: CategoryMappings = {
    TPE: [],
    JP: [],
    US: [],
  };

  // 統一標籤格式 - 廣類別映射配置
  private broaderCategoryMapping: BroaderCategoryMapping = {
    TPE: {
      // 傳統產業
      '1': { mainCategory: '傳統產業', subCategory: '水泥' },
      '2': { mainCategory: '傳統產業', subCategory: '食品' },
      '3': { mainCategory: '傳統產業', subCategory: '塑膠' },
      '4': { mainCategory: '傳統產業', subCategory: '紡織' },
      '8': { mainCategory: '傳統產業', subCategory: '玻璃陶瓷' },
      '9': { mainCategory: '傳統產業', subCategory: '造紙' },
      '10': { mainCategory: '傳統產業', subCategory: '鋼鐵' },
      '11': { mainCategory: '傳統產業', subCategory: '橡膠' },
      '14': { mainCategory: '民生消費', subCategory: '建材營造' },
      '19': { mainCategory: '傳統產業', subCategory: '化學原料' },
      '21': { mainCategory: '傳統產業', subCategory: '化學' },
      
      // 科技電子
      '24': { mainCategory: '科技電子', subCategory: '半導體' },
      '25': { mainCategory: '科技電子', subCategory: '電腦及週邊設備' },
      '26': { mainCategory: '科技電子', subCategory: '光電' },
      '27': { mainCategory: '科技電子', subCategory: '通信網路' },
      '28': { mainCategory: '科技電子', subCategory: '電子零組件' },
      '29': { mainCategory: '科技電子', subCategory: '電子通路' },
      '30': { mainCategory: '科技電子', subCategory: '資訊服務' },
      '31': { mainCategory: '科技電子', subCategory: '其他電子' },
      '84': { mainCategory: '科技電子', subCategory: '半導體業' },
      '85': { mainCategory: '科技電子', subCategory: '電腦及週邊' },
      '86': { mainCategory: '科技電子', subCategory: '光電業' },
      '87': { mainCategory: '科技電子', subCategory: '通信網路業' },
      '88': { mainCategory: '科技電子', subCategory: '電子零組件業' },
      '89': { mainCategory: '科技電子', subCategory: '電子通路業' },
      '91': { mainCategory: '科技電子', subCategory: '其他電子業' },
      
      // 金融保險
      '17': { mainCategory: '金融保險', subCategory: '金融保險' },
      '52': { mainCategory: '金融保險', subCategory: '資產股' },
      
      // 生技醫療
      '7': { mainCategory: '生技醫療', subCategory: '化學生技醫療' },
      '22': { mainCategory: '生技醫療', subCategory: '生技醫療' },
      '145': { mainCategory: '生技醫療', subCategory: '生技醫療業' },
      '171': { mainCategory: '生技醫療', subCategory: '生醫材料業' },
      
      // 民生消費
      '5': { mainCategory: '民生消費', subCategory: '電機' },
      '6': { mainCategory: '民生消費', subCategory: '電器電纜' },
      '12': { mainCategory: '民生消費', subCategory: '汽車' },
      '15': { mainCategory: '民生消費', subCategory: '航運' },
      '16': { mainCategory: '民生消費', subCategory: '觀光' },
      '18': { mainCategory: '民生消費', subCategory: '貿易百貨' },
      '23': { mainCategory: '民生消費', subCategory: '油電燃氣' },
      '157': { mainCategory: '民生消費', subCategory: '觀光業' },
      '170': { mainCategory: '民生消費', subCategory: '電動車業' },
      
      // 其他產業
      '20': { mainCategory: '其他產業', subCategory: '其他' },
      '40': { mainCategory: '其他產業', subCategory: 'ETF' },
      '49': { mainCategory: '其他產業', subCategory: '存託憑證' },
      '98': { mainCategory: '其他產業', subCategory: '存託憑證' },
      '97': { mainCategory: '其他產業', subCategory: '其他' },
    },
    
    JP: {
      // 製造業
      '3550': { mainCategory: '製造業', subCategory: '機械' },
      '3600': { mainCategory: '製造業', subCategory: '電気機器' },
      '3650': { mainCategory: '製造業', subCategory: '輸送用機器' },
      '3700': { mainCategory: '製造業', subCategory: '精密機器' },
      '6050': { mainCategory: '製造業', subCategory: '機械' },
      '6100': { mainCategory: '製造業', subCategory: '電気機器' },
      '7050': { mainCategory: '製造業', subCategory: '輸送用機器' },
      '7100': { mainCategory: '製造業', subCategory: '精密機器' },
      '7200': { mainCategory: '製造業', subCategory: '精密機器' },
      
      // 基礎材料
      '3400': { mainCategory: '基礎材料', subCategory: '鉄鋼' },
      '3450': { mainCategory: '基礎材料', subCategory: '非鉄金属' },
      '3100': { mainCategory: '基礎材料', subCategory: '化学製品' },
      '3300': { mainCategory: '基礎材料', subCategory: 'ゴム製品' },
      '4050': { mainCategory: '基礎材料', subCategory: '化学' },
      '5200': { mainCategory: '基礎材料', subCategory: '鉄鋼' },
      '5250': { mainCategory: '基礎材料', subCategory: '非鉄金属' },
      '5100': { mainCategory: '基礎材料', subCategory: 'ゴム製品' },
      
      // 消費品
      '1050': { mainCategory: '消費品', subCategory: '食料品' },
      '2050': { mainCategory: '消費品', subCategory: '繊維製品' },
      '3750': { mainCategory: '消費品', subCategory: 'その他製品' },
      '7150': { mainCategory: '消費品', subCategory: 'その他製品' },
      '7250': { mainCategory: '消費品', subCategory: 'その他製品' },
      
      // 建設資材
      '0050': { mainCategory: '建設資材', subCategory: '建設・資材' },
      '3350': { mainCategory: '建設資材', subCategory: 'ガラス・土石製品' },
      '5150': { mainCategory: '建設資材', subCategory: 'ガラス・土石製品' },
      
      // 能源化工
      '3250': { mainCategory: '能源化工', subCategory: '石油・石炭製品' },
      '3800': { mainCategory: '能源化工', subCategory: '電気・ガス業' },
      '5050': { mainCategory: '能源化工', subCategory: '石油・石炭製品' },
      '7750': { mainCategory: '能源化工', subCategory: '電気・ガス業' },
      '9500': { mainCategory: '能源化工', subCategory: '電気・ガス業' },
      
      // 金融服務
      '8650': { mainCategory: '金融服務', subCategory: '証券・商品先物取引業' },
      '8750': { mainCategory: '金融服務', subCategory: '保険業' },
      '8800': { mainCategory: '金融服務', subCategory: 'その他金融業' },
      
      // 運輸不動産
      '8050': { mainCategory: '運輸不動産', subCategory: '陸運業' },
      '8550': { mainCategory: '運輸不動産', subCategory: '海運業' },
      '8600': { mainCategory: '運輸不動産', subCategory: '空運業' },
      '8850': { mainCategory: '運輸不動産', subCategory: '不動産業' },
    },
    
    US: {
      // 這裡將在 processUSData 中動態填充
    }
  };

  // US 市場細分類映射配置 - 基於知名股票代碼
  private usSubcategoryMapping: { [mainCategory: string]: { [subCategory: string]: string[] } } = {
    'technology': {
      '軟體服務': ['MSFT', 'ORCL', 'CRM', 'ADBE', 'INTU', 'WDAY', 'NOW', 'TEAM', 'ZM', 'DOCU', 'OKTA', 'SPLK'],
      '半導體': ['NVDA', 'AMD', 'INTC', 'TSM', 'QCOM', 'AVGO', 'TXN', 'ADI', 'MRVL', 'XLNX', 'LRCX', 'KLAC', 'AMAT'],
      '硬體設備': ['AAPL', 'DELL', 'HPQ', 'IBM', 'NTAP', 'WDC', 'STX'],
      '網路服務': ['GOOGL', 'GOOG', 'META', 'NFLX', 'UBER', 'LYFT', 'TWTR', 'SNAP', 'PINS'],
      '電子商務': ['AMZN', 'EBAY', 'SHOP', 'ETSY', 'W', 'CHWY']
    },
    'financial': {
      '銀行': ['JPM', 'BAC', 'WFC', 'C', 'MS', 'GS', 'USB', 'PNC', 'TFC', 'COF', 'BK', 'STT'],
      '保險': ['BRK.A', 'BRK.B', 'UNH', 'AIG', 'PRU', 'MET', 'AFL', 'ALL', 'TRV', 'PGR'],
      '資產管理': ['BLK', 'BX', 'KKR', 'AMG', 'TROW', 'BEN', 'IVZ'],
      '金融科技': ['V', 'MA', 'PYPL', 'SQ', 'FIS', 'FISV', 'AXP'],
      '投資銀行': ['GS', 'MS', 'SCHW', 'IBKR', 'LAZ']
    },
    'healthcare': {
      '製藥': ['JNJ', 'PFE', 'ABBV', 'MRK', 'LLY', 'BMY', 'AMGN', 'GILD', 'BIIB', 'REGN'],
      '生物科技': ['MRNA', 'BNTX', 'ILMN', 'VRTX', 'CELG', 'BMRN', 'ALXN', 'INCY'],
      '醫療設備': ['MDT', 'ABT', 'TMO', 'DHR', 'SYK', 'BSX', 'BDX', 'EW', 'ZBH', 'BAX'],
      '醫療服務': ['UNH', 'ANTM', 'CI', 'HUM', 'CNC', 'MOH', 'WCG', 'HCA', 'UHS']
    },
    'consumer': {
      '零售業': ['WMT', 'TGT', 'COST', 'HD', 'LOW', 'AMZN', 'DG', 'DLTR', 'BBY', 'GPS'],
      '休閒用品': ['DIS', 'NKE', 'SBUX', 'MCD', 'KO', 'PEP', 'NFLX', 'EA', 'ATVI'],
      '汽車': ['TSLA', 'F', 'GM', 'TM', 'HMC', 'RACE', 'NIO', 'XPEV', 'LI'],
      '服裝紡織': ['NKE', 'LULU', 'VFC', 'RL', 'PVH', 'UAA', 'DECK', 'CROX']
    },
    'industrial': {
      '航太國防': ['BA', 'LMT', 'RTX', 'NOC', 'GD', 'LHX', 'TXT', 'HON'],
      '工業機械': ['CAT', 'DE', 'MMM', 'GE', 'EMR', 'ITW', 'PH', 'ETN', 'ROK', 'DOV'],
      '物流運輸': ['UPS', 'FDX', 'UNP', 'CSX', 'NSC', 'KSU', 'JBHT', 'CHRW', 'EXPD'],
      '建築工程': ['CAT', 'VMC', 'MLM', 'NUE', 'STLD', 'X', 'CMC', 'RS', 'SUM']
    },
    'energy': {
      '石油天然氣': ['XOM', 'CVX', 'COP', 'EOG', 'SLB', 'MPC', 'VLO', 'PSX', 'PXD'],
      '再生能源': ['NEE', 'ENPH', 'SEDG', 'FSLR', 'SPWR', 'RUN', 'VSLR'],
      '公用事業': ['NEE', 'DUK', 'SO', 'D', 'EXC', 'XEL', 'SRE', 'PEG', 'WEC', 'ES']
    },
    'materials': {
      '化學原料': ['DD', 'DOW', 'LYB', 'EMN', 'PPG', 'APD', 'LIN', 'ECL', 'SHW'],
      '金屬礦業': ['FCX', 'NEM', 'GOLD', 'AA', 'X', 'NUE', 'STLD', 'CLF', 'MP'],
      '建材': ['VMC', 'MLM', 'NUE', 'STLD', 'X', 'CMC', 'SUM']
    },
    'communication': {
      '電信服務': ['VZ', 'T', 'TMUS', 'CCI', 'AMT', 'SBAC', 'EQIX'],
      '媒體娛樂': ['DIS', 'NFLX', 'CMCSA', 'CHTR', 'FOXA', 'FOX', 'PARA', 'WBD']
    },
    'realestate': {
      '房地產投資信託基金': ['SPG', 'PLD', 'CCI', 'AMT', 'EQIX', 'PSA', 'EXR', 'AVB', 'EQR', 'UDR'],
      '房地產開發': ['LEN', 'DHI', 'PHM', 'NVR', 'KBH', 'TOL', 'MTH', 'LGIH']
    },
    'utilities': {
      '電力公司': ['NEE', 'DUK', 'SO', 'D', 'EXC', 'XEL', 'SRE', 'PEG', 'WEC', 'ES'],
      '水務公司': ['AWK', 'WTR', 'WTRG', 'MSEX', 'SBS', 'CWT']
    },
    'defensive': {
      '食品飲料': ['KO', 'PEP', 'MDLZ', 'GIS', 'KHC', 'CPB', 'K', 'SJM', 'HSY', 'CAG'],
      '家庭用品': ['PG', 'UL', 'KMB', 'CL', 'CHD', 'CLX', 'EL', 'COTY']
    }
  };

  // JP 市場分類合併配置
  private jpCategoryConsolidation: JPCategoryConsolidation = {
    '非鉄金屬': {
      targetCategoryId: '3450',
      sourceCategoryIds: ['3450', '5250']
    },
    '電気機器': {
      targetCategoryId: '3600',
      sourceCategoryIds: ['3600', '6100']
    },
    '機械': {
      targetCategoryId: '3550',
      sourceCategoryIds: ['3550', '6050']
    },
    '輸送用機器': {
      targetCategoryId: '3650',
      sourceCategoryIds: ['3650', '7050']
    },
    '精密機器': {
      targetCategoryId: '3700',
      sourceCategoryIds: ['3700', '7100', '7200']
    },
    '石油・石炭製品': {
      targetCategoryId: '3250',
      sourceCategoryIds: ['3250', '5050']
    },
    '鉄鋼': {
      targetCategoryId: '3400',
      sourceCategoryIds: ['3400', '5200']
    },
    'ガラス・土石製品': {
      targetCategoryId: '3350',
      sourceCategoryIds: ['3350', '5150']
    },
    'ゴム製品': {
      targetCategoryId: '3300',
      sourceCategoryIds: ['3300', '5100']
    },
    'その他製品': {
      targetCategoryId: '3750',
      sourceCategoryIds: ['3750', '7150']
    }
  };

  /**
   * Process Taiwan stock data with unified format
   */
  processTaiwanData(): void {
    console.log('\n📊 Processing Taiwan (TPE) data with unified format...');
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
        // 使用統一格式映射
        const mappingConfig = this.broaderCategoryMapping.TPE[categoryId];
        
        if (mappingConfig) {
          const { mainCategory, subCategory } = mappingConfig;
          // 將 mainCategory 中的空格和底線替換為 '-' 以避免解析錯誤
          const safeMainCategory = mainCategory.replace(/[\s_]/g, '-');
          const safeSubCategory = subCategory.replace(/[\s_]/g, '-');
          
          const symbols: Symbol[] = data[categoryId].map((stock) => ({
            symbolCode: stock.symbolCode,
            name: stock.name,
          }));

          this.categoryMappings.TPE.push({
            category: `${safeMainCategory}_${safeSubCategory}`,
            categoryId: `TPE_${safeMainCategory}_${safeSubCategory}`,
            symbols: symbols,
          });

          console.log(
            `  ✅ TPE_${mainCategory}_${subCategory} (${categoryId}): ${symbols.length} symbols`
          );
        } else {
          // 回退處理：未映射的類別歸類為其他產業
          const categoryName = TW_CATEGORY_NAMES[categoryId] || `產業${categoryId}`;
          
          const symbols: Symbol[] = data[categoryId].map((stock) => ({
            symbolCode: stock.symbolCode,
            name: stock.name,
          }));

          this.categoryMappings.TPE.push({
            category: `其他產業_${categoryName}`,
            categoryId: `TPE_其他產業_${categoryName}`,
            symbols: symbols,
          });

          console.log(
            `  ⚠️ TPE_其他產業_${categoryName} (${categoryId}): ${symbols.length} symbols [未映射]`
          );
        }
      }
    }

    console.log(
      `  Total Taiwan categories: ${this.categoryMappings.TPE.length}`
    );
  }

  /**
   * Process Japan stock data with unified format and consolidation
   */
  processJapanData(): void {
    console.log('\n📊 Processing Japan (JP) data with unified format...');
    const filePath = join(__dirname, 'data/yahoo-jp-stock-details.json');

    if (!existsSync(filePath)) {
      console.warn('⚠️  Japan data file not found:', filePath);
      return;
    }

    const fileContent = readFileSync(filePath, 'utf-8');
    const data: TWJPStockDetails = JSON.parse(fileContent);

    // 用於合併重複分類的臨時存儲
    const consolidatedCategories = new Map<string, {
      categoryName: string;
      targetCategoryId: string;
      mainCategory: string;
      subCategory: string;
      symbols: Symbol[];
    }>();

    // Process each category
    for (const categoryId in data) {
      if (Array.isArray(data[categoryId]) && data[categoryId].length > 0) {
        // 使用統一格式映射
        const mappingConfig = this.broaderCategoryMapping.JP[categoryId];
        
        if (mappingConfig) {
          const { mainCategory, subCategory } = mappingConfig;
          // 將 mainCategory 和 subCategory 中的空格和底線替換為 '-' 以避免解析錯誤
          const safeMainCategory = mainCategory.replace(/[\s_]/g, '-');
          const safeSubCategory = subCategory.replace(/[\s_]/g, '-');
          const categoryName = JP_CATEGORY_NAMES[categoryId] || `産業${categoryId}`;
          
          const symbols: Symbol[] = data[categoryId].map((stock) => ({
            symbolCode: stock.symbolCode,
            name: stock.name,
          }));

          // 檢查是否需要合併
          const consolidationConfig = this.jpCategoryConsolidation[categoryName];
          
          if (consolidationConfig && consolidationConfig.sourceCategoryIds.includes(categoryId)) {
            // 需要合併的分類
            const key = `${safeMainCategory}_${safeSubCategory}`;
            if (consolidatedCategories.has(key)) {
              // 合併到現有分類
              const existing = consolidatedCategories.get(key)!;
              existing.symbols.push(...symbols);
              console.log(
                `  🔄 Merging JP_${safeMainCategory}_${safeSubCategory} (${categoryId}) with existing: ${symbols.length} symbols`
              );
            } else {
              // 創建新的合併分類
              consolidatedCategories.set(key, {
                categoryName,
                targetCategoryId: consolidationConfig.targetCategoryId,
                mainCategory: safeMainCategory,
                subCategory: safeSubCategory,
                symbols: [...symbols]
              });
              console.log(
                `  ⚡ Creating consolidated JP_${safeMainCategory}_${safeSubCategory} (${consolidationConfig.targetCategoryId}): ${symbols.length} symbols`
              );
            }
          } else {
            // 不需要合併的分類，直接添加
            this.categoryMappings.JP.push({
              category: `${safeMainCategory}_${safeSubCategory}`,
              categoryId: `JP_${safeMainCategory}_${safeSubCategory}`,
              symbols: symbols,
            });
            console.log(
              `  ✅ JP_${safeMainCategory}_${safeSubCategory} (${categoryId}): ${symbols.length} symbols`
            );
          }
        } else {
          // 回退處理：未映射的類別
          const categoryName = JP_CATEGORY_NAMES[categoryId] || `産業${categoryId}`;
          
          const symbols: Symbol[] = data[categoryId].map((stock) => ({
            symbolCode: stock.symbolCode,
            name: stock.name,
          }));

          this.categoryMappings.JP.push({
            category: `其他產業_${categoryName}`,
            categoryId: `JP_其他產業_${categoryName}`,
            symbols: symbols,
          });

          console.log(
            `  ⚠️ JP_其他產業_${categoryName} (${categoryId}): ${symbols.length} symbols [未映射]`
          );
        }
      }
    }

    // 添加合併後的分類到最終結果
    for (const [, consolidated] of consolidatedCategories) {
      // 去除重複股票
      const uniqueSymbols = new Map<string, Symbol>();
      consolidated.symbols.forEach(symbol => {
        if (!uniqueSymbols.has(symbol.symbolCode)) {
          uniqueSymbols.set(symbol.symbolCode, symbol);
        }
      });
      
      this.categoryMappings.JP.push({
        category: `${consolidated.mainCategory}_${consolidated.subCategory}`,
        categoryId: `JP_${consolidated.mainCategory}_${consolidated.subCategory}`,
        symbols: Array.from(uniqueSymbols.values()),
      });
      
      console.log(
        `  ✨ Consolidated JP_${consolidated.mainCategory}_${consolidated.subCategory}: ${uniqueSymbols.size} unique symbols (from ${consolidated.symbols.length} total)`
      );
    }

    console.log(`  Total Japan categories: ${this.categoryMappings.JP.length}`);
  }

  /**
   * Process US stock data with unified format and subcategory subdivision
   */
  processUSData(): void {
    console.log('\n📊 Processing US data with unified format and subcategories...');
    const dataDir = join(__dirname, 'data');

    // 美國市場主分類映射
    const usMainCategoryMapping: { [sectorId: string]: string } = {
      'technology': 'technology',
      'financial': 'financial', 
      'financial-services': 'financial',
      'healthcare': 'healthcare',
      'consumer-cyclical': 'consumer',
      'consumer-defensive': 'consumer',
      'industrials': 'industrial',
      'energy': 'energy',
      'basic-materials': 'materials',
      'communication-services': 'communication',
      'real-estate': 'realestate',
      'utilities': 'utilities'
    };

    // Find all US sector files
    const files = readdirSync(dataDir);
    const usFiles = files.filter(
      (f) =>
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
      const categoryMatch = fileName.match(/yahoo-us-(.+)-\d+\.json$/);
      if (!categoryMatch) continue;

      const sectorId = categoryMatch[1];
      const mainCategory = usMainCategoryMapping[sectorId] || sectorId;
      
      if (data.data && Array.isArray(data.data)) {
        // 檢查是否有細分類配置
        const subcategoryConfig = this.usSubcategoryMapping[mainCategory];
        
        if (subcategoryConfig) {
          console.log(`  🔍 Processing US_${mainCategory} with ${Object.keys(subcategoryConfig).length} subcategories`);
          
          // 為每個細分類創建股票映射
          const subcategoryStocks = new Map<string, Symbol[]>();
          const unclassifiedStocks: Symbol[] = [];
          
          // 初始化細分類
          for (const subcategoryName of Object.keys(subcategoryConfig)) {
            subcategoryStocks.set(subcategoryName, []);
          }
          
          // 分類股票到細分類
          for (const stock of data.data) {
            if (!stock.symbol) continue;
            
            const symbol: Symbol = {
              symbolCode: stock.symbol,
              name: stock.symbol,
            };
            
            let bestMatch = { subcategory: '', priority: -1 };
            
            // 根據股票代碼直接匹配細分類
            for (const [subcategoryName, symbolList] of Object.entries(subcategoryConfig)) {
              if (symbolList.includes(stock.symbol)) {
                bestMatch = { subcategory: subcategoryName, priority: 10 };
                break; // 直接匹配，優先級最高
              }
            }
            
            if (bestMatch.subcategory) {
              subcategoryStocks.get(bestMatch.subcategory)!.push(symbol);
            } else {
              unclassifiedStocks.push(symbol);
            }
          }
          
          // 創建細分類映射
          for (const [subcategoryName, stocks] of subcategoryStocks) {
            if (stocks.length > 0) {
              // 去重
              const uniqueSymbols = new Map<string, Symbol>();
              stocks.forEach(s => uniqueSymbols.set(s.symbolCode, s));
              
              // 將 subcategoryName 中的空格和底線替換為 '-' 以避免解析錯誤
              const safeSubcategoryName = subcategoryName.replace(/[\s_]/g, '-');
              
              this.categoryMappings.US.push({
                category: `${mainCategory}_${safeSubcategoryName}`,
                categoryId: `US_${mainCategory}_${safeSubcategoryName}`,
                symbols: Array.from(uniqueSymbols.values()),
              });
              
              console.log(`    ✅ US_${mainCategory}_${safeSubcategoryName}: ${uniqueSymbols.size} symbols`);
            }
          }
          
          // 處理未分類的股票 - 創建「其他」類別
          if (unclassifiedStocks.length > 0) {
            const uniqueUnclassified = new Map<string, Symbol>();
            unclassifiedStocks.forEach(s => uniqueUnclassified.set(s.symbolCode, s));
            
            this.categoryMappings.US.push({
              category: `${mainCategory}_其他`,
              categoryId: `US_${mainCategory}_其他`,
              symbols: Array.from(uniqueUnclassified.values()),
            });
            
            console.log(`    📦 US_${mainCategory}_其他: ${uniqueUnclassified.size} symbols`);
          }
          
        } else {
          // 沒有細分類配置，使用通用分類
          const categoryName = this.formatCategoryName(sectorId);
          const uniqueSymbols = new Map<string, Symbol>();

          for (const stock of data.data) {
            if (stock.symbol && !uniqueSymbols.has(stock.symbol)) {
              uniqueSymbols.set(stock.symbol, {
                symbolCode: stock.symbol,
                name: stock.symbol,
              });
            }
          }

          const symbols = Array.from(uniqueSymbols.values());

          this.categoryMappings.US.push({
            category: `其他產業_${categoryName}`,
            categoryId: `US_其他產業_${categoryName}`,
            symbols: symbols,
          });

          console.log(
            `  ⚠️ US_其他產業_${categoryName}: ${symbols.length} symbols [無細分類配置]`
          );
        }
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
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Generate subcategory ID from Chinese name
   */
  private generateSubcategoryId(subcategoryName: string): string {
    const mapping: { [key: string]: string } = {
      '軟體服務': 'software',
      '半導體': 'semiconductor', 
      '硬體設備': 'hardware',
      '網路服務': 'internet',
      '電子商務': 'ecommerce',
      '銀行': 'banks',
      '保險': 'insurance',
      '資產管理': 'asset-mgmt',
      '金融科技': 'fintech',
      '投資銀行': 'investment-bank',
      '製藥': 'pharma',
      '生物科技': 'biotech',
      '醫療設備': 'medical-device',
      '醫療服務': 'healthcare-service',
      '零售業': 'retail',
      '休閒用品': 'leisure',
      '汽車': 'automotive',
      '服裝紡織': 'apparel',
      '航太國防': 'aerospace-defense',
      '工業機械': 'industrial-machinery',
      '物流運輸': 'logistics',
      '建築工程': 'construction',
      '石油天然氣': 'oil-gas',
      '再生能源': 'renewable',
      '公用事業': 'utilities-energy',
      '化學原料': 'chemicals',
      '金屬礦業': 'metals-mining',
      '建材': 'construction-materials',
      '電信服務': 'telecom',
      '媒體娛樂': 'media',
      '房地產投資信託基金': 'reits',
      '房地產開發': 'property-dev',
      '電力公司': 'electric-power',
      '水務公司': 'water-utility',
      '食品飲料': 'food-beverage',
      '家庭用品': 'household-goods'
    };
    
    return mapping[subcategoryName] || subcategoryName.toLowerCase().replace(/[^a-z0-9]/gi, '-');
  }

  /**
   * Save mappings to JSON file
   */
  saveMappings(): void {
    console.log('\n💾 Saving category-symbol mappings...');

    // Save to metadata directory for structured organization
    const outputDir = join(__dirname, 'output', 'metadata');
    
    // Ensure metadata directory exists
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
    }
    
    const outputPath = join(outputDir, 'category-symbol-mappings.json');

    // Calculate statistics
    const stats = {
      TPE: {
        categories: this.categoryMappings.TPE.length,
        totalSymbols: this.categoryMappings.TPE.reduce(
          (sum, cat) => sum + cat.symbols.length,
          0
        ),
      },
      JP: {
        categories: this.categoryMappings.JP.length,
        totalSymbols: this.categoryMappings.JP.reduce(
          (sum, cat) => sum + cat.symbols.length,
          0
        ),
      },
      US: {
        categories: this.categoryMappings.US.length,
        totalSymbols: this.categoryMappings.US.reduce(
          (sum, cat) => sum + cat.symbols.length,
          0
        ),
      },
    };

    const output = {
      metadata: {
        generatedAt: new Date().toISOString(),
        statistics: stats,
      },
      categoryMappings: this.categoryMappings,
    };

    writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf-8');

    console.log(`  ✅ Saved to: ${outputPath}`);
    console.log('\n📊 Summary:');
    console.log(
      `  Taiwan: ${stats.TPE.categories} categories, ${stats.TPE.totalSymbols} symbols`
    );
    console.log(
      `  Japan: ${stats.JP.categories} categories, ${stats.JP.totalSymbols} symbols`
    );
    console.log(
      `  US: ${stats.US.categories} categories, ${stats.US.totalSymbols} symbols`
    );
    console.log(
      `  Total: ${stats.TPE.totalSymbols + stats.JP.totalSymbols + stats.US.totalSymbols} symbols`
    );
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

