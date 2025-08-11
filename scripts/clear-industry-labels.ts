#!/usr/bin/env tsx
/**
 * Script to clear industry labels from backend
 * 
 * This script:
 * 1. Fetches all system-defined industry labels
 * 2. Optionally filters by market or label name
 * 3. Deletes labels and their relationships
 * 4. Provides dry-run mode for preview
 * 
 * Usage:
 *   npm run clear:labels          # Delete all industry labels
 *   npm run clear:labels:dry      # Dry run mode
 *   npm run clear:labels -- --market=TPE  # Clear only Taiwan labels
 *   npm run clear:labels -- --pattern="產業*"  # Clear matching pattern
 */

// Load environment variables from .env file
import 'dotenv/config';

import axios, { AxiosInstance } from 'axios';
import chalk from 'chalk';
import ora from 'ora';
import { program } from 'commander';
import { ApiClient, createApiClient } from '../src/common/api-client';

interface Label {
  id: string;
  name: string;
  type: string;
  description?: string;
  usageCount?: number;
}

interface ClearConfig {
  apiUrl: string;
  apiToken?: string;
  dryRun: boolean;
  market?: string;
  pattern?: string;
  confirm: boolean;
  forceHardDelete: boolean;
}

class IndustryLabelCleaner {
  private apiClient: ApiClient;
  private config: ClearConfig;
  private spinner: any;

  constructor(config: ClearConfig) {
    this.config = config;
    this.apiClient = createApiClient({
      apiUrl: config.apiUrl,
      apiToken: config.apiToken,
    });
  }

  /**
   * 解碼產業標籤（本地版本，用於向後兼容）
   * 格式: {MarketRegion}_{CategoryId}_{Name}
   * @param encodedLabel 編碼標籤名稱
   * @returns 解碼結果或 null
   */
  private decodeIndustryLabel(encodedLabel: string): {
    marketRegion: string;
    categoryId: string;
    name: string;
  } | null {
    const parts = encodedLabel.split('_');
    if (parts.length < 3) {
      return null;
    }
    
    const [marketRegion, categoryId, ...nameParts] = parts;
    return {
      marketRegion,
      categoryId,
      name: nameParts.join('_'), // 處理名稱中可能包含的底線
    };
  }

  /**
   * 通過後端 API 解碼標籤（優先使用）
   */
  private async decodeIndustryLabelViaAPI(encodedLabel: string): Promise<{
    marketRegion: string;
    categoryId: string;
    name: string;
    isEncoded: boolean;
  } | null> {
    try {
      const response = await this.apiClient.post('/label-industry/labels/decode', {
        labelName: encodedLabel
      });
      
      const decoded = response.data;
      if (decoded && decoded.isEncoded) {
        return decoded;
      }
      
      return null;
    } catch (error) {
      // Fallback to local decoding if API fails
      console.warn(chalk.yellow(`API decode failed for ${encodedLabel}, using local decode`));
      const localDecoded = this.decodeIndustryLabel(encodedLabel);
      return localDecoded ? { ...localDecoded, isEncoded: true } : null;
    }
  }

  async clear(): Promise<void> {
    try {
      console.log(chalk.blue('\n🧹 Industry Labels Cleaner'));
      console.log(chalk.gray('─'.repeat(50)));
      console.log(`API URL: ${this.config.apiUrl}`);
      console.log(`Mode: ${this.config.dryRun ? 'DRY RUN' : 'LIVE'}`);
      console.log(`Delete Type: ${this.config.forceHardDelete ? 'HARD DELETE (permanent)' : 'SOFT DELETE (set inactive)'}`);
      
      if (this.config.market) {
        console.log(`Market Filter: ${this.config.market}`);
      }
      if (this.config.pattern) {
        console.log(`Pattern Filter: ${this.config.pattern}`);
      }
      
      // Fetch all industry labels
      this.spinner = ora('Fetching industry labels...').start();
      const labels = await this.fetchIndustryLabels();
      this.spinner.succeed(`Found ${labels.length} industry labels`);
      
      if (labels.length === 0) {
        console.log(chalk.yellow('\n⚠️ No industry labels found'));
        return;
      }
      
      // Filter labels if needed
      const filteredLabels = await this.filterLabels(labels);
      
      if (filteredLabels.length === 0) {
        console.log(chalk.yellow('\n⚠️ No labels match the filter criteria'));
        return;
      }
      
      // Display labels to be deleted
      console.log(chalk.cyan(`\n📋 Labels to be deleted (${filteredLabels.length}):`));
      console.log(chalk.gray('─'.repeat(50)));
      
      filteredLabels.forEach((label, index) => {
        console.log(`${index + 1}. ${label.name} (ID: ${label.id})`);
        if (label.description) {
          console.log(chalk.gray(`   ${label.description}`));
        }
        if (label.usageCount && label.usageCount > 0) {
          console.log(chalk.yellow(`   ⚠️ Used by ${label.usageCount} entities`));
        }
      });
      
      if (this.config.dryRun) {
        console.log(chalk.blue('\n✅ Dry run completed. No labels were deleted.'));
        return;
      }
      
      // Confirm deletion
      if (!this.config.confirm) {
        console.log(chalk.red('\n⚠️ This action cannot be undone!'));
        console.log('Add --confirm flag to proceed with deletion');
        return;
      }
      
      // Delete labels
      console.log(chalk.red('\n🗑️ Deleting labels...'));
      const results = await this.deleteLabels(filteredLabels);
      
      // Print summary
      this.printSummary(results);
      
    } catch (error) {
      console.error(chalk.red(`\n❌ Clear failed: ${error.message}`));
      throw error;
    }
  }

