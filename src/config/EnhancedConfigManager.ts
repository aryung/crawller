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
  ): Promise<Function | undefined> {
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
          return transformFn;
        }
      } catch (error) {
        logger.warn(`Transform function "${selectorConfig.transform}" not found in built-in library`);
      }

      if (enhancedConfig.transforms && enhancedConfig.transforms[selectorConfig.transform]) {
        try {
          const transformCode = enhancedConfig.transforms[selectorConfig.transform];
          return new Function('value', 'context', transformCode);
        } catch (error) {
          logger.error(`Failed to create custom transform function: ${error}`);
          return undefined;
        }
      }

      try {
        return new Function('value', 'context', `return ${selectorConfig.transform}`);
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
  ): Promise<Function> {
    return (elements: any[]) => {
      if (!Array.isArray(elements)) {
        elements = [elements];
      }

      return elements.map(element => {
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
          } else if (typeof config === 'object') {
            let value: any;
            
            if (config.attribute) {
              value = element.getAttribute(config.attribute);
            } else {
              value = element.textContent?.trim();
            }

            if (config.transform) {
              try {
                const transformFn = getTransformFunction(config.transform as string);
                if (transformFn) {
                  value = transformFn(value);
                }
              } catch (error) {
                logger.warn(`Transform function "${config.transform}" failed:`, error);
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

  async mergeConfigs(baseConfigName: string, overrideConfig: Partial<CrawlerConfig>): Promise<CrawlerConfig> {
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

    const { source, jsonPath, variable } = config.dataDriven;
    const sourceFiles = await fs.readdir(outputDir);
    const matchingFiles = sourceFiles.filter(file => file.startsWith(source.split('*')[0]) && file.endsWith(source.split('*')[1]));

    if (matchingFiles.length === 0) {
      throw new Error(`Data source file not found for pattern: ${source}`);
    }

    const latestFile = matchingFiles.sort().reverse()[0];
    const sourceFile = path.join(outputDir, latestFile);

    if (!await fs.pathExists(sourceFile)) {
      throw new Error(`Data source file not found: ${sourceFile}`);
    }

    const sourceData = await fs.readJson(sourceFile);
    const values = JSONPath({ path: jsonPath, json: sourceData });

    if (!Array.isArray(values)) {
      throw new Error(`JSONPath expression did not return an array: ${jsonPath}`);
    }

    const configs = await Promise.all(values.map(async (value) => {
      const newConfig = { ...config };
      newConfig.variables = { ...newConfig.variables, [variable]: value };
      return await this.processVariables(newConfig);
    }));

    return configs;
  }
}