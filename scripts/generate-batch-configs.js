#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// 讀取模板配置
const templatePath = path.join(__dirname, '../configs/templates/yahoo-finance-jp-performance.json');
const template = JSON.parse(fs.readFileSync(templatePath, 'utf8'));

// 讀取股票代碼數據
const stockCodesPath = path.join(__dirname, '../data/yahoo-finance-jp-stockcodes.json');
const stockCodes = JSON.parse(fs.readFileSync(stockCodesPath, 'utf8'));

// 確保 active 目錄存在
const activeDir = path.join(__dirname, '../configs/active');
if (!fs.existsSync(activeDir)) {
  fs.mkdirSync(activeDir, { recursive: true });
}

// 清理舊的配置文件
const existingFiles = fs.readdirSync(activeDir).filter(file => file.startsWith('yahoo-finance-jp-'));
existingFiles.forEach(file => {
  fs.unlinkSync(path.join(activeDir, file));
  console.log(`🗑️  已刪除舊配置: ${file}`);
});

// 為每個股票代碼生成配置文件
stockCodes.forEach(stock => {
  const config = JSON.parse(JSON.stringify(template)); // 深拷貝
  
  // 替換 URL 中的變數
  config.url = config.url.replace('${stockCode}', stock.stockCode);
  
  // 更新變數
  config.variables.stockCode = stock.stockCode;
  
  // 更新註釋
  config._note = `Yahoo Finance Japan performance data for ${stock.companyName} - ${stock.stockCode} (${stock.sector})`;
  
  // 更新導出文件名
  config.export.filename = `yahoo_finance_jp_${stock.stockCode.replace('.', '')}`;
  
  // 添加股票信息到配置中
  config.stockInfo = {
    stockCode: stock.stockCode,
    companyName: stock.companyName,
    sector: stock.sector
  };
  
  // 生成文件名（安全的文件名）
  const safeStockCode = stock.stockCode.replace('.', '_');
  const configFilename = `yahoo-finance-jp-${safeStockCode}.json`;
  const configPath = path.join(activeDir, configFilename);
  
  // 寫入配置文件
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  console.log(`✅ 已生成配置: ${configFilename} (${stock.companyName})`);
});

console.log(`\n🎉 批處理配置生成完成！共生成 ${stockCodes.length} 個配置文件`);
console.log(`📁 配置文件位置: configs/active/`);
console.log(`💡 使用方法: npm run crawl -- --config-dir configs/active`);