import { UniversalCrawler } from '../src';

async function multipleSitesExample() {
  const crawler = new UniversalCrawler();

  try {
    // 爬取多個網站
    const configs = [
      {
        url: 'https://news.ycombinator.com',
        selectors: {
          headlines: '.storylink:multiple',
          points: '.score:multiple'
        }
      },
      {
        url: 'https://github.com/trending',
        selectors: {
          repositories: '.Box-row h2 a:multiple',
          descriptions: '.Box-row p:multiple'
        }
      },
      {
        url: 'https://stackoverflow.com/questions',
        selectors: {
          questions: '.s-post-summary--content-title a:multiple',
          votes: '.s-post-summary--stats-item-number:multiple'
        }
      }
    ];

    console.log('開始爬取多個網站...');
    const results = await crawler.crawlMultiple(configs, 2); // 同時爬取2個

    console.log(`完成！共爬取 ${results.length} 個網站`);
    
    // 生成統計報告
    const reportPath = await crawler.generateReport(results);
    console.log(`報告已生成: ${reportPath}`);

    // 導出為 Excel
    await crawler.export(results, {
      format: 'xlsx',
      filename: 'multiple_sites_results'
    });

    console.log('結果已導出為 Excel');

  } catch (error) {
    console.error('批量爬蟲失敗:', error);
  } finally {
    await crawler.cleanup();
  }
}

if (require.main === module) {
  multipleSitesExample();
}