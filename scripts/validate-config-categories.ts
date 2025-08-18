#!/usr/bin/env tsx

import * as fs from 'fs-extra';
import * as path from 'path';
import { MarketRegionPathMapping } from '../src/common/constants/report';
import { logger } from '../src/utils';

interface ValidationResult {
  isValid: boolean;
  totalFiles: number;
  validFiles: number;
  invalidFiles: number;
  missingFiles: number;
  errors: string[];
  warnings: string[];
  summary: {
    daily: { count: number; types: string[] };
    quarterly: { count: number; markets: Record<string, string[]> };
    metadata: { count: number; types: string[] };
  };
}

export class ConfigValidator {
  private configDir: string;
  private result: ValidationResult;

  constructor(configDir: string = 'config-categorized') {
    this.configDir = configDir;
    this.result = {
      isValid: true,
      totalFiles: 0,
      validFiles: 0,
      invalidFiles: 0,
      missingFiles: 0,
      errors: [],
      warnings: [],
      summary: {
        daily: { count: 0, types: [] },
        quarterly: { count: 0, markets: {} },
        metadata: { count: 0, types: [] }
      }
    };
  }

  /**
   * 執行完整驗證
   */
  async validate(): Promise<ValidationResult> {
    console.log('🔍 開始驗證配置檔案分類結構');
    console.log('='.repeat(50));
    console.log(`📁 驗證目錄: ${this.configDir}`);
    console.log('='.repeat(50));

    // 檢查基本目錄結構
    await this.validateDirectoryStructure();

    // 驗證各類別配置
    await this.validateDailyConfigs();
    await this.validateQuarterlyConfigs();
    await this.validateMetadataConfigs();

    // 檢查檔案完整性
    await this.validateFileIntegrity();

    // 生成報告
    this.generateReport();

    return this.result;
  }

  /**
   * 驗證基本目錄結構
   */
  private async validateDirectoryStructure(): Promise<void> {
    console.log('\n📋 檢查目錄結構...');

    const requiredDirs = [
      'daily',
      'quarterly', 
      'metadata'
    ];

    for (const dir of requiredDirs) {
      const dirPath = path.join(this.configDir, dir);
      if (!await fs.pathExists(dirPath)) {
        this.addError(`缺少必要目錄: ${dir}/`);
      } else {
        console.log(`   ✅ ${dir}/`);
      }
    }

    // 檢查每日更新子目錄
    const dailySubDirs = ['tw-history', 'us-history', 'jp-history'];
    for (const subDir of dailySubDirs) {
      const dirPath = path.join(this.configDir, 'daily', subDir);
      if (!await fs.pathExists(dirPath)) {
        this.addWarning(`建議創建目錄: daily/${subDir}/`);
      } else {
        console.log(`   ✅ daily/${subDir}/`);
      }
    }

    // 檢查季度更新子目錄
    const quarterlyMarkets = Object.values(MarketRegionPathMapping);
    for (const market of quarterlyMarkets) {
      const dirPath = path.join(this.configDir, 'quarterly', market);
      if (!await fs.pathExists(dirPath)) {
        this.addWarning(`建議創建目錄: quarterly/${market}/`);
      } else {
        console.log(`   ✅ quarterly/${market}/`);
      }
    }
  }

  /**
   * 驗證每日配置
   */
  private async validateDailyConfigs(): Promise<void> {
    console.log('\n📅 驗證每日更新配置...');

    const dailyDir = path.join(this.configDir, 'daily');
    if (!await fs.pathExists(dailyDir)) {
      this.addError('daily/ 目錄不存在');
      return;
    }

    const historyTypes = new Set<string>();
    
    // 遍歷每日目錄下的所有檔案
    await this.traverseDirectory(dailyDir, async (filePath, relativePath) => {
      const filename = path.basename(filePath);
      
      // 檢查檔案名稱格式
      if (!this.isValidHistoryConfig(filename)) {
        this.addError(`無效的歷史數據配置檔案: ${relativePath}`);
        return;
      }

      // 檢查檔案內容
      if (await this.validateConfigContent(filePath)) {
        this.result.validFiles++;
        
        // 提取類型
        const type = this.extractConfigType(filename);
        if (type) {
          historyTypes.add(type);
        }
      } else {
        this.result.invalidFiles++;
      }
    });

    this.result.summary.daily = {
      count: this.result.validFiles,
      types: Array.from(historyTypes)
    };

    console.log(`   📊 有效檔案: ${this.result.summary.daily.count}`);
    console.log(`   📋 類型: ${this.result.summary.daily.types.join(', ')}`);
  }

