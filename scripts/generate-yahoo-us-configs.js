#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// 解析命令行參數
const args = process.argv.slice(2);
const typeArg = args.find(arg => arg.startsWith('--type='));
const specificType = typeArg ? typeArg.split('=')[1] : null;

// 自動發現所有 Yahoo Finance US 模板
const templatesDir = path.join(__dirname, '../configs/templates');
const templateFiles = fs.readdirSync(templatesDir)
  .filter(file => file.startsWith('yahoo-finance-us-') && file.endsWith('.json'));

console.log('🔍 Yahoo Finance US 配置生成器');
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

const stockCodes = JSON.parse(fs.readFileSync(stockCodesPath, 'utf8'));

// 確保目錄存在
const activeDir = path.join(__dirname, '../configs/active');
const configsDir = path.join(__dirname, '../configs');
if (!fs.existsSync(activeDir)) {
  fs.mkdirSync(activeDir, { recursive: true });
}

let processedTemplates = [];
let totalConfigs = 0;

// 處理每個模板
templateFiles.forEach(templateFile => {
  const templatePath = path.join(templatesDir, templateFile);
  const template = JSON.parse(fs.readFileSync(templatePath, 'utf8'));
  
  // 從文件名提取模板類型，避免從 templateType 欄位取得 (會造成重複的 us)
  const templateType = templateFile.replace('yahoo-finance-us-', '').replace('.json', '');
  
  // 如果指定了特定類型，只處理該類型
  if (specificType && templateType !== specificType) {
    return;
  }
  
  console.log(`\n📋 處理模板: ${templateType}`);
  
  // 清理該類型的舊配置文件
  const oldConfigPattern = `yahoo-finance-us-${templateType}-`;
  const existingFiles = fs.readdirSync(activeDir).filter(file => file.startsWith(oldConfigPattern));
  existingFiles.forEach(file => {
    fs.unlinkSync(path.join(activeDir, file));
  });
  
  const existingRootFiles = fs.readdirSync(configsDir).filter(file => file.startsWith(oldConfigPattern));
  existingRootFiles.forEach(file => {
    fs.unlinkSync(path.join(configsDir, file));
  });
  
  let configCount = 0;
  
  // 為每個股票代碼生成配置文件
  stockCodes.forEach(stock => {
    const config = JSON.parse(JSON.stringify(template)); // 深拷貝
    
    // 替換 URL 中的變數
    config.url = config.url.replace('${stockCode}', stock.stockCode);
    
    // 更新變數
    config.variables.stockCode = stock.stockCode;
    
    // 更新註釋
    config._note = `Yahoo Finance US ${templateType} data for ${stock.companyName} - ${stock.stockCode} (${stock.sector})`;
    
    // 更新導出文件名
    config.export.filename = `yahoo_finance_us_${templateType}_${stock.stockCode.replace('-', '')}`;
    
    // 添加股票信息到配置中
    config.stockInfo = {
      stockCode: stock.stockCode,
      companyName: stock.companyName,
      sector: stock.sector
    };
    
    // 生成文件名（安全的文件名）
    const safeStockCode = stock.stockCode.replace('-', '_');
    const configFilename = `yahoo-finance-us-${templateType}-${safeStockCode}.json`;
    
    // 寫入到 active 目錄
    const activeConfigPath = path.join(activeDir, configFilename);
    fs.writeFileSync(activeConfigPath, JSON.stringify(config, null, 2));
    
    // 複製到根目錄供執行
    const rootConfigPath = path.join(configsDir, configFilename);
    fs.writeFileSync(rootConfigPath, JSON.stringify(config, null, 2));
    
    console.log(`   ✅ ${configFilename} (${stock.companyName})`);
    configCount++;
  });
  
  processedTemplates.push({
    type: templateType,
    count: configCount
  });
  
  totalConfigs += configCount;
});

console.log(`\n🎉 美國股票批處理配置生成完成！`);
console.log(`📊 生成統計:`);
processedTemplates.forEach(template => {
  console.log(`   - ${template.type}: ${template.count} 個配置`);
});
console.log(`📈 總計: ${totalConfigs} 個配置文件`);
console.log(`📁 配置文件位置: configs/ 和 configs/active/`);

if (processedTemplates.length > 1) {
  console.log(`\n💡 使用方法:`);
  processedTemplates.forEach(template => {
    console.log(`   - ${template.type}: node scripts/run-yahoo-us-${template.type}-batch.js`);
  });
} else if (processedTemplates.length === 1) {
  console.log(`\n💡 使用方法:`);
  console.log(`   - ${processedTemplates[0].type}: node scripts/run-yahoo-us-${processedTemplates[0].type}-batch.js`);
}

console.log(`\n🚀 單一測試:`);
console.log(`   - npm run crawl yahoo-finance-us-financials-BRK_B`);