  private async fetchIndustryLabels(): Promise<Label[]> {
    try {
      // 嘗試多種 API 端點來查詢標籤
      let response;
      
      // 方法 1: 使用新的 all-including-inactive 端點
      try {
        console.log(chalk.gray('  嘗試查詢方法 1: /label-industry/labels/all-including-inactive'));
        const result = await this.apiClient.get('/label-industry/labels/all-including-inactive');
        response = { data: result };
        console.log(chalk.gray(`  方法 1 回應長度: ${Array.isArray(result) ? result.length : 'unknown'}`));
        
        // 檢查是否成功獲取數據
        if (result && Array.isArray(result) && result.length > 0) {
          console.log(chalk.green(`  ✓ 方法 1 成功獲取 ${result.length} 個標籤`));
        }
      } catch (error) {
        console.log(chalk.yellow(`  方法 1 失敗: ${error.message}`));
      }
      
      // 方法 2: 使用原始查詢
      if (!response || !response.data || (Array.isArray(response.data) && response.data.length === 0)) {
        try {
          console.log(chalk.gray('  嘗試查詢方法 2: /labels?type=SYSTEM_DEFINED'));
          const result = await this.apiClient.get('/labels', {
            type: 'SYSTEM_DEFINED'
          });
          response = { data: result };
          console.log(chalk.gray(`  方法 2 回應: ${JSON.stringify(result).substring(0, 100)}...`));
        } catch (error) {
          console.log(chalk.yellow(`  方法 2 失敗: ${error.message}`));
        }
      }
      
      // 方法 3: 使用 /labels/all 端點
      if (!response || !response.data || (Array.isArray(response.data) && response.data.length === 0)) {
        try {
          console.log(chalk.gray('  嘗試查詢方法 3: /label-industry/labels/all'));
          const result = await this.apiClient.get('/label-industry/labels/all');
          response = { data: result };
          console.log(chalk.gray(`  方法 3 回應長度: ${Array.isArray(result) ? result.length : 'unknown'}`));
        } catch (error) {
          console.log(chalk.yellow(`  方法 3 失敗: ${error.message}`));
        }
      }
      
      // 方法 4: 使用 POST 搜尋
      if (!response || !response.data || (Array.isArray(response.data) && response.data.length === 0)) {
        try {
          console.log(chalk.gray('  嘗試查詢方法 4: POST /label-industry/labels/search'));
          const result = await this.apiClient.post('/label-industry/labels/search', {
            type: 'SYSTEM_DEFINED'
          });
          response = { data: result.data || result };
          console.log(chalk.gray(`  方法 4 回應長度: ${Array.isArray(result.data) ? result.data.length : Array.isArray(result) ? result.length : 'unknown'}`));
        } catch (error) {
          console.log(chalk.yellow(`  方法 4 失敗: ${error.message}`));
        }
      }
      
      if (!response) {
        throw new Error('所有查詢方法都失敗了');
      }
      
      // 提取標籤資料
      let labels = response.data?.data || response.data || [];
      
      // 如果是陣列，過濾出 SYSTEM_DEFINED 類型
      if (Array.isArray(labels)) {
        labels = labels.filter(label => 
          label.type === 'SYSTEM_DEFINED' || 
          label.type === 'SYSTEM-DEFINED'
        );
      }
      
      console.log(chalk.green(`  ✓ 找到 ${labels.length} 個 SYSTEM_DEFINED 標籤`));
      
      return labels;
    } catch (error) {
      if (error.response?.status === 401) {
        throw new Error('Unauthorized. Please provide a valid API token.');
      }
      console.error(chalk.red(`  查詢標籤失敗: ${error.message}`));
      throw error;
    }
  }