  /**
   * 驗證季度配置
   */
  private async validateQuarterlyConfigs(): Promise<void> {
    console.log('\n📋 驗證季度更新配置...');

    const quarterlyDir = path.join(this.configDir, 'quarterly');
    if (!await fs.pathExists(quarterlyDir)) {
      this.addError('quarterly/ 目錄不存在');
      return;
    }

    const marketTypes: Record<string, Set<string>> = {};
    let quarterlyValidFiles = 0;

    // 遍歷各市場目錄
    const markets = await fs.readdir(quarterlyDir);
    for (const market of markets) {
      const marketDir = path.join(quarterlyDir, market);
      const stat = await fs.stat(marketDir);
      
      if (!stat.isDirectory()) {
        continue;
      }

      console.log(`   🌍 檢查市場: ${market}`);
      marketTypes[market] = new Set<string>();

      await this.traverseDirectory(marketDir, async (filePath, relativePath) => {
        const filename = path.basename(filePath);
        
        // 檢查檔案名稱格式
        if (!this.isValidFinancialConfig(filename, market)) {
          this.addError(`無效的財務配置檔案: quarterly/${market}/${relativePath}`);
          return;
        }

        // 檢查檔案內容
        if (await this.validateConfigContent(filePath)) {
          quarterlyValidFiles++;
          
          // 提取類型
          const type = this.extractConfigType(filename);
          if (type) {
            marketTypes[market].add(type);
          }
        } else {
          this.result.invalidFiles++;
        }
      });

      console.log(`     📊 ${market}: ${marketTypes[market].size} 種類型, ${Array.from(marketTypes[market]).join(', ')}`);
    }

    this.result.summary.quarterly = {
      count: quarterlyValidFiles,
      markets: Object.fromEntries(
        Object.entries(marketTypes).map(([market, types]) => [market, Array.from(types)])
      )
    };
  }

  /**
   * 驗證元數據配置
   */
  private async validateMetadataConfigs(): Promise<void> {
    console.log('\n🏷️  驗證元數據配置...');

    const metadataDir = path.join(this.configDir, 'metadata');
    if (!await fs.pathExists(metadataDir)) {
      this.addError('metadata/ 目錄不存在');
      return;
    }

    const metadataTypes = new Set<string>();
    let metadataValidFiles = 0;

    await this.traverseDirectory(metadataDir, async (filePath, relativePath) => {
      const filename = path.basename(filePath);
      
      // 檢查檔案名稱格式
      if (!this.isValidMetadataConfig(filename)) {
        this.addError(`無效的元數據配置檔案: metadata/${relativePath}`);
        return;
      }

      // 檢查檔案內容
      if (await this.validateConfigContent(filePath)) {
        metadataValidFiles++;
        
        // 提取類型
        const type = this.extractConfigType(filename);
        if (type) {
          metadataTypes.add(type);
        }
      } else {
        this.result.invalidFiles++;
      }
    });

    this.result.summary.metadata = {
      count: metadataValidFiles,
      types: Array.from(metadataTypes)
    };

    console.log(`   📊 有效檔案: ${this.result.summary.metadata.count}`);
    console.log(`   📋 類型: ${this.result.summary.metadata.types.join(', ')}`);
  }

