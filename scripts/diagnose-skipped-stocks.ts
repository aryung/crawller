#!/usr/bin/env tsx

/**
 * 診斷被跳過股票的腳本
 * 分析進度檔案中的 SKIPPED 任務，提供詳細的錯誤原因和處理建議
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import { ProgressSummary, TaskStatus } from '../src/batch/ProgressTracker';

interface SkippedTaskInfo {
  configName: string;
  error?: string;
  stockCode?: string;
  market?: string;
  dataType?: string;
  url?: string;
}

interface DiagnosisReport {
  totalSkipped: number;
  errorCategories: Record<string, SkippedTaskInfo[]>;
  stocksByMarket: Record<string, string[]>;
  recommendations: string[];
}

class SkippedStocksDiagnostic {
  private progressDir: string;

  constructor(progressDir: string = '.progress') {
    this.progressDir = progressDir;
  }

  /**
   * 獲取所有進度檔案
   */
  async getProgressFiles(): Promise<string[]> {
    if (!await fs.pathExists(this.progressDir)) {
      return [];
    }

    const files = await fs.readdir(this.progressDir);
    return files
      .filter(file => file.endsWith('.json') && file.startsWith('batch-'))
      .map(file => path.join(this.progressDir, file))
      .sort((a, b) => {
        // 按修改時間倒序排列
        const statA = fs.statSync(a);
        const statB = fs.statSync(b);
        return statB.mtime.getTime() - statA.mtime.getTime();
      });
  }

  /**
   * 解析配置名稱，提取股票代碼和市場信息
   */
  parseConfigName(configName: string): {
    stockCode?: string;
    market?: string;
    dataType?: string;
    url?: string;
  } {
    // 範例: yahoo-finance-us-financials-AAPL.json
    // 範例: yahoo-finance-tw-eps-2330_TW.json
    const match = configName.match(/yahoo-finance-(\w+)-(\w+(?:-\w+)*)-(.+)\.json$/);
    
    if (match) {
      const [, market, dataType, stockPart] = match;
      const stockCode = stockPart.replace(/_TW$/, ''); // 移除 _TW 後綴
      
      // 構建可能的 URL
      let url = '';
      if (market === 'us') {
        url = `https://finance.yahoo.com/quote/${stockCode}`;
      } else if (market === 'tw') {
        url = `https://tw.stock.yahoo.com/quote/${stockCode}.TW`;
      } else if (market === 'jp') {
        url = `https://finance.yahoo.com/quote/${stockCode}.T`;
      }

      return { stockCode, market, dataType, url };
    }

    return {};
  }

  /**
   * 分類錯誤原因
   */
  categorizeError(error: string): string {
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
   * 分析單個進度檔案
   */
  async analyzeProgressFile(filePath: string): Promise<SkippedTaskInfo[]> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const progress: ProgressSummary = JSON.parse(content);
      const skippedTasks: SkippedTaskInfo[] = [];

      // 轉換 Map 為對象（如果需要）
      const tasks = progress.tasks instanceof Map ? 
        Object.fromEntries(progress.tasks) : 
        progress.tasks;

      for (const [configName, task] of Object.entries(tasks)) {
        if (task.status === TaskStatus.SKIPPED) {
          const parsed = this.parseConfigName(configName);
          skippedTasks.push({
            configName,
            error: task.error || '未知錯誤',
            ...parsed
          });
        }
      }

      return skippedTasks;
    } catch (error) {
      console.error(`❌ 讀取進度檔案失敗: ${filePath}`, error);
      return [];
    }
  }

  /**
   * 生成診斷報告
   */
  async generateReport(progressFileId?: string): Promise<DiagnosisReport> {
    const progressFiles = await this.getProgressFiles();
    
    if (progressFiles.length === 0) {
      throw new Error('未找到任何進度檔案');
    }

    let filesToAnalyze = progressFiles;
    
    // 如果指定了特定進度檔案 ID
    if (progressFileId) {
      filesToAnalyze = progressFiles.filter(file => 
        path.basename(file).includes(progressFileId)
      );
      
      if (filesToAnalyze.length === 0) {
        throw new Error(`未找到包含 ID "${progressFileId}" 的進度檔案`);
      }
    }

    console.log(`📊 分析 ${filesToAnalyze.length} 個進度檔案...`);

    const allSkippedTasks: SkippedTaskInfo[] = [];
    
    for (const file of filesToAnalyze) {
      const skippedTasks = await this.analyzeProgressFile(file);
      allSkippedTasks.push(...skippedTasks);
      console.log(`📁 ${path.basename(file)}: ${skippedTasks.length} 個跳過任務`);
    }

    // 按錯誤類型分組
    const errorCategories: Record<string, SkippedTaskInfo[]> = {};
    const stocksByMarket: Record<string, string[]> = {};

    for (const task of allSkippedTasks) {
      // 按錯誤類型分組
      const category = this.categorizeError(task.error || '');
      if (!errorCategories[category]) {
        errorCategories[category] = [];
      }
      errorCategories[category].push(task);

      // 按市場分組股票代碼
      if (task.market && task.stockCode) {
        if (!stocksByMarket[task.market]) {
          stocksByMarket[task.market] = [];
        }
        if (!stocksByMarket[task.market].includes(task.stockCode)) {
          stocksByMarket[task.market].push(task.stockCode);
        }
      }
    }

    // 生成建議
    const recommendations = this.generateRecommendations(errorCategories, stocksByMarket);

    return {
      totalSkipped: allSkippedTasks.length,
      errorCategories,
      stocksByMarket,
      recommendations
    };
  }

  /**
   * 生成處理建議
   */
  generateRecommendations(
    errorCategories: Record<string, SkippedTaskInfo[]>,
    stocksByMarket: Record<string, string[]>
  ): string[] {
    const recommendations: string[] = [];

    // 404 錯誤建議
    if (errorCategories['404 頁面不存在']?.length > 0) {
      recommendations.push(
        '🔍 對於 404 錯誤的股票：',
        '   • 檢查股票是否已下市或代碼變更',
        '   • 使用 npm run crawl:validate:stocks 驗證股票代碼',
        '   • 考慮從股票列表中移除無效代碼'
      );
    }

    // 403 錯誤建議
    if (errorCategories['403 權限錯誤']?.length > 0) {
      recommendations.push(
        '🚫 對於 403 權限錯誤的股票：',
        '   • 可能存在地區限制',
        '   • 檢查 User-Agent 和 Headers 配置',
        '   • 考慮使用代理或調整請求頻率'
      );
    }

    // 配置錯誤建議
    if (errorCategories['配置錯誤']?.length > 0) {
      recommendations.push(
        '⚙️  對於配置錯誤的任務：',
        '   • 檢查配置檔案的選擇器是否正確',
        '   • 驗證 URL 模板是否有效',
        '   • 使用 npm run validate 驗證配置'
      );
    }

    // 市場特定建議
    Object.entries(stocksByMarket).forEach(([market, stocks]) => {
      if (stocks.length > 5) {
        recommendations.push(
          `📈 ${market.toUpperCase()} 市場有 ${stocks.length} 個問題股票，建議：`,
          '   • 批量檢查這些股票的有效性',
          '   • 更新股票代碼資料庫',
          `   • 執行: npm run update:stockcodes:${market}`
        );
      }
    });

    return recommendations;
  }

  /**
   * 輸出診斷報告
   */
  printReport(report: DiagnosisReport) {
    console.log('\n' + '='.repeat(60));
    console.log('📊 跳過任務診斷報告');
    console.log('='.repeat(60));
    
    console.log(`\n📋 總覽：`);
    console.log(`   • 總跳過任務數：${report.totalSkipped}`);
    console.log(`   • 錯誤類型數：${Object.keys(report.errorCategories).length}`);
    console.log(`   • 涉及市場數：${Object.keys(report.stocksByMarket).length}`);

    console.log(`\n🏷️  錯誤分類：`);
    Object.entries(report.errorCategories)
      .sort((a, b) => b[1].length - a[1].length)
      .forEach(([category, tasks]) => {
        console.log(`   • ${category}: ${tasks.length} 個任務`);
        
        // 顯示前 5 個範例
        const examples = tasks.slice(0, 5).map(task => 
          `${task.stockCode || 'Unknown'} (${task.market || 'Unknown'})`
        ).join(', ');
        
        console.log(`     範例: ${examples}${tasks.length > 5 ? '...' : ''}`);
      });

    console.log(`\n🌍 市場分佈：`);
    Object.entries(report.stocksByMarket).forEach(([market, stocks]) => {
      console.log(`   • ${market.toUpperCase()}: ${stocks.length} 個問題股票`);
    });

    console.log(`\n💡 處理建議：`);
    report.recommendations.forEach(rec => {
      console.log(`   ${rec}`);
    });

    console.log(`\n🛠️  後續操作：`);
    console.log(`   • npm run crawl:validate:stocks  - 驗證股票代碼`);
    console.log(`   • npm run crawl:clean:invalid    - 清理無效股票`);
    console.log(`   • npm run update:stockcodes      - 更新股票代碼資料庫`);
  }

  /**
   * 輸出詳細的跳過任務列表
   */
  printDetailedList(report: DiagnosisReport) {
    console.log('\n' + '='.repeat(60));
    console.log('📋 跳過任務詳細列表');
    console.log('='.repeat(60));

    Object.entries(report.errorCategories).forEach(([category, tasks]) => {
      console.log(`\n🔍 ${category} (${tasks.length} 個):`);
      
      tasks.forEach((task, index) => {
        console.log(`   ${index + 1}. ${task.stockCode || 'Unknown'} (${task.market || 'Unknown'})`);
        console.log(`      配置: ${task.configName}`);
        console.log(`      錯誤: ${task.error}`);
        if (task.url) {
          console.log(`      URL: ${task.url}`);
        }
        console.log('');
      });
    });
  }
}

