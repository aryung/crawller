#!/usr/bin/env node

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

/**
 * Yahoo Japan 股票詳細資料爬蟲腳本
 * 讀取 yahoo-jp-stock-categories.json，遍歷每個分類連結，爬取所有分頁的股票詳細資料
 * 核心功能：自動處理某個分類的所有分頁
 * 輸出格式: {categoryId: [{name: "公司名", symbolCode: "股票代碼.S"}]}
 */

// 解析命令行參數
const args = process.argv.slice(2);
const limitArg = args.find(arg => arg.startsWith('--limit='));
const categoryArg = args.find(arg => arg.startsWith('--category='));
const concurrentArg = args.find(arg => arg.startsWith('--concurrent='));
const maxPagesArg = args.find(arg => arg.startsWith('--max-pages='));
const testModeArg = args.includes('--test-mode');

const limit = limitArg ? parseInt(limitArg.split('=')[1]) : null;
const specificCategory = categoryArg ? categoryArg.split('=')[1] : null;
const concurrentLimit = concurrentArg ? parseInt(concurrentArg.split('=')[1]) : 1; // 日股網站較嚴格，減少並發
const maxPages = maxPagesArg ? parseInt(maxPagesArg.split('=')[1]) : (testModeArg ? 2 : 50);

console.log('🔍 Yahoo Japan 股票詳細資料爬蟲啟動');
console.log('====================================');

if (limit) console.log(`📊 限制處理: ${limit} 個分類`);
if (specificCategory) console.log(`🎯 指定分類: ${specificCategory}`);
if (testModeArg) console.log(`🧪 測試模式: 只處理前 ${maxPages} 頁`);
console.log(`⚡ 並發數量: ${concurrentLimit}`);
console.log(`📄 最大頁數: ${maxPages}`);

/**
 * 從 URL 中提取 categoryId
 */
function extractCategoryId(url) {
  const match = url.match(/ids=([^&]+)/);
  return match ? match[1] : null;
}

/**
 * 基於總筆數計算分頁信息 (智能分頁策略)
 */
async function detectPaginationInfo(page) {
  return await page.evaluate(() => {
    console.log('開始檢測分頁信息 (基於總筆數計算)...');
    
    // 核心策略: 從首頁的總筆數信息計算總頁數
    const pageInfoElements = document.querySelectorAll('*');
    for (const element of pageInfoElements) {
      const text = element.textContent || '';
      if (text) {
        // 日本格式: "121～128 / 128件" 或 "1～20 / 161件"
        let match = text.match(/(\d+)～(\d+)\s*\/\s*(\d+)件?/);
        if (match) {
          const [, currentStart, currentEnd, total] = match;
          const totalItems = parseInt(total);
          const itemsPerPage = 20; // Yahoo Finance Japan 每頁固定20筆
          const totalPages = Math.ceil(totalItems / itemsPerPage);
          
          // 從URL獲取當前頁數
          const urlParams = new URLSearchParams(window.location.search);
          const currentPage = parseInt(urlParams.get('page')) || 1;
          const hasMorePages = currentPage < totalPages;
          
          console.log(`📊 智能分頁計算:`);
          console.log(`   總筆數: ${totalItems} 件`);
          console.log(`   每頁筆數: ${itemsPerPage}`);
          console.log(`   計算頁數: ${totalPages} 頁`);
          console.log(`   當前頁: ${currentPage}`);
          console.log(`   還有更多: ${hasMorePages}`);
          
          return {
            hasMore: hasMorePages,
            currentStart: parseInt(currentStart),
            currentEnd: parseInt(currentEnd),
            total: totalItems,
            totalPages: totalPages,
            currentPage: currentPage,
            itemsPerPage: itemsPerPage,
            method: 'smartPagination'
          };
        }
        
        // 備用格式: "1-20 of 128"
        match = text.match(/(\d+)-(\d+)\s+of\s+(\d+)/);
        if (match) {
          const [, currentStart, currentEnd, total] = match;
          const totalItems = parseInt(total);
          const itemsPerPage = 20;
          const totalPages = Math.ceil(totalItems / itemsPerPage);
          
          const urlParams = new URLSearchParams(window.location.search);
          const currentPage = parseInt(urlParams.get('page')) || 1;
          const hasMorePages = currentPage < totalPages;
          
          console.log(`📊 智能分頁計算 (英文格式):`);
          console.log(`   總筆數: ${totalItems} 項`);
          console.log(`   計算頁數: ${totalPages} 頁`);
          console.log(`   當前頁: ${currentPage}`);
          
          return {
            hasMore: hasMorePages,
            currentStart: parseInt(currentStart),
            currentEnd: parseInt(currentEnd),
            total: totalItems,
            totalPages: totalPages,
            currentPage: currentPage,
            itemsPerPage: itemsPerPage,
            method: 'smartPagination'
          };
        }
      }
    }
    
    // 備用方法: 檢查是否有股票數據
    const stockElements = document.querySelectorAll('a[href*="/quote/"], a[href*="code="]');
    if (stockElements.length > 0) {
      console.log(`發現 ${stockElements.length} 個股票，但無總筆數信息，假設單頁`);
      return { 
        hasMore: false, 
        total: stockElements.length,
        totalPages: 1,
        currentPage: 1,
        method: 'singlePageDetected' 
      };
    }
    
    console.log('❌ 未檢測到任何分頁或股票信息');
    return { 
      hasMore: false, 
      total: 0,
      totalPages: 0,
      currentPage: 1,
      method: 'noData' 
    };
  });
}

