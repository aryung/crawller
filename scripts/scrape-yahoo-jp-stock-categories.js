#!/usr/bin/env node

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

/**
 * Yahoo Japan 股票分類爬蟲腳本
 * 爬取 Yahoo Finance Japan 的股票分類頁面
 * 輸出格式: {分類名: [{name: "子分類名", url: "連結", categoryId: "分類ID"}]}
 */

async function scrapeYahooJpStockCategories() {
  console.log('🔍 Yahoo Japan 股票分類爬蟲啟動');
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
    
    // 首先嘗試從搜索頁面獲取分類信息
    console.log('📄 正在載入頁面: https://finance.yahoo.co.jp/search/');
    
    await page.goto('https://finance.yahoo.co.jp/search/', {
      waitUntil: 'domcontentloaded',
      timeout: 45000
    });
    
    // 等待頁面完全載入
    await page.waitForTimeout(5000);
    
    console.log('🔍 開始分析日股分類結構...');
    
    // 提取分類數據
    const categoriesData = await page.evaluate(() => {
      const result = {};
      const categories = [];
      
      console.log('開始尋找日股分類...');
      
      // 嘗試多種可能的分類選擇器
      const categorySelectors = [
        'select[name="ids"] option',  // 分類下拉選單
        '.category-list a',           // 分類列表連結
        '[data-category]',            // 帶有分類數據的元素
        'a[href*="ids="]',           // 包含 ids 參數的連結
        '.industry-link',             // 行業連結
        '.category-item'              // 分類項目
      ];
      
      let foundCategories = [];
      
      for (const selector of categorySelectors) {
        const elements = document.querySelectorAll(selector);
        console.log(`測試選擇器 ${selector}: 找到 ${elements.length} 個元素`);
        
        if (elements.length > 0) {
          elements.forEach(element => {
            let categoryId = '';
            let categoryName = '';
            let categoryUrl = '';
            
            if (element.tagName === 'OPTION') {
              // 處理下拉選單選項
              categoryId = element.value;
              categoryName = element.textContent.trim();
              if (categoryId && categoryName && categoryId !== '') {
                categoryUrl = `https://finance.yahoo.co.jp/search/qi/?ids=${categoryId}&page=1`;
              }
            } else if (element.href) {
              // 處理連結元素
              const urlMatch = element.href.match(/ids=([^&]+)/);
              if (urlMatch) {
                categoryId = urlMatch[1];
                categoryName = element.textContent.trim();
                categoryUrl = element.href;
                
                // 確保 URL 包含 page 參數
                if (!categoryUrl.includes('page=')) {
                  categoryUrl += '&page=1';
                }
              }
            } else {
              // 處理其他類型的元素
              const dataCategory = element.getAttribute('data-category');
              if (dataCategory) {
                categoryId = dataCategory;
                categoryName = element.textContent.trim();
                categoryUrl = `https://finance.yahoo.co.jp/search/qi/?ids=${categoryId}&page=1`;
              }
            }
            
            // 驗證並添加分類
            if (categoryId && categoryName && categoryUrl) {
              // 過濾掉空的或無效的選項
              if (categoryName !== '選択してください' && categoryName !== '請選擇' && categoryName.length > 1) {
                foundCategories.push({
                  name: categoryName,
                  url: categoryUrl,
                  categoryId: categoryId
                });
                console.log(`發現分類: ${categoryName} (ID: ${categoryId})`);
              }
            }
          });
          
          if (foundCategories.length > 0) {
            console.log(`✅ 使用選擇器 ${selector} 找到 ${foundCategories.length} 個分類`);
            break; // 找到有效分類後停止
          }
        }
      }
      
      // 如果沒有找到分類，嘗試手動構建一些常見的分類
      if (foundCategories.length === 0) {
        console.log('⚠️  未找到自動分類，使用預設分類列表');
        const defaultCategories = [
          { name: '建設・資材', categoryId: '0050' },
          { name: '食料品', categoryId: '1050' },
          { name: '繊維製品', categoryId: '3050' },
          { name: '化学', categoryId: '4050' },
          { name: '医薬品', categoryId: '4502' },
          { name: '石油・石炭製品', categoryId: '5050' },
          { name: 'ゴム製品', categoryId: '5100' },
          { name: 'ガラス・土石製品', categoryId: '5150' },
          { name: '鉄鋼', categoryId: '5200' },
          { name: '非鉄金属', categoryId: '5250' },
          { name: '金属製品', categoryId: '5300' },
          { name: '機械', categoryId: '6050' },
          { name: '電気機器', categoryId: '6500' },
          { name: '輸送用機器', categoryId: '7050' },
          { name: '精密機器', categoryId: '7200' },
          { name: 'その他製品', categoryId: '7250' },
          { name: '電気・ガス業', categoryId: '9500' },
          { name: '情報・通信業', categoryId: '9550' },
          { name: '証券・商品先物取引業', categoryId: '8650' },
          { name: '保険業', categoryId: '8750' },
          { name: 'その他金融業', categoryId: '8800' },
          { name: '不動産業', categoryId: '8850' },
          { name: 'サービス業', categoryId: '9050' }
        ];
        
        foundCategories = defaultCategories.map(cat => ({
          name: cat.name,
          url: `https://finance.yahoo.co.jp/search/qi/?ids=${cat.categoryId}&page=1`,
          categoryId: cat.categoryId
        }));
      }
      
      // 去重處理
      const uniqueCategories = [];
      const seenIds = new Set();
      
      foundCategories.forEach(category => {
        if (!seenIds.has(category.categoryId)) {
          seenIds.add(category.categoryId);
          uniqueCategories.push(category);
        }
      });
      
      result['日股分類'] = uniqueCategories;
      return result;
    });
    
    console.log('✅ 分類數據提取完成');
    
    // 輸出統計信息
    Object.keys(categoriesData).forEach(categoryGroup => {
      console.log(`📊 ${categoryGroup}: ${categoriesData[categoryGroup].length} 個分類`);
    });
    
    // 顯示前幾個分類作為示例
    if (categoriesData['日股分類'] && categoriesData['日股分類'].length > 0) {
      console.log('\n📋 分類示例:');
      categoriesData['日股分類'].slice(0, 5).forEach(cat => {
        console.log(`  - ${cat.name} (ID: ${cat.categoryId})`);
      });
    }
    
    // 確保輸出目錄存在
    const outputDir = path.join(__dirname, '../output');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // 保存結果到 JSON 文件
    const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const outputPath = path.join(outputDir, `yahoo-jp-stock-categories-${timestamp}.json`);
    
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
  scrapeYahooJpStockCategories()
    .then((data) => {
      console.log('🏆 爬取任務完成！');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 爬取任務失敗:', error);
      process.exit(1);
    });
}

module.exports = { scrapeYahooJpStockCategories };