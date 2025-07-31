import { UniversalCrawler } from '../src';

async function cookieLoginExample() {
  const crawler = new UniversalCrawler();

  try {
    // 使用 Cookie 字串的範例
    const cookieStringResult = await crawler.crawl({
      url: 'https://protected-site.com/dashboard',
      cookies: {
        enabled: true,
        cookieString: 'sessionId=abc123; userId=456; token=xyz789'
      },
      selectors: {
        username: '.user-profile .username',
        dashboard: '.dashboard-content'
      }
    });

    console.log('Cookie 字串爬蟲結果:', cookieStringResult);

    // 自動登入的範例
    const loginResult = await crawler.crawl({
      url: 'https://social-site.com/profile',
      cookies: {
        enabled: true,
        loginUrl: 'https://social-site.com/login',
        loginSelectors: {
          username: 'input[name="username"]',
          password: 'input[name="password"]',
          submit: 'button[type="submit"]'
        },
        credentials: {
          username: 'your_username',
          password: 'your_password'
        }
      },
      selectors: {
        profile: '.profile-info',
        posts: '.post:multiple .post-content'
      },
      options: {
        waitFor: 5000 // 等待登入完成
      }
    });

    console.log('自動登入爬蟲結果:', loginResult);

    // 保存結果
    const results = [cookieStringResult, loginResult];
    await crawler.export(results, {
      format: 'json',
      filename: 'cookie_login_results'
    });

  } catch (error) {
    console.error('Cookie 登入爬蟲失敗:', error);
  } finally {
    await crawler.cleanup();
  }
}

if (require.main === module) {
  cookieLoginExample();
}