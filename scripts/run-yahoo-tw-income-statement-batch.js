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
  // 檢查兩個可能的配置目錄
  const activeDir = path.join(__dirname, '../config/active');
  const configsDir = path.join(__dirname, '../config');
  
  // 找出所有 Yahoo Finance TW Income Statement 配置文件
  let configFiles = [];
  
  // 首先檢查 active 目錄
  if (fs.existsSync(activeDir)) {
    try {
      configFiles = fs.readdirSync(activeDir)
        .filter(file => file.startsWith('yahoo-finance-tw-income-statement-') && file.endsWith('.json'))
        .map(file => `active/${file.replace('.json', '')}`);
    } catch (error) {
      console.log('⚠️  無法讀取 active 配置目錄:', activeDir);
    }
  }
  
  // 如果 active 目錄沒有找到，檢查根配置目錄
  if (configFiles.length === 0) {
    try {
      configFiles = fs.readdirSync(configsDir)
        .filter(file => file.startsWith('yahoo-finance-tw-income-statement-') && file.endsWith('.json'))
        .map(file => file.replace('.json', ''));
    } catch (error) {
      console.log('❌ 無法讀取配置目錄:', configsDir);
      process.exit(1);
    }
  }
  
  if (configFiles.length === 0) {
    console.log('❌ 沒有找到 Yahoo Finance TW Income Statement 配置文件');
    console.log('💡 請先執行: node scripts/generate-yahoo-tw-configs.js --type=income-statement');
    process.exit(1);
  }
  
  // 如果設定了限制，只取前 N 個
  if (limit && limit > 0) {
    configFiles = configFiles.slice(0, limit);
    console.log(`📊 限制執行數量: ${limit} 個配置`);
  }
  
  console.log('🔍 Yahoo Finance Taiwan Income Statement 批量爬蟲');
  console.log('===============================================');
  console.log(`📋 找到 ${configFiles.length} 個損益表配置文件`);
  console.log(`⏱️  預估執行時間: ${Math.ceil(configFiles.length * 15 / 60)} 分鐘`);
  console.log('');
  
  const results = [];
  const startTime = Date.now();
  
  for (let i = 0; i < configFiles.length; i++) {
    const configName = configFiles[i];
    
    console.log(`\n[${i + 1}/${configFiles.length}] 處理損益表配置: ${configName}`);
    
    try {
      const result = await runCrawler(configName);
      results.push(result);
      
      // 在請求之間加入延遲，避免被反爬蟲機制阻擋
      if (i < configFiles.length - 1) {
        console.log('⏳ 等待 8 秒後繼續...');
        await delay(8000);
      }
      
    } catch (error) {
      console.log(`💥 配置執行異常: ${configName}`, error);
      results.push({ configName, success: false, error: error.error || error.message });
    }
  }
  
  // 統計結果
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  const endTime = Date.now();
  const duration = Math.round((endTime - startTime) / 1000);
  
  console.log('\n✅ Income Statement批量執行完成');
  console.log('===============================================');
  console.log(`📊 成功: ${successful} 個`);
  console.log(`❌ 失敗: ${failed} 個`);
  console.log(`⏱️  總耗時: ${Math.floor(duration / 60)}:${String(duration % 60).padStart(2, '0')}`);
  
  // 列出失敗的配置
  if (failed > 0) {
    console.log('\n❌ 失敗的配置:');
    results.filter(r => !r.success).forEach(result => {
      console.log(`   ${result.configName} - ${result.error || '未知錯誤'}`);
    });
  }
  
  // 列出成功的配置範例
  if (successful > 0) {
    console.log('\n✅ 成功的配置範例:');
    results.filter(r => r.success).slice(0, 5).forEach(result => {
      console.log(`   ${result.configName}`);
    });
    if (successful > 5) {
      console.log(`   ... 還有 ${successful - 5} 個成功的配置`);
    }
  }
  
  console.log('\n💡 提示:');
  console.log('   - 檢查 output/ 目錄查看損益表爬取結果');
  console.log('   - 使用 --limit=N 參數限制執行數量');
  console.log('   - 失敗的配置可以單獨重新執行');
  console.log('   - 損益表數據格式: 「營收、營業利益、稅後淨利」季度/年度表格');
  console.log('   - 輸出格式: fiscalPeriod, totalRevenue, operatingIncome, netIncome, basicEPS, dilutedEPS');
}

main().catch(console.error);