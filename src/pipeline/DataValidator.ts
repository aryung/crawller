import * as fs from 'fs-extra';
import * as path from 'path';
import { REPORT_DATA_FIELDS, getPossibleDataFields } from '../common/constants/report';

export interface ValidationResult {
  isValid: boolean;
  isEmpty: boolean;
  reason?: string;
  details?: any;
}

/**
 * 驗證爬蟲輸出數據質量
 * Validates crawler output data quality
 */
export class DataValidator {
  
  /**
   * 驗證輸出文件是否包含有效數據
   */
  async validateOutputFile(filePath: string): Promise<ValidationResult> {
    try {
      if (!(await fs.pathExists(filePath))) {
        return {
          isValid: false,
          isEmpty: true,
          reason: 'file_not_found',
        };
      }

      const fileData = await fs.readJson(filePath);
      return this.validateFileData(fileData, filePath);
    } catch (error) {
      return {
        isValid: false,
        isEmpty: true,
        reason: 'parse_error',
        details: (error as Error).message,
      };
    }
  }

  /**
   * 驗證文件數據內容
   */
  private validateFileData(fileData: any, filePath: string): ValidationResult {
    // 檢查基本文件結構
    if (!fileData || !fileData.results || !Array.isArray(fileData.results)) {
      return {
        isValid: false,
        isEmpty: true,
        reason: 'invalid_structure',
        details: 'Missing results array',
      };
    }

    if (fileData.results.length === 0) {
      return {
        isValid: false,
        isEmpty: true,
        reason: 'no_results',
      };
    }

    // 檢查第一個結果的數據
    const firstResult = fileData.results[0];
    if (!firstResult.data) {
      return {
        isValid: false,
        isEmpty: true,
        reason: 'no_data_field',
      };
    }

    // 根據文件類型檢測數據完整性
    const fileName = path.basename(filePath);
    const reportType = this.extractReportTypeFromFileName(fileName);
    
    return this.validateDataByReportType(firstResult.data, reportType);
  }

  /**
   * 從文件名提取報表類型
   */
  private extractReportTypeFromFileName(fileName: string): string {
    if (fileName.includes('income-statement') || fileName.includes('income')) {
      return 'income-statement';
    } else if (fileName.includes('balance-sheet') || fileName.includes('balance')) {
      return 'balance-sheet';
    } else if (fileName.includes('cash-flow')) {
      return 'cash-flow-statement';
    } else if (fileName.includes('eps')) {
      return 'eps';
    } else if (fileName.includes('dividend')) {
      return 'dividend';
    } else if (fileName.includes('performance')) {
      return 'performance';
    }
    return 'unknown';
  }

  /**
   * 根據報表類型驗證數據
   */
  private validateDataByReportType(data: any, reportType: string): ValidationResult {
    switch (reportType) {
      case 'income-statement':
        return this.validateIncomeStatementData(data);
      case 'balance-sheet':
        return this.validateBalanceSheetData(data);
      case 'cash-flow-statement':
      case 'cashflow':  // 美國和日本使用的簡化名稱
        return this.validateCashFlowData(data);
      case 'eps':
        return this.validateEPSData(data);
      case 'dividend':
        return this.validateDividendData(data);
      case 'performance':
        return this.validatePerformanceData(data);
      case 'history':     // 歷史價格數據
      case 'revenue':     // 營收數據
      case 'financials':  // 通用財務數據
        return this.validateDataArray(data, reportType);
      default:
        return this.validateGenericFinancialData(data);
    }
  }

  /**
   * 驗證損益表數據
   */
  private validateIncomeStatementData(data: any): ValidationResult {
    return this.validateDataArray(data, 'income-statement');
  }

  /**
   * 驗證資產負債表數據
   */
  private validateBalanceSheetData(data: any): ValidationResult {
    return this.validateDataArray(data, 'balance-sheet');
  }

  /**
   * 驗證現金流量表數據
   */
  private validateCashFlowData(data: any): ValidationResult {
    return this.validateDataArray(data, 'cash-flow-statement');
  }

  /**
   * 驗證每股盈餘數據
   */
  private validateEPSData(data: any): ValidationResult {
    return this.validateDataArray(data, 'eps');
  }

  /**
   * 驗證股利數據
   */
  private validateDividendData(data: any): ValidationResult {
    return this.validateDataArray(data, 'dividend');
  }

  /**
   * 驗證日本績效數據
   */
  private validatePerformanceData(data: any): ValidationResult {
    return this.validateDataArray(data, 'performance');
  }

