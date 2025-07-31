import { CrawlerConfig } from '../types';
import { logger } from './logger';

export interface ParsedCurl {
  url: string;
  method: string;
  headers: Record<string, string>;
  cookies: string[];
  data?: string;
  userAgent?: string;
}

export class CurlParser {
  /**
   * 解析 curl 命令字串
   */
  static parseCurlCommand(curlCommand: string): ParsedCurl | null {
    try {
      // 清理命令字串
      const cleanCommand = this.cleanCurlCommand(curlCommand);
      
      // 提取 URL
      const url = this.extractUrl(cleanCommand);
      if (!url) {
        throw new Error('無法找到 URL');
      }

      // 提取方法
      const method = this.extractMethod(cleanCommand);
      
      // 提取 headers
      const headers = this.extractHeaders(cleanCommand);
      
      // 提取 cookies
      const cookies = this.extractCookies(cleanCommand);
      
      // 提取 data
      const data = this.extractData(cleanCommand);
      
      // 提取 User-Agent
      const userAgent = headers['user-agent'] || headers['User-Agent'];

      const result: ParsedCurl = {
        url,
        method,
        headers,
        cookies,
        userAgent
      };

      if (data) {
        result.data = data;
      }

      logger.debug('Successfully parsed curl command', result);
      return result;

    } catch (error) {
      logger.error('Failed to parse curl command:', error);
      return null;
    }
  }

  /**
   * 將解析的 curl 轉換為 CrawlerConfig
   */
  static curlToConfig(
    parsedCurl: ParsedCurl, 
    selectors: Record<string, string> = { title: 'title', content: 'body' },
    options: { 
      encoding?: string;
      name?: string;
      removeSensitiveCookies?: boolean;
    } = {}
  ): CrawlerConfig {
    const config: CrawlerConfig = {
      url: parsedCurl.url,
      selectors,
      headers: { ...parsedCurl.headers }
    };

    // 處理 cookies
    if (parsedCurl.cookies.length > 0) {
      const cookieString = options.removeSensitiveCookies 
        ? this.sanitizeCookies(parsedCurl.cookies.join('; '))
        : parsedCurl.cookies.join('; ');

      if (cookieString.trim()) {
        config.cookies = {
          enabled: true,
          cookieString
        };
      }
    }

    // 添加選項
    config.options = {
      timeout: 30000,
      retries: 3,
      headless: true,
      screenshot: false,
      ...(options.encoding && { encoding: options.encoding })
    };

    // 從 URL 推薦編碼
    if (!options.encoding) {
      const suggestedEncoding = this.suggestEncodingFromUrl(parsedCurl.url);
      if (suggestedEncoding !== 'utf-8') {
        config.options!.encoding = suggestedEncoding;
      }
    }

    return config;
  }

  /**
   * 清理 curl 命令
   */
  private static cleanCurlCommand(command: string): string {
    return command
      .replace(/\\\n/g, ' ') // 處理行續接
      .replace(/\s+/g, ' ')  // 合併多個空格
      .trim();
  }

  /**
   * 提取 URL
   */
  private static extractUrl(command: string): string | null {
    // 匹配單引號或雙引號中的 URL
    const quotedUrlMatch = command.match(/curl\s+['"](https?:\/\/[^'"]+)['"]/);
    if (quotedUrlMatch) {
      return quotedUrlMatch[1];
    }

    // 匹配沒有引號的 URL
    const urlMatch = command.match(/curl\s+(https?:\/\/\S+)/);
    if (urlMatch) {
      return urlMatch[1];
    }

    return null;
  }

  /**
   * 提取 HTTP 方法
   */
  private static extractMethod(command: string): string {
    const methodMatch = command.match(/-X\s+([A-Z]+)/);
    return methodMatch ? methodMatch[1] : 'GET';
  }

  /**
   * 提取 headers
   */
  private static extractHeaders(command: string): Record<string, string> {
    const headers: Record<string, string> = {};
    
    // 匹配 -H 參數
    const headerMatches = command.matchAll(/-H\s+['"](.*?)['"]/g);
    
    for (const match of headerMatches) {
      const headerLine = match[1];
      const colonIndex = headerLine.indexOf(':');
      
      if (colonIndex > 0) {
        const key = headerLine.substring(0, colonIndex).trim();
        const value = headerLine.substring(colonIndex + 1).trim();
        headers[key] = value;
      }
    }

    return headers;
  }

  /**
   * 提取 cookies
   */
  private static extractCookies(command: string): string[] {
    const cookies: string[] = [];
    
    // 從 -b 參數提取
    const cookieMatches = command.matchAll(/-b\s+['"](.*?)['"]/g);
    
    for (const match of cookieMatches) {
      const cookieString = match[1];
      cookies.push(cookieString);
    }

    // 從 --cookie 參數提取
    const cookieMatches2 = command.matchAll(/--cookie\s+['"](.*?)['"]/g);
    
    for (const match of cookieMatches2) {
      const cookieString = match[1];
      cookies.push(cookieString);
    }

    return cookies;
  }

  /**
   * 提取 data
   */
  private static extractData(command: string): string | null {
    // 匹配 -d 或 --data 參數
    const dataMatch = command.match(/(?:-d|--data)\s+['"](.*?)['"]/);
    return dataMatch ? dataMatch[1] : null;
  }

  /**
   * 清理敏感 cookies
   */
  private static sanitizeCookies(cookieString: string): string {
    const sensitiveCookieNames = [
      'session', 'sessionid', 'token', 'auth', 'password', 'secret',
      '_ga', '_gid', '_fbp', 'USER', 'ASPSESSIONID'
    ];

    return cookieString
      .split(';')
      .map(cookie => cookie.trim())
      .filter(cookie => {
        const cookieName = cookie.split('=')[0].toLowerCase();
        return !sensitiveCookieNames.some(sensitive => 
          cookieName.includes(sensitive.toLowerCase())
        );
      })
      .join('; ');
  }

  /**
   * 從 URL 推薦編碼
   */
  private static suggestEncodingFromUrl(url: string): string {
    const domain = url.toLowerCase();
    
    if (domain.includes('moneydj.com') || 
        domain.includes('pchome.com.tw') || 
        domain.includes('sina.com.tw')) {
      return 'big5';
    }

    return 'utf-8';
  }

  /**
   * 生成配置檔案名稱
   */
  static generateConfigName(url: string): string {
    try {
      const urlObj = new URL(url);
      const domain = urlObj.hostname
        .replace(/^www\./, '')
        .replace(/\./g, '-');
      
      const path = urlObj.pathname
        .replace(/[^\w-]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
      
      let name = domain;
      if (path && path !== '-') {
        name += `-${path.substring(0, 20)}`;
      }
      
      return name;
    } catch {
      return 'curl-config';
    }
  }

  /**
   * 創建範例選擇器
   */
  static createExampleSelectors(url: string): Record<string, string> {
    const domain = url.toLowerCase();
    
    if (domain.includes('moneydj.com')) {
      return {
        industries: "a[href*='/z/zh/zha/zh']:multiple"
      };
    }
    
    // 通用選擇器
    return {
      title: 'title, h1',
      content: 'main, .content, .article, #content',
      links: 'a:multiple'
    };
  }
}