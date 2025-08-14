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
  scraped_date: string;
  total_pages: number;
  total_records: number;
  unique_stocks: number;
  duplicates_removed: number;
  sectors_distribution: Record<string, number>;
}

interface SectorOutput {
  metadata: SectorMetadata;
  data: SectorStock[];
}

const OUTPUT_DIR = path.join(__dirname, '../output/yahoo-us-sectors');
const ITEMS_PER_PAGE = 100;
const BASE_URL = 'https://finance.yahoo.com/research-hub/screener/sec-ind_sec-largest-equities_technology';

async function ensureDir(dir: string): Promise<void> {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

async function scrapePage(page: Page, pageNum: number): Promise<SectorStock[]> {
  const start = (pageNum - 1) * ITEMS_PER_PAGE;
  const url = `${BASE_URL}/?start=${start}&count=${ITEMS_PER_PAGE}`;
  
  console.log(`📄 Scraping page ${pageNum}: ${url}`);
  
  await page.goto(url, {
    waitUntil: 'domcontentloaded',
    timeout: 30000
  });
  
  // Wait for table to load
  await page.waitForTimeout(5000);
  
  // Scroll to trigger lazy loading
  await page.evaluate(() => {
    window.scrollTo(0, 500);
  });
  await page.waitForTimeout(2000);
  
  // Extract data
  const stocks = await page.evaluate(() => {
    const results: { symbol: string; sector: string; scraped_at: string }[] = [];
    const rows = document.querySelectorAll('tbody tr');
    
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      
      // Symbol - 2nd column
      const symbolLink = row.querySelector('td:nth-child(2) a[href*="/quote/"]');
      
      // Sector - 14th column
      const sectorCell = row.querySelector('td:nth-child(14)');
      
      if (symbolLink) {
        const href = symbolLink.getAttribute('href') || '';
        const match = href.match(/\/quote\/([^\/\?]+)/);
        const symbol = match ? match[1].toUpperCase() : '';
        const sector = sectorCell ? sectorCell.textContent?.trim() || 'Unknown' : 'Unknown';
        
        if (symbol) {
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
  
  console.log(`✅ Page ${pageNum}: ${stocks.length} stocks found`);
  return stocks;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  
  // Check for help flag
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Yahoo US Stock Sectors Scraper (Simple Version - Technology Only)

使用方式:
  tsx scripts/scrape-yahoo-us-simple.ts [pages]

參數:
  pages             要爬取的頁數 (預設: 10)

選項:
  --help, -h        顯示此說明

範例:
  tsx scripts/scrape-yahoo-us-simple.ts 5
  tsx scripts/scrape-yahoo-us-simple.ts --help
    `);
    process.exit(0);
  }
  
  const maxPages = args[0] && !args[0].startsWith('--') ? parseInt(args[0]) : 10;
  
  console.log('🚀 Yahoo US Stock Sectors Scraper (Simple Version - Technology Only)');
  console.log('=' .repeat(70));
  console.log(`Target: ${maxPages} pages (${maxPages * 100} stocks)`);
  console.log('Sector: Technology');
  console.log('');
  
  await ensureDir(OUTPUT_DIR);
  
  const browser: Browser = await chromium.launch({ headless: true });
  const context: BrowserContext = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
  });
  const page: Page = await context.newPage();
  
  const allStocks: SectorStock[] = [];
  const sectorCount: Record<string, number> = {};
  
  try {
    for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
      console.log(`\n[${pageNum}/${maxPages}] Processing...`);
      
      const stocks = await scrapePage(page, pageNum);
      allStocks.push(...stocks);
      
      // Count sectors
      stocks.forEach(stock => {
        sectorCount[stock.sector] = (sectorCount[stock.sector] || 0) + 1;
      });
      
      // Wait between pages
      if (pageNum < maxPages) {
        await page.waitForTimeout(2000 + Math.random() * 2000);
      }
    }
    
    // Remove duplicates
    const uniqueStocks: SectorStock[] = [];
    const seenSymbols = new Set<string>();
    
    for (const stock of allStocks) {
      if (!seenSymbols.has(stock.symbol)) {
        seenSymbols.add(stock.symbol);
        uniqueStocks.push(stock);
      }
    }
    
    // Save results
    const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const filename = `yahoo-us-technology-simple-${timestamp}.json`;
    const filepath = path.join(OUTPUT_DIR, filename);
    
    const output: SectorOutput = {
      metadata: {
        scraped_date: new Date().toISOString(),
        total_pages: maxPages,
        total_records: allStocks.length,
        unique_stocks: uniqueStocks.length,
        duplicates_removed: allStocks.length - uniqueStocks.length,
        sectors_distribution: sectorCount
      },
      data: uniqueStocks.sort((a, b) => a.symbol.localeCompare(b.symbol))
    };
    
    fs.writeFileSync(filepath, JSON.stringify(output, null, 2));
    
    console.log('\n' + '='.repeat(70));
    console.log('✅ Scraping Complete!');
    console.log('='.repeat(70));
    console.log(`📊 Statistics:`);
    console.log(`   • Total pages: ${maxPages}`);
    console.log(`   • Total records: ${allStocks.length}`);
    console.log(`   • Unique stocks: ${uniqueStocks.length}`);
    console.log(`   • Duplicates removed: ${allStocks.length - uniqueStocks.length}`);
    console.log(`\n📊 Sector Distribution:`);
    
    Object.entries(sectorCount)
      .sort((a, b) => b[1] - a[1])
      .forEach(([sector, count]) => {
        console.log(`   • ${sector}: ${count}`);
      });
    
    console.log(`\n💾 Output saved to: ${filepath}`);
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await browser.close();
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

export { main as scrapeYahooUSSimple };