  private async filterLabels(labels: Label[]): Promise<Label[]> {
    let filtered = [...labels];
    
    // Filter by market using encoded format
    if (this.config.market) {
      const marketFiltered: Label[] = [];
      
      for (const label of filtered) {
        // 優先使用 API 解碼
        let decoded = await this.decodeIndustryLabelViaAPI(label.name);
        
        // 如果 API 解碼失敗，使用本地解碼
        if (!decoded) {
          const localDecoded = this.decodeIndustryLabel(label.name);
          if (localDecoded) {
            decoded = { ...localDecoded, isEncoded: true };
          }
        }
        
        if (decoded && decoded.marketRegion === this.config.market) {
          marketFiltered.push(label);
        } else if (!decoded) {
          // 舊格式相容性處理 (for labels not yet migrated to encoded format)
          if (this.config.market === 'TPE') {
            if (/[\u4e00-\u9fa5]/.test(label.name) || label.name.startsWith('產業')) {
              marketFiltered.push(label);
            }
          } else if (this.config.market === 'US') {
            if (/^[A-Z][a-z]+$/.test(label.name)) {
              marketFiltered.push(label);
            }
          } else if (this.config.market === 'JP') {
            if (/[\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]/.test(label.name)) {
              marketFiltered.push(label);
            }
          }
        }
      }
      
      filtered = marketFiltered;
    }
    
    // Filter by pattern
    if (this.config.pattern) {
      const regex = new RegExp(this.config.pattern.replace('*', '.*'), 'i');
      const patternFiltered: Label[] = [];
      
      for (const label of filtered) {
        // 優先使用 API 解碼
        let decoded = await this.decodeIndustryLabelViaAPI(label.name);
        
        // 如果 API 解碼失敗，使用本地解碼
        if (!decoded) {
          const localDecoded = this.decodeIndustryLabel(label.name);
          if (localDecoded) {
            decoded = { ...localDecoded, isEncoded: true };
          }
        }
        
        if (decoded && regex.test(decoded.name)) {
          patternFiltered.push(label);
        } else if (!decoded && regex.test(label.name)) {
          // 舊格式相容
          patternFiltered.push(label);
        }
      }
      
      filtered = patternFiltered;
    }
    
    return filtered;
  }

  private async deleteLabels(labels: Label[]): Promise<{ success: number; failed: number; errors: string[] }> {
    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[]
    };
    
    const deleteType = this.config.forceHardDelete ? 'HARD' : 'SOFT';
    
    // Note: Entity-label relationships are handled differently:
    // - Soft delete: Relationships remain but become inactive (label.is_active = false)
    // - Hard delete: Relationships are removed due to CASCADE DELETE in entity-label table
    console.log(chalk.cyan(`\n🗑️ ${deleteType} deleting ${labels.length} labels...`));
    
    for (const label of labels) {
      this.spinner = ora(`${deleteType} deleting ${label.name}...`).start();
      
      try {
        // 嘗試多個可能的刪除端點
        const deleteEndpoints = this.config.forceHardDelete ? [
          `/label-industry/labels/${label.id}/force-delete?hard=true`,
          `/labels/${label.id}/force-delete?hard=true`,
          `/label-industry/labels/${label.id}?hard=true`,
          `/labels/${label.id}?hard=true`
        ] : [
          `/label-industry/labels/${label.id}/force-delete`,
          `/labels/${label.id}/force-delete`,
          `/label-industry/labels/${label.id}`,
          `/labels/${label.id}`
        ];
        
        let deleted = false;
        let lastError: any = null;
        
        for (const endpoint of deleteEndpoints) {
          try {
            await this.apiClient.delete(endpoint);
            results.success++;
            const deleteType = this.config.forceHardDelete ? 'Hard' : 'Soft';
            this.spinner.succeed(`${deleteType} deleted ${label.name}`);
            deleted = true;
            break;
          } catch (err: any) {
            lastError = err;
            if (err.response?.status !== 404) {
              // 如果不是 404，記錄錯誤但繼續嘗試其他端點
              console.log(chalk.gray(`  端點 ${endpoint} 失敗: ${err.response?.status}`));
            }
          }
        }
        
        if (!deleted) {
          throw lastError || new Error('所有刪除端點都失敗');
        }
      } catch (error) {
        results.failed++;
        const errMsg = `Failed to ${deleteType.toLowerCase()} delete ${label.name}: ${error.response?.data?.message || error.message}`;
        results.errors.push(errMsg);
        this.spinner.fail(errMsg);
      }
    }
    
    return results;
  }

  private printSummary(results: { success: number; failed: number; errors: string[] }) {
    const deleteType = this.config.forceHardDelete ? 'hard' : 'soft';
    console.log(chalk.blue('\n📊 Clear Summary'));
    console.log(chalk.gray('─'.repeat(50)));
    console.log(chalk.green(`✅ Successfully ${deleteType} deleted: ${results.success}`));
    
    if (results.failed > 0) {
      console.log(chalk.red(`❌ Failed: ${results.failed}`));
      
      if (results.errors.length > 0) {
        console.log(chalk.red('\nErrors:'));
        results.errors.slice(0, 5).forEach(err => {
          console.log(chalk.red(`  - ${err}`));
        });
        if (results.errors.length > 5) {
          console.log(chalk.red(`  ... and ${results.errors.length - 5} more`));
        }
      }
    }
  }
}

