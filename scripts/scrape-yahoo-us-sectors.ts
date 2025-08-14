#!/usr/bin/env tsx

import { chromium, Browser, BrowserContext, Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

interface SectorStock {
  symbol: string;
  sector: string;
  scraped_at: string;
}

interface SectorMetadata {
  sector_filter: string;
  scraped_date: string;
  total_pages_scraped: number;
  total_records: number;
  unique_stocks: number;
  duplicates_removed: number;
  detected_total_results?: number | null;
  sectors_distribution: Record<string, number>;
}

interface SectorOutput {
  metadata: SectorMetadata;
  data: SectorStock[];
}

interface DetectionResult {
  totalResults: number | null;
  totalPages: number | null;
}

// Sector 對應表
const SECTORS: Record<string, string> = {
  'technology': 'sec-ind_sec-largest-equities_technology',
  'financial': 'sec-ind_sec-largest-equities_financial-services',
  'healthcare': 'sec-ind_sec-largest-equities_healthcare',
  'consumer': 'sec-ind_sec-largest-equities_consumer-cyclical',
  'industrial': 'sec-ind_sec-largest-equities_industrials',
  'communication': 'sec-ind_sec-largest-equities_communication-services',
  'energy': 'sec-ind_sec-largest-equities_energy',
  'realestate': 'sec-ind_sec-largest-equities_real-estate',
  'materials': 'sec-ind_sec-largest-equities_basic-materials',
  'utilities': 'sec-ind_sec-largest-equities_utilities',
  'defensive': 'sec-ind_sec-largest-equities_consumer-defensive'
};

const OUTPUT_DIR = path.join(__dirname, '../output/yahoo-us-sectors');

async function ensureDir(dir: string): Promise<void> {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

async function detectTotalResults(page: Page, url: string): Promise<DetectionResult> {
  console.log('🔍 偵測總筆數...');
  
  // 訪問第一頁
  await page.goto(url, {
    waitUntil: 'domcontentloaded',
    timeout: 30000
  });
  
  await page.waitForTimeout(3000);
  
  // 嘗試多種方式偵測總筆數
  const totalResults = await page.evaluate(() => {
    // 方法1: 尋找 "Showing X-Y of Z results" 文字
    const bodyText = document.body.innerText;
    
    // 嘗試不同的模式
    const patterns = [
      /of\s+([\d,]+)\s+results/i,
      /(\d+(?:,\d+)*)\s+results/i,
      /Showing\s+\d+\s*-\s*\d+\s+of\s+([\d,]+)/i,
      /total:\s*([\d,]+)/i
    ];
    
    for (const pattern of patterns) {
      const match = bodyText.match(pattern);
      if (match) {
        return parseInt(match[1].replace(/,/g, ''));
      }
    }
    
    // 方法2: 尋找分頁元素
    const paginationElements = document.querySelectorAll('[data-testid*="pagination"], .pagination, [class*="pagination"]');
    for (const elem of paginationElements) {
      const text = elem.textContent || '';
      const match = text.match(/(\d+(?:,\d+)*)/);
      if (match) {
        const num = parseInt(match[1].replace(/,/g, ''));
        if (num > 100) { // 應該是總數而不是頁數
          return num;
        }
      }
    }
    
    // 方法3: 計算實際的資料筆數（如果顯示在頁面上）
    const rows = document.querySelectorAll('tbody tr');
    if (rows.length > 0) {
      console.log(`Found ${rows.length} rows on first page`);
    }
    
    return null;
  });
  
  if (totalResults) {
    console.log(`✅ 偵測到總筆數: ${totalResults.toLocaleString()}`);
    const totalPages = Math.ceil(totalResults / 100);
    console.log(`📄 預計需要爬取 ${totalPages} 頁`);
    return { totalResults, totalPages };
  } else {
    console.log('⚠️ 無法自動偵測總筆數，將持續爬取直到沒有資料');
    return { totalResults: null, totalPages: null };
  }
}

async function scrapePage(page: Page, url: string, pageNum: number): Promise<SectorStock[]> {
  // 構建 URL（如果有頁碼）
  const pageUrl = pageNum > 1 
    ? `${url}?start=${(pageNum - 1) * 100}&count=100`
    : url;
  
  console.log(`📄 爬取第 ${pageNum} 頁...`);
  
  await page.goto(pageUrl, {
    waitUntil: 'domcontentloaded',
    timeout: 30000
  });
  
  await page.waitForTimeout(3000);
  
  // 滾動觸發懶載入
  await page.evaluate(() => {
    window.scrollTo(0, 500);
  });
  await page.waitForTimeout(2000);
  
  // 提取資料
  const stocks = await page.evaluate(() => {
    const results: { symbol: string; sector: string; scraped_at: string }[] = [];
    const rows = document.querySelectorAll('tbody tr');
    
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      
      // Symbol - 第2列
      const symbolLink = row.querySelector('td:nth-child(2) a[href*="/quote/"]');
      
      // Sector - 第14列
      const sectorCell = row.querySelector('td:nth-child(14)');
      
      if (symbolLink) {
        const href = symbolLink.getAttribute('href') || '';
        const match = href.match(/\/quote\/([^\/\?]+)/);
        const symbol = match ? match[1].toUpperCase() : '';
        const sector = sectorCell ? sectorCell.textContent?.trim() || 'Unknown' : 'Unknown';
        
        // 驗證 symbol
        if (symbol && symbol.length <= 5 && /^[A-Z][A-Z0-9.\-]*$/.test(symbol)) {
          results.push({
            symbol: symbol,
            sector: sector,
            scraped_at: new Date().toISOString()
          });
        }
      }
    }
    
    return results;
  });
  
  console.log(`   ✅ 取得 ${stocks.length} 筆資料`);
  return stocks;
}

async function scrapeSector(sectorName: string, sectorPath: string, maxPages: number | null = null): Promise<number> {
  console.log('\n' + '='.repeat(60));
  console.log(`🏢 開始爬取 ${sectorName.toUpperCase()} Sector`);
  console.log('='.repeat(60));
  
  const browser: Browser = await chromium.launch({ headless: true });
  const context: BrowserContext = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
  });
  const page: Page = await context.newPage();
  
  const baseUrl = `https://finance.yahoo.com/research-hub/screener/${sectorPath}`;
  const allStocks: SectorStock[] = [];
  const sectorCount: Record<string, number> = {};
  
  try {
    // 偵測總筆數
    const { totalResults, totalPages } = await detectTotalResults(page, baseUrl);
    
    // 決定要爬取的頁數
    let pagesToScrape = totalPages || 100; // 預設最多100頁
    if (maxPages && maxPages < pagesToScrape) {
      pagesToScrape = maxPages;
      console.log(`🎯 限制爬取 ${maxPages} 頁`);
    }
    
    // 開始爬取
    let emptyPageCount = 0;
    
    for (let pageNum = 1; pageNum <= pagesToScrape; pageNum++) {
      const stocks = await scrapePage(page, baseUrl, pageNum);
      
      if (stocks.length === 0) {
        emptyPageCount++;
        console.log(`   ⚠️ 第 ${pageNum} 頁沒有資料`);
        
        // 連續3頁沒有資料就停止
        if (emptyPageCount >= 3) {
          console.log('📌 連續3頁沒有資料，停止爬取');
          break;
        }
      } else {
        emptyPageCount = 0;
        allStocks.push(...stocks);
        
        // 統計 sectors
        stocks.forEach(stock => {
          sectorCount[stock.sector] = (sectorCount[stock.sector] || 0) + 1;
        });
      }
      
      // 顯示進度
      const progress = Math.round((pageNum / pagesToScrape) * 100);
      console.log(`   進度: ${progress}% | 累計: ${allStocks.length} 筆`);
      
      // 等待避免過快請求
      if (pageNum < pagesToScrape) {
        await page.waitForTimeout(2000 + Math.random() * 2000);
      }
    }
    
    // 去重處理
    const uniqueStocks: SectorStock[] = [];
    const seenSymbols = new Set<string>();
    
    for (const stock of allStocks) {
      if (!seenSymbols.has(stock.symbol)) {
        seenSymbols.add(stock.symbol);
        uniqueStocks.push(stock);
      }
    }
    
    // 儲存結果
    if (uniqueStocks.length > 0) {
      const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const filename = `yahoo-us-${sectorName}-${timestamp}.json`;
      const filepath = path.join(OUTPUT_DIR, filename);
      
      const output: SectorOutput = {
        metadata: {
          sector_filter: sectorName,
          scraped_date: new Date().toISOString(),
          total_pages_scraped: Math.min(pagesToScrape, totalPages || pagesToScrape),
          total_records: allStocks.length,
          unique_stocks: uniqueStocks.length,
          duplicates_removed: allStocks.length - uniqueStocks.length,
          detected_total_results: totalResults,
          sectors_distribution: sectorCount
        },
        data: uniqueStocks.sort((a, b) => a.symbol.localeCompare(b.symbol))
      };
      
      fs.writeFileSync(filepath, JSON.stringify(output, null, 2));
      
      console.log('\n' + '='.repeat(60));
      console.log(`✅ ${sectorName.toUpperCase()} Sector 爬取完成！`);
      console.log('='.repeat(60));
      console.log(`📊 統計：`);
      console.log(`   • 爬取頁數: ${Math.min(pagesToScrape, totalPages || pagesToScrape)}`);
      console.log(`   • 總記錄數: ${allStocks.length}`);
      console.log(`   • 唯一股票: ${uniqueStocks.length}`);
      console.log(`   • 移除重複: ${allStocks.length - uniqueStocks.length}`);
      
      if (totalResults) {
        console.log(`   • 偵測總數: ${totalResults}`);
      }
      
      console.log(`\n📊 Sector 分布:`);
      Object.entries(sectorCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .forEach(([sector, count]) => {
          console.log(`   • ${sector}: ${count}`);
        });
      
      if (Object.keys(sectorCount).length > 5) {
        console.log(`   • ...還有 ${Object.keys(sectorCount).length - 5} 個其他 sectors`);
      }
      
      console.log(`\n💾 儲存至: ${filepath}`);
    } else {
      console.log('⚠️ 沒有爬取到任何資料');
    }
    
  } catch (error: any) {
    console.error('❌ 錯誤:', error.message);
    throw error;
  } finally {
    await browser.close();
  }
  
  return allStocks.length;
}

