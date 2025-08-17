#!/usr/bin/env tsx

/**
 * 顯示進度檔案詳細資訊腳本
 * 用於查看批次爬取的執行統計和狀態
 */

import * as fs from 'fs-extra';
import * as path from 'path';

interface TaskInfo {
  configName: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  attempts: number;
  startTime?: number;
  endTime?: number;
}

interface ProgressInfo {
  id: string;
  category?: string;
  market?: string;
  type?: string;
  total: number;
  completed: number;
  failed: number;
  skipped: number;
  running: number;
  pending: number;
  percentage: number;
  estimatedTimeRemaining: number;
  averageTimePerTask?: number;
  startTime: number;
  lastUpdateTime: number;
  tasks: Record<string, TaskInfo>;
  errors: any[];
}

/**
 * 格式化時間戳為可讀格式
 */
function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toISOString().replace('T', ' ').slice(0, 19);
}

/**
 * 格式化持續時間
 */
function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds.toFixed(1)} 秒`;
  } else if (seconds < 3600) {
    return `${(seconds / 60).toFixed(1)} 分鐘`;
  } else {
    return `${(seconds / 3600).toFixed(1)} 小時`;
  }
}

/**
 * 分類跳過錯誤類型
 */
function categorizeSkipError(error: string): string {
  const lowerError = error.toLowerCase();
  
  if (lowerError.includes('404') || lowerError.includes('not found')) {
    return '404 頁面不存在';
  }
  if (lowerError.includes('403') || lowerError.includes('forbidden') || lowerError.includes('access denied')) {
    return '403 權限錯誤';
  }
  if (lowerError.includes('401') || lowerError.includes('unauthorized')) {
    return '401 未授權';
  }
  if (lowerError.includes('invalid configuration') || lowerError.includes('parse error')) {
    return '配置錯誤';
  }
  if (lowerError.includes('malformed') || lowerError.includes('format')) {
    return '格式錯誤';
  }
  
  return '其他永久性錯誤';
}

/**
 * 顯示進度詳細資訊
 */
async function showProgressInfo(progressId: string): Promise<void> {
  try {
    const progressDir = '.progress';
    const progressFiles = await fs.readdir(progressDir);
    const progressFile = progressFiles.find(file => file.includes(progressId));

    if (!progressFile) {
      console.error(`❌ 找不到進度檔案: ${progressId}`);
      console.log('');
      console.log('📁 可用的進度檔案:');
      const batchFiles = progressFiles.filter(file => file.startsWith('batch-'));
      if (batchFiles.length > 0) {
        batchFiles.forEach(file => {
          const id = file.replace('.json', '');
          console.log(`   • ${id}`);
        });
      } else {
        console.log('   沒有找到進度檔案');
      }
      process.exit(1);
    }

    const progressPath = path.join(progressDir, progressFile);
    const progress: ProgressInfo = await fs.readJson(progressPath);

    // 計算統計資訊
    const startTime = new Date(progress.startTime);
    const endTime = new Date(progress.lastUpdateTime);
    const totalDuration = (progress.lastUpdateTime - progress.startTime) / 1000;

    // 分析任務狀態
    const taskStats = {
      completed: 0,
      failed: 0,
      pending: 0,
      running: 0,
      skipped: 0
    };

    const failedTasks: string[] = [];
    const skippedTasks: string[] = [];
    const completedTasks: string[] = [];
    const skippedTasksWithErrors: { configName: string; error: string; stockCode?: string }[] = [];

    Object.values(progress.tasks).forEach(task => {
      taskStats[task.status]++;
      if (task.status === 'failed') {
        failedTasks.push(task.configName);
      } else if (task.status === 'completed') {
        completedTasks.push(task.configName);
      } else if (task.status === 'skipped') {
        skippedTasks.push(task.configName);
        // 解析股票代碼和錯誤信息
        const stockCodeMatch = task.configName.match(/-([A-Z0-9]+(?:_TW)?).json$/);
        const stockCode = stockCodeMatch ? stockCodeMatch[1].replace('_TW', '') : undefined;
        skippedTasksWithErrors.push({
          configName: task.configName,
          error: (task as any).error || '未知原因',
          stockCode
        });
      }
    });

    // 顯示詳細資訊
    console.log('');
    console.log('📊 批次執行詳細資訊');
    console.log('='.repeat(70));
    console.log(`📋 批次 ID: ${progress.id}`);
    
    if (progress.category || progress.market || progress.type) {
      console.log(`🏷️  分類資訊:`);
      if (progress.category) console.log(`   • 類別: ${progress.category}`);
      if (progress.market) console.log(`   • 市場: ${progress.market}`);
      if (progress.type) console.log(`   • 類型: ${progress.type}`);
    }

    console.log(`⏰ 執行時間:`);
    console.log(`   • 開始時間: ${formatTimestamp(progress.startTime)}`);
    console.log(`   • 結束時間: ${formatTimestamp(progress.lastUpdateTime)}`);
    console.log(`   • 總耗時: ${formatDuration(totalDuration)}`);

    console.log(`📈 執行統計:`);
    console.log(`   • 總任務數: ${progress.total}`);
    console.log(`   • ✅ 成功: ${progress.completed} (${(progress.completed / progress.total * 100).toFixed(1)}%)`);
    console.log(`   • ❌ 失敗: ${progress.failed} (${(progress.failed / progress.total * 100).toFixed(1)}%)`);
    console.log(`   • ⏭️  跳過: ${progress.skipped} (${(progress.skipped / progress.total * 100).toFixed(1)}%)`);
    console.log(`   • 🔄 運行中: ${progress.running}`);
    console.log(`   • ⏳ 待處理: ${progress.pending}`);

    if (progress.averageTimePerTask) {
      console.log(`   • ⏱️  平均每任務: ${formatDuration(progress.averageTimePerTask / 1000)}`);
    }

    // 顯示錯誤資訊
    if (progress.errors && progress.errors.length > 0) {
      console.log(`❌ 錯誤資訊 (${progress.errors.length} 個):`);
      progress.errors.slice(0, 5).forEach((error, index) => {
        console.log(`   ${index + 1}. ${error.message || error}`);
      });
      if (progress.errors.length > 5) {
        console.log(`   ... 還有 ${progress.errors.length - 5} 個錯誤`);
      }
    }

    // 顯示失敗的任務（可重試）
    if (failedTasks.length > 0) {
      console.log(`⚠️  失敗任務 (${failedTasks.length} 個) - 可重試:`);
      failedTasks.slice(0, 10).forEach((task, index) => {
        const taskInfo = progress.tasks[task];
        console.log(`   ${index + 1}. ${task} (嘗試 ${taskInfo.attempts} 次)`);
      });
      if (failedTasks.length > 10) {
        console.log(`   ... 還有 ${failedTasks.length - 10} 個失敗任務`);
      }
    }

    // 顯示跳過的任務（永久性錯誤，不可重試）
    if (skippedTasks.length > 0) {
      console.log(`⏭️  跳過任務 (${skippedTasks.length} 個) - 永久性錯誤，不可重試:`);
      
      // 按錯誤類型分組顯示
      const errorGroups: { [key: string]: { configName: string; error: string; stockCode?: string }[] } = {};
      skippedTasksWithErrors.forEach(task => {
        const errorType = categorizeSkipError(task.error);
        if (!errorGroups[errorType]) {
          errorGroups[errorType] = [];
        }
        errorGroups[errorType].push(task);
      });

      Object.entries(errorGroups).forEach(([errorType, tasks]) => {
        console.log(`   📌 ${errorType} (${tasks.length} 個):`);
        tasks.slice(0, 5).forEach((task, index) => {
          console.log(`      ${index + 1}. ${task.stockCode || 'Unknown'} - ${task.configName}`);
          console.log(`         錯誤: ${task.error}`);
        });
        if (tasks.length > 5) {
          console.log(`      ... 還有 ${tasks.length - 5} 個同類型錯誤`);
        }
      });

      console.log('');
      console.log('💡 跳過任務處理建議:');
      console.log('   • 使用診斷工具: npm run crawl:diagnose:skipped');
      console.log('   • 檢查股票有效性: npm run crawl:validate:stocks');
      console.log('   • 清理無效股票: npm run crawl:clean:invalid');
    }

    // 顯示重試建議
    if (progress.failed > 0) {
      console.log('');
      console.log('🔄 重試建議:');
      console.log(`   npx tsx src/cli.ts crawl-batch --retry-failed=${progress.id}`);
    } else {
      console.log('');
      console.log('✅ 所有任務都已成功完成，無需重試');
    }

    console.log('='.repeat(70));
    console.log('');

  } catch (error) {
    console.error('❌ 讀取進度檔案失敗:', (error as Error).message);
    process.exit(1);
  }
}

// 主函數
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('❌ 請指定進度 ID');
    console.log('');
    console.log('💡 使用方式:');
    console.log('   npx tsx scripts/show-progress-info.ts <進度ID>');
    console.log('   npm run crawl:progress:info -- <進度ID>');
    console.log('');
    console.log('📋 範例:');
    console.log('   npx tsx scripts/show-progress-info.ts batch-quarterly-us-all-20250817T062052');
    console.log('');
    console.log('🔍 查看可用進度檔案:');
    console.log('   npm run crawl:retry:list');
    process.exit(1);
  }

  const progressId = args[0];
  await showProgressInfo(progressId);
}

if (require.main === module) {
  main().catch(error => {
    console.error('❌ 執行失敗:', error.message);
    process.exit(1);
  });
}