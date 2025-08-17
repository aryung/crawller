#!/usr/bin/env tsx

import * as fs from 'fs-extra';
import * as path from 'path';
import { logger } from '../src/utils';
import { MarketRegion } from '../src/common/shared-types/interfaces/market-data.interface';
import { MarketRegionPathMapping } from '../src/common/constants/report';

interface MigrationStats {
  total: number;
  daily: number;
  quarterly: number;
  metadata: number;
  unmapped: number;
  errors: number;
  skipped: number;
}

interface ConfigMapping {
  originalPath: string;
  newPath: string;
  category: 'daily' | 'quarterly' | 'metadata';
  market?: MarketRegion;
  type: string;
}

export class ConfigMigrator {
  private sourceDir: string;
  private targetDir: string;
  private backupDir: string;
  private dryRun: boolean;
  private stats: MigrationStats;

  constructor(options: {
    sourceDir?: string;
    targetDir?: string;
    backupDir?: string;
    dryRun?: boolean;
  } = {}) {
    this.sourceDir = options.sourceDir || 'config';
    this.targetDir = options.targetDir || 'config-categorized';
    this.backupDir = options.backupDir || 'config-backup';
    this.dryRun = options.dryRun || false;
    
    this.stats = {
      total: 0,
      daily: 0,
      quarterly: 0,
      metadata: 0,
      unmapped: 0,
      errors: 0,
      skipped: 0
    };
  }

  /**
   * 分析配置檔案並分類
   */
  analyzeConfig(filename: string): ConfigMapping | null {
    // 跳過非 JSON 檔案
    if (!filename.endsWith('.json')) {
      return null;
    }

    // 解析檔案名稱模式: yahoo-finance-{market}-{type}-{symbol}.json
    const match = filename.match(/^yahoo-finance-([a-z]+)-([a-z-]+)-(.+)\.json$/);
    if (!match) {
      // 檢查是否為模板或其他特殊檔案
      if (filename.includes('template') || filename.startsWith('active/')) {
        return null; // 跳過模板和 active 目錄
      }
      
      // 未匹配的檔案
      logger.warn(`無法解析配置檔案名稱: ${filename}`);
      return null;
    }

    const [, market, type, symbol] = match;
    const originalPath = path.join(this.sourceDir, filename);

    // 確定類別
    let category: 'daily' | 'quarterly' | 'metadata';
    let newPath: string;

    if (type === 'history') {
      // 每日更新：歷史價格數據
      category = 'daily';
      newPath = path.join(this.targetDir, 'daily', `${market}-history`, filename);
    } else if (this.isMetadataType(type)) {
      // 元數據：股票代碼、標籤、分類
      category = 'metadata';
      newPath = path.join(this.targetDir, 'metadata', type, filename);
    } else {
      // 季度更新：財務報表
      category = 'quarterly';
      newPath = path.join(this.targetDir, 'quarterly', market, type, filename);
    }

    return {
      originalPath,
      newPath,
      category,
      market: this.pathToMarketRegion(market),
      type
    };
  }

  /**
   * 檢查是否為元數據類型
   */
  private isMetadataType(type: string): boolean {
    return [
      'symbols',
      'labels', 
      'categories',
      'details',
      'sectors'
    ].includes(type);
  }

  /**
   * 將路徑字串轉換為 MarketRegion
   */
  private pathToMarketRegion(pathStr: string): MarketRegion {
    const mapping: Record<string, MarketRegion> = {
      'tw': MarketRegion.TPE,
      'us': MarketRegion.US,
      'jp': MarketRegion.JP
    };
    return mapping[pathStr] || MarketRegion.TPE;
  }

  /**
   * 執行遷移
   */
  async migrate(): Promise<MigrationStats> {
    console.log('🚀 開始配置檔案分類遷移');
    console.log('='.repeat(50));
    console.log(`📁 來源目錄: ${this.sourceDir}`);
    console.log(`📂 目標目錄: ${this.targetDir}`);
    console.log(`💾 備份目錄: ${this.backupDir}`);
    console.log(`🔍 模式: ${this.dryRun ? '預覽模式 (不實際移動檔案)' : '實際執行'}`);
    console.log('='.repeat(50));

    // 檢查來源目錄
    if (!await fs.pathExists(this.sourceDir)) {
      throw new Error(`來源目錄不存在: ${this.sourceDir}`);
    }

    // 讀取所有配置檔案
    const files = await fs.readdir(this.sourceDir);
    const jsonFiles = files.filter(file => file.endsWith('.json'));
    
    console.log(`📋 找到 ${jsonFiles.length} 個 JSON 配置檔案`);

    // 分析配置檔案
    const mappings: ConfigMapping[] = [];
    for (const file of jsonFiles) {
      this.stats.total++;
      
      const mapping = this.analyzeConfig(file);
      if (mapping) {
        mappings.push(mapping);
        this.stats[mapping.category]++;
      } else {
        this.stats.unmapped++;
      }
    }

    // 顯示分析結果
    this.displayAnalysis(mappings);

    if (this.dryRun) {
      console.log('\n🔍 預覽模式完成，未實際移動檔案');
      return this.stats;
    }

    // 確認是否執行
    console.log('\n⚠️  即將開始檔案遷移，這將會移動大量檔案');
    console.log('💡 建議先執行備份操作');
    
    // 創建備份
    await this.createBackup();

    // 執行遷移
    await this.performMigration(mappings);

    // 創建目錄說明檔案
    await this.createDirectoryDocumentation();

    console.log('\n🎉 配置檔案分類遷移完成！');
    this.displayFinalStats();

    return this.stats;
  }