  /**
   * 通用財務數據驗證
   */
  private validateGenericFinancialData(data: any): ValidationResult {
    return this.validateDataArray(data, 'generic-financial');
  }

  /**
   * 統一的數據驗證方法
   * 所有報表類型都使用相同的驗證邏輯：檢查最終的數據陣列是否有值
   */
  private validateDataArray(data: any, reportType: string): ValidationResult {
    // 檢查主要欄位
    const hasMainData = data[REPORT_DATA_FIELDS.PRIMARY] && 
                       Array.isArray(data[REPORT_DATA_FIELDS.PRIMARY]) && 
                       data[REPORT_DATA_FIELDS.PRIMARY].length > 0;
    
    if (hasMainData) {
      return {
        isValid: true,
        isEmpty: false,
      };
    }
    
    // 檢查替代欄位
    const hasAlternativeData = REPORT_DATA_FIELDS.ALTERNATIVE.some(field => 
      data[field] && Array.isArray(data[field]) && data[field].length > 0
    );
    
    if (hasAlternativeData) {
      return {
        isValid: true,
        isEmpty: false,
      };
    }
    
    return {
      isValid: false,
      isEmpty: true,
      reason: 'empty_data',
      details: `No valid data array found in ${reportType}. Checked fields: ${getPossibleDataFields().join(', ')}`,
    };
  }

  /**
   * 批量驗證多個輸出文件
   */
  async validateMultipleFiles(filePaths: string[]): Promise<{
    valid: string[];
    empty: string[];
    invalid: string[];
    details: Record<string, ValidationResult>;
  }> {
    const result = {
      valid: [] as string[],
      empty: [] as string[],
      invalid: [] as string[],
      details: {} as Record<string, ValidationResult>,
    };

    for (const filePath of filePaths) {
      const validation = await this.validateOutputFile(filePath);
      result.details[filePath] = validation;

      if (validation.isValid) {
        result.valid.push(filePath);
      } else if (validation.isEmpty) {
        result.empty.push(filePath);
      } else {
        result.invalid.push(filePath);
      }
    }

    return result;
  }

  /**
   * 檢查文件大小是否合理
   */
  async validateFileSize(filePath: string, minSizeKB: number = 1): Promise<boolean> {
    try {
      const stats = await fs.stat(filePath);
      return stats.size >= (minSizeKB * 1024);
    } catch {
      return false;
    }
  }

  /**
   * 驗證配置文件對應的輸出文件
   */
  async validateConfigOutput(configFile: string, outputDir: string): Promise<ValidationResult> {
    const configData = await fs.readJson(configFile);
    const exportFilename = configData.export?.filename;
    
    if (!exportFilename) {
      return {
        isValid: false,
        isEmpty: true,
        reason: 'no_export_filename',
      };
    }

    // 尋找對應的輸出文件 (支援結構化目錄)
    const outputFile = await this.findOutputFile(outputDir, exportFilename);
    
    if (!outputFile) {
      return {
        isValid: false,
        isEmpty: true,
        reason: 'output_file_not_found',
        details: `Expected: ${exportFilename}.json`,
      };
    }

    // 驗證輸出文件內容
    return this.validateOutputFile(outputFile);
  }

  /**
   * 在結構化目錄中尋找輸出文件
   */
  private async findOutputFile(outputDir: string, filename: string): Promise<string | null> {
    // v3.0 統一變數處理：大多數變數已在配置生成時替換，使用通配符搜尋實際文件
    const searchPattern = this.convertFilenameToGlobPattern(filename);
    
    const possiblePaths = [
      // 結構化目錄路徑
      path.join(outputDir, 'quarterly', '**', `${searchPattern}.json`),
      path.join(outputDir, 'daily', '**', `${searchPattern}.json`),
      path.join(outputDir, 'metadata', '**', `${searchPattern}.json`),
      // 扁平目錄路徑 (向後兼容)
      path.join(outputDir, `${searchPattern}.json`),
    ];

    for (const pattern of possiblePaths) {
      // 使用 glob 模式搜尋
      const files = await this.globSearch(pattern);
      if (files.length > 0) {
        // 如果有多個匹配，選擇最新的檔案（根據修改時間）
        if (files.length === 1) {
          return files[0];
        }
        
        // 多個檔案時，選擇最新的
        const latestFile = await this.selectLatestFile(files);
        return latestFile;
      }
    }

    return null;
  }