  /**
   * 檢查檔案完整性
   */
  private async validateFileIntegrity(): Promise<void> {
    console.log('\n🔍 檢查檔案完整性...');

    this.result.totalFiles = this.result.validFiles + this.result.invalidFiles;

    // 檢查是否有重複檔案
    await this.checkDuplicateFiles();

    // 檢查檔案權限
    await this.checkFilePermissions();

    console.log(`   📊 總檔案數: ${this.result.totalFiles}`);
    console.log(`   ✅ 有效檔案: ${this.result.validFiles}`);
    console.log(`   ❌ 無效檔案: ${this.result.invalidFiles}`);
  }

  /**
   * 遞歸遍歷目錄
   */
  private async traverseDirectory(
    dir: string, 
    callback: (filePath: string, relativePath: string) => Promise<void>
  ): Promise<void> {
    const items = await fs.readdir(dir);
    
    for (const item of items) {
      const itemPath = path.join(dir, item);
      const stat = await fs.stat(itemPath);
      
      if (stat.isDirectory()) {
        await this.traverseDirectory(itemPath, callback);
      } else if (item.endsWith('.json')) {
        const relativePath = path.relative(this.configDir, itemPath);
        await callback(itemPath, relativePath);
      }
    }
  }

  /**
   * 檢查是否為有效的歷史數據配置
   */
  private isValidHistoryConfig(filename: string): boolean {
    return /^yahoo-finance-[a-z]+-history-.+\.json$/.test(filename);
  }

  /**
   * 檢查是否為有效的財務配置
   */
  private isValidFinancialConfig(filename: string, market: string): boolean {
    const pattern = new RegExp(`^yahoo-finance-${market}-[a-z-]+-.+\\.json$`);
    return pattern.test(filename) && !filename.includes('history');
  }

  /**
   * 檢查是否為有效的元數據配置
   */
  private isValidMetadataConfig(filename: string): boolean {
    const metadataTypes = ['symbols', 'labels', 'categories', 'details', 'sectors'];
    return metadataTypes.some(type => filename.includes(type));
  }

  /**
   * 從檔案名提取配置類型
   */
  private extractConfigType(filename: string): string | null {
    const match = filename.match(/yahoo-finance-[a-z]+-([a-z-]+)-.+\.json/);
    return match ? match[1] : null;
  }

  /**
   * 驗證配置檔案內容
   */
  private async validateConfigContent(filePath: string): Promise<boolean> {
    try {
      const content = await fs.readJson(filePath);
      
      // 基本結構檢查
      if (!content.url) {
        this.addWarning(`配置檔案缺少 URL: ${path.basename(filePath)}`);
        return false;
      }

      if (!content.selectors || Object.keys(content.selectors).length === 0) {
        this.addWarning(`配置檔案缺少選擇器: ${path.basename(filePath)}`);
        return false;
      }

      return true;
    } catch (error) {
      this.addError(`無法解析配置檔案: ${path.basename(filePath)} - ${error}`);
      return false;
    }
  }

  /**
   * 檢查重複檔案
   */
  private async checkDuplicateFiles(): Promise<void> {
    console.log('   🔍 檢查重複檔案...');
    
    const fileMap = new Map<string, string[]>();
    
    await this.traverseDirectory(this.configDir, async (filePath, relativePath) => {
      const filename = path.basename(filePath);
      
      if (!fileMap.has(filename)) {
        fileMap.set(filename, []);
      }
      fileMap.get(filename)!.push(relativePath);
    });

    for (const [filename, paths] of Array.from(fileMap.entries())) {
      if (paths.length > 1) {
        this.addWarning(`發現重複檔案 ${filename}: ${paths.join(', ')}`);
      }
    }
  }

  /**
   * 檢查檔案權限
   */
  private async checkFilePermissions(): Promise<void> {
    console.log('   🔍 檢查檔案權限...');
    
    let unreadableFiles = 0;
    
    await this.traverseDirectory(this.configDir, async (filePath) => {
      try {
        await fs.access(filePath, fs.constants.R_OK);
      } catch (error) {
        unreadableFiles++;
        this.addError(`檔案無法讀取: ${path.relative(this.configDir, filePath)}`);
      }
    });

    if (unreadableFiles === 0) {
      console.log('   ✅ 所有檔案權限正常');
    }
  }

