import { UniversalCrawler } from '../src';

async function advancedSelectorsExample() {
  const crawler = new UniversalCrawler();

  try {
    const result = await crawler.crawl({
      url: 'https://example-blog.com/post/123',
      selectors: {
        // 基本文字選擇器
        title: 'h1.post-title',
        
        // 屬性選擇器
        canonicalUrl: {
          selector: 'link[rel="canonical"]',
          attribute: 'href'
        },
        
        // 多個元素選擇
        tags: {
          selector: '.tag:multiple',
          transform: (values: string[]) => values.map(tag => tag.trim().toLowerCase())
        },
        
        // 複雜轉換
        publishDate: {
          selector: '.publish-date',
          attribute: 'datetime',
          transform: (value: string) => {
            const date = new Date(value);
            return {
              iso: date.toISOString(),
              formatted: date.toLocaleDateString('zh-TW'),
              timestamp: date.getTime()
            };
          }
        },
        
        // 數字處理
        viewCount: {
          selector: '.view-count',
          transform: (value: string) => {
            const match = value.match(/(\d+)/);
            return match ? parseInt(match[1]) : 0;
          }
        },
        
        // HTML 內容
        content: {
          selector: '.post-content',
          attribute: 'innerHTML'
        },
        
        // 圖片資訊
        images: {
          selector: '.post-content img:multiple',
          transform: (elements: any[]) => {
            return elements.map((img, index) => ({
              index,
              src: img.getAttribute('src'),
              alt: img.getAttribute('alt') || '',
              width: img.getAttribute('width') || 'auto',
              height: img.getAttribute('height') || 'auto'
            }));
          }
        },
        
        // 作者資訊
        author: {
          selector: '.author-info',
          transform: (element: any) => ({
            name: element.querySelector('.author-name')?.textContent?.trim(),
            avatar: element.querySelector('.author-avatar')?.getAttribute('src'),
            bio: element.querySelector('.author-bio')?.textContent?.trim()
          })
        },
        
        // 社交分享數
        socialShares: {
          selector: '.social-share',
          transform: (element: any) => {
            const facebook = element.querySelector('.facebook-count')?.textContent || '0';
            const twitter = element.querySelector('.twitter-count')?.textContent || '0';
            const linkedin = element.querySelector('.linkedin-count')?.textContent || '0';
            
            return {
              facebook: parseInt(facebook.replace(/\D/g, '')) || 0,
              twitter: parseInt(twitter.replace(/\D/g, '')) || 0,
              linkedin: parseInt(linkedin.replace(/\D/g, '')) || 0,
              total: [facebook, twitter, linkedin]
                .reduce((sum, count) => sum + (parseInt(count.replace(/\D/g, '')) || 0), 0)
            };
          }
        }
      },
      
      headers: {
        'Accept-Language': 'zh-TW,zh;q=0.9,en;q=0.8'
      },
      
      options: {
        waitFor: 3000,
        screenshot: true,
        viewport: { width: 1920, height: 1080 }
      }
    });

    console.log('進階選擇器爬蟲結果:', JSON.stringify(result, null, 2));

    // 保存截圖
    if (result.screenshot) {
      await crawler.saveScreenshots([result]);
      console.log('截圖已保存');
    }

    // 導出詳細資料
    await crawler.export([result], {
      format: 'json',
      filename: 'advanced_selectors_result'
    });

    console.log('結果已導出');

  } catch (error) {
    console.error('進階選擇器範例失敗:', error);
  } finally {
    await crawler.cleanup();
  }
}

if (require.main === module) {
  advancedSelectorsExample();
}