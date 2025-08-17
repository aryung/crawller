#!/usr/bin/env tsx

/**
 * 進度狀態重置腳本
 * 提供各種進度重置功能，支援跳過任務重試
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import { ProgressTracker, TaskStatus } from '../src/batch/ProgressTracker';

interface ResetOptions {
  progressId?: string;
  resetType: 'failed' | 'skipped' | 'all' | 'failed-and-skipped';
  resetAttempts?: boolean;
  dryRun?: boolean;
  force?: boolean;
}

interface ResetReport {
  progressId: string;
  totalTasks: number;
  resetTasks: number;
  resetType: string;
  resetAttempts: boolean;
  affectedConfigs: string[];
  summary: {
    beforeReset: {
      completed: number;
      failed: number;
      skipped: number;
      pending: number;
      running: number;
    };
    afterReset: {
      completed: number;
      failed: number;
      skipped: number;
      pending: number;
      running: number;
    };
  };
}

class ProgressStatusReset {
  constructor() {}

  /**
   * 列出所有可用的進度檔案
   */
  async listProgressFiles(): Promise<string[]> {
    const progressDir = '.progress';
    
    if (!await fs.pathExists(progressDir)) {
      return [];
    }

    const files = await fs.readdir(progressDir);
    return files
      .filter(file => file.endsWith('.json') && file.startsWith('batch-'))
      .map(file => path.join(progressDir, file));
  }

  /**
   * 重置進度狀態
   */
  async resetProgressStatus(options: ResetOptions): Promise<ResetReport> {
    if (!options.progressId) {
      throw new Error('progressId is required');
    }

    const progressPath = options.progressId.endsWith('.json') 
      ? options.progressId 
      : path.join('.progress', `${options.progressId}.json`);

    if (!await fs.pathExists(progressPath)) {
      throw new Error(`Progress file not found: ${progressPath}`);
    }

    console.log(`🔄 載入進度檔案: ${progressPath}`);
    const tracker = await ProgressTracker.load(progressPath);
    const progressBefore = tracker.getProgress();

    let configsToReset: string[] = [];

    // 根據重置類型獲取要重置的配置
    switch (options.resetType) {
      case 'failed':
        configsToReset = tracker.getFailedConfigs();
        break;
      case 'skipped':
        configsToReset = tracker.getSkippedConfigs();
        break;
      case 'failed-and-skipped':
        configsToReset = tracker.getAllFailedAndSkippedConfigs();
        break;
      case 'all':
        configsToReset = Array.from(progressBefore.tasks.keys()).filter(
          configName => {
            const task = progressBefore.tasks.get(configName);
            return task && task.status !== TaskStatus.COMPLETED;
          }
        );
        break;
      default:
        throw new Error(`Unknown reset type: ${options.resetType}`);
    }

    console.log(`📊 找到 ${configsToReset.length} 個 ${options.resetType} 狀態的任務需要重置`);

    if (configsToReset.length === 0) {
      console.log('✅ 沒有需要重置的任務');
      return this.createEmptyReport(options.progressId, progressBefore, options);
    }

    if (options.dryRun) {
      console.log('🧪 預覽模式，不會實際修改檔案');
      console.log('將要重置的配置:');
      configsToReset.slice(0, 10).forEach((config, index) => {
        console.log(`   ${index + 1}. ${config}`);
      });
      if (configsToReset.length > 10) {
        console.log(`   ... 還有 ${configsToReset.length - 10} 個配置`);
      }
      
      return this.createDryRunReport(options.progressId, progressBefore, configsToReset, options);
    }

    // 確認重置操作
    if (!options.force) {
      console.log(`⚠️  即將重置 ${configsToReset.length} 個任務的狀態為 PENDING`);
      if (options.resetAttempts) {
        console.log('⚠️  同時將重置所有重試計數器');
      }
      console.log('這個操作無法撤銷！');
      
      // 在真實場景中，這裡可以添加用戶確認提示
      // 現在直接進行重置
    }

    // 執行重置
    const resetCount = tracker.resetConfigs(configsToReset, {
      resetAttempts: options.resetAttempts || false
    });

    console.log(`✅ 成功重置 ${resetCount} 個任務`);

    // 保存更新後的進度檔案
    await tracker.save();
    console.log(`💾 進度檔案已更新: ${progressPath}`);

    const progressAfter = tracker.getProgress();

    return {
      progressId: options.progressId,
      totalTasks: progressBefore.total,
      resetTasks: resetCount,
      resetType: options.resetType,
      resetAttempts: options.resetAttempts || false,
      affectedConfigs: configsToReset,
      summary: {
        beforeReset: {
          completed: progressBefore.completed,
          failed: progressBefore.failed,
          skipped: progressBefore.skipped,
          pending: progressBefore.pending,
          running: progressBefore.running
        },
        afterReset: {
          completed: progressAfter.completed,
          failed: progressAfter.failed,
          skipped: progressAfter.skipped,
          pending: progressAfter.pending,
          running: progressAfter.running
        }
      }
    };
  }

  /**
   * 創建空報告（沒有需要重置的任務時）
   */
  private createEmptyReport(progressId: string, progress: any, options: ResetOptions): ResetReport {
    return {
      progressId,
      totalTasks: progress.total,
      resetTasks: 0,
      resetType: options.resetType,
      resetAttempts: options.resetAttempts || false,
      affectedConfigs: [],
      summary: {
        beforeReset: {
          completed: progress.completed,
          failed: progress.failed,
          skipped: progress.skipped,
          pending: progress.pending,
          running: progress.running
        },
        afterReset: {
          completed: progress.completed,
          failed: progress.failed,
          skipped: progress.skipped,
          pending: progress.pending,
          running: progress.running
        }
      }
    };
  }

  /**
   * 創建預覽模式報告
   */
  private createDryRunReport(progressId: string, progress: any, configsToReset: string[], options: ResetOptions): ResetReport {
    const pendingIncrease = configsToReset.length;
    const failedDecrease = configsToReset.filter(config => {
      const task = progress.tasks.get(config);
      return task && task.status === TaskStatus.FAILED;
    }).length;
    const skippedDecrease = configsToReset.filter(config => {
      const task = progress.tasks.get(config);
      return task && task.status === TaskStatus.SKIPPED;
    }).length;

    return {
      progressId,
      totalTasks: progress.total,
      resetTasks: configsToReset.length,
      resetType: options.resetType,
      resetAttempts: options.resetAttempts || false,
      affectedConfigs: configsToReset,
      summary: {
        beforeReset: {
          completed: progress.completed,
          failed: progress.failed,
          skipped: progress.skipped,
          pending: progress.pending,
          running: progress.running
        },
        afterReset: {
          completed: progress.completed,
          failed: progress.failed - failedDecrease,
          skipped: progress.skipped - skippedDecrease,
          pending: progress.pending + pendingIncrease,
          running: progress.running
        }
      }
    };
  }

  /**
   * 列出所有進度檔案的狀態
   */
  async listAllProgressStatus(): Promise<void> {
    console.log('📊 查看所有進度檔案狀態');
    console.log('='.repeat(60));

    const progressFiles = await this.listProgressFiles();
    
    if (progressFiles.length === 0) {
      console.log('📂 沒有找到進度檔案');
      return;
    }

    for (const file of progressFiles) {
      try {
        const tracker = await ProgressTracker.load(file);
        const progress = tracker.getProgress();
        
        console.log(`\n📋 進度ID: ${progress.id}`);
        console.log(`   檔案: ${path.basename(file)}`);
        if (progress.category) console.log(`   類別: ${progress.category}`);
        if (progress.market) console.log(`   市場: ${progress.market}`);
        if (progress.type) console.log(`   類型: ${progress.type}`);
        
        const percentage = ((progress.completed + progress.failed + progress.skipped) / progress.total * 100).toFixed(1);
        console.log(`   進度: ${percentage}% (${progress.completed + progress.failed + progress.skipped}/${progress.total})`);
        
        console.log(`   狀態分佈:`);
        console.log(`     ✅ 完成: ${progress.completed}`);
        console.log(`     ❌ 失敗: ${progress.failed}`);
        console.log(`     ⏭️  跳過: ${progress.skipped}`);
        console.log(`     ⏳ 待處理: ${progress.pending}`);
        console.log(`     🔄 執行中: ${progress.running}`);

        // 顯示可重置的任務數量
        const failedConfigs = tracker.getFailedConfigs();
        const skippedConfigs = tracker.getSkippedConfigs();
        const allFailedAndSkipped = tracker.getAllFailedAndSkippedConfigs();
        
        if (allFailedAndSkipped.length > 0) {
          console.log(`   📋 可重置任務:`);
          if (failedConfigs.length > 0) {
            console.log(`     🔄 失敗任務: ${failedConfigs.length} 個`);
          }
          if (skippedConfigs.length > 0) {
            console.log(`     🔄 跳過任務: ${skippedConfigs.length} 個`);
          }
          console.log(`     🔄 總可重置: ${allFailedAndSkipped.length} 個`);
        }

      } catch (error) {
        console.log(`   ❌ 無法讀取進度檔案: ${file} - ${(error as Error).message}`);
      }
    }
  }

  /**
   * 打印重置報告
   */
  printResetReport(report: ResetReport): void {
    console.log('\n' + '='.repeat(60));
    console.log('📊 進度重置報告');
    console.log('='.repeat(60));
    
    console.log(`📋 進度ID: ${report.progressId}`);
    console.log(`🔄 重置類型: ${report.resetType}`);
    console.log(`📈 重置任務數: ${report.resetTasks}/${report.totalTasks}`);
    console.log(`🔢 重置重試計數: ${report.resetAttempts ? '是' : '否'}`);

    console.log(`\n📊 狀態變化:`);
    console.log(`   重置前: 完成 ${report.summary.beforeReset.completed}, 失敗 ${report.summary.beforeReset.failed}, 跳過 ${report.summary.beforeReset.skipped}, 待處理 ${report.summary.beforeReset.pending}, 執行中 ${report.summary.beforeReset.running}`);
    console.log(`   重置後: 完成 ${report.summary.afterReset.completed}, 失敗 ${report.summary.afterReset.failed}, 跳過 ${report.summary.afterReset.skipped}, 待處理 ${report.summary.afterReset.pending}, 執行中 ${report.summary.afterReset.running}`);

    if (report.affectedConfigs.length > 0) {
      console.log(`\n📋 受影響的配置 (前10個):`);
      report.affectedConfigs.slice(0, 10).forEach((config, index) => {
        console.log(`   ${index + 1}. ${config}`);
      });
      if (report.affectedConfigs.length > 10) {
        console.log(`   ... 還有 ${report.affectedConfigs.length - 10} 個配置`);
      }
    }

    console.log(`\n💡 下一步建議:`);
    if (report.resetTasks > 0) {
      console.log(`   🚀 重新執行: npx tsx src/cli.ts crawl-batch --resume=${report.progressId}`);
      console.log(`   📊 查看狀態: npx tsx src/cli.ts crawl-batch --status`);
    } else {
      console.log(`   ✅ 沒有需要重置的任務，進度狀態良好`);
    }
  }
}

