#!/usr/bin/env node

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

/**
 * Yahoo 股票分類爬蟲腳本
 * 爬取 https://tw.stock.yahoo.com/class/ 頁面的所有股票分類連結
 * 輸出格式: {分類名: [{name: "子分類名", url: "連結"}]}
 */

async function scrapeYahooStockCategories() {
  console.log('🔍 Yahoo 股票分類爬蟲啟動');
  console.log('====================================');
  
  let browser;
  try {
    // 啟動瀏覽器
    browser = await chromium.launch({ 
      headless: true,
      timeout: 30000 
    });
    
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      viewport: { width: 1920, height: 1080 }
    });
    
    const page = await context.newPage();
    
    console.log('📄 正在載入頁面: https://tw.stock.yahoo.com/class/');
    
    // 載入頁面
    await page.goto('https://tw.stock.yahoo.com/class/', {
      waitUntil: 'domcontentloaded',
      timeout: 45000
    });
    
    // 等待頁面完全載入
    await page.waitForTimeout(5000);
    
    console.log('🔍 開始提取股票分類數據...');
    
    // 提取所有分類數據
    const categoriesData = await page.evaluate(() => {
      const result = {};
      
      // 獲取所有包含股票分類的連結
      const allCategoryLinks = document.querySelectorAll('a[href*="class-quote"]');
      console.log(`發現 ${allCategoryLinks.length} 個分類連結`);
      
      // 分類邏輯：根據實際頁面內容分類
      const linksByCategory = {
        '上市類股': [],
        '上櫃類股': [],
        '電子產業': []
      };
      
      // 電子相關關鍵字
      const electronicsKeywords = ['半導體', '電腦', '光電', '通訊', '電子', '資訊', 'IC', '設備'];
      
      // 上櫃相關關鍵字 (如果頁面中有櫃前綴)
      const otcKeywords = ['櫃'];
      
      allCategoryLinks.forEach(link => {
        const href = link.href;
        const text = link.textContent ? link.textContent.trim() : '';
        
        if (text && href && text !== '類股報價') {
          console.log(`處理連結: ${text} - ${href}`);
          
          const isElectronics = electronicsKeywords.some(keyword => text.includes(keyword));
          const isOTC = otcKeywords.some(keyword => text.includes(keyword)) || href.includes('exchange=OTC');
          
          if (isOTC) {
            // 上櫃股票
            if (isElectronics) {
              linksByCategory['電子產業'].push({ name: text, url: href });
            } else {
              linksByCategory['上櫃類股'].push({ name: text, url: href });
            }
          } else {
            // 上市股票或其他
            if (isElectronics) {
              linksByCategory['電子產業'].push({ name: text, url: href });
            } else {
              linksByCategory['上市類股'].push({ name: text, url: href });
            }
          }
        }
      });
      
      console.log('分類統計:');
      Object.keys(linksByCategory).forEach(category => {
        console.log(`${category}: ${linksByCategory[category].length} 個`);
      });
      
      // 過濾重複項目並返回
      Object.keys(linksByCategory).forEach(category => {
        const uniqueLinks = [];
        const seen = new Set();
        
        linksByCategory[category].forEach(item => {
          const key = `${item.name}|${item.url}`;
          if (!seen.has(key)) {
            seen.add(key);
            uniqueLinks.push(item);
          }
        });
        
        if (uniqueLinks.length > 0) {
          result[category] = uniqueLinks;
        }
      });
      
      return result;
    });
    
    console.log('✅ 數據提取完成');
    
    // 輸出統計信息
    Object.keys(categoriesData).forEach(category => {
      console.log(`📊 ${category}: ${categoriesData[category].length} 個分類`);
    });
    
    // 確保輸出目錄存在
    const outputDir = path.join(__dirname, '../output');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // 保存結果到 JSON 文件
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const outputPath = path.join(outputDir, `yahoo-stock-categories_${timestamp}.json`);
    
    fs.writeFileSync(outputPath, JSON.stringify(categoriesData, null, 2), 'utf8');
    
    console.log('💾 結果已保存到:', outputPath);
    console.log('🎯 總計:', Object.values(categoriesData).reduce((sum, arr) => sum + arr.length, 0), '個股票分類');
    
    return categoriesData;
    
  } catch (error) {
    console.error('❌ 爬取過程中發生錯誤:', error.message);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// 如果直接執行此腳本
if (require.main === module) {
  scrapeYahooStockCategories()
    .then((data) => {
      console.log('🏆 爬取任務完成！');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 爬取任務失敗:', error);
      process.exit(1);
    });
}

module.exports = { scrapeYahooStockCategories };