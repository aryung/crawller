import * as fs from 'fs-extra';
import * as path from 'path';
import { EnhancedCrawlerConfig, CrawlerConfig } from '../types';
import { logger, validateCrawlerConfig } from '../utils';
import { getTransformFunction } from '../transforms';
import { JSONPath } from 'jsonpath-plus';

export class EnhancedConfigManager {
  private configPath: string;
  private configCache: Map<string, EnhancedCrawlerConfig> = new Map();

  constructor(configPath: string = 'configs') {
    this.configPath = configPath;
  }

  async loadConfig(name: string): Promise<CrawlerConfig> {
    try {
      const enhancedConfig = await this.loadEnhancedConfig(name);
      return await this.convertToStandardConfig(enhancedConfig);
    } catch (error) {
      logger.error(`Failed to load enhanced config "${name}":`, error);
      throw error;
    }
  }

  async loadEnhancedConfig(name: string): Promise<EnhancedCrawlerConfig> {
    if (this.configCache.has(name)) {
      return this.configCache.get(name)!;
    }

    const configFile = path.join(this.configPath, `${name}.json`);
    
    if (!await fs.pathExists(configFile)) {
      throw new Error(`Config file not found: ${configFile}`);
    }

    let config: EnhancedCrawlerConfig = await fs.readJson(configFile);
    
    if (config.inherits) {
      const baseConfig = await this.loadEnhancedConfig(config.inherits);
      config = this.mergeConfigs(baseConfig, config);
    }

    config = await this.processVariables(config);

    this.configCache.set(name, config);
    
    logger.info(`Enhanced config "${name}" loaded successfully`);
    return config;
  }

  private async convertToStandardConfig(enhancedConfig: EnhancedCrawlerConfig): Promise<CrawlerConfig> {
    const standardConfig: CrawlerConfig = {
      url: enhancedConfig.url,
      headers: enhancedConfig.headers,
      cookies: enhancedConfig.cookies,
      options: enhancedConfig.options
    };

    if (enhancedConfig.selectors) {
      standardConfig.selectors = {};
      
      for (const [key, selectorConfig] of Object.entries(enhancedConfig.selectors)) {
        if (typeof selectorConfig === 'string') {
          standardConfig.selectors[key] = selectorConfig;
        } else {
          const selector = selectorConfig.selector;
          const multiple = selectorConfig.multiple ? ':multiple' : '';
          
          standardConfig.selectors[key] = {
            selector: selector + multiple,
            attribute: selectorConfig.attribute,
            transform: await this.buildTransformFunction(selectorConfig, enhancedConfig)
          };

          if (selectorConfig.extract) {
            standardConfig.selectors[key] = {
              selector: selector + multiple,
              transform: await this.buildExtractFunction(selectorConfig.extract, enhancedConfig)
            };
          }
        }
      }
    }

    const errors = validateCrawlerConfig(standardConfig);
    if (errors.length > 0) {
      throw new Error(`Invalid converted config: ${errors.join(', ')}`);
    }

    return standardConfig;
  }

  private async buildTransformFunction(
    selectorConfig: any, 
    enhancedConfig: EnhancedCrawlerConfig
  ): Promise<((value: string) => unknown) | undefined> {
    if (!selectorConfig.transform) {
      return undefined;
    }

    if (typeof selectorConfig.transform === 'function') {
      return selectorConfig.transform;
    }

    if (typeof selectorConfig.transform === 'string') {
      try {
        const transformFn = getTransformFunction(selectorConfig.transform);
        if (transformFn) {
          return transformFn as (value: string) => unknown;
        }
      } catch (error) {
        logger.warn(`Transform function "${selectorConfig.transform}" not found in built-in library`);
      }

      if (enhancedConfig.transforms && enhancedConfig.transforms[selectorConfig.transform]) {
        try {
          const transformCode = enhancedConfig.transforms[selectorConfig.transform];
          return new Function('value', 'context', transformCode) as (value: string) => unknown;
        } catch (error) {
          logger.error(`Failed to create custom transform function: ${error}`);
          return undefined;
        }
      }

      try {
        return new Function('value', 'context', `return ${selectorConfig.transform}`) as (value: string) => unknown;
      } catch (error) {
        logger.error(`Failed to create transform function from expression: ${error}`);
        return undefined;
      }
    }

    return undefined;
  }