/**
 * 從頁面提取股票數據 (日股特殊處理)
 */
async function extractStocksFromPage(page) {
  return await page.evaluate(() => {
    const stocks = [];
    
    console.log('開始提取日股數據...');
    
    // Yahoo Finance Japan 專用選擇器策略
    const selectors = [
      // Yahoo Finance Japan 特定選擇器
      'table.bordertbl tr',              // Yahoo Finance Japan 表格
      'table.boardtbl tr',               // 備用表格類名
      'tr[bgcolor]',                     // 帶背景色的行
      'table tr[bgcolor="#ffffff"]',     // 白色背景行
      'table tr[bgcolor="#ffffcc"]',     // 黃色背景行
      // 通用表格選擇器
      'tbody tr',                        // 表格體行
      'table tr',                        // 所有表格行
      // 股票連結選擇器
      'a[href*="/quote/"]',              // 股票詳情連結
      'a[href*="code="]',                // 股票代碼連結
      // 通用選擇器
      'tr',                              // 所有行
      'div[class*="row"]',               // 包含row的div
      'li'                               // 列表項
    ];
    
    let foundElements = null;
    let usedSelector = '';
    
    // 首先搜索 Yahoo Finance Japan 的所有連結，這些通常包含股票代碼
    const stockLinks = document.querySelectorAll('a[href*="/quote/"], a[href*="code="]');
    if (stockLinks.length > 0) {
      console.log(`✅ 發現 ${stockLinks.length} 個股票連結`);
      foundElements = Array.from(stockLinks).map(link => link.closest('tr') || link.parentElement);
      usedSelector = '股票連結的父級元素';
    } else {
      // 如果沒有找到股票連結，嘗試選擇器策略
      for (const selector of selectors) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          console.log(`測試選擇器: ${selector}, 找到 ${elements.length} 個元素`);
          
          // 檢查前幾個元素是否包含日股相關信息
          let hasJpStockInfo = false;
          for (let i = 0; i < Math.min(5, elements.length); i++) {
            const text = elements[i].textContent;
            if (text && (/\d{4}\.T|\.S/.test(text) || text.includes('株') || /\d{4}/.test(text))) {
              hasJpStockInfo = true;
              break;
            }
          }
          
          if (hasJpStockInfo) {
            console.log(`✅ 使用選擇器: ${selector}, 找到 ${elements.length} 個相關元素`);
            foundElements = elements;
            usedSelector = selector; 
            break;
          }
        }
      }
    }
    
    if (!foundElements || foundElements.length === 0) {
      console.log('⚠️  未找到股票元素，嘗試全域搜索...');
      
      // 全域搜索包含日股代碼模式的元素
      const allElements = document.querySelectorAll('*');
      const jpStockElements = [];
      
      allElements.forEach(el => {
        const text = el.textContent || '';
        // 搜索日股代碼格式: nnnn.T 或 nnnn.S
        if (text && /\b\d{4}\.[TS]\b/.test(text)) {
          // 確保不是重複的父子元素
          let isChild = false;
          for (const existing of jpStockElements) {
            if (existing.contains(el) || el.contains(existing)) {
              isChild = true;
              break;
            }
          }
          if (!isChild) {
            jpStockElements.push(el);
          }
        }
      });
      
      if (jpStockElements.length > 0) {
        foundElements = jpStockElements;
        usedSelector = '全域搜索日股代碼';
        console.log(`發現 ${jpStockElements.length} 個包含日股代碼的元素`);
      } else {
        console.log('❌ 完全未找到股票數據');
        
        // 最後嘗試：檢查頁面是否真的有內容
        const bodyText = document.body.textContent || '';
        console.log(`頁面內容長度: ${bodyText.length}`);
        console.log(`頁面前200字符: ${bodyText.substring(0, 200)}`);
        
        return [];
      }
    }
    
    // 提取股票數據
    foundElements.forEach((element, index) => {
      try {
        let symbolCode = '';
        let companyName = '';
        
        const elementText = element.textContent || '';
        
        // 提取日股代碼 - 支援多種格式
        // 1. 優先從連結URL提取
        const links = element.querySelectorAll('a[href*="/quote/"], a[href*="code="]');
        for (const link of links) {
          const href = link.href || '';
          // 從 /quote/1234.T 或 code=1234 提取
          let match = href.match(/quote\/(\d{4}\.[TS])/);
          if (!match) {
            match = href.match(/code=(\d{4})/);
            if (match) {
              // 如果只有數字，預設加上 .T
              symbolCode = match[1] + '.T';
            }
          } else {
            symbolCode = match[1];
          }
          if (symbolCode) break;
        }
        
        // 2. 從文本中直接提取日股代碼
        if (!symbolCode) {
          // 支援多種日股格式: 1234.T, 1234.S, 或純數字(預設為.T)
          let codeMatch = elementText.match(/\b(\d{4}\.[TS])\b/);
          if (codeMatch) {
            symbolCode = codeMatch[1];
          } else {
            // 如果找到4位數字但沒有後綴，嘗試添加.T
            codeMatch = elementText.match(/\b(\d{4})\b/);
            if (codeMatch && !elementText.includes('年') && !elementText.includes('月')) {
              // 確保不是日期
              symbolCode = codeMatch[1] + '.T';
            }
          }
        }
        
        // 提取公司名稱
        if (symbolCode) {
          // 1. 嘗試從連結文本或title提取
          const stockLink = element.querySelector('a[href*="/quote/"], a[href*="code="]');
          if (stockLink) {
            const linkText = stockLink.textContent?.trim() || '';
            const linkTitle = stockLink.title?.trim() || '';
            
            if (linkTitle && linkTitle !== symbolCode && !linkTitle.includes('詳細')) {
              companyName = linkTitle;
            } else if (linkText && linkText !== symbolCode && linkText.length > 1) {
              companyName = linkText.replace(/\d{4}\.[TS]/g, '').trim();
            }
          }
          
          // 2. 如果沒找到，從表格單元格提取
          if (!companyName) {
            const cells = element.querySelectorAll('td');
            for (const cell of cells) {
              const cellText = cell.textContent?.trim() || '';
              // 跳過包含數字、日期、價格的單元格
              if (cellText && 
                  !cellText.includes(symbolCode.replace('.T', '').replace('.S', '')) &&
                  !/^\d+$/.test(cellText) &&
                  !/^\d+\.\d+$/.test(cellText) &&
                  !/^\d{4}\/\d{1,2}\/\d{1,2}/.test(cellText) &&
                  cellText.length > 1 &&
                  cellText.length < 50) {
                companyName = cellText;
                break;
              }
            }
          }
          
          // 3. 最後從整個元素文本提取，移除股票代碼和數字
          if (!companyName) {
            let cleanText = elementText;
            // 移除股票代碼
            cleanText = cleanText.replace(new RegExp(symbolCode.replace('.', '\\.'), 'g'), '');
            // 移除純數字、日期、價格等
            cleanText = cleanText.replace(/\b\d+\.?\d*\b/g, ' ');
            cleanText = cleanText.replace(/\d{4}\/\d{1,2}\/\d{1,2}/g, ' ');
            cleanText = cleanText.replace(/\s+/g, ' ').trim();
            
            if (cleanText && cleanText.length > 1 && cleanText.length < 50) {
              companyName = cleanText;
            }
          }
        }
        
        // 清理公司名稱 (適度清理，保持可讀性)
        if (companyName) {
          // 基本清理
          companyName = companyName.replace(/\s+/g, ' ').trim();
          
          // 移除明顯的股票相關信息
          companyName = companyName.replace(/東証\w+/g, ''); // 移除東証標記
          companyName = companyName.replace(/\d+,?\d*\+?-?\d*\(\+?-?\d*\.?\d*%?\)/g, ''); // 移除價格和百分比
          companyName = companyName.replace(/時価総額[\d,]+百万円/g, ''); // 移除時價總額
          companyName = companyName.replace(/\d+\/\d+/g, ''); // 移除日期格式 8/5
          companyName = companyName.replace(/\d{4}\.[TS]/g, ''); // 移除股票代碼本身
          
          // 移除純股票代碼數字部分 (開頭的4位數字)
          companyName = companyName.replace(/^\d{4}\s*/, '');
          
          // 移除尾部的價格數字 (如: 1,787. 或 2,001.)
          companyName = companyName.replace(/\d{1,3}(,\d{3})*\.?\s*$/g, '');
          companyName = companyName.replace(/\d+\.\s*$/g, ''); // 移除結尾的數字.
          
          // 移除無關連結文字
          const unwantedWords = ['詳細', '株価', 'チャート', '時系列', 'ニュース', '主優待'];
          for (const word of unwantedWords) {
            if (companyName.trim() === word) {
              companyName = '';
              break;
            }
          }
          
          // 最終清理
          companyName = companyName.replace(/\s+/g, ' ').trim();
        }
        
        // 驗證和添加股票數據
        if (symbolCode && companyName) {
          // 驗證日股代碼格式和公司名稱有效性
          if (/^\d{4}\.[TS]$/.test(symbolCode) && 
              companyName.length > 0 && 
              companyName.length < 50 &&
              !companyName.match(/^(時系列|ニュース|主優待|詳細|株価|チャート)$/)) {
            
            // 檢查是否已存在相同的股票代碼，避免重複
            const existingStock = stocks.find(stock => stock.symbolCode === symbolCode);
            if (!existingStock) {
              stocks.push({
                name: companyName,
                symbolCode: symbolCode
              });
              console.log(`✅ 提取日股: ${symbolCode} - ${companyName}`);
            } else {
              console.log(`⚠️  跳過重複股票: ${symbolCode}`);
            }
          }
        } else if (symbolCode && !companyName) {
          console.log(`⚠️  跳過無名稱股票: ${symbolCode}`);
        } else if (!symbolCode && companyName) {
          console.log(`⚠️  跳過無代碼公司: ${companyName}`);
        }
        
      } catch (error) {
        console.log(`❌ 處理第 ${index} 個元素時出錯:`, error.message);
      }
    });
    
    console.log(`本頁提取完成: ${stocks.length} 支股票`);
    
    return stocks;
  });
}