  /**
   * 顯示分析結果
   */
  private displayAnalysis(mappings: ConfigMapping[]): void {
    console.log('\n📊 分析結果:');
    console.log(`   總檔案數: ${this.stats.total}`);
    console.log(`   📅 每日更新 (daily): ${this.stats.daily}`);
    console.log(`   📋 季度更新 (quarterly): ${this.stats.quarterly}`);
    console.log(`   🏷️  元數據 (metadata): ${this.stats.metadata}`);
    console.log(`   ❓ 未分類: ${this.stats.unmapped}`);

    // 按類別和市場統計
    const categoryStats = this.calculateCategoryStats(mappings);
    
    console.log('\n📈 詳細統計:');
    Object.entries(categoryStats).forEach(([category, markets]) => {
      console.log(`\n   ${category.toUpperCase()}:`);
      Object.entries(markets as any).forEach(([market, types]) => {
        if (Object.keys(types).length > 0) {
          console.log(`     ${market.toUpperCase()}:`);
          Object.entries(types).forEach(([type, count]) => {
            console.log(`       ${type}: ${count} 個檔案`);
          });
        }
      });
    });
  }

  /**
   * 計算分類統計
   */
  private calculateCategoryStats(mappings: ConfigMapping[]): any {
    const stats: any = {
      daily: { tw: {}, us: {}, jp: {} },
      quarterly: { tw: {}, us: {}, jp: {} },
      metadata: { common: {} }
    };

    mappings.forEach(mapping => {
      if (mapping.category === 'metadata') {
        stats.metadata.common[mapping.type] = (stats.metadata.common[mapping.type] || 0) + 1;
      } else if (mapping.market) {
        stats[mapping.category][mapping.market][mapping.type] = 
          (stats[mapping.category][mapping.market][mapping.type] || 0) + 1;
      }
    });

    return stats;
  }

  /**
   * 創建備份
   */
  private async createBackup(): Promise<void> {
    console.log(`\n💾 正在創建備份...`);
    
    if (await fs.pathExists(this.backupDir)) {
      // 如果備份目錄已存在，創建帶時間戳的備份
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      this.backupDir = `${this.backupDir}-${timestamp}`;
    }

    await fs.copy(this.sourceDir, this.backupDir);
    console.log(`✅ 備份已創建: ${this.backupDir}`);
  }

  /**
   * 執行實際遷移
   */
  private async performMigration(mappings: ConfigMapping[]): Promise<void> {
    console.log(`\n📦 正在遷移 ${mappings.length} 個配置檔案...`);

    let processed = 0;
    const progressInterval = setInterval(() => {
      process.stdout.write(`\r   進度: ${processed}/${mappings.length} (${((processed / mappings.length) * 100).toFixed(1)}%)`);
    }, 1000);

    for (const mapping of mappings) {
      try {
        // 確保目標目錄存在
        await fs.ensureDir(path.dirname(mapping.newPath));
        
        // 移動檔案
        await fs.move(mapping.originalPath, mapping.newPath);
        
        processed++;
      } catch (error) {
        this.stats.errors++;
        logger.error(`移動檔案失敗: ${mapping.originalPath} -> ${mapping.newPath}`, error);
      }
    }

    clearInterval(progressInterval);
    process.stdout.write(`\r   完成: ${processed}/${mappings.length} ✅\n`);
  }

  /**
   * 創建目錄說明文檔
   */
  private async createDirectoryDocumentation(): Promise<void> {
    const readmeContent = `# 配置檔案分類結構

此目錄包含按更新頻率和數據類型分類的爬蟲配置檔案。

## 目錄結構

### daily/ - 每日更新配置
包含需要每日更新的歷史價格數據配置：
- \`tw-history/\` - 台灣市場歷史價格
- \`us-history/\` - 美國市場歷史價格  
- \`jp-history/\` - 日本市場歷史價格

### quarterly/ - 季度更新配置
包含財務報表等季度更新的配置：
- \`tw/\` - 台灣市場財務報表
  - \`eps/\` - 每股盈餘
  - \`balance-sheet/\` - 資產負債表
  - \`income-statement/\` - 損益表
  - \`cash-flow-statement/\` - 現金流量表
  - \`revenue/\` - 營收數據
  - \`dividend/\` - 股利數據
- \`us/\` - 美國市場財務報表
  - \`balance-sheet/\` - 資產負債表
  - \`income-statement/\` - 損益表
  - \`cashflow/\` - 現金流量
- \`jp/\` - 日本市場財務報表
  - \`financials/\` - 財務數據
  - \`performance/\` - 績效數據
  - \`cashflow/\` - 現金流量

### metadata/ - 元數據配置
包含股票代碼、標籤、分類等元數據配置：
- \`symbols/\` - 股票代碼
- \`labels/\` - 行業標籤
- \`categories/\` - 分類資訊
- \`details/\` - 詳細資訊
- \`sectors/\` - 行業分類

## 使用建議

### 批量執行
\`\`\`bash
# 執行每日更新
npm run crawl:daily

# 執行季度更新
npm run crawl:quarterly

# 執行元數據更新
npm run crawl:metadata

# 執行特定市場
npm run crawl:tw
npm run crawl:us
npm run crawl:jp
\`\`\`

### 目標時程
- **每日執行**: daily/ 目錄下的配置
- **季度執行**: quarterly/ 目錄下的配置
- **不定期執行**: metadata/ 目錄下的配置

---
自動生成時間: ${new Date().toISOString()}
`;

    await fs.writeFile(path.join(this.targetDir, 'README.md'), readmeContent);
    console.log(`📄 已創建目錄說明文檔: ${this.targetDir}/README.md`);
  }

