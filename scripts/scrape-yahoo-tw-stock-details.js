#!/usr/bin/env node

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

/**
 * Yahoo 股票詳細資料爬蟲腳本
 * 讀取 yahoo-stock-categories.json，遍歷每個分類連結，爬取股票詳細資料
 * 輸出格式: {sectorId: [{name: "公司名", symbolCode: "股票代碼"}]}
 */

// 解析命令行參數
const args = process.argv.slice(2);
const limitArg = args.find((arg) => arg.startsWith('--limit='));
const sectorArg = args.find((arg) => arg.startsWith('--sector='));
const concurrentArg = args.find((arg) => arg.startsWith('--concurrent='));

const limit = limitArg ? parseInt(limitArg.split('=')[1]) : null;
const specificSector = sectorArg ? sectorArg.split('=')[1] : null;
const concurrentLimit = concurrentArg
  ? parseInt(concurrentArg.split('=')[1])
  : 2;

console.log('🔍 Yahoo 股票詳細資料爬蟲啟動');
console.log('====================================');

if (limit) console.log(`📊 限制處理: ${limit} 個分類`);
if (specificSector) console.log(`🎯 指定分類: ${specificSector}`);
console.log(`⚡ 並發數量: ${concurrentLimit}`);

/**
 * 從 URL 中提取 sectorId
 */
function extractSectorId(url) {
  const match = url.match(/sectorId=(\d+)/);
  return match ? match[1] : null;
}

/**
 * 爬取單個分類的股票列表
 */