  /**
   * 從多個檔案中選擇最新的（根據修改時間）
   */
  private async selectLatestFile(files: string[]): Promise<string> {
    let latestFile = files[0];
    let latestTime = 0;
    
    for (const file of files) {
      try {
        const stats = await fs.stat(file);
        if (stats.mtime.getTime() > latestTime) {
          latestTime = stats.mtime.getTime();
          latestFile = file;
        }
      } catch (error) {
        // 忽略無法讀取的檔案
        continue;
      }
    }
    
    return latestFile;
  }

  /**
   * 將包含變數的文件名轉換為 glob 搜尋模式
   * v3.0 統一變數處理 + 跨日容錯：使用模糊匹配容忍日期差異
   */
  private convertFilenameToGlobPattern(filename: string): string {
    // 方案 1 實施後：所有日期和其他變數都已在配置生成時替換為實際值
    // 但考慮跨日問題，對日期部分使用通配符
    
    let pattern = filename;
    
    // 處理跨日問題：日期部分使用通配符
    // TW: yahoo-finance-tw-history-9955_TW_20250815 -> yahoo-finance-tw-history-9955_TW_*
    pattern = pattern.replace(/_\d{8}(?=\.json|$)/, '_*');
    
    // US: yahoo-finance-us-history-AAL-1752681364-1755273364 -> yahoo-finance-us-history-AAL-*-*
    pattern = pattern.replace(/-\d{10}-\d{10}(?=\.json|$)/, '-*-*');
    
    // JP: yahoo-finance-jp-history-9993_T-20250801-20250815 -> yahoo-finance-jp-history-9993_T-*-*
    pattern = pattern.replace(/-\d{8}-\d{8}(?=\.json|$)/, '-*-*');
    
    // 修復：如果檔名沒有明確的日期後綴但可能需要通配符
    // 例如：yahoo-finance-tw-balance-sheet-9943_TW 應該變成 yahoo-finance-tw-balance-sheet-9943_TW*
    if (!pattern.includes('*') && !pattern.endsWith('.json')) {
      // 檢查是否以 symbolCode 格式結尾（包含 .TW, .T 等）
      if (/_(TW|T|US)$/.test(pattern) || /[A-Z]{1,5}$/.test(pattern)) {
        pattern = pattern + '*';
      }
    }
    
    // 處理任何殘留變數（向後兼容）
    pattern = pattern.replace(/\$\{[^}]+\}/g, '*');
    
    console.log(`  🔍 Pattern conversion: "${filename}" -> "${pattern}"`);
    
    return pattern;
  }

  /**
   * 簡化的 glob 搜尋實現
   */
  private async globSearch(pattern: string): Promise<string[]> {
    const results: string[] = [];
    
    try {
      if (pattern.includes('**')) {
        // 處理遞歸搜尋模式
        const parts = pattern.split('**');
        const basePath = parts[0].replace(/\/$/, ''); // 移除尾隨斜杠
        const fileName = path.basename(pattern);
        
        if (await fs.pathExists(basePath)) {
          await this.searchRecursively(basePath, fileName, results);
        }
      } else {
        // 處理直接路徑 - 使用 Node.js 內建的文件系統操作
        const dir = path.dirname(pattern);
        const fileName = path.basename(pattern);
        
        if (await fs.pathExists(dir)) {
          const items = await fs.readdir(dir);
          for (const item of items) {
            if (this.matchesPattern(item, fileName)) {
              results.push(path.join(dir, item));
            }
          }
        }
      }
    } catch (error) {
      // 忽略搜尋錯誤
      console.error('globSearch error:', (error as Error).message);
    }

    return results;
  }

  /**
   * 遞歸搜尋文件
   */
  private async searchRecursively(dir: string, fileName: string, results: string[]): Promise<void> {
    try {
      const items = await fs.readdir(dir, { withFileTypes: true });
      
      for (const item of items) {
        const fullPath = path.join(dir, item.name);
        
        if (item.isDirectory()) {
          await this.searchRecursively(fullPath, fileName, results);
        } else if (item.isFile() && this.matchesPattern(item.name, fileName)) {
          results.push(fullPath);
        }
      }
    } catch (error) {
      // 忽略權限或存取錯誤
    }
  }

  /**
   * 簡單的通配符模式匹配
   */
  private matchesPattern(filename: string, pattern: string): boolean {
    // 如果沒有通配符，使用精確匹配
    if (!pattern.includes('*')) {
      return filename === pattern;
    }
    
    // 將模式轉換為正則表達式
    const regexPattern = pattern
      .replace(/\./g, '\\.')  // 轉義點號
      .replace(/\*/g, '.*');  // * 替換為 .*
    
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(filename);
  }
}