/**
 * 智能分頁處理 - 基於總筆數計算的分頁策略
 */
async function scrapeAllPagesForCategory(browser, categoryUrl, categoryId, categoryName) {
  console.log(`\n📄 開始處理分類: ${categoryName} (ID: ${categoryId})`);
  console.log(`🔗 基礎 URL: ${categoryUrl}`);
  
  let allStocks = [];
  let totalPages = 1;
  let actualPagesProcessed = 0;
  
  // 第一步：從首頁獲取總筆數和計算總頁數
  const firstPage = await browser.newPage();
  try {
    const firstPageUrl = categoryUrl.replace(/page=\d+/, 'page=1');
    console.log(`  🔍 分析首頁獲取總筆數: ${firstPageUrl}`);
    
    await firstPage.goto(firstPageUrl, { 
      waitUntil: 'domcontentloaded', 
      timeout: 30000 
    });
    await firstPage.waitForTimeout(3000);
    
    // 獲取分頁信息
    const paginationInfo = await detectPaginationInfo(firstPage);
    console.log(`    📊 首頁分頁分析: ${JSON.stringify(paginationInfo)}`);
    
    if (paginationInfo.method === 'smartPagination') {
      totalPages = paginationInfo.totalPages;
      console.log(`    🎯 智能分頁: 總共 ${paginationInfo.total} 筆數據，計算得 ${totalPages} 頁`);
    } else {
      console.log(`    ⚠️  未檢測到總筆數，將使用舊方法逐頁處理`);
      totalPages = maxPages; // 使用原有的最大頁數限制
    }
    
    await firstPage.close();
    
  } catch (error) {
    console.error(`    ❌ 首頁分析失敗:`, error.message);
    await firstPage.close();
    totalPages = maxPages; // 使用舊方法
  }
  
  // 第二步：依序處理每一頁
  let consecutiveEmptyPages = 0;
  const maxEmptyPages = 3;
  
  for (let currentPage = 1; currentPage <= totalPages; currentPage++) {
    // 檢查是否達到最大頁數限制
    if (currentPage > maxPages) {
      console.log(`    🛑 達到最大頁數限制: ${maxPages}`);
      break;
    }
    
    // 檢查連續空頁停止條件
    if (consecutiveEmptyPages >= maxEmptyPages) {
      console.log(`    🛑 連續 ${consecutiveEmptyPages} 頁無數據，停止處理`);
      break;
    }
    
    const pageUrl = categoryUrl.replace(/page=\d+/, `page=${currentPage}`);
    console.log(`  📖 處理第 ${currentPage}/${totalPages} 頁...`);
    
    const page = await browser.newPage();
    
    try {
      await page.goto(pageUrl, { 
        waitUntil: 'domcontentloaded', 
        timeout: 30000 
      });
      await page.waitForTimeout(3000);
      
      // 提取本頁股票數據
      const pageStocks = await extractStocksFromPage(page);
      
      if (pageStocks.length === 0) {
        consecutiveEmptyPages++;
        console.log(`    ⚠️  第 ${currentPage} 頁無數據 (連續空頁: ${consecutiveEmptyPages}/${maxEmptyPages})`);
      } else {
        allStocks.push(...pageStocks);
        consecutiveEmptyPages = 0; // 重置空頁計數
        console.log(`    ✅ 第 ${currentPage} 頁: ${pageStocks.length} 支股票 (累計: ${allStocks.length})`);
      }
      
      actualPagesProcessed = currentPage;
      await page.close();
      
      // 請求間隔 (避免對服務器造成壓力)
      if (currentPage < totalPages) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
    } catch (error) {
      console.error(`    ❌ 第 ${currentPage} 頁處理失敗:`, error.message);
      await page.close();
      
      // 網絡錯誤重試一次
      if (error.message.includes('timeout') && consecutiveEmptyPages < 2) {
        console.log(`    🔄 重試第 ${currentPage} 頁...`);
        await new Promise(resolve => setTimeout(resolve, 5000));
        currentPage--; // 重試當前頁
        continue;
      }
      
      // 如果當前頁失敗但之前有成功的頁面，繼續處理下一頁
      if (allStocks.length > 0) {
        console.log(`    ⏭️  跳過失敗頁面，繼續處理下一頁...`);
        consecutiveEmptyPages++;
        continue;
      } else {
        break; // 如果還沒有成功頁面就失敗，停止處理
      }
    }
  }
  
  console.log(`  🎯 ${categoryName} 完成: 預期 ${totalPages} 頁，實際處理 ${actualPagesProcessed} 頁，提取 ${allStocks.length} 支股票`);
  
  return { 
    categoryId, 
    categoryName, 
    stocks: allStocks, 
    totalPages: actualPagesProcessed,
    expectedPages: totalPages,
    scrapedAt: new Date().toISOString()
  };
}