async function scrapeStockListForSector(
  browser,
  categoryName,
  url,
  retryCount = 0
) {
  const sectorId = extractSectorId(url);
  console.log(`📈 處理分類: ${categoryName} (ID: ${sectorId})`);

  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    viewport: { width: 1920, height: 1080 },
  });

  const page = await context.newPage();

  try {
    console.log(`🔗 載入 URL: ${url}`);

    // 載入頁面
    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    // 等待頁面載入
    await page.waitForTimeout(3000);

    // 等待表格載入
    try {
      await page.waitForSelector('table, [role="table"], .table, tbody', {
        timeout: 10000,
      });
    } catch (e) {
      console.log('⚠️  未檢測到表格元素，繼續嘗試提取');
    }

    // 提取股票列表
    const stockList = await page.evaluate(() => {
      const stocks = [];

      console.log('開始分析頁面結構...');

      // 嘗試多種可能的選擇器
      const selectors = [
        'tbody tr', // 表格行
        'table tr', // 所有表格行
        '[data-symbol]', // 帶有 data-symbol 屬性的元素
        'a[href*="/quote/"]', // 包含 quote 的連結
        '.table-row', // 表格行類
        '.stock-item', // 股票項目類
        'tr[data-row-key]', // 帶有 row key 的表格行
        'div[data-testid*="row"]', // 測試用 ID 包含 row 的 div
        'li', // 列表項目
        '[class*="row"]', // class 包含 row 的元素
      ];

      let foundElements = null;
      let usedSelector = '';

      for (const selector of selectors) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          console.log(
            `測試選擇器: ${selector}, 找到 ${elements.length} 個元素`
          );
          // 檢查第一個元素是否包含股票相關信息
          const firstElement = elements[0];
          const hasStockInfo =
            firstElement.textContent.includes('TW') ||
            firstElement.querySelector('a[href*="quote"]') ||
            /\d{4}/.test(firstElement.textContent);

          if (hasStockInfo) {
            console.log(
              `✅ 使用選擇器: ${selector}, 找到 ${elements.length} 個相關元素`
            );
            foundElements = elements;
            usedSelector = selector;
            break;
          }
        }
      }

      if (!foundElements) {
        console.log('⚠️  未找到股票列表元素，嘗試分析頁面內容...');

        // 分析頁面中所有包含數字的元素
        const allElements = document.querySelectorAll('*');
        const potentialStockElements = [];

        allElements.forEach((el) => {
          const text = el.textContent;
          if (text && /\d{4}\.TW/.test(text)) {
            potentialStockElements.push(el);
          }
        });

        console.log(
          `發現 ${potentialStockElements.length} 個可能包含股票代碼的元素`
        );

        if (potentialStockElements.length > 0) {
          foundElements = potentialStockElements;
          usedSelector = '包含股票代碼的元素';
        } else {
          return [];
        }
      }

      foundElements.forEach((element, index) => {
        try {
          let symbolCode = '';
          let companyName = '';

          // 提取股票代碼的多種方法
          const symbolSelectors = [
            'a[href*="/quote/"]',
            '[data-symbol]',
            '.symbol',
            '.stock-code',
            'td:first-child a',
            'td:first-child',
            'span',
            'div',
          ];

          for (const selector of symbolSelectors) {
            const symbolElement = element.querySelector(selector);
            if (symbolElement) {
              if (symbolElement.href) {
                // 從 URL 中提取股票代碼
                const match = symbolElement.href.match(/quote\/([^\/]+)/);
                if (match) {
                  symbolCode = match[1].replace('.TW', '');
                  break;
                }
              } else if (
                symbolElement.dataset &&
                symbolElement.dataset.symbol
              ) {
                symbolCode = symbolElement.dataset.symbol.replace('.TW', '');
                break;
              } else {
                const text = symbolElement.textContent.trim();
                // 尋找4位數字格式的股票代碼
                const codeMatch = text.match(/(\d{4})/);
                if (codeMatch) {
                  symbolCode = codeMatch[1];
                  break;
                }
              }
            }
          }

          // 如果還沒找到，直接從元素文本中提取
          if (!symbolCode) {
            const fullText = element.textContent;
            const codeMatch = fullText.match(/(\d{4})(?:\.TW)?/);
            if (codeMatch) {
              symbolCode = codeMatch[1];
            }
          }

          // 提取公司名稱的多種方法
          const nameSelectors = [
            'td:nth-child(2)',
            'td:last-child',
            '.company-name',
            '.stock-name',
            'a[title]',
            'span:last-child',
            'div:last-child',
          ];

          for (const selector of nameSelectors) {
            const nameElement = element.querySelector(selector);
            if (nameElement) {
              let name = nameElement.textContent.trim();
              // 移除股票代碼部分，只保留公司名稱
              name = name.replace(/\d{4}\.?TW?/g, '').trim();
              if (name && name.length > 0 && name !== symbolCode) {
                companyName = name;
                break;
              }
            }
          }

          // 如果沒有找到公司名稱，嘗試從連結標題獲取
          if (!companyName) {
            const linkElement = element.querySelector('a[title]');
            if (linkElement && linkElement.title) {
              companyName = linkElement.title.trim();
            }
          }

          // 最後嘗試從整個元素文本中提取名稱
          if (!companyName && symbolCode) {
            const fullText = element.textContent.trim();
            // 移除股票代碼，剩下的可能是公司名稱
            const withoutCode = fullText
              .replace(new RegExp(symbolCode + '(?:\\.TW)?', 'g'), '')
              .trim();
            if (withoutCode && withoutCode.length > 0) {
              companyName = withoutCode;
            }
          }

          // 驗證和清理數據
          if (symbolCode && companyName) {
            // 清理股票代碼 (移除 .TW 後綴)
            symbolCode = symbolCode.replace(/\.TW$/, '');

            // 驗證股票代碼格式 (通常是4位數字)
            if (/^\d{4}$/.test(symbolCode)) {
              stocks.push({
                name: companyName,
                symbolCode: symbolCode,
              });
              console.log(`提取股票: ${symbolCode} - ${companyName}`);
            }
          }
        } catch (error) {
          console.log(`處理第 ${index} 個元素時出錯:`, error.message);
        }
      });

      return stocks;
    });

    console.log(`✅ ${categoryName} 完成，找到 ${stockList.length} 支股票`);

    await context.close();
    return { sectorId, categoryName, stocks: stockList };
  } catch (error) {
    console.error(`❌ ${categoryName} 處理失敗:`, error.message);

    await context.close();

    // 重試機制
    if (retryCount < 2) {
      console.log(`🔄 重試 ${categoryName} (${retryCount + 1}/2)`);
      await new Promise((resolve) => setTimeout(resolve, 2000)); // 等待2秒
      return scrapeStockListForSector(
        browser,
        categoryName,
        url,
        retryCount + 1
      );
    }

    return { sectorId, categoryName, stocks: [], error: error.message };
  }
}

/**
 * 批次處理分類
 */
