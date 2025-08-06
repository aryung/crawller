#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// 解析命令行參數
const args = process.argv.slice(2);
const typeArg = args.find(arg => arg.startsWith('--type='));
const specificType = typeArg ? typeArg.split('=')[1] : null;

// 自動發現所有 Yahoo Finance JP 模板
const templatesDir = path.join(__dirname, '../config/templates');
const templateFiles = fs.readdirSync(templatesDir)
  .filter(file => file.startsWith('yahoo-finance-jp-') && file.endsWith('.json'));

console.log('🔍 Yahoo Finance Japan 配置生成器');
console.log('====================================');

if (templateFiles.length === 0) {
  console.log('❌ 沒有找到 Yahoo Finance Japan 模板文件');
  process.exit(1);
}

// 讀取日本股票代碼數據
const stockCodesPath = path.join(__dirname, '../data/yahoo-finance-jp-stockcodes.json');
if (!fs.existsSync(stockCodesPath)) {
  console.log('❌ 找不到日本股票代碼數據文件:', stockCodesPath);
  process.exit(1);
}

const stockCodes = JSON.parse(fs.readFileSync(stockCodesPath, 'utf8'));

// 確保目錄存在 - 直接輸出到 config 目錄 (扁平結構)
const configsDir = path.join(__dirname, '../config');
if (!fs.existsSync(configsDir)) {
  fs.mkdirSync(configsDir, { recursive: true });
}

let processedTemplates = [];
let totalConfigs = 0;

// 處理每個模板
templateFiles.forEach(templateFile => {
  const templatePath = path.join(templatesDir, templateFile);
  const template = JSON.parse(fs.readFileSync(templatePath, 'utf8'));
  
  // 從文件名提取模板類型，避免從 templateType 欄位取得 (會造成重複的 jp-)
  const templateType = templateFile.replace('yahoo-finance-jp-', '').replace('.json', '');
  
  // 如果指定了特定類型，只處理該類型
  if (specificType && templateType !== specificType) {
    return;
  }
  
  console.log(`\n📋 處理模板: ${templateType}`);
  console.log(`模板文件: ${templateFile}`);
  
  let configCount = 0;
  
  // 為每個股票代碼生成配置
  stockCodes.forEach(stock => {
    const config = { ...template };
    
    // 更新 URL 中的變數 (支援兩種格式)
    config.url = config.url.replace('${symbolCode}', stock.stockCode);
    config.url = config.url.replace('${stockCode}', stock.stockCode);
    
    // 更新變數
    config.variables = {
      ...config.variables,
      symbolCode: stock.stockCode,
      companyName: stock.companyName,
      sector: stock.sector
    };
    
    // 更新導出文件名 (支援兩種格式)
    if (config.export && config.export.filename) {
      config.export.filename = config.export.filename.replace('${symbolCode}', stock.stockCode.replace('.T', '_T'));
      config.export.filename = config.export.filename.replace('${stockCode}', stock.stockCode.replace('.T', '_T'));
    }
    
    // 生成配置文件名 (將 .T 轉換為 _T 避免文件系統問題)
    const safeStockCode = stock.stockCode.replace('.T', '_T');
    const configFileName = `yahoo-finance-jp-${templateType}-${safeStockCode}.json`;
    const configPath = path.join(configsDir, configFileName);
    
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
console.log(`📁 輸出目錄: ${configsDir}`);

// 列出生成的配置文件範例
console.log('\n📋 生成的配置文件範例:');
const exampleFiles = fs.readdirSync(configsDir)
  .filter(file => file.startsWith('yahoo-finance-jp-'))
  .slice(0, 5);

exampleFiles.forEach(file => {
  console.log(`   ${file}`);
});
if (totalConfigs > 5) {
  console.log(`   ... 還有 ${totalConfigs - 5} 個文件`);
}

console.log('\n🚀 可以使用以下命令測試:');
if (exampleFiles[0]) {
  const testFile = exampleFiles[0].replace('.json', '');
  console.log(`   npm run crawl ${testFile}`);
}
console.log('\n💡 提示:');
console.log('   - 使用 --type=<type> 只生成特定類型的配置');
console.log('   - 可用類型: cashflow, financials, performance');
console.log('   - 配置文件位於 config/ 目錄');
console.log('   - 可以直接編輯模板文件來調整所有配置');