import * as fs from 'fs-extra';
import * as path from 'path';

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
        return this.validateCashFlowData(data);
      case 'eps':
        return this.validateEPSData(data);
      case 'dividend':
        return this.validateDividendData(data);
      case 'performance':
        return this.validatePerformanceData(data);
      default:
        return this.validateGenericFinancialData(data);
    }
  }

  /**
   * 驗證損益表數據
   */
  private validateIncomeStatementData(data: any): ValidationResult {
    const requiredArrays = [
      'fiscalPeriodsArray',
      'totalRevenueValues',
      'netIncomeCommonStockholdersValues',
    ];

    const missingArrays = requiredArrays.filter(key => {
      const value = data[key];
      return !Array.isArray(value) || value.length === 0;
    });

    if (missingArrays.length > 0) {
      return {
        isValid: false,
        isEmpty: true,
        reason: 'empty_financial_arrays',
        details: `Missing or empty arrays: ${missingArrays.join(', ')}`,
      };
    }

    // 檢查數據陣列是否包含實際的財務記錄
    const hasValidData = data.data && Array.isArray(data.data) && data.data.length > 0;
    if (!hasValidData) {
      return {
        isValid: false,
        isEmpty: true,
        reason: 'no_structured_data',
        details: 'Missing structured financial data array',
      };
    }

    return {
      isValid: true,
      isEmpty: false,
    };
  }

  /**
   * 驗證資產負債表數據
   */
  private validateBalanceSheetData(data: any): ValidationResult {
    const requiredArrays = [
      'fiscalPeriodsArray',
      'totalAssetsValues',
      'totalLiabilitiesValues',
      'totalEquityValues',
    ];

    const missingArrays = requiredArrays.filter(key => {
      const value = data[key];
      return !Array.isArray(value) || value.length === 0;
    });

    if (missingArrays.length > 0) {
      return {
        isValid: false,
        isEmpty: true,
        reason: 'empty_balance_arrays',
        details: `Missing or empty arrays: ${missingArrays.join(', ')}`,
      };
    }

    const hasValidData = data.data && Array.isArray(data.data) && data.data.length > 0;
    if (!hasValidData) {
      return {
        isValid: false,
        isEmpty: true,
        reason: 'no_structured_data',
      };
    }

    return {
      isValid: true,
      isEmpty: false,
    };
  }

  /**
   * 驗證現金流量表數據
   */
  private validateCashFlowData(data: any): ValidationResult {
    const requiredArrays = [
      'fiscalPeriodsArray',
      'operatingCashFlowValues',
    ];

    const missingArrays = requiredArrays.filter(key => {
      const value = data[key];
      return !Array.isArray(value) || value.length === 0;
    });

    if (missingArrays.length > 0) {
      return {
        isValid: false,
        isEmpty: true,
        reason: 'empty_cashflow_arrays',
        details: `Missing or empty arrays: ${missingArrays.join(', ')}`,
      };
    }

    const hasValidData = data.independentCashFlowData && Array.isArray(data.independentCashFlowData) && data.independentCashFlowData.length > 0;
    if (!hasValidData) {
      return {
        isValid: false,
        isEmpty: true,
        reason: 'no_structured_cashflow_data',
      };
    }

    return {
      isValid: true,
      isEmpty: false,
    };
  }

  /**
   * 驗證每股盈餘數據
   */
  private validateEPSData(data: any): ValidationResult {
    const requiredArrays = [
      'fiscalPeriods',
      'epsValues',
    ];

    const missingArrays = requiredArrays.filter(key => {
      const value = data[key];
      return !Array.isArray(value) || value.length === 0;
    });

    if (missingArrays.length > 0) {
      return {
        isValid: false,
        isEmpty: true,
        reason: 'empty_eps_arrays',
        details: `Missing or empty arrays: ${missingArrays.join(', ')}`,
      };
    }

    const hasValidData = data.simpleEPSData && Array.isArray(data.simpleEPSData) && data.simpleEPSData.length > 0;
    if (!hasValidData) {
      return {
        isValid: false,
        isEmpty: true,
        reason: 'no_structured_eps_data',
      };
    }

    return {
      isValid: true,
      isEmpty: false,
    };
  }

  /**
   * 驗證股利數據
   */
  private validateDividendData(data: any): ValidationResult {
    const requiredArrays = [
      'fiscalPeriods',
      'dividendValues',
    ];

    const missingArrays = requiredArrays.filter(key => {
      const value = data[key];
      return !Array.isArray(value) || value.length === 0;
    });

    if (missingArrays.length > 0) {
      return {
        isValid: false,
        isEmpty: true,
        reason: 'empty_dividend_arrays',
        details: `Missing or empty arrays: ${missingArrays.join(', ')}`,
      };
    }

    const hasValidData = data.dividendData && Array.isArray(data.dividendData) && data.dividendData.length > 0;
    if (!hasValidData) {
      return {
        isValid: false,
        isEmpty: true,
        reason: 'no_structured_dividend_data',
      };
    }

    return {
      isValid: true,
      isEmpty: false,
    };
  }

  /**
   * 驗證日本績效數據
   */
  private validatePerformanceData(data: any): ValidationResult {
    const requiredArrays = [
      'fiscalPeriods',
      'performanceValues',
    ];

    const missingArrays = requiredArrays.filter(key => {
      const value = data[key];
      return !Array.isArray(value) || value.length === 0;
    });

    if (missingArrays.length > 0) {
      return {
        isValid: false,
        isEmpty: true,
        reason: 'empty_performance_arrays',
        details: `Missing or empty arrays: ${missingArrays.join(', ')}`,
      };
    }

    const hasValidData = data.performanceData && Array.isArray(data.performanceData) && data.performanceData.length > 0;
    if (!hasValidData) {
      return {
        isValid: false,
        isEmpty: true,
        reason: 'no_structured_performance_data',
      };
    }

    return {
      isValid: true,
      isEmpty: false,
    };
  }

  /**
   * 通用財務數據驗證
   */
  private validateGenericFinancialData(data: any): ValidationResult {
    // 尋找任何看起來像是期間數據的陣列
    const periodArrays = Object.keys(data).filter(key => 
      key.toLowerCase().includes('period') || 
      key.toLowerCase().includes('fiscal')
    );

    // 尋找任何看起來像是數值數據的陣列
    const valueArrays = Object.keys(data).filter(key => 
      key.toLowerCase().includes('values') || 
      key.toLowerCase().includes('data')
    );

    if (periodArrays.length === 0 && valueArrays.length === 0) {
      return {
        isValid: false,
        isEmpty: true,
        reason: 'no_recognizable_data_arrays',
      };
    }

    // 檢查是否有非空的數據陣列
    const hasNonEmptyArrays = [...periodArrays, ...valueArrays].some(key => {
      const value = data[key];
      return Array.isArray(value) && value.length > 0;
    });

    if (!hasNonEmptyArrays) {
      return {
        isValid: false,
        isEmpty: true,
        reason: 'all_arrays_empty',
        details: `Checked arrays: ${[...periodArrays, ...valueArrays].join(', ')}`,
      };
    }

    return {
      isValid: true,
      isEmpty: false,
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
    const possiblePaths = [
      // 結構化目錄路徑
      path.join(outputDir, 'quarterly', '**', `${filename}.json`),
      path.join(outputDir, 'daily', '**', `${filename}.json`),
      path.join(outputDir, 'metadata', '**', `${filename}.json`),
      // 扁平目錄路徑 (向後兼容)
      path.join(outputDir, `${filename}.json`),
    ];

    for (const pattern of possiblePaths) {
      // 使用 glob 模式搜尋
      const files = await this.globSearch(pattern);
      if (files.length > 0) {
        return files[0]; // 返回第一個匹配的文件
      }
    }

    return null;
  }

  /**
   * 簡化的 glob 搜尋實現
   */
  private async globSearch(pattern: string): Promise<string[]> {
    const results: string[] = [];
    
    try {
      // 替換 ** 為實際目錄掃描
      const basePath = pattern.split('**')[0];
      const fileName = path.basename(pattern);
      
      if (await fs.pathExists(basePath)) {
        await this.searchRecursively(basePath, fileName, results);
      }
    } catch (error) {
      // 忽略搜尋錯誤
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
        } else if (item.isFile() && item.name === fileName) {
          results.push(fullPath);
        }
      }
    } catch (error) {
      // 忽略權限或存取錯誤
    }
  }
}