async function main(): Promise<void> {
  // 解析命令列參數
  const args = process.argv.slice(2);
  let sectorName = 'technology';
  let maxPages: number | null = null;
  let scrapeAll = false;
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--sector' && args[i + 1]) {
      sectorName = args[i + 1].toLowerCase();
      i++;
    } else if (args[i] === '--limit' && args[i + 1]) {
      maxPages = parseInt(args[i + 1]);
      i++;
    } else if (args[i] === '--all') {
      scrapeAll = true;
    } else if (args[i] === '--help') {
      console.log(`
Yahoo Finance US Sectors 智能爬蟲

使用方式:
  tsx scripts/scrape-yahoo-us-sectors.ts [選項]

選項:
  --sector <name>   指定 sector (預設: technology)
  --limit <number>  限制最大頁數
  --all            爬取所有 sectors
  --help           顯示此說明

可用的 Sectors:
  ${Object.keys(SECTORS).join(', ')}

範例:
  tsx scripts/scrape-yahoo-us-sectors.ts --sector healthcare
  tsx scripts/scrape-yahoo-us-sectors.ts --sector technology --limit 10
  tsx scripts/scrape-yahoo-us-sectors.ts --all
      `);
      process.exit(0);
    }
  }
  
  console.log('🚀 Yahoo Finance US Sectors 智能爬蟲');
  console.log('📊 自動偵測總筆數，智能爬取');
  
  await ensureDir(OUTPUT_DIR);
  
  if (scrapeAll) {
    // 爬取所有 sectors
    console.log('\n📋 將爬取所有 Sectors...\n');
    let totalStocks = 0;
    
    for (const [name, path] of Object.entries(SECTORS)) {
      const count = await scrapeSector(name, path, maxPages);
      totalStocks += count;
      
      // 等待一下再爬取下一個 sector
      if (name !== Object.keys(SECTORS)[Object.keys(SECTORS).length - 1]) {
        console.log('\n⏳ 等待 5 秒後繼續下一個 Sector...\n');
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('🎉 所有 Sectors 爬取完成！');
    console.log(`📊 總計爬取 ${totalStocks} 筆資料`);
    console.log('='.repeat(60));
    
  } else {
    // 爬取單一 sector
    const sectorPath = SECTORS[sectorName];
    
    if (!sectorPath) {
      console.error(`❌ 未知的 sector: ${sectorName}`);
      console.log(`可用的 sectors: ${Object.keys(SECTORS).join(', ')}`);
      process.exit(1);
    }
    
    await scrapeSector(sectorName, sectorPath, maxPages);
  }
}

// Execute if script is run directly
if (require.main === module) {
  main()
    .then(() => {
      console.log('🏆 Scraping task completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Scraping task failed:', error);
      process.exit(1);
    });
}

export { main as scrapeYahooUSSectors, scrapeSector };