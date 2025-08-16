#!/usr/bin/env tsx

import * as fs from 'fs-extra';
import * as path from 'path';
import { ProgressTracker } from '../src/batch/ProgressTracker';

interface ProgressStats {
  totalFiles: number;
  totalSize: string;
  oldFiles: {
    days7: number;
    days3: number;
    days1: number;
  };
  recentFiles: string[];
  largestFiles: Array<{ name: string; size: string }>;
}

/**
 * 檢查進度目錄狀態
 */
async function checkProgressStatus(progressDir: string = '.progress'): Promise<ProgressStats> {
  if (!await fs.pathExists(progressDir)) {
    throw new Error(`進度目錄不存在: ${progressDir}`);
  }

  const files = await fs.readdir(progressDir);
  const jsonFiles = files.filter(file => file.endsWith('.json'));
  
  let totalSize = 0;
  const fileDetails: Array<{ name: string; size: number; mtime: Date }> = [];
  
  // 收集檔案詳細資訊
  for (const file of jsonFiles) {
    const filePath = path.join(progressDir, file);
    const stats = await fs.stat(filePath);
    if (stats.isFile()) {
      totalSize += stats.size;
      fileDetails.push({
        name: file,
        size: stats.size,
        mtime: stats.mtime
      });
    }
  }

  // 計算舊檔案數量
  const now = Date.now();
  const oldFiles = {
    days7: fileDetails.filter(f => now - f.mtime.getTime() > 7 * 24 * 60 * 60 * 1000).length,
    days3: fileDetails.filter(f => now - f.mtime.getTime() > 3 * 24 * 60 * 60 * 1000).length,
    days1: fileDetails.filter(f => now - f.mtime.getTime() > 1 * 24 * 60 * 60 * 1000).length,
  };

  // 最近的檔案（按修改時間排序）
  const recentFiles = fileDetails
    .sort((a, b) => b.mtime.getTime() - a.mtime.getTime())
    .slice(0, 5)
    .map(f => f.name);

  // 最大的檔案（按大小排序）
  const largestFiles = fileDetails
    .sort((a, b) => b.size - a.size)
    .slice(0, 5)
    .map(f => ({
      name: f.name,
      size: formatFileSize(f.size)
    }));

  return {
    totalFiles: jsonFiles.length,
    totalSize: formatFileSize(totalSize),
    oldFiles,
    recentFiles,
    largestFiles
  };
}

/**
 * 格式化檔案大小
 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

/**
 * 分析進度檔案內容
 */
async function analyzeProgressFiles(progressDir: string = '.progress'): Promise<void> {
  try {
    const progressFiles = await ProgressTracker.listProgressFiles(progressDir);
    
    if (progressFiles.length === 0) {
      console.log('📂 沒有找到進度檔案');
      return;
    }

    console.log('\n📊 進度檔案分析:');
    console.log(''.padEnd(60, '='));
    
    for (const filePath of progressFiles.slice(0, 5)) { // 只分析最近的 5 個
      try {
        const tracker = await ProgressTracker.load(filePath);
        const progress = tracker.getProgress();
        const fileName = path.basename(filePath);
        
        console.log(`\n📁 ${fileName}`);
        console.log(`   類別: ${progress.category || 'all'} | 市場: ${progress.market || 'all'} | 類型: ${progress.type || 'all'}`);
        console.log(`   進度: ${progress.completed}/${progress.total} (${progress.percentage.toFixed(1)}%)`);
        console.log(`   狀態: ✅ ${progress.completed} 完成, ❌ ${progress.failed} 失敗, ⏸️ ${progress.skipped} 跳過`);
        
        if (progress.failed > 0) {
          console.log(`   錯誤: ${progress.errors.slice(0, 2).join(', ')}${progress.errors.length > 2 ? '...' : ''}`);
        }
      } catch (error) {
        console.log(`\n📁 ${path.basename(filePath)} - ⚠️ 無法讀取檔案`);
      }
    }
    
    if (progressFiles.length > 5) {
      console.log(`\n... 還有 ${progressFiles.length - 5} 個檔案未顯示`);
    }
  } catch (error) {
    console.error('分析進度檔案時發生錯誤:', error);
  }
}

/**
 * 顯示清理建議
 */
function showCleanupSuggestions(stats: ProgressStats): void {
  console.log('\n🧹 清理建議:');
  console.log(''.padEnd(60, '='));
  
  if (stats.totalFiles > 20) {
    console.log('⚠️  檔案數量過多，建議清理');
    console.log('   npm run clean:progress:keep-recent  # 只保留最近 5 個');
  }
  
  if (stats.oldFiles.days7 > 0) {
    console.log(`📅 有 ${stats.oldFiles.days7} 個檔案超過 7 天`);
    console.log('   npm run clean:progress:old          # 清理 7 天前的檔案');
  }
  
  if (stats.oldFiles.days3 > 0) {
    console.log(`📅 有 ${stats.oldFiles.days3} 個檔案超過 3 天`);
    console.log('   npm run clean:progress:safe         # 清理 3 天前的檔案');
  }
  
  if (stats.totalFiles > 10) {
    console.log('\n💡 維護建議:');
    console.log('   npm run maintenance                 # 執行完整維護');
    console.log('   npm run clean:progress              # 完全清理進度目錄');
  }
}

/**
 * 主函數
 */
async function main(): Promise<void> {
  try {
    const progressDir = process.argv[2] || '.progress';
    
    console.log('📊 進度目錄狀態檢查');
    console.log(''.padEnd(60, '='));
    console.log(`📂 檢查目錄: ${progressDir}`);
    
    const stats = await checkProgressStatus(progressDir);
    
    console.log(`
╔════════════════════════════════════════════════════════════╗
║                    📁 進度目錄狀態                          ║
╠════════════════════════════════════════════════════════════╣
║  📊 基本統計：                                              ║
║  • 總檔案數：${stats.totalFiles} 個                         ║
║  • 總大小：${stats.totalSize}                               ║
║                                                            ║
║  📅 檔案年齡分布：                                          ║
║  • 超過 1 天：${stats.oldFiles.days1} 個                   ║
║  • 超過 3 天：${stats.oldFiles.days3} 個                   ║
║  • 超過 7 天：${stats.oldFiles.days7} 個                   ║
║                                                            ║
║  📁 最近檔案：                                              ║
${stats.recentFiles.map(f => `║  • ${f.padEnd(54)}║`).join('\n')}
║                                                            ║
║  📦 最大檔案：                                              ║
${stats.largestFiles.map(f => `║  • ${f.name.slice(0, 40).padEnd(40)} ${f.size.padStart(8)}  ║`).join('\n')}
╚════════════════════════════════════════════════════════════╝
    `);

    // 分析進度檔案內容
    await analyzeProgressFiles(progressDir);
    
    // 顯示清理建議
    showCleanupSuggestions(stats);
    
  } catch (error) {
    console.error('檢查進度狀態時發生錯誤:', error);
    process.exit(1);
  }
}

// 執行主函數
if (require.main === module) {
  main();
}