  /**
   * 添加錯誤
   */
  private addError(message: string): void {
    this.result.errors.push(message);
    this.result.isValid = false;
  }

  /**
   * 添加警告
   */
  private addWarning(message: string): void {
    this.result.warnings.push(message);
  }

  /**
   * 生成驗證報告
   */
  private generateReport(): void {
    console.log('\n📊 驗證報告');
    console.log('='.repeat(50));

    if (this.result.isValid) {
      console.log('✅ 配置檔案分類結構驗證通過');
    } else {
      console.log('❌ 配置檔案分類結構驗證失敗');
    }

    console.log(`\n📈 統計摘要:`);
    console.log(`   總檔案數: ${this.result.totalFiles}`);
    console.log(`   有效檔案: ${this.result.validFiles} (${((this.result.validFiles / this.result.totalFiles) * 100).toFixed(1)}%)`);
    console.log(`   無效檔案: ${this.result.invalidFiles} (${((this.result.invalidFiles / this.result.totalFiles) * 100).toFixed(1)}%)`);

    console.log(`\n📋 分類統計:`);
    console.log(`   📅 每日更新: ${this.result.summary.daily.count} 個檔案`);
    console.log(`   📋 季度更新: ${this.result.summary.quarterly.count} 個檔案`);
    console.log(`   🏷️  元數據: ${this.result.summary.metadata.count} 個檔案`);

    if (this.result.warnings.length > 0) {
      console.log(`\n⚠️  警告 (${this.result.warnings.length}):`);
      this.result.warnings.slice(0, 10).forEach((warning, index) => {
        console.log(`   ${index + 1}. ${warning}`);
      });
      if (this.result.warnings.length > 10) {
        console.log(`   ... 還有 ${this.result.warnings.length - 10} 個警告`);
      }
    }

    if (this.result.errors.length > 0) {
      console.log(`\n❌ 錯誤 (${this.result.errors.length}):`);
      this.result.errors.slice(0, 10).forEach((error, index) => {
        console.log(`   ${index + 1}. ${error}`);
      });
      if (this.result.errors.length > 10) {
        console.log(`   ... 還有 ${this.result.errors.length - 10} 個錯誤`);
      }
    }

    console.log('\n💡 建議:');
    if (this.result.errors.length > 0) {
      console.log('   - 修復上述錯誤後重新執行驗證');
    }
    if (this.result.warnings.length > 0) {
      console.log('   - 檢查警告項目並按需調整');
    }
    console.log('   - 使用批量爬取命令測試新結構');
    console.log('   - 定期執行驗證確保結構完整性');
  }

  /**
   * 生成詳細報告檔案
   */
  async generateDetailedReport(): Promise<string> {
    const reportPath = path.join(this.configDir, 'validation-report.json');
    await fs.writeJson(reportPath, this.result, { spaces: 2 });
    console.log(`\n📄 詳細報告已保存: ${reportPath}`);
    return reportPath;
  }
}

/**
 * 主執行函數
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const configDir = args.find(arg => arg.startsWith('--config='))?.split('=')[1] || 'config-categorized';
  const detailed = args.includes('--detailed');
  const help = args.includes('--help') || args.includes('-h');

  if (help) {
    console.log(`
配置檔案分類驗證工具

用法:
  npx tsx scripts/validate-config-categories.ts [選項]

選項:
  --config=<dir>         配置目錄 (預設: config-categorized)
  --detailed             生成詳細報告檔案
  --help, -h             顯示此幫助資訊

範例:
  npx tsx scripts/validate-config-categories.ts
  npx tsx scripts/validate-config-categories.ts --config=config-new --detailed
`);
    return;
  }

  try {
    const validator = new ConfigValidator(configDir);
    const result = await validator.validate();

    if (detailed) {
      await validator.generateDetailedReport();
    }

    if (!result.isValid) {
      console.log('\n❌ 驗證失敗');
      process.exit(1);
    }

    console.log('\n🎉 驗證成功！');
    
  } catch (error) {
    console.error('❌ 驗證執行失敗:', error);
    process.exit(1);
  }
}

// 直接執行
if (require.main === module) {
  main();
}