import { UniversalCrawler } from '../src';

async function compareEnginesExample() {
  const config = {
    url: 'https://quotes.toscrape.com',
    selectors: {
      quotes: '.quote:multiple .text',
      authors: '.quote:multiple .author',
      tags: '.quote:multiple .tag:multiple'
    },
    options: {
      waitFor: 2000,
      screenshot: true
    }
  };

  // 使用 Puppeteer
  console.log('=== 使用 Puppeteer 引擎 ===');
  const puppeteerCrawler = new UniversalCrawler({ usePlaywright: false });
  
  try {
    const startTime = Date.now();
    const puppeteerResult = await puppeteerCrawler.crawl(config);
    const puppeteerTime = Date.now() - startTime;
    
    console.log(`Puppeteer 完成時間: ${puppeteerTime}ms`);
    console.log(`Puppeteer 成功: ${puppeteerResult.success}`);
    console.log(`Puppeteer 資料欄位: ${Object.keys(puppeteerResult.data).length}`);
    
    await puppeteerCrawler.export([puppeteerResult], {
      format: 'json',
      filename: 'puppeteer_result'
    });
    
  } catch (error) {
    console.error('Puppeteer 失敗:', error);
  } finally {
    await puppeteerCrawler.cleanup();
  }

  // 使用 Playwright
  console.log('\n=== 使用 Playwright 引擎 ===');
  const playwrightCrawler = new UniversalCrawler({ usePlaywright: true });
  
  try {
    const startTime = Date.now();
    const playwrightResult = await playwrightCrawler.crawl(config);
    const playwrightTime = Date.now() - startTime;
    
    console.log(`Playwright 完成時間: ${playwrightTime}ms`);
    console.log(`Playwright 成功: ${playwrightResult.success}`);
    console.log(`Playwright 資料欄位: ${Object.keys(playwrightResult.data).length}`);
    
    await playwrightCrawler.export([playwrightResult], {
      format: 'json',
      filename: 'playwright_result'
    });
    
  } catch (error) {
    console.error('Playwright 失敗:', error);
    console.log('注意: Playwright 需要額外安裝 (npm install playwright)');
  } finally {
    await playwrightCrawler.cleanup();
  }

  // 動態切換引擎範例
  console.log('\n=== 動態切換引擎 ===');
  const dynamicCrawler = new UniversalCrawler();
  
  try {
    // 先嘗試 Puppeteer
    dynamicCrawler.setEngine(false);
    let result = await dynamicCrawler.crawl(config);
    
    if (!result.success) {
      console.log('Puppeteer 失敗，切換到 Playwright...');
      dynamicCrawler.setEngine(true);
      result = await dynamicCrawler.crawl(config);
    }
    
    console.log(`最終結果成功: ${result.success}`);
    
    if (result.success) {
      await dynamicCrawler.generateReport([result]);
      console.log('報告已生成');
    }
    
  } catch (error) {
    console.error('動態切換失敗:', error);
  } finally {
    await dynamicCrawler.cleanup();
  }
}

if (require.main === module) {
  compareEnginesExample();
}