/**
 * 批次處理分類
 */
async function processCategoriesInBatches(browser, categories, batchSize = 1) {
  const results = {};
  const metadata = {};
  const totalCategories = categories.length;
  let processedCount = 0;
  
  console.log(`\n🚀 開始批次處理 ${totalCategories} 個分類 (批次大小: ${batchSize})`);
  
  for (let i = 0; i < totalCategories; i += batchSize) {
    const batch = categories.slice(i, i + batchSize);
    console.log(`\n📦 處理批次 ${Math.floor(i / batchSize) + 1}/${Math.ceil(totalCategories / batchSize)}`);
    
    const batchPromises = batch.map(category => 
      scrapeAllPagesForCategory(browser, category.url, category.categoryId, category.name)
    );
    
    const batchResults = await Promise.allSettled(batchPromises);
    
    batchResults.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        const { categoryId, categoryName, stocks, totalPages, expectedPages, scrapedAt, error } = result.value;
        if (categoryId) {
          results[categoryId] = stocks;
          metadata[categoryId] = {
            categoryName,
            totalPages,
            expectedPages: expectedPages || totalPages,
            totalStocks: stocks.length,
            scrapedAt,
            paginationMethod: 'smartPagination',
            ...(error && { error })
          };
        }
        processedCount++;
      } else {
        console.error(`❌ 批次處理失敗:`, result.reason);
      }
    });
    
    console.log(`📊 總進度: ${processedCount}/${totalCategories}`);
    
    // 批次間等待 (日股網站保護)
    if (i + batchSize < totalCategories) {
      console.log('⏳ 批次間休息 5 秒...');
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
  
  return { results, metadata };
}