  /**
   * 顯示最終統計
   */
  private displayFinalStats(): void {
    console.log('\n📊 遷移統計:');
    console.log(`   ✅ 成功遷移: ${this.stats.daily + this.stats.quarterly + this.stats.metadata} 個檔案`);
    console.log(`   ❌ 遷移失敗: ${this.stats.errors} 個檔案`);
    console.log(`   ⏭️  跳過檔案: ${this.stats.unmapped} 個檔案`);
    console.log(`\n📂 新目錄結構:`);
    console.log(`   ${this.targetDir}/`);
    console.log(`   ├── daily/     (${this.stats.daily} 個檔案)`);
    console.log(`   ├── quarterly/ (${this.stats.quarterly} 個檔案)`);
    console.log(`   └── metadata/  (${this.stats.metadata} 個檔案)`);
  }

  /**
   * 驗證遷移結果
   */
  async validateMigration(): Promise<boolean> {
    console.log('\n🔍 驗證遷移結果...');
    
    try {
      const originalCount = (await fs.readdir(this.backupDir))
        .filter(file => file.endsWith('.json')).length;
      
      const newCount = await this.countNewFiles();
      
      console.log(`   原始檔案數: ${originalCount}`);
      console.log(`   新檔案數: ${newCount}`);
      
      if (originalCount === newCount) {
        console.log('   ✅ 檔案數量一致');
        return true;
      } else {
        console.log('   ❌ 檔案數量不一致');
        return false;
      }
    } catch (error) {
      console.error('❌ 驗證失敗:', error);
      return false;
    }
  }

  /**
   * 計算新目錄下的檔案數量
   */
  private async countNewFiles(): Promise<number> {
    let count = 0;
    
    const categories = ['daily', 'quarterly', 'metadata'];
    for (const category of categories) {
      const categoryPath = path.join(this.targetDir, category);
      if (await fs.pathExists(categoryPath)) {
        count += await this.countFilesRecursively(categoryPath);
      }
    }
    
    return count;
  }

  /**
   * 遞歸計算目錄下的 JSON 檔案數
   */
  private async countFilesRecursively(dir: string): Promise<number> {
    let count = 0;
    const items = await fs.readdir(dir);
    
    for (const item of items) {
      const itemPath = path.join(dir, item);
      const stat = await fs.stat(itemPath);
      
      if (stat.isDirectory()) {
        count += await this.countFilesRecursively(itemPath);
      } else if (item.endsWith('.json')) {
        count++;
      }
    }
    
    return count;
  }
}

/**
 * 主執行函數
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const sourceDir = args.find(arg => arg.startsWith('--source='))?.split('=')[1] || 'config';
  const targetDir = args.find(arg => arg.startsWith('--target='))?.split('=')[1] || 'config-categorized';
  const help = args.includes('--help') || args.includes('-h');

  if (help) {
    console.log(`
配置檔案分類遷移工具

用法:
  npx tsx scripts/migrate-configs-to-categories.ts [選項]

選項:
  --dry-run              只預覽不實際移動檔案
  --source=<dir>         來源目錄 (預設: config)
  --target=<dir>         目標目錄 (預設: config-categorized)
  --help, -h             顯示此幫助資訊

範例:
  npx tsx scripts/migrate-configs-to-categories.ts --dry-run
  npx tsx scripts/migrate-configs-to-categories.ts --source=config --target=config-new
`);
    return;
  }

  try {
    const migrator = new ConfigMigrator({
      sourceDir,
      targetDir,
      dryRun
    });

    const stats = await migrator.migrate();

    if (!dryRun) {
      const isValid = await migrator.validateMigration();
      if (!isValid) {
        console.log('\n⚠️  遷移驗證失敗，請檢查結果');
        process.exit(1);
      }
    }

    console.log('\n🎊 遷移成功完成！');
    
  } catch (error) {
    console.error('❌ 遷移失敗:', error);
    process.exit(1);
  }
}

// 直接執行
if (require.main === module) {
  main();
}