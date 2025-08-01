#!/usr/bin/env node

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// 解析命令行參數
const args = process.argv.slice(2);
const limitArg = args.find(arg => arg.startsWith('--limit='));
const limit = limitArg ? parseInt(limitArg.split('=')[1]) : null;

async function runCrawler(configName) {
  return new Promise((resolve, reject) => {
    console.log(`🚀 開始執行: ${configName}`);
    
    const child = spawn('npm', ['run', 'crawl', configName], {
      stdio: 'pipe',
      cwd: path.join(__dirname, '..')
    });
    
    let output = '';
    let errorOutput = '';
    
    child.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    child.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });
    
    child.on('close', (code) => {
      if (code === 0) {
        console.log(`✅ 完成: ${configName}`);
        resolve({ configName, success: true, output });
      } else {
        console.log(`❌ 失敗: ${configName} (代碼: ${code})`);
        resolve({ configName, success: false, error: errorOutput, code });
      }
    });
    
    child.on('error', (error) => {
      console.log(`💥 錯誤: ${configName} - ${error.message}`);
      reject({ configName, error: error.message });
    });
  });
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('🎯 Yahoo Finance US Cash Flow 批處理爬蟲');
  console.log('=============================================');
  
  // 尋找所有 Yahoo Finance US Cash Flow 配置文件
  const configsDir = path.join(__dirname, '../configs');
  const configFiles = fs.readdirSync(configsDir)
    .filter(file => file.startsWith('yahoo-finance-us-cashflow-') && file.endsWith('.json'))
    .map(file => file.replace('.json', ''));
  
  if (configFiles.length === 0) {
    console.log('❌ 沒有找到配置文件');
    console.log('💡 請先執行: node scripts/generate-yahoo-us-configs.js --type=cashflow');
    process.exit(1);
  }
  
  // 如果設定了限制，只處理指定數量的配置
  const targetConfigs = limit ? configFiles.slice(0, limit) : configFiles;
  
  console.log(`📊 找到 ${configFiles.length} 個配置文件`);
  if (limit) {
    console.log(`🎯 限制執行: ${limit} 個配置`);
  }
  console.log(`⏱️  預估執行時間: ${Math.ceil(targetConfigs.length * 0.5)} 分鐘`);
  console.log('');
  
  const results = [];
  let successCount = 0;
  let failCount = 0;
  
  for (let i = 0; i < targetConfigs.length; i++) {
    const configName = targetConfigs[i];
    
    try {
      console.log(`📈 進度: ${i + 1}/${targetConfigs.length}`);
      
      const result = await runCrawler(configName);
      results.push(result);
      
      if (result.success) {
        successCount++;
      } else {
        failCount++;
      }
      
      // 防止過於頻繁的請求，等待 8 秒
      if (i < targetConfigs.length - 1) {
        console.log('⏱️  等待 8 秒...\n');
        await delay(8000);
      }
      
    } catch (error) {
      console.log(`💥 執行錯誤: ${configName}`, error);
      results.push({ configName, success: false, error: error.message });
      failCount++;
    }
  }
  
  // 結果統計
  console.log('\n🎉 批處理執行完成！');
  console.log('===================');
  console.log(`✅ 成功: ${successCount} 個`);
  console.log(`❌ 失敗: ${failCount} 個`);
  console.log(`📊 總計: ${targetConfigs.length} 個`);
  
  if (failCount > 0) {
    console.log('\n❌ 失敗的配置:');
    results.filter(r => !r.success).forEach(r => {
      console.log(`   - ${r.configName}: ${r.error || '未知錯誤'}`);
    });
  }
  
  // 保存執行結果
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const resultPath = path.join(__dirname, `../logs/yahoo-us-cashflow-batch-${timestamp}.json`);
  
  // 確保 logs 目錄存在
  const logsDir = path.dirname(resultPath);
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
  
  fs.writeFileSync(resultPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    totalConfigs: targetConfigs.length,
    successCount,
    failCount,
    results: results
  }, null, 2));
  
  console.log(`\n📄 執行結果已保存到: ${resultPath}`);
  console.log(`📁 輸出文件位置: output/`);
  
  process.exit(failCount > 0 ? 1 : 0);
}

main().catch(error => {
  console.error('批處理執行失敗:', error);
  process.exit(1);
});