  private async buildExtractFunction(
    extractConfig: any,
    enhancedConfig: EnhancedCrawlerConfig
  ): Promise<(value: any) => unknown> {
    return (elements: any) => {
      if (!Array.isArray(elements)) {
        elements = [elements];
      }

      return elements.map((element: any) => {
        const result: any = {};
        
        for (const [key, config] of Object.entries(extractConfig)) {
          if (typeof config === 'string') {
            if (config === 'text') {
              result[key] = element.textContent?.trim();
            } else if (config === 'html') {
              result[key] = element.innerHTML;
            } else {
              result[key] = element.getAttribute(config);
            }
          } else if (typeof config === 'object' && config !== null && 'attribute' in config) {
            let value: unknown;
            const configObj = config as { attribute?: string; transform?: string };
            
            if (configObj.attribute) {
              value = element.getAttribute(configObj.attribute);
            } else {
              value = element.textContent?.trim();
            }

            if (configObj.transform) {
              try {
                const transformFn = getTransformFunction(configObj.transform);
                if (transformFn) {
                  value = transformFn(value);
                }
              } catch (error) {
                logger.warn(`Transform function "${configObj.transform}" failed:`, error);
              }
            }

            result[key] = value;
          }
        }
        
        return result;
      });
    };
  }

  private mergeConfigs(
    baseConfig: EnhancedCrawlerConfig, 
    overrideConfig: EnhancedCrawlerConfig
  ): EnhancedCrawlerConfig {
    return {
      ...baseConfig,
      ...overrideConfig,
      headers: { ...baseConfig.headers, ...overrideConfig.headers },
      selectors: { ...baseConfig.selectors, ...overrideConfig.selectors },
      options: { ...baseConfig.options, ...overrideConfig.options },
      cookies: { ...baseConfig.cookies, ...overrideConfig.cookies },
      transforms: { ...baseConfig.transforms, ...overrideConfig.transforms },
      variables: { ...baseConfig.variables, ...overrideConfig.variables }
    };
  }

  private async processVariables(config: EnhancedCrawlerConfig): Promise<EnhancedCrawlerConfig> {
    let configStr = JSON.stringify(config);

    configStr = configStr.replace(/\$\{env\.(\w+)\}/g, (match, varName) => {
      return process.env[varName] || match;
    });

    if (config.variables) {
      for (const [key, value] of Object.entries(config.variables)) {
        const regex = new RegExp(`\\\$\\{${key}\\}`, 'g');
        configStr = configStr.replace(regex, String(value));
      }
    }

    return JSON.parse(configStr);
  }

  async saveEnhancedConfig(name: string, config: EnhancedCrawlerConfig): Promise<void> {
    const configFile = path.join(this.configPath, `${name}.json`);
    
    try {
      await fs.ensureDir(this.configPath);
      await fs.writeJson(configFile, config, { spaces: 2 });
      this.configCache.set(name, config);
      logger.info(`Enhanced config "${name}" saved successfully`);
    } catch (error) {
      logger.error(`Failed to save enhanced config "${name}":`, error);
      throw error;
    }
  }

  async saveConfig(name: string, config: CrawlerConfig): Promise<void> {
    const enhancedConfig: EnhancedCrawlerConfig = {
      ...config,
      export: {
        formats: ['json'],
        filename: name
      }
    };
    
    return await this.saveEnhancedConfig(name, enhancedConfig);
  }