/**
 * 主函數
 */
async function scrapeYahooJpStockDetails() {
  try {
    // 讀取日股分類數據
    let categoriesPath = path.join(__dirname, '../output');
    const files = fs.readdirSync(categoriesPath)
      .filter(file => file.startsWith('yahoo-jp-stock-categories') && file.endsWith('.json'))
      .sort((a, b) => b.localeCompare(a)); // 最新的在前
    
    if (files.length === 0) {
      throw new Error('找不到日股分類數據文件，請先執行 scrape-yahoo-jp-stock-categories.js');
    }
    
    const latestFile = path.join(categoriesPath, files[0]);
    console.log(`📁 使用分類數據文件: ${latestFile}`);
    const categoriesData = JSON.parse(fs.readFileSync(latestFile, 'utf8'));
    
    // 收集所有分類
    const allCategories = [];
    Object.keys(categoriesData).forEach(categoryGroup => {
      categoriesData[categoryGroup].forEach(category => {
        allCategories.push(category);
      });
    });
    
    console.log(`📊 總共發現 ${allCategories.length} 個分類`);
    
    // 過濾分類
    let categoriesToProcess = allCategories;
    
    if (specificCategory) {
      categoriesToProcess = allCategories.filter(cat => 
        cat.categoryId === specificCategory
      );
      console.log(`🎯 指定分類過濾後: ${categoriesToProcess.length} 個分類`);
    }
    
    if (limit) {
      categoriesToProcess = categoriesToProcess.slice(0, limit);
      console.log(`📊 數量限制後: ${categoriesToProcess.length} 個分類`);
    }
    
    if (categoriesToProcess.length === 0) {
      throw new Error('沒有找到要處理的分類');
    }
    
    // 啟動瀏覽器
    console.log('🚀 啟動瀏覽器...');
    const browser = await chromium.launch({ 
      headless: true,
      timeout: 30000 
    });
    
    // 批次處理分類 (包含完整分頁處理)
    const { results, metadata } = await processCategoriesInBatches(
      browser, 
      categoriesToProcess, 
      concurrentLimit
    );
    
    await browser.close();
    
    // 統計結果
    let totalStocks = 0;
    let totalPages = 0;
    let successfulCategories = 0;
    
    Object.keys(results).forEach(categoryId => {
      const stocks = results[categoryId];
      const meta = metadata[categoryId];
      totalStocks += stocks.length;
      totalPages += meta.totalPages || 0;
      if (stocks.length > 0) successfulCategories++;
    });
    
    // 構建最終輸出
    const finalOutput = {
      ...results,
      _metadata: metadata
    };
    
    // 保存結果
    const outputDir = path.join(__dirname, '../output');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const outputPath = path.join(outputDir, `yahoo-jp-stock-details_${timestamp}.json`);
    
    fs.writeFileSync(outputPath, JSON.stringify(finalOutput, null, 2), 'utf8');
    
    console.log('\n✅ 日股爬取完成！');
    console.log('====================================');
    console.log(`📄 結果文件: ${outputPath}`);
    console.log(`📊 處理分類: ${Object.keys(results).length}`);
    console.log(`✅ 成功分類: ${successfulCategories}`);
    console.log(`📄 總處理頁數: ${totalPages}`);
    console.log(`🎯 總股票數: ${totalStocks}`);
    
    return finalOutput;
    
  } catch (error) {
    console.error('❌ 爬取過程中發生錯誤:', error.message);
    throw error;
  }
}

// 如果直接執行此腳本
if (require.main === module) {
  scrapeYahooJpStockDetails()
    .then((data) => {
      console.log('🏆 日股爬取任務完成！');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 日股爬取任務失敗:', error);
      process.exit(1);
    });
}

module.exports = { scrapeYahooJpStockDetails };