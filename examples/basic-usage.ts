import { UniversalCrawler } from '../src';

async function basicExample() {
  const crawler = new UniversalCrawler();

  try {
    // 基本爬蟲範例
    const result = await crawler.crawl({
      url: 'https://example.com',
      selectors: {
        title: 'h1',
        description: 'meta[name="description"]'
      },
      options: {
        waitFor: 2000,
        screenshot: true
      }
    });

    console.log('爬蟲結果:', result);

    // 導出為 JSON
    await crawler.export([result], {
      format: 'json',
      filename: 'basic_example'
    });

    console.log('結果已導出為 JSON');

  } catch (error) {
    console.error('爬蟲失敗:', error);
  } finally {
    await crawler.cleanup();
  }
}

if (require.main === module) {
  basicExample();
}