  async listConfigs(): Promise<string[]> {
    try {
      await fs.ensureDir(this.configPath);
      const files = await fs.readdir(this.configPath);
      return files
        .filter(file => file.endsWith('.json'))
        .map(file => path.basename(file, '.json'));
    } catch (error) {
      logger.error('Failed to list configs:', error);
      return [];
    }
  }

  async deleteConfig(name: string): Promise<void> {
    const configFile = path.join(this.configPath, `${name}.json`);
    
    try {
      await fs.remove(configFile);
      this.configCache.delete(name);
      logger.info(`Config "${name}" deleted successfully`);
    } catch (error) {
      logger.error(`Failed to delete config "${name}":`, error);
      throw error;
    }
  }

  async duplicateConfig(sourceName: string, targetName: string): Promise<void> {
    try {
      const sourceConfig = await this.loadEnhancedConfig(sourceName);
      await this.saveEnhancedConfig(targetName, { ...sourceConfig });
      logger.info(`Config duplicated from "${sourceName}" to "${targetName}"`);
    } catch (error) {
      logger.error(`Failed to duplicate config:`, error);
      throw error;
    }
  }

  async mergeConfigsWithBase(baseConfigName: string, overrideConfig: Partial<CrawlerConfig>): Promise<CrawlerConfig> {
    try {
      const baseConfig = await this.loadEnhancedConfig(baseConfigName);
      const mergedEnhancedConfig = {
        ...baseConfig,
        ...overrideConfig,
        headers: { ...baseConfig.headers, ...overrideConfig.headers },
        selectors: { ...baseConfig.selectors, ...overrideConfig.selectors },
        options: { ...baseConfig.options, ...overrideConfig.options },
        cookies: { ...baseConfig.cookies, ...overrideConfig.cookies }
      };

      return await this.convertToStandardConfig(mergedEnhancedConfig);
    } catch (error) {
      logger.error('Failed to merge configs:', error);
      throw error;
    }
  }

  getConfig(name: string): CrawlerConfig | undefined {
    const enhancedConfig = this.configCache.get(name);
    if (!enhancedConfig) return undefined;
    
    try {
      return {
        url: enhancedConfig.url,
        headers: enhancedConfig.headers,
        cookies: enhancedConfig.cookies,
        options: enhancedConfig.options,
        selectors: enhancedConfig.selectors as any
      };
    } catch {
      return undefined;
    }
  }

  hasConfig(name: string): boolean {
    return this.configCache.has(name);
  }

  clearCache(): void {
    this.configCache.clear();
    logger.info('Enhanced config cache cleared');
  }

  async expandDataDrivenConfigs(configName: string, outputDir: string): Promise<EnhancedCrawlerConfig[]> {
    const config = await this.loadEnhancedConfig(configName);

    if (!config.dataDriven) {
      return [config];
    }

    // 支持新版本的 dataDriven 格式
    if (config.dataDriven.enabled && config.dataDriven.sourceConfig) {
      return await this.expandNewDataDrivenConfigs(config, outputDir);
    }

    // 支持舊版本的 dataDriven 格式
    return await this.expandLegacyDataDrivenConfigs(config, outputDir);
  }