async function processCategoriesInBatches(browser, categories, batchSize = 2) {
  const results = {};
  const totalCategories = categories.length;
  let processedCount = 0;

  for (let i = 0; i < totalCategories; i += batchSize) {
    const batch = categories.slice(i, i + batchSize);
    console.log(
      `📦 處理批次 ${Math.floor(i / batchSize) + 1}/${Math.ceil(totalCategories / batchSize)}`
    );

    const batchPromises = batch.map((category) =>
      scrapeStockListForSector(browser, category.name, category.url)
    );

    const batchResults = await Promise.allSettled(batchPromises);

    batchResults.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        const { sectorId, categoryName, stocks, error } = result.value;
        if (sectorId) {
          results[sectorId] = {
            categoryName,
            stocks,
            ...(error && { error }),
          };
        }
        processedCount++;
      } else {
        console.error(`❌ 批次處理失敗:`, result.reason);
      }
    });

    console.log(`📊 進度: ${processedCount}/${totalCategories}`);

    // 批次間等待
    if (i + batchSize < totalCategories) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  return results;
}

/**
 * 主函數
 */
async function scrapeYahooStockDetails() {
  try {
    // 讀取股票分類數據
    const categoriesPath = path.join(
      __dirname,
      '../output/yahoo-tw-stock-categories.json'
    );
    if (!fs.existsSync(categoriesPath)) {
      // 嘗試在 output 目錄中尋找最新的文件
      const outputDir = path.join(__dirname, '../output');
      const files = fs
        .readdirSync(outputDir)
        .filter(
          (file) =>
            file.startsWith('yahoo-stock-categories') && file.endsWith('.json')
        )
        .sort((a, b) => b.localeCompare(a)); // 按時間戳排序，最新的在前

      if (files.length === 0) {
        throw new Error('找不到股票分類數據文件');
      }

      const latestFile = path.join(outputDir, files[0]);
      console.log(`📁 使用分類數據文件: ${latestFile}`);
      var categoriesData = JSON.parse(fs.readFileSync(latestFile, 'utf8'));
    } else {
      console.log(`📁 使用分類數據文件: ${categoriesPath}`);
      var categoriesData = JSON.parse(fs.readFileSync(categoriesPath, 'utf8'));
    }

    // 收集所有分類
    const allCategories = [];
    Object.keys(categoriesData).forEach((categoryGroup) => {
      categoriesData[categoryGroup].forEach((category) => {
        allCategories.push(category);
      });
    });

    console.log(`📊 總共發現 ${allCategories.length} 個分類`);

    // 過濾分類
    let categoriesToProcess = allCategories;

    if (specificSector) {
      categoriesToProcess = allCategories.filter(
        (cat) => extractSectorId(cat.url) === specificSector
      );
      console.log(`🎯 過濾後處理 ${categoriesToProcess.length} 個分類`);
    }

    if (limit) {
      categoriesToProcess = categoriesToProcess.slice(0, limit);
      console.log(`📊 限制處理前 ${categoriesToProcess.length} 個分類`);
    }

    // 啟動瀏覽器
    console.log('🚀 啟動瀏覽器...');
    const browser = await chromium.launch({
      headless: true,
      timeout: 30000,
    });

    // 批次處理分類
    const results = await processCategoriesInBatches(
      browser,
      categoriesToProcess,
      concurrentLimit
    );

    await browser.close();

    // 整理結果
    const stockDetails = {};
    let totalStocks = 0;
    let successfulCategories = 0;

    Object.keys(results).forEach((sectorId) => {
      const { categoryName, stocks, error } = results[sectorId];
      stockDetails[sectorId] = stocks;
      totalStocks += stocks.length;
      if (!error && stocks.length > 0) successfulCategories++;
    });

    // 保存結果
    const outputDir = path.join(__dirname, '../output');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const timestamp = new Date()
      .toISOString()
      .slice(0, 10)
      .replace(/-/g, '');
    const outputPath = path.join(
      outputDir,
      `yahoo-tw-stock-details-${timestamp}.json`
    );

    fs.writeFileSync(outputPath, JSON.stringify(stockDetails, null, 2), 'utf8');

    console.log('✅ 爬取完成！');
    console.log('====================================');
    console.log(`📄 結果文件: ${outputPath}`);
    console.log(`📊 處理分類: ${Object.keys(results).length}`);
    console.log(`✅ 成功分類: ${successfulCategories}`);
    console.log(`🎯 總股票數: ${totalStocks}`);

    return stockDetails;
  } catch (error) {
    console.error('❌ 爬取過程中發生錯誤:', error.message);
    throw error;
  }
}

// 如果直接執行此腳本
if (require.main === module) {
  scrapeYahooStockDetails()
    .then((data) => {
      console.log('🏆 爬取任務完成！');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 爬取任務失敗:', error);
      process.exit(1);
    });
}

module.exports = { scrapeYahooStockDetails };
