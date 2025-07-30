import iconv from 'iconv-lite';
import { logger } from './logger';

export class EncodingHelper {
  private static encodingMap = new Map([
    ['big5', ['big5', 'big5hkscs', 'cp950']],
    ['gb2312', ['gb2312', 'gbk', 'gb18030', 'cp936']],
    ['utf-8', ['utf-8', 'utf8']],
    ['iso-8859-1', ['iso-8859-1', 'latin1']],
    ['shift_jis', ['shift_jis', 'sjis', 'cp932']]
  ]);

  /**
   * 檢測文本編碼
   */
  static detectEncoding(buffer: Buffer, contentType?: string): string {
    // 1. 從 Content-Type header 檢測
    if (contentType) {
      const charsetMatch = contentType.match(/charset=([^;]+)/i);
      if (charsetMatch) {
        const charset = charsetMatch[1].toLowerCase().trim();
        logger.debug(`Detected encoding from Content-Type: ${charset}`);
        return this.normalizeEncoding(charset);
      }
    }

    // 2. 從 HTML meta 標籤檢測
    const htmlStart = buffer.slice(0, 1024).toString('ascii');
    const metaCharsetMatch = htmlStart.match(/<meta[^>]+charset=["']?([^"'\s>]+)/i);
    if (metaCharsetMatch) {
      const charset = metaCharsetMatch[1].toLowerCase().trim();
      logger.debug(`Detected encoding from meta tag: ${charset}`);
      return this.normalizeEncoding(charset);
    }

    // 3. BOM 檢測
    if (buffer.length >= 3) {
      const bom = buffer.slice(0, 3);
      if (bom[0] === 0xEF && bom[1] === 0xBB && bom[2] === 0xBF) {
        logger.debug('Detected UTF-8 BOM');
        return 'utf-8';
      }
    }

    // 4. 內容特徵檢測（簡單啟發式）
    const text = buffer.toString('ascii');
    
    // 檢查是否包含繁體中文常見字符的 Big5 編碼模式
    if (this.containsBig5Pattern(buffer)) {
      logger.debug('Detected BIG5 encoding from content pattern');
      return 'big5';
    }

    // 5. 預設使用 UTF-8
    logger.debug('Using default UTF-8 encoding');
    return 'utf-8';
  }

  /**
   * 正規化編碼名稱
   */
  static normalizeEncoding(encoding: string): string {
    const normalized = encoding.toLowerCase().replace(/[-_]/g, '');
    
    for (const [standard, aliases] of this.encodingMap) {
      if (aliases.some(alias => alias.replace(/[-_]/g, '') === normalized)) {
        return standard;
      }
    }

    return encoding.toLowerCase();
  }

  /**
   * 轉換文本編碼
   */
  static convertToUtf8(buffer: Buffer, sourceEncoding: string): string {
    try {
      const normalizedEncoding = this.normalizeEncoding(sourceEncoding);
      
      if (normalizedEncoding === 'utf-8' || normalizedEncoding === 'utf8') {
        return buffer.toString('utf-8');
      }

      if (!iconv.encodingExists(normalizedEncoding)) {
        logger.warn(`Encoding ${normalizedEncoding} not supported, falling back to UTF-8`);
        return buffer.toString('utf-8');
      }

      const decoded = iconv.decode(buffer, normalizedEncoding);
      logger.debug(`Successfully converted from ${normalizedEncoding} to UTF-8`);
      return decoded;

    } catch (error) {
      logger.error(`Failed to convert encoding from ${sourceEncoding}:`, error);
      // 回退到 UTF-8
      return buffer.toString('utf-8');
    }
  }

  /**
   * 檢測是否包含 Big5 編碼模式
   */
  private static containsBig5Pattern(buffer: Buffer): boolean {
    // Big5 編碼範圍檢測
    // 第一字節：0xA1-0xFE
    // 第二字節：0x40-0x7E, 0xA1-0xFE
    
    for (let i = 0; i < buffer.length - 1; i++) {
      const byte1 = buffer[i];
      const byte2 = buffer[i + 1];
      
      if (byte1 >= 0xA1 && byte1 <= 0xFE) {
        if ((byte2 >= 0x40 && byte2 <= 0x7E) || (byte2 >= 0xA1 && byte2 <= 0xFE)) {
          // 檢查是否看起來像常見的繁體中文字符
          const potentialChar = Buffer.from([byte1, byte2]);
          try {
            const decoded = iconv.decode(potentialChar, 'big5');
            // 檢查是否是常見的繁體中文字符
            if (this.isTraditionalChineseChar(decoded)) {
              return true;
            }
          } catch {
            // 解碼失敗，繼續檢查
          }
        }
      }
    }

    return false;
  }

  /**
   * 檢查是否為繁體中文字符
   */
  private static isTraditionalChineseChar(char: string): boolean {
    if (char.length !== 1) return false;
    
    const code = char.charCodeAt(0);
    
    // CJK 統一漢字範圍
    return (code >= 0x4E00 && code <= 0x9FFF) ||
           (code >= 0x3400 && code <= 0x4DBF) ||
           (code >= 0x20000 && code <= 0x2A6DF);
  }

  /**
   * 為網站建議編碼
   */
  static suggestEncodingForUrl(url: string): string {
    const domain = url.toLowerCase();
    
    // 已知的網站編碼對應
    const siteEncodings = {
      'moneydj.com': 'big5',
      'yahoo.com.tw': 'utf-8',
      'pchome.com.tw': 'big5',
      'sina.com.tw': 'big5',
      'ettoday.net': 'utf-8',
      'chinatimes.com': 'utf-8',
      'udn.com': 'utf-8'
    };

    for (const [site, encoding] of Object.entries(siteEncodings)) {
      if (domain.includes(site)) {
        logger.debug(`Suggested encoding for ${site}: ${encoding}`);
        return encoding;
      }
    }

    return 'utf-8';
  }

  /**
   * 獲取支援的編碼列表
   */
  static getSupportedEncodings(): string[] {
    return Array.from(this.encodingMap.keys());
  }
}