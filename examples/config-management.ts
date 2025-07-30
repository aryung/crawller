import { UniversalCrawler, getPresetConfig } from '../src';

async function configManagementExample() {
  const crawler = new UniversalCrawler();

  try {
    // 使用預設配置
    const newsConfig = getPresetConfig('news');
    newsConfig.url = 'https://news.ycombinator.com';
    newsConfig.selectors = {
      headlines: '.storylink:multiple',
      points: '.score:multiple',
      comments: '.subtext a[href*="item"]:multiple'
    };

    // 保存自定義配置
    await crawler.saveConfig('hackernews', newsConfig);
    console.log('HackerNews 配置已保存');

    // 列出所有配置
    const configs = await crawler.listConfigs();
    console.log('可用配置:', configs);

    // 使用保存的配置進行爬蟲
    const result = await crawler.crawl('hackernews');
    console.log('使用配置檔案爬蟲結果:', result);

    // 創建電商配置範例
    const ecommerceConfig = getPresetConfig('ecommerce');
    ecommerceConfig.url = 'https://example-shop.com/product/123';
    ecommerceConfig.selectors = {
      name: '.product-title',
      price: '.price-current',
      stock: '.stock-status',
      images: '.product-images img:multiple'
    };

    await crawler.saveConfig('example-shop', ecommerceConfig);

    // 批量使用不同配置
    const batchResults = await crawler.crawlMultiple([
      'hackernews',
      'example-shop'
    ]);

    console.log(`批量爬蟲完成，共 ${batchResults.length} 個結果`);

    // 導出結果
    await crawler.export(batchResults, {
      format: 'csv',
      filename: 'config_management_results'
    });

  } catch (error) {
    console.error('配置管理範例失敗:', error);
  } finally {
    await crawler.cleanup();
  }
}

if (require.main === module) {
  configManagementExample();
}