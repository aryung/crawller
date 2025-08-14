#!/usr/bin/env tsx

import * as fs from 'fs';
import * as path from 'path';

interface StockCode {
  stockCode: string;
  companyName: string;
  sector: string;
}

interface ConfigTemplate {
  templateType?: string;
  url: string;
  variables?: Record<string, any>;
  export?: {
    filename?: string;
    [key: string]: any;
  };
  [key: string]: any;
}

interface ProcessedTemplate {
  type: string;
  file: string;
  configs: number;
}

/**
 * 根據模板類型決定配置分類路徑
 */
function getCategoryPath(templateType: string): string {
  if (templateType === 'history') {
    // 每日更新：歷史價格數據
    return 'daily/us-history';
  } else if (isMetadataType(templateType)) {
    // 元數據：股票代碼、標籤、分類
    return `metadata/${templateType}`;
  } else {
    // 季度更新：財務報表
    return `quarterly/us/${templateType}`;
  }
}

/**
 * 檢查是否為元數據類型
 */
function isMetadataType(type: string): boolean {
  return [
    'symbols',
    'labels', 
    'categories',
    'details',
    'sectors'
  ].includes(type);
}

/**
 * 遞歸獲取目錄下所有 JSON 文件
 */
function getAllJsonFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  
  const results: string[] = [];
  const items = fs.readdirSync(dir);
  
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      results.push(...getAllJsonFiles(fullPath));
    } else if (item.endsWith('.json')) {
      results.push(fullPath);
    }
  }
  
  return results;
}

// 解析命令行參數
const args = process.argv.slice(2);
const typeArg = args.find(arg => arg.startsWith('--type='));
const specificType = typeArg ? typeArg.split('=')[1] : null;

// 自動發現所有 Yahoo Finance US 模板
const templatesDir = path.join(__dirname, '../config/templates');
const templateFiles = fs.readdirSync(templatesDir)
  .filter(file => file.startsWith('yahoo-finance-us-') && file.endsWith('.json'));

console.log('🔍 Yahoo Finance United States 配置生成器');
console.log('====================================');

if (templateFiles.length === 0) {
  console.log('❌ 沒有找到 Yahoo Finance US 模板文件');
  process.exit(1);
}

// 讀取美國股票代碼數據
const stockCodesPath = path.join(__dirname, '../data/yahoo-finance-us-stockcodes.json');
if (!fs.existsSync(stockCodesPath)) {
  console.log('❌ 找不到美國股票代碼數據文件:', stockCodesPath);
  process.exit(1);
}

const stockCodes: StockCode[] = JSON.parse(fs.readFileSync(stockCodesPath, 'utf8'));

// 確保基礎目錄存在 - 輸出到分類目錄結構
const baseConfigsDir = path.join(__dirname, '../config-categorized');
if (!fs.existsSync(baseConfigsDir)) {
  fs.mkdirSync(baseConfigsDir, { recursive: true });
}

const processedTemplates: ProcessedTemplate[] = [];
let totalConfigs = 0;

// 處理每個模板
templateFiles.forEach(templateFile => {
  const templatePath = path.join(templatesDir, templateFile);
  const template: ConfigTemplate = JSON.parse(fs.readFileSync(templatePath, 'utf8'));
  
  // 從文件名提取模板類型
  const templateType = templateFile.replace('yahoo-finance-us-', '').replace('.json', '');
  
  // 如果指定了特定類型，只處理該類型
  if (specificType && templateType !== specificType) {
    return;
  }
  
  console.log(`\n📋 處理模板: ${templateType}`);
  console.log(`模板文件: ${templateFile}`);
  
  // 確定配置類別和目錄結構
  const categoryPath = getCategoryPath(templateType);
  console.log(`輸出目錄: ${categoryPath}`);
  const fullConfigDir = path.join(baseConfigsDir, categoryPath);
  
  // 確保分類目錄存在
  if (!fs.existsSync(fullConfigDir)) {
    fs.mkdirSync(fullConfigDir, { recursive: true });
  }
  
  let configCount = 0;
  
  // 為每個股票代碼生成配置
  stockCodes.forEach(stock => {
    const config: ConfigTemplate = { ...template };
    
    // 更新 URL 中的變數
    config.url = config.url.replace('${symbolCode}', stock.stockCode);
    
    // 更新變數
    config.variables = {
      ...config.variables,
      symbolCode: stock.stockCode,
      companyName: stock.companyName,
      sector: stock.sector
    };
    
    // 更新導出文件名
    if (config.export && config.export.filename) {
      // 美國股票代碼處理 (替換特殊字符)
      const safeCode = stock.stockCode.replace(/[^A-Za-z0-9]/g, '_');
      config.export.filename = config.export.filename.replace('${symbolCode}', safeCode);
    }
    
    // 生成配置文件名 (替換特殊字符，如 BRK.B -> BRK_B)
    const safeStockCode = stock.stockCode.replace(/[^A-Za-z0-9]/g, '_');
    const configFileName = `yahoo-finance-us-${templateType}-${safeStockCode}.json`;
    const configPath = path.join(fullConfigDir, configFileName);
    
    // 寫入配置文件
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    configCount++;
  });
  
  processedTemplates.push({
    type: templateType,
    file: templateFile,
    configs: configCount
  });
  
  totalConfigs += configCount;
});

// 輸出總結
console.log('\n✅ 配置生成完成');
console.log('====================================');
processedTemplates.forEach(template => {
  console.log(`📊 ${template.type}: ${template.configs} 個配置文件`);
});
console.log(`\n🎯 總計: ${totalConfigs} 個配置文件`);
console.log(`📁 輸出目錄: ${baseConfigsDir}`);

// 列出生成的配置文件範例 (從分類目錄中搜索)
console.log('\n📋 生成的配置文件範例:');
let exampleFiles: string[] = [];

try {
  // 搜索所有分類目錄下的 US 配置文件
  const searchDirs = ['daily', 'quarterly', 'metadata'];
  for (const dir of searchDirs) {
    const dirPath = path.join(baseConfigsDir, dir);
    if (fs.existsSync(dirPath)) {
      const files = getAllJsonFiles(dirPath)
        .filter(file => file.includes('yahoo-finance-us-'))
        .slice(0, 2); // 每個類別最多顯示 2 個
      exampleFiles = exampleFiles.concat(files.map(file => path.relative(baseConfigsDir, file)));
    }
  }

  exampleFiles.slice(0, 5).forEach(file => {
    console.log(`   ${file}`);
  });
  if (totalConfigs > 5) {
    console.log(`   ... 還有 ${totalConfigs - 5} 個文件`);
  }
} catch (error) {
  console.log('   (無法列出範例文件)');
}

console.log('\n🚀 可以使用以下命令測試:');
console.log(`   npx tsx src/cli.ts crawl --config config-categorized`);
console.log('\n💡 提示:');
console.log('   - 使用 --type=<type> 只生成特定類型的配置');
console.log('   - 可用類型: balance-sheet, cashflow, income-statement, financials');
console.log('   - 配置文件已按類型分類到 config-categorized/ 目錄');
console.log('   - 可以直接編輯模板文件來調整所有配置');
console.log('   - 生成後無需手動遷移，CLI 會自動找到分類配置');