// 主函數
async function main() {
  const args = process.argv.slice(2);
  const resetType = args.find(arg => arg.startsWith('--type='))?.split('=')[1] as ResetOptions['resetType'] || 'failed-and-skipped';
  const progressId = args.find(arg => arg.startsWith('--progress-id='))?.split('=')[1];
  const resetAttempts = args.includes('--reset-attempts');
  const dryRun = args.includes('--dry-run');
  const force = args.includes('--force');
  const listAll = args.includes('--list-all');
  const helpFlag = args.includes('--help') || args.includes('-h');

  if (helpFlag) {
    console.log(`
📋 進度狀態重置工具使用說明

使用方式：
  tsx scripts/reset-progress-status.ts [選項]

選項：
  --progress-id=<ID>        指定要重置的進度ID
  --type=<類型>             重置類型 (failed|skipped|failed-and-skipped|all)
  --reset-attempts          同時重置重試計數器
  --dry-run                 預覽模式，不實際修改檔案
  --force                   跳過確認提示
  --list-all                列出所有進度檔案狀態
  --help, -h                顯示此幫助信息

重置類型說明：
  failed                    只重置失敗的任務
  skipped                   只重置跳過的任務  
  failed-and-skipped        重置失敗和跳過的任務 (預設)
  all                       重置所有未完成的任務

範例：
  # 列出所有進度檔案
  tsx scripts/reset-progress-status.ts --list-all
  
  # 預覽重置跳過的任務
  tsx scripts/reset-progress-status.ts --progress-id=batch-quarterly-us-all-20250817T062052 --type=skipped --dry-run
  
  # 重置所有失敗和跳過的任務，並重置重試計數器
  tsx scripts/reset-progress-status.ts --progress-id=batch-quarterly-us-all-20250817T062052 --type=failed-and-skipped --reset-attempts --force
  
  # 重置所有未完成的任務
  tsx scripts/reset-progress-status.ts --progress-id=batch-quarterly-us-all-20250817T062052 --type=all --force
`);
    return;
  }

  const resetTool = new ProgressStatusReset();

  try {
    if (listAll) {
      await resetTool.listAllProgressStatus();
      return;
    }

    if (!progressId) {
      console.error('❌ 錯誤: 需要指定進度ID');
      console.log('💡 使用 --progress-id=<ID> 指定進度ID');
      console.log('💡 使用 --list-all 查看所有可用的進度檔案');
      console.log('💡 使用 --help 查看完整使用說明');
      process.exit(1);
    }

    const validTypes = ['failed', 'skipped', 'failed-and-skipped', 'all'];
    if (!validTypes.includes(resetType)) {
      console.error(`❌ 錯誤: 無效的重置類型 "${resetType}"`);
      console.log(`💡 有效的類型: ${validTypes.join(', ')}`);
      process.exit(1);
    }

    console.log('🔄 進度狀態重置工具');
    console.log('='.repeat(50));
    console.log(`📋 進度ID: ${progressId}`);
    console.log(`🔄 重置類型: ${resetType}`);
    console.log(`🔢 重置重試計數: ${resetAttempts ? '是' : '否'}`);
    console.log(`🧪 預覽模式: ${dryRun ? '是' : '否'}`);
    console.log('='.repeat(50));

    const report = await resetTool.resetProgressStatus({
      progressId,
      resetType,
      resetAttempts,
      dryRun,
      force
    });

    resetTool.printResetReport(report);

  } catch (error) {
    console.error('❌ 重置過程中發生錯誤:', (error as Error).message);
    process.exit(1);
  }
}

// 執行主函數
if (require.main === module) {
  main().catch(console.error);
}

export { ProgressStatusReset, ResetOptions, ResetReport };