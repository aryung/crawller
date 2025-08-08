import * as fs from 'fs-extra';
import * as path from 'path';
import { CrawlerConfig } from '../types';
import { logger, validateCrawlerConfig } from '../utils';

export class ConfigManager {
  private configPath: string;
  private configs: Map<string, CrawlerConfig> = new Map();

  constructor(configPath: string = 'config') {
    this.configPath = configPath;
  }

  async loadConfig(name: string): Promise<CrawlerConfig> {
    if (this.configs.has(name)) {
      return this.configs.get(name)!;
    }

    const configFile = path.join(this.configPath, `${name}.json`);
    
    try {
      const config = await fs.readJson(configFile);
      const errors = validateCrawlerConfig(config);
      
      if (errors.length > 0) {
        throw new Error(`Invalid config "${name}": ${errors.join(', ')}`);
      }

      this.configs.set(name, config);
      logger.info(`Config "${name}" loaded successfully`);
      return config;
    } catch (error) {
      logger.error(`Failed to load config "${name}":`, error);
      throw error;
    }
  }

  async saveConfig(name: string, config: CrawlerConfig): Promise<void> {
    const errors = validateCrawlerConfig(config);
    if (errors.length > 0) {
      throw new Error(`Invalid config: ${errors.join(', ')}`);
    }

    const configFile = path.join(this.configPath, `${name}.json`);
    
    try {
      await fs.ensureDir(this.configPath);
      await fs.writeJson(configFile, config, { spaces: 2 });
      this.configs.set(name, config);
      logger.info(`Config "${name}" saved successfully`);
    } catch (error) {
      logger.error(`Failed to save config "${name}":`, error);
      throw error;
    }
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
      this.configs.delete(name);
      logger.info(`Config "${name}" deleted successfully`);
    } catch (error) {
      logger.error(`Failed to delete config "${name}":`, error);
      throw error;
    }
  }

  async duplicateConfig(sourceName: string, targetName: string): Promise<void> {
    try {
      const sourceConfig = await this.loadConfig(sourceName);
      await this.saveConfig(targetName, { ...sourceConfig });
      logger.info(`Config duplicated from "${sourceName}" to "${targetName}"`);
    } catch (error) {
      logger.error(`Failed to duplicate config:`, error);
      throw error;
    }
  }

  async mergeConfigs(baseConfigName: string, overrideConfig: Partial<CrawlerConfig>): Promise<CrawlerConfig> {
    try {
      const baseConfig = await this.loadConfig(baseConfigName);
      const mergedConfig = {
        ...baseConfig,
        ...overrideConfig,
        headers: { ...baseConfig.headers, ...overrideConfig.headers },
        selectors: { ...baseConfig.selectors, ...overrideConfig.selectors },
        options: { ...baseConfig.options, ...overrideConfig.options },
        cookies: { ...baseConfig.cookies, ...overrideConfig.cookies }
      };

      const errors = validateCrawlerConfig(mergedConfig);
      if (errors.length > 0) {
        throw new Error(`Invalid merged config: ${errors.join(', ')}`);
      }

      return mergedConfig;
    } catch (error) {
      logger.error('Failed to merge configs:', error);
      throw error;
    }
  }

  getConfig(name: string): CrawlerConfig | undefined {
    return this.configs.get(name);
  }

  hasConfig(name: string): boolean {
    return this.configs.has(name);
  }

  clearCache(): void {
    this.configs.clear();
    logger.info('Config cache cleared');
  }
}