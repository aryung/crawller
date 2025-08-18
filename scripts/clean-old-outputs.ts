#!/usr/bin/env tsx

import * as fs from 'fs-extra';
import * as path from 'path';
import { glob } from 'glob';

interface CleanupOptions {
  dryRun: boolean;
  maxAgeDays: number;
  outputDir: string;
  verbose: boolean;
}

/**
 * 清理舊的輸出檔案腳本
 * 用於清理超過指定天數的爬蟲輸出檔案
 */
class OutputCleaner {
  private options: CleanupOptions;
  private deletedFiles: string[] = [];
  private preservedFiles: string[] = [];

  constructor(options: CleanupOptions) {
    this.options = options;
  }

  /**
   * 執行清理操作
   */
  async clean(): Promise<void> {
    console.log('🧹 爬蟲輸出檔案清理工具');
    console.log('========================');
    console.log(`📁 目標目錄: ${this.options.outputDir}`);
    console.log(`📅 清理條件: 超過 ${this.options.maxAgeDays} 天的檔案`);
    console.log(`🔍 模式: ${this.options.dryRun ? '預覽模式（不實際刪除）' : '實際清理模式'}`);
    console.log('');

    // 檢查目錄是否存在
    if (!(await fs.pathExists(this.options.outputDir))) {
      console.log('❌ 輸出目錄不存在:', this.options.outputDir);
      return;
    }

    // 搜尋所有 JSON 輸出檔案
    const patterns = [
      path.join(this.options.outputDir, 'daily/**/*.json'),
      path.join(this.options.outputDir, 'quarterly/**/*.json'),
      path.join(this.options.outputDir, 'metadata/**/*.json'),
      // 傳統平面結構（向後兼容）
      path.join(this.options.outputDir, '*.json'),
    ];

    const allFiles: string[] = [];
    for (const pattern of patterns) {
      const files = await glob(pattern);
      allFiles.push(...files);
    }

    // 去重
    const uniqueFiles = Array.from(new Set(allFiles));
    console.log(`📊 找到 ${uniqueFiles.length} 個輸出檔案`);

    if (uniqueFiles.length === 0) {
      console.log('✅ 沒有找到任何輸出檔案，無需清理');
      return;
    }

    // 分析檔案
    await this.analyzeFiles(uniqueFiles);

    // 顯示結果
    this.showSummary();
  }

  /**
   * 分析檔案並決定是否清理
   */
  private async analyzeFiles(files: string[]): Promise<void> {
    const cutoffTime = Date.now() - (this.options.maxAgeDays * 24 * 60 * 60 * 1000);

    for (const file of files) {
      try {
        const stats = await fs.stat(file);
        const fileAge = Date.now() - stats.mtime.getTime();
        const ageDays = Math.floor(fileAge / (24 * 60 * 60 * 1000));

        if (stats.mtime.getTime() < cutoffTime) {
          // 檔案太舊，標記為刪除
          this.deletedFiles.push(file);
          
          if (this.options.verbose) {
            console.log(`🗑️  刪除: ${path.relative(this.options.outputDir, file)} (${ageDays} 天)`);
          }

          // 實際刪除檔案
          if (!this.options.dryRun) {
            await fs.remove(file);
          }
        } else {
          // 檔案較新，保留
          this.preservedFiles.push(file);
          
          if (this.options.verbose) {
            console.log(`✅ 保留: ${path.relative(this.options.outputDir, file)} (${ageDays} 天)`);
          }
        }
      } catch (error) {
        console.error(`❌ 處理檔案失敗: ${file}`, error);
      }
    }
  }

  /**
   * 顯示清理摘要
   */
  private showSummary(): void {
    console.log('\n📋 清理摘要');
    console.log('============');
    console.log(`🗑️  已刪除: ${this.deletedFiles.length} 個檔案`);
    console.log(`✅ 已保留: ${this.preservedFiles.length} 個檔案`);

    if (this.deletedFiles.length > 0) {
      console.log('\n🗑️  被刪除的檔案:');
      this.deletedFiles.slice(0, 10).forEach(file => {
        console.log(`   ${path.relative(this.options.outputDir, file)}`);
      });
      if (this.deletedFiles.length > 10) {
        console.log(`   ... 還有 ${this.deletedFiles.length - 10} 個檔案`);
      }
    }

    if (this.options.dryRun && this.deletedFiles.length > 0) {
      console.log('\n💡 這是預覽模式，實際執行請移除 --dry-run 參數');
    }

    console.log('\n✅ 清理完成');
  }
}

/**
 * 解析命令行參數
 */
function parseArgs(): CleanupOptions {
  const args = process.argv.slice(2);
  
  const dryRun = args.includes('--dry-run');
  const verbose = args.includes('--verbose') || args.includes('-v');
  
  const maxAgeDaysArg = args.find(arg => arg.startsWith('--max-age='));
  const maxAgeDays = maxAgeDaysArg ? parseInt(maxAgeDaysArg.split('=')[1]) : 7;
  
  const outputDirArg = args.find(arg => arg.startsWith('--output-dir='));
  const outputDir = outputDirArg 
    ? outputDirArg.split('=')[1] 
    : path.join(__dirname, '../output');

  return {
    dryRun,
    maxAgeDays,
    outputDir,
    verbose,
  };
}

/**
 * 顯示使用說明
 */
function showHelp(): void {
  console.log(`
🧹 爬蟲輸出檔案清理工具

用法:
  npx tsx scripts/clean-old-outputs.ts [選項]

選項:
  --dry-run              預覽模式，不實際刪除檔案
  --verbose, -v          顯示詳細資訊
  --max-age=DAYS         設定檔案最大保留天數（預設: 7）
  --output-dir=PATH      指定輸出目錄（預設: ../output）
  --help, -h             顯示此說明

範例:
  # 預覽清理超過 7 天的檔案
  npm run clean:outputs:dry
  
  # 實際清理超過 7 天的檔案
  npm run clean:outputs
  
  # 清理超過 14 天的檔案
  npx tsx scripts/clean-old-outputs.ts --max-age=14
  
  # 詳細模式預覽
  npx tsx scripts/clean-old-outputs.ts --dry-run --verbose
`);
}

/**
 * 主要執行函數
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    showHelp();
    return;
  }

  try {
    const options = parseArgs();
    const cleaner = new OutputCleaner(options);
    await cleaner.clean();
  } catch (error) {
    console.error('❌ 清理過程中發生錯誤:', error);
    process.exit(1);
  }
}

// 執行腳本
if (require.main === module) {
  main().catch(console.error);
}

export { OutputCleaner, CleanupOptions };