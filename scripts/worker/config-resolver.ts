/**
 * 配置解析器
 * 負責動態載入和解析爬蟲配置，支援模板參數化
 */

import { readFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { ConfigTemplate, ResolvedConfig, CrawlerTask, WorkerError } from '../../src/common/shared-types/interfaces/crawler.interface';

export class ConfigResolver {
  private configCache = new Map<string, ConfigTemplate>();
  private projectRoot: string;
  private configBaseDir: string;
  private templateBaseDir: string;

  constructor(options: {
    projectRoot?: string;
    configBaseDir?: string;
    templateBaseDir?: string;
  } = {}) {
    this.projectRoot = options.projectRoot || process.cwd();
    this.configBaseDir = options.configBaseDir || join(this.projectRoot, 'config-categorized');
    this.templateBaseDir = options.templateBaseDir || join(this.projectRoot, 'config/templates');
  }

  /**
   * 解析任務配置
   */
  async resolveTaskConfig(task: CrawlerTask): Promise<ResolvedConfig> {
    try {
      console.log(`🔧 解析任務配置: ${task.config_identifier || 'default'}`);

      // 1. 確定配置來源
      let configSource: string;
      let template: ConfigTemplate;

      if (task.config_file_path) {
        // 使用指定的配置文件路徑
        configSource = this.resolveAbsolutePath(task.config_file_path);
        template = await this.loadConfigFromPath(configSource);
      } else if (task.config_identifier) {
        // 使用配置識別碼解析
        configSource = this.resolveConfigPath(task.config_identifier, task.exchange_area, task.data_type);
        template = await this.loadConfigTemplate(task.config_identifier);
      } else {
        // 自動推斷配置
        const identifier = this.inferConfigIdentifier(task);
        configSource = this.resolveConfigPath(identifier, task.exchange_area, task.data_type);
        template = await this.loadConfigTemplate(identifier);
      }

      // 2. 應用動態參數
      const resolvedConfig = this.applyParameters(template, task.parameters || {}, task);

      // 3. 應用配置覆蓋
      const finalConfig = this.applyConfigOverride(resolvedConfig, task.config_override || {});

      // 4. 驗證最終配置
      this.validateConfig(finalConfig);

      // 5. 返回解析結果
      const result: ResolvedConfig = {
        ...finalConfig,
        resolvedParameters: task.parameters || {},
        source: {
          template: configSource,
          version: task.required_config_version || 'latest',
          resolvedAt: new Date(),
        },
      };

      console.log(`✅ 配置解析成功: ${task.config_identifier || 'default'}`);
      return result;

    } catch (error) {
      console.error(`❌ 配置解析失敗: ${error instanceof Error ? error.message : error}`);
      throw this.createConfigError('CONFIG_RESOLUTION_FAILED', error, task);
    }
  }

  /**
   * 載入配置模板
   */
  async loadConfigTemplate(identifier: string): Promise<ConfigTemplate> {
    const cacheKey = identifier;

    // 檢查快取
    if (this.configCache.has(cacheKey)) {
      console.log(`📦 使用快取配置: ${identifier}`);
      return this.configCache.get(cacheKey)!;
    }

    try {
      // 嘗試從分類目錄載入
      const categorizedPath = this.resolveConfigPath(identifier);
      if (existsSync(categorizedPath)) {
        const config = await this.loadConfigFromPath(categorizedPath);
        this.configCache.set(cacheKey, config);
        return config;
      }

      // 嘗試從模板目錄載入
      const templatePath = this.resolveTemplatePath(identifier);
      if (existsSync(templatePath)) {
        const config = await this.loadConfigFromPath(templatePath);
        this.configCache.set(cacheKey, config);
        return config;
      }

      throw new Error(`找不到配置: ${identifier}`);

    } catch (error) {
      console.error(`❌ 載入配置模板失敗 (${identifier}):`, error);
      throw error;
    }
  }

  /**
   * 從文件路徑載入配置
   */
  private async loadConfigFromPath(filePath: string): Promise<ConfigTemplate> {
    try {
      console.log(`📄 載入配置文件: ${filePath}`);

      if (!existsSync(filePath)) {
        throw new Error(`配置文件不存在: ${filePath}`);
      }

      const configContent = readFileSync(filePath, 'utf8');
      const config = JSON.parse(configContent);

      // 基本結構驗證
      if (!config.crawlerSettings?.url) {
        throw new Error('配置缺少 crawlerSettings.url');
      }

      if (!config.selectors || Object.keys(config.selectors).length === 0) {
        throw new Error('配置缺少 selectors');
      }

      return config as ConfigTemplate;

    } catch (error) {
      throw new Error(`載入配置文件失敗 (${filePath}): ${error instanceof Error ? error.message : error}`);
    }
  }

  /**
   * 解析配置路徑
   */
  private resolveConfigPath(
    identifier: string,
    exchangeArea?: string,
    dataType?: string
  ): string {
    // yahoo-finance-tw-eps -> config-categorized/quarterly/tw/yahoo-finance-tw-eps.json
    const parts = identifier.split('-');

    if (parts[0] === 'yahoo' && parts[1] === 'finance' && parts.length >= 4) {
      const region = parts[2]?.toLowerCase(); // tw, us, jp
      const type = parts.slice(3).join('-'); // eps, balance-sheet, etc.

      // 根據數據類型決定分類目錄
      const category = this.inferCategory(type, dataType);
      const fileName = `${identifier}.json`;

      return join(this.configBaseDir, category, region, fileName);
    }

    // 預設路徑 (向後相容)
    return join(this.configBaseDir, `${identifier}.json`);
  }

  /**
   * 解析模板路徑
   */
  private resolveTemplatePath(identifier: string): string {
    return join(this.templateBaseDir, `${identifier}.json`);
  }

  /**
   * 推斷配置分類
   */
  private inferCategory(type: string, dataType?: string): string {
    // 從類型推斷分類
    if (type.includes('history') || dataType === 'daily') {
      return 'daily';
    }

    if (type.includes('symbol') || type.includes('label')) {
      return 'metadata';
    }

    // 預設為季度數據
    return 'quarterly';
  }

  /**
   * 推斷配置識別碼
   */
  private inferConfigIdentifier(task: CrawlerTask): string {
    const region = task.exchange_area.toLowerCase();
    const type = task.data_type.toLowerCase().replace('_', '-');

    return `yahoo-finance-${region}-${type}`;
  }

  /**
   * 應用動態參數
   */
  private applyParameters(
    template: ConfigTemplate,
    parameters: Record<string, unknown>,
    task: CrawlerTask
  ): ConfigTemplate {
    try {
      console.log(`🔧 應用動態參數:`, Object.keys(parameters));

      // 合併任務基本參數
      const allParameters = {
        ...parameters,
        symbol: task.symbol_code,
        symbolCode: task.symbol_code,
        exchange: task.exchange_area,
        exchangeArea: task.exchange_area,
        dataType: task.data_type,
        startDate: task.start_date?.toISOString().split('T')[0],
        endDate: task.end_date?.toISOString().split('T')[0],
      };

      let configStr = JSON.stringify(template, null, 2);

      // 替換 ${parameter} 佔位符
      Object.entries(allParameters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          const regex = new RegExp(`\\$\\{${key}\\}`, 'g');
          configStr = configStr.replace(regex, String(value));
        }
      });

      // 檢查是否還有未替換的佔位符
      const unresolved = configStr.match(/\$\{[^}]+\}/g);
      if (unresolved) {
        console.warn(`⚠️ 未解析的參數佔位符: ${unresolved.join(', ')}`);
      }

      return JSON.parse(configStr) as ConfigTemplate;

    } catch (error) {
      throw new Error(`參數應用失敗: ${error instanceof Error ? error.message : error}`);
    }
  }

  /**
   * 應用配置覆蓋
   */
  private applyConfigOverride(
    config: ConfigTemplate,
    override: Record<string, unknown>
  ): ConfigTemplate {
    if (!override || Object.keys(override).length === 0) {
      return config;
    }

    console.log(`🔧 應用配置覆蓋:`, Object.keys(override));

    try {
      // 深度合併配置覆蓋
      return this.deepMerge(config, override) as ConfigTemplate;
    } catch (error) {
      console.warn('⚠️ 配置覆蓋應用失敗:', error);
      return config;
    }
  }

  /**
   * 深度合併對象
   */
  private deepMerge(target: any, source: any): any {
    const result = { ...target };

    Object.keys(source).forEach(key => {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this.deepMerge(result[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    });

    return result;
  }

  /**
   * 驗證配置
   */
  private validateConfig(config: ConfigTemplate): void {
    const errors: string[] = [];

    // 驗證 crawlerSettings
    if (!config.crawlerSettings) {
      errors.push('缺少 crawlerSettings');
    } else {
      if (!config.crawlerSettings.url) {
        errors.push('crawlerSettings 缺少 url');
      }
      
      if (config.crawlerSettings.timeout && config.crawlerSettings.timeout < 1000) {
        errors.push('crawlerSettings.timeout 過小 (最少 1000ms)');
      }
      
      if (config.crawlerSettings.retries && config.crawlerSettings.retries < 0) {
        errors.push('crawlerSettings.retries 不能為負數');
      }
    }

    // 驗證 selectors
    if (!config.selectors || Object.keys(config.selectors).length === 0) {
      errors.push('缺少 selectors 或 selectors 為空');
    } else {
      Object.entries(config.selectors).forEach(([key, selector]) => {
        if (!selector.selector) {
          errors.push(`selector "${key}" 缺少 selector 屬性`);
        }
      });
    }

    // 驗證 outputSettings
    if (config.outputSettings) {
      if (!config.outputSettings.format) {
        errors.push('outputSettings 缺少 format');
      } else if (!['json', 'csv', 'xlsx'].includes(config.outputSettings.format)) {
        errors.push('outputSettings.format 必須是 json、csv 或 xlsx');
      }
    }

    if (errors.length > 0) {
      throw new Error(`配置驗證失敗:\n${errors.map(e => `- ${e}`).join('\n')}`);
    }

    console.log('✅ 配置驗證通過');
  }

  /**
   * 解析絕對路徑
   */
  private resolveAbsolutePath(filePath: string): string {
    if (filePath.startsWith('/')) {
      return filePath;
    }
    return resolve(this.projectRoot, filePath);
  }

  /**
   * 創建配置錯誤
   */
  private createConfigError(code: string, originalError: unknown, task?: CrawlerTask): WorkerError {
    return {
      code,
      message: originalError instanceof Error ? originalError.message : String(originalError),
      details: {
        originalError,
        task: task ? {
          id: task.id,
          config_identifier: task.config_identifier,
          config_file_path: task.config_file_path,
        } : undefined,
      },
      timestamp: new Date(),
      source: 'config',
      retryable: false,
    };
  }

  /**
   * 清理配置快取
   */
  clearCache(): void {
    console.log('🗑️ 清理配置快取');
    this.configCache.clear();
  }

  /**
   * 獲取快取統計
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.configCache.size,
      keys: Array.from(this.configCache.keys()),
    };
  }

  /**
   * 預載入常用配置
   */
  async preloadConfigs(identifiers: string[]): Promise<void> {
    console.log(`📦 預載入 ${identifiers.length} 個配置...`);

    const loadPromises = identifiers.map(async (identifier) => {
      try {
        await this.loadConfigTemplate(identifier);
        console.log(`✅ 預載入成功: ${identifier}`);
      } catch (error) {
        console.warn(`⚠️ 預載入失敗: ${identifier} - ${error}`);
      }
    });

    await Promise.all(loadPromises);
    console.log(`📦 預載入完成，快取大小: ${this.configCache.size}`);
  }
}

// 工廠函數：創建配置解析器
export function createConfigResolver(options?: {
  projectRoot?: string;
  configBaseDir?: string;
  templateBaseDir?: string;
}): ConfigResolver {
  return new ConfigResolver(options);
}

// 便利函數：快速解析配置
export async function resolveConfig(
  configIdentifier: string,
  parameters: Record<string, unknown> = {},
  options?: {
    projectRoot?: string;
    configBaseDir?: string;
  }
): Promise<ResolvedConfig> {
  const resolver = createConfigResolver(options);
  
  // 創建臨時任務對象
  const task: Partial<CrawlerTask> = {
    id: 'temp',
    symbol_code: String(parameters.symbol || 'UNKNOWN'),
    exchange_area: String(parameters.exchange || 'TW') as any,
    data_type: String(parameters.dataType || 'eps') as any,
    config_identifier: configIdentifier,
    parameters,
  };

  return resolver.resolveTaskConfig(task as CrawlerTask);
}

export default ConfigResolver;