  private async expandNewDataDrivenConfigs(config: EnhancedCrawlerConfig, outputDir: string): Promise<EnhancedCrawlerConfig[]> {
    const { sourceConfig, sourceSelector, urlTemplate, templateVars } = config.dataDriven!;
    
    if (!sourceConfig) {
      throw new Error('Data-driven config missing required "sourceConfig" field');
    }
    
    if (!sourceSelector) {
      throw new Error('Data-driven config missing required "sourceSelector" field');
    }
    
    logger.info(`Expanding data-driven config using source: ${sourceConfig}`);

    // 查找源配置的輸出文件
    const sourceFiles = await fs.readdir(outputDir);
    const sourcePattern = `${sourceConfig}*_crawl_results_*.json`;
    const matchingFiles = sourceFiles.filter(file => 
      file.startsWith(sourceConfig) && 
      file.includes('_crawl_results_') && 
      file.endsWith('.json')
    );

    if (matchingFiles.length === 0) {
      throw new Error(`Data source file not found for source config: ${sourceConfig}. Expected pattern: ${sourcePattern}`);
    }

    const latestFile = matchingFiles.sort().reverse()[0];
    const sourceFile = path.join(outputDir, latestFile);
    
    logger.info(`Using data source file: ${latestFile}`);

    if (!await fs.pathExists(sourceFile)) {
      throw new Error(`Data source file not found: ${sourceFile}`);
    }

    const sourceData = await fs.readJson(sourceFile);
    
    // 從 results 數組中提取數據
    let dataArray = [];
    if (sourceData.results && Array.isArray(sourceData.results) && sourceData.results.length > 0) {
      const firstResult = sourceData.results[0];
      if (firstResult.data && firstResult.data[sourceSelector]) {
        dataArray = firstResult.data[sourceSelector];
      }
    }

    if (!Array.isArray(dataArray)) {
      throw new Error(`Source selector '${sourceSelector}' did not return an array. Got: ${typeof dataArray}`);
    }

    logger.info(`Found ${dataArray.length} items from source selector '${sourceSelector}'`);

    if (dataArray.length === 0) {
      logger.warn(`No data found in source selector '${sourceSelector}', returning empty config array`);
      return [];
    }

    // 為每個數據項生成新的配置
    const configs = dataArray.map((item: any) => {
      const newConfig = { ...config };
      
      // 替換 URL 模板
      let newUrl = urlTemplate || config.url;
      newUrl = this.replaceTemplateVariables(newUrl, item);
      
      // 設置變量
      const newVariables = { ...config.variables };
      if (templateVars) {
        for (const [varName, template] of Object.entries(templateVars)) {
          newVariables[varName] = this.replaceTemplateVariables(template as string, item);
        }
      }

      newConfig.url = newUrl;
      newConfig.variables = newVariables;
      delete newConfig.dataDriven; // 移除 dataDriven 配置，避免無限遞歸

      return newConfig;
    });

    logger.info(`Generated ${configs.length} data-driven configurations`);
    return configs;
  }

  private async expandLegacyDataDrivenConfigs(config: EnhancedCrawlerConfig, outputDir: string): Promise<EnhancedCrawlerConfig[]> {
    const { source, jsonPath, variable } = config.dataDriven!;
    
    if (!source) {
      throw new Error('Data-driven config missing required "source" field');
    }

    const sourceFiles = await fs.readdir(outputDir);
    const [prefix, suffix] = source.includes('*') ? source.split('*') : [source, ''];
    const matchingFiles = sourceFiles.filter(file => 
      file.startsWith(prefix) && file.endsWith(suffix)
    );

    if (matchingFiles.length === 0) {
      throw new Error(`Data source file not found for pattern: ${source}`);
    }

    const latestFile = matchingFiles.sort().reverse()[0];
    const sourceFile = path.join(outputDir, latestFile);

    if (!await fs.pathExists(sourceFile)) {
      throw new Error(`Data source file not found: ${sourceFile}`);
    }

    const sourceData = await fs.readJson(sourceFile);
    const values = JSONPath({ path: jsonPath!, json: sourceData });

    if (!Array.isArray(values)) {
      throw new Error(`JSONPath expression did not return an array: ${jsonPath}`);
    }

    const configs = await Promise.all(values.map(async (value) => {
      const newConfig = { ...config };
      newConfig.variables = { ...newConfig.variables, [variable!]: value };
      return await this.processVariables(newConfig);
    }));

    return configs;
  }

  private replaceTemplateVariables(template: string, item: any): string {
    return template.replace(/\{\{item\.(\w+)\}\}/g, (match, key) => {
      return item[key] || match;
    }).replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return item[key] || match;
    });
  }
}