// CLI setup
program
  .name('clear-industry-labels')
  .description('Clear industry labels from backend')
  .option('--dry-run', 'Preview labels to be deleted without actually deleting', false)
  .option('--market <market>', 'Filter by market (TPE, US, JP)')
  .option('--pattern <pattern>', 'Filter by name pattern (supports * wildcard)')
  .option('--confirm', 'Confirm deletion (required for actual deletion)', false)
  .option('--force-hard-delete', 'Permanently delete labels from database (default: soft delete)', false)
  .option('--api-url <url>', 'Backend API URL', process.env.BACKEND_API_URL || 'http://localhost:3000')
  .option('--api-token <token>', 'API authentication token', process.env.BACKEND_API_TOKEN)
  .parse();

const options = program.opts();

// Main execution
async function main() {
  // 優先使用環境變數中的 token
  let apiToken = process.env.BACKEND_API_TOKEN || options.apiToken;
  
  console.log(chalk.blue('🔐 API Token 狀態檢查:'));
  if (apiToken) {
    console.log(chalk.green(`  ✅ 找到 API Token: ${apiToken.substring(0, 20)}...`));
  } else {
    console.log(chalk.yellow('  ⚠️  沒有找到 API Token，將嘗試自動登入'));
  }
  
  // 只有在完全沒有 token 時才嘗試自動登入
  if (!apiToken && options.apiUrl.includes('localhost')) {
    try {
      console.log(chalk.yellow('🔄 嘗試自動登入...'));
      const loginResponse = await axios.post(`${options.apiUrl}/auth/auto-login`, {
        email: 'aryung@gmail.com',
        name: 'Test User',
      });
      apiToken = loginResponse.data.accessToken;
      console.log(chalk.green('✅ 自動登入成功'));
    } catch (error) {
      console.log(chalk.red('❌ 自動登入失敗，將嘗試無認證請求'));
      console.log(chalk.gray(`   錯誤: ${(error as any).message}`));
    }
  }
  
  // 驗證 API 連接（如果有 token）
  if (apiToken) {
    try {
      console.log(chalk.blue('🔍 驗證 API 連接...'));
      const testResponse = await axios.get(`${options.apiUrl}/auth/profile`, {
        headers: { 'Authorization': `Bearer ${apiToken}` },
        timeout: 5000
      });
      console.log(chalk.green(`  ✅ API 連接正常，用戶: ${testResponse.data?.email || 'unknown'}`));
    } catch (error: any) {
      console.log(chalk.yellow(`  ⚠️  API 連接測試失敗: ${error.response?.status} ${error.response?.statusText || error.message}`));
      if (error.response?.status === 401) {
        console.log(chalk.red('  🚫 Token 可能已過期或無效'));
      }
    }
  }

  const config: ClearConfig = {
    apiUrl: options.apiUrl,
    apiToken: apiToken,
    dryRun: options.dryRun,
    market: options.market,
    pattern: options.pattern,
    confirm: options.confirm,
    forceHardDelete: options.forceHardDelete
  };
  
  const cleaner = new IndustryLabelCleaner(config);
  
  try {
    await cleaner.clear();
    console.log(chalk.green('\n✅ Clear process completed!'));
    process.exit(0);
  } catch (error: any) {
    console.error(chalk.red('\n❌ Clear process failed!'));
    
    // 提供詳細的錯誤資訊
    if (error.response) {
      console.error(chalk.red(`HTTP ${error.response.status}: ${error.response.statusText}`));
      if (error.response.data) {
        console.error(chalk.red(`API 錯誤詳情:`));
        console.error(chalk.red(JSON.stringify(error.response.data, null, 2)));
      }
      
      // 特定錯誤的建議
      if (error.response.status === 401) {
        console.error(chalk.yellow('\n💡 建議: 檢查 API Token 是否正確或已過期'));
        console.error(chalk.yellow('   可嘗試: 更新 .env 中的 BACKEND_API_TOKEN'));
      } else if (error.response.status === 403) {
        console.error(chalk.yellow('\n💡 建議: 當前用戶可能沒有刪除標籤的權限'));
        console.error(chalk.yellow('   可嘗試: 使用管理員帳號 token'));
      } else if (error.response.status === 404) {
        console.error(chalk.yellow('\n💡 建議: API 端點可能不存在'));
        console.error(chalk.yellow('   可嘗試: 檢查後端服務是否支援標籤刪除功能'));
      }
    } else {
      console.error(chalk.red(error.message));
    }
    
    process.exit(1);
  }
}

// Execute if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}