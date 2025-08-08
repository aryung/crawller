import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

export interface RunResult {
  configName: string;
  success: boolean;
  output?: string;
  error?: string;
  code?: number;
}

export interface BatchRunnerOptions {
  configPrefix: string;
  displayName: string;
  delayMs?: number;
  estimatedTimePerItem?: number;
  tips?: string[];
}

export class BatchRunner {
  private options: Required<BatchRunnerOptions>;

  constructor(options: BatchRunnerOptions) {
    this.options = {
      delayMs: 8000,
      estimatedTimePerItem: 15,
      tips: [],
      ...options
    };
  }

  async runCrawler(configName: string): Promise<RunResult> {
    return new Promise((resolve, reject) => {
      console.log(`🚀 開始執行: ${configName}`);
      
      const child: ChildProcessWithoutNullStreams = spawn('npm', ['run', 'crawl', configName], {
        stdio: 'pipe',
        cwd: path.join(__dirname, '../..')
      });
      
      let output = '';
      let errorOutput = '';
      
      child.stdout.on('data', (data: Buffer) => {
        output += data.toString();
      });
      
      child.stderr.on('data', (data: Buffer) => {
        errorOutput += data.toString();
      });
      
      child.on('close', (code: number | null) => {
        if (code === 0) {
          console.log(`✅ 完成: ${configName}`);
          resolve({ configName, success: true, output });
        } else {
          console.log(`❌ 失敗: ${configName} (代碼: ${code})`);
          resolve({ configName, success: false, error: errorOutput, code: code || undefined });
        }
      });
      
      child.on('error', (error: Error) => {
        console.log(`💥 錯誤: ${configName} - ${error.message}`);
        reject({ configName, error: error.message });
      });
    });
  }

  delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  findConfigFiles(limit: number | null): string[] {
    // 檢查兩個可能的配置目錄
    const activeDir = path.join(__dirname, '../../config/active');
    const configsDir = path.join(__dirname, '../../config');
    
    // 找出所有配置文件
    let configFiles: string[] = [];
    
    // 首先檢查 active 目錄
    if (fs.existsSync(activeDir)) {
      try {
        configFiles = fs.readdirSync(activeDir)
          .filter(file => file.startsWith(this.options.configPrefix) && file.endsWith('.json'))
          .map(file => `active/${file.replace('.json', '')}`);
      } catch (error) {
        console.log('⚠️  無法讀取 active 配置目錄:', activeDir);
      }
    }
    
    // 如果 active 目錄沒有找到，檢查根配置目錄
    if (configFiles.length === 0) {
      try {
        configFiles = fs.readdirSync(configsDir)
          .filter(file => file.startsWith(this.options.configPrefix) && file.endsWith('.json'))
          .map(file => file.replace('.json', ''));
      } catch (error) {
        console.log('❌ 無法讀取配置目錄:', configsDir);
        process.exit(1);
      }
    }
    
    // 如果設定了限制，只取前 N 個
    if (limit && limit > 0) {
      configFiles = configFiles.slice(0, limit);
      console.log(`📊 限制執行數量: ${limit} 個配置`);
    }
    
    return configFiles;
  }

  async run(): Promise<void> {
    // 解析命令行參數
    const args = process.argv.slice(2);
    const limitArg = args.find(arg => arg.startsWith('--limit='));
    const limit = limitArg ? parseInt(limitArg.split('=')[1]) : null;
    
    const configFiles = this.findConfigFiles(limit);
    
    if (configFiles.length === 0) {
      console.log(`❌ 沒有找到 ${this.options.displayName} 配置文件`);
      const templateType = this.options.configPrefix.replace('yahoo-finance-', '').replace(/-/g, '-');
      console.log(`💡 請先執行: npx tsx scripts/generate-${templateType.split('-')[0]}-configs.ts --type=${templateType.split('-').slice(1).join('-')}`);
      process.exit(1);
    }
    
    console.log(`🔍 ${this.options.displayName} 批量爬蟲`);
    console.log('===============================================');
    console.log(`📋 找到 ${configFiles.length} 個配置文件`);
    console.log(`⏱️  預估執行時間: ${Math.ceil(configFiles.length * this.options.estimatedTimePerItem / 60)} 分鐘`);
    console.log('');
    
    const results: RunResult[] = [];
    const startTime = Date.now();
    
    for (let i = 0; i < configFiles.length; i++) {
      const configName = configFiles[i];
      
      console.log(`\n[${i + 1}/${configFiles.length}] 處理配置: ${configName}`);
      
      try {
        const result = await this.runCrawler(configName);
        results.push(result);
        
        // 在請求之間加入延遲，避免被反爬蟲機制阻擋
        if (i < configFiles.length - 1) {
          console.log(`⏳ 等待 ${this.options.delayMs / 1000} 秒後繼續...`);
          await this.delay(this.options.delayMs);
        }
        
      } catch (error: any) {
        console.log(`💥 配置執行異常: ${configName}`, error);
        results.push({ configName, success: false, error: error.error || error.message });
      }
    }
    
    // 統計結果
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    const endTime = Date.now();
    const duration = Math.round((endTime - startTime) / 1000);
    
    console.log(`\n✅ ${this.options.displayName} 批量執行完成`);
    console.log('===============================================');
    console.log(`📊 成功: ${successful} 個`);
    console.log(`❌ 失敗: ${failed} 個`);
    console.log(`⏱️  總耗時: ${Math.floor(duration / 60)}:${String(duration % 60).padStart(2, '0')}`);
    
    // 列出失敗的配置
    if (failed > 0) {
      console.log('\n❌ 失敗的配置:');
      results.filter(r => !r.success).forEach(result => {
        console.log(`   ${result.configName} - ${result.error || '未知錯誤'}`);
      });
    }
    
    // 列出成功的配置範例
    if (successful > 0) {
      console.log('\n✅ 成功的配置範例:');
      results.filter(r => r.success).slice(0, 5).forEach(result => {
        console.log(`   ${result.configName}`);
      });
      if (successful > 5) {
        console.log(`   ... 還有 ${successful - 5} 個成功的配置`);
      }
    }
    
    console.log('\n💡 提示:');
    console.log('   - 檢查 output/ 目錄查看爬取結果');
    console.log('   - 使用 --limit=N 參數限制執行數量');
    console.log('   - 失敗的配置可以單獨重新執行');
    
    if (this.options.tips.length > 0) {
      this.options.tips.forEach(tip => {
        console.log(`   - ${tip}`);
      });
    }
  }
}