// 主函數
async function main() {
  const args = process.argv.slice(2);
  const progressId = args.find(arg => !arg.startsWith('--'));
  const showDetailed = args.includes('--detailed') || args.includes('-d');
  const helpFlag = args.includes('--help') || args.includes('-h');

  if (helpFlag) {
    console.log(`
📋 跳過股票診斷工具使用說明

使用方式：
  tsx scripts/diagnose-skipped-stocks.ts [進度ID] [選項]

參數：
  進度ID    指定要分析的進度檔案ID（可選，不指定則分析所有）

選項：
  --detailed, -d    顯示詳細的任務列表
  --help, -h        顯示此幫助信息

範例：
  tsx scripts/diagnose-skipped-stocks.ts
  tsx scripts/diagnose-skipped-stocks.ts batch-quarterly-us-all-20250817T062052
  tsx scripts/diagnose-skipped-stocks.ts --detailed
  tsx scripts/diagnose-skipped-stocks.ts batch-quarterly-us-all-20250817T062052 --detailed
`);
    return;
  }

  try {
    const diagnostic = new SkippedStocksDiagnostic();
    const report = await diagnostic.generateReport(progressId);
    
    if (report.totalSkipped === 0) {
      console.log('✅ 沒有發現跳過的任務！');
      return;
    }

    diagnostic.printReport(report);
    
    if (showDetailed) {
      diagnostic.printDetailedList(report);
    }

  } catch (error) {
    console.error('❌ 診斷過程中發生錯誤:', error);
    process.exit(1);
  }
}

// 執行主函數
if (require.main === module) {
  main().catch(console.error);
}

export { SkippedStocksDiagnostic };