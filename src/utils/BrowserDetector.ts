import * as fs from 'fs-extra';
import * as path from 'path';
import { logger } from './logger';

export interface BrowserInfo {
  name: string;
  path: string;
  version?: string;
}

export class BrowserDetector {
  private static macOSBrowserPaths = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/snap/bin/chromium',
    '/snap/bin/chrome'
  ];

  private static linuxBrowserPaths = [
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/snap/bin/chromium',
    '/snap/bin/chrome',
    '/opt/google/chrome/google-chrome',
    '/usr/bin/microsoft-edge',
    '/usr/bin/brave-browser'
  ];

  private static windowsBrowserPaths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files\\Chromium\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Chromium\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe',
    'C:\\Program Files (x86)\\BraveSoftware\\Brave-Browser\\Application\\brave.exe'
  ];

  /**
   * 檢測系統中可用的瀏覽器
   */
  static async detectAvailableBrowsers(): Promise<BrowserInfo[]> {
    const availableBrowsers: BrowserInfo[] = [];
    const platform = process.platform;
    
    let pathsToCheck: string[] = [];
    
    switch (platform) {
      case 'darwin':
        pathsToCheck = this.macOSBrowserPaths;
        break;
      case 'linux':
        pathsToCheck = this.linuxBrowserPaths;
        break;
      case 'win32':
        pathsToCheck = this.windowsBrowserPaths;
        break;
      default:
        logger.warn(`Unsupported platform: ${platform}`);
        return availableBrowsers;
    }

    for (const browserPath of pathsToCheck) {
      try {
        if (await fs.pathExists(browserPath)) {
          const browserName = this.getBrowserNameFromPath(browserPath);
          const version = await this.getBrowserVersion(browserPath);
          
          availableBrowsers.push({
            name: browserName,
            path: browserPath,
            version
          });
          
          logger.debug(`Found browser: ${browserName} at ${browserPath}${version ? ` (${version})` : ''}`);
        }
      } catch (error) {
        logger.debug(`Error checking browser path ${browserPath}:`, error);
      }
    }

    return availableBrowsers;
  }

  /**
   * 獲取最佳的瀏覽器路徑
   */
  static async getBestBrowserPath(): Promise<string | null> {
    const browsers = await this.detectAvailableBrowsers();
    
    if (browsers.length === 0) {
      return null;
    }

    // 優先順序：Chrome > Chromium > Edge > Brave
    const priorities = ['chrome', 'chromium', 'edge', 'brave'];
    
    for (const priority of priorities) {
      const browser = browsers.find(b => 
        b.name.toLowerCase().includes(priority)
      );
      if (browser) {
        logger.info(`Selected browser: ${browser.name} at ${browser.path}`);
        return browser.path;
      }
    }

    // 如果沒有找到優先的瀏覽器，返回第一個
    const firstBrowser = browsers[0];
    logger.info(`Selected fallback browser: ${firstBrowser.name} at ${firstBrowser.path}`);
    return firstBrowser.path;
  }

  /**
   * 從路徑中推斷瀏覽器名稱
   */
  private static getBrowserNameFromPath(browserPath: string): string {
    const filename = path.basename(browserPath).toLowerCase();
    
    if (filename.includes('chrome')) return 'Google Chrome';
    if (filename.includes('chromium')) return 'Chromium';
    if (filename.includes('edge') || filename.includes('msedge')) return 'Microsoft Edge';
    if (filename.includes('brave')) return 'Brave Browser';
    
    return path.basename(browserPath);
  }

  /**
   * 嘗試獲取瀏覽器版本
   */
  private static async getBrowserVersion(browserPath: string): Promise<string | undefined> {
    try {
      const { execFile } = await import('child_process');
      const { promisify } = await import('util');
      const execFileAsync = promisify(execFile);

      // 嘗試獲取版本資訊
      const versionArgs = ['--version'];
      const { stdout } = await execFileAsync(browserPath, versionArgs, {
        timeout: 5000
      });

      return stdout.trim();
    } catch (error) {
      logger.debug(`Failed to get browser version for ${browserPath}:`, error);
      return undefined;
    }
  }

  /**
   * 檢查是否有任何可用的瀏覽器
   */
  static async hasAvailableBrowser(): Promise<boolean> {
    const browsers = await this.detectAvailableBrowsers();
    return browsers.length > 0;
  }

  /**
   * 生成診斷報告
   */
  static async generateDiagnosticReport(): Promise<string> {
    const browsers = await this.detectAvailableBrowsers();
    const platform = process.platform;
    
    let report = `Browser Detection Report (${platform})\n`;
    report += '='.repeat(40) + '\n\n';
    
    if (browsers.length === 0) {
      report += '❌ No browsers found on this system\n\n';
      report += 'Suggestions:\n';
      
      switch (platform) {
        case 'darwin':
          report += '• Install Google Chrome: https://www.google.com/chrome/\n';
          report += '• Install Chromium: brew install chromium\n';
          break;
        case 'linux':
          report += '• Install Chrome: sudo apt install google-chrome-stable\n';
          report += '• Install Chromium: sudo apt install chromium-browser\n';
          break;
        case 'win32':
          report += '• Install Google Chrome from: https://www.google.com/chrome/\n';
          report += '• Install Chromium from: https://www.chromium.org/\n';
          break;
      }
    } else {
      report += `✅ Found ${browsers.length} browser(s):\n\n`;
      
      browsers.forEach((browser, index) => {
        report += `${index + 1}. ${browser.name}\n`;
        report += `   Path: ${browser.path}\n`;
        if (browser.version) {
          report += `   Version: ${browser.version}\n`;
        }
        report += '\n';
      });
      
      const bestPath = await this.getBestBrowserPath();
      if (bestPath) {
        const bestBrowser = browsers.find(b => b.path === bestPath);
        report += `🎯 Recommended: ${bestBrowser?.name || 'Unknown'}\n`;
        report += `   Path: ${bestPath}\n`;
      }
    }
    
    return report;
  }
}