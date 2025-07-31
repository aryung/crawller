#!/usr/bin/env node

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

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

async function main() {
  console.log('🎯 Yahoo Finance Japan Performance 批處理爬蟲');
  console.log('===============================================');
  
  // 尋找所有 Yahoo Finance Performance 配置文件
  const configsDir = path.join(__dirname, '../configs');
  const configFiles = fs.readdirSync(configsDir)
    .filter(file => file.startsWith('yahoo-finance-jp-performance-') && file.endsWith('.json'))
    .map(file => file.replace('.json', ''));
  
  if (configFiles.length === 0) {
    console.log('❌ 沒有找到 Yahoo Finance Performance 配置文件');
    console.log('💡 請先執行: node scripts/generate-batch-configs.js --type=performance');
    process.exit(1);
  }
  
  console.log(`📋 找到 ${configFiles.length} 個 Performance 配置文件:`);
  configFiles.forEach((config, index) => {
    console.log(`   ${index + 1}. ${config}`);
  });
  console.log('');
  
  const startTime = Date.now();
  const results = [];
  
  // 順序執行每個配置（避免並發問題）
  for (const configName of configFiles) {
    try {
      const result = await runCrawler(configName);
      results.push(result);
      
      // 延遲以避免對服務器造成過大壓力
      if (configFiles.indexOf(configName) < configFiles.length - 1) {
        console.log('⏳ 等待 3 秒...\n');
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    } catch (error) {
      results.push(error);
    }
  }
  
  const endTime = Date.now();
  const duration = Math.round((endTime - startTime) / 1000);
  
  // 結果統計
  console.log('\n🎉 Performance 批處理完成！');
  console.log('=============================');
  console.log(`⏱️  總執行時間: ${duration} 秒`);
  console.log(`📊 總計: ${results.length} 個任務`);
  console.log(`✅ 成功: ${results.filter(r => r.success).length} 個`);
  console.log(`❌ 失敗: ${results.filter(r => !r.success).length} 個`);
  
  // 詳細結果
  if (results.some(r => !r.success)) {
    console.log('\n❌ 失敗的任務:');
    results.filter(r => !r.success).forEach(result => {
      console.log(`   - ${result.configName}: ${result.error || '未知錯誤'}`);
    });
  }
  
  console.log('\n📁 輸出文件位置: output/');
  console.log('💡 可使用 ls output/ | grep performance 查看 Performance 相關文件');
}

main().catch(console.error);