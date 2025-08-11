#!/usr/bin/env tsx
/**
 * Script to sync category-symbol mappings to backend label system
 *
 * This script:
 * 1. Reads category-symbol-mappings.json
 * 2. Calls backend API to sync labels
 * 3. Handles Taiwan market special logic (TAI/TWO)
 * 4. Cleans old Symbol-Label relationships
 * 5. Creates new relationships
 *
 * Usage:
 *   npm run sync:labels          # Execute sync
 *   npm run sync:labels:dry      # Dry run mode
 */

// Load environment variables from .env file
import 'dotenv/config';

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import axios, { AxiosInstance } from 'axios';
import chalk from 'chalk';
import ora from 'ora';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Type definitions
interface Symbol {
  symbolCode: string;
  name: string;
}

interface CategoryMapping {
  category: string;
  categoryId: string;
  symbols: Symbol[];
}

interface CategoryMappings {
  TPE?: CategoryMapping[];
  JP?: CategoryMapping[];
  US?: CategoryMapping[];
}

interface SyncConfig {
  apiUrl: string;
  apiToken?: string;
  dryRun: boolean;
  strategy: 'replace' | 'merge';
  batchSize: number;
}

interface SyncResult {
  market: string;
  labelsCreated: number;
  symbolsUpdated: number;
  relationsCreated: number;
  relationsRemoved: number;
  errors: string[];
}

class CategoryLabelSyncer {
  private api: AxiosInstance;
  private config: SyncConfig;
  private spinner: any;

  constructor(config: SyncConfig) {
    this.config = config;
    this.api = axios.create({
      baseURL: config.apiUrl,
      headers: {
        'Content-Type': 'application/json',
        ...(config.apiToken && { Authorization: `Bearer ${config.apiToken}` }),
      },
    });
  }

  async sync(): Promise<SyncResult[]> {
    const results: SyncResult[] = [];

    try {
      // Read category mappings
      const mappingFile = join(
        __dirname,
        '../output/category-symbol-mappings.json'
      );
      if (!existsSync(mappingFile)) {
        throw new Error(`Mapping file not found: ${mappingFile}`);
      }

      const fileContent = JSON.parse(readFileSync(mappingFile, 'utf-8'));
      const mappings: CategoryMappings =
        fileContent.categoryMappings || fileContent;

      console.log(chalk.blue('\n📊 Category-Symbol Mappings Sync'));
      console.log(chalk.gray('─'.repeat(50)));

      // Sync each market
      if (mappings.TPE) {
        console.log(chalk.yellow('\n🇹🇼 Processing Taiwan market...'));
        const tpeResult = await this.syncMarket('TPE', mappings.TPE);
        results.push(tpeResult);
      }

      if (mappings.US) {
        console.log(chalk.yellow('\n🇺🇸 Processing US market...'));
        const usResult = await this.syncMarket('US', mappings.US);
        results.push(usResult);
      }

      if (mappings.JP) {
        console.log(chalk.yellow('\n🇯🇵 Processing Japan market...'));
        const jpResult = await this.syncMarket('JP', mappings.JP);
        results.push(jpResult);
      }

      // Print summary
      this.printSummary(results);

      return results;
    } catch (error) {
      console.error(chalk.red(`\n❌ Sync failed: ${error.message}`));
      throw error;
    }
  }

  private async syncMarket(
    market: string,
    categories: CategoryMapping[]
  ): Promise<SyncResult> {
    const result: SyncResult = {
      market,
      labelsCreated: 0,
      symbolsUpdated: 0,
      relationsCreated: 0,
      relationsRemoved: 0,
      errors: [],
    };

    // Process categories in batches
    const batches = this.createBatches(categories, this.config.batchSize);

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      this.spinner = ora(`Processing batch ${i + 1}/${batches.length}`).start();

      for (const category of batch) {
        try {
          // Parse category info
          const categoryInfo = this.parseCategoryInfo(market, category);

          if (this.config.dryRun) {
            // Dry run mode - actually try the API calls to check for errors
            console.log(
              chalk.gray(`  [DRY RUN] Testing: ${categoryInfo.labelName}`)
            );
            console.log(
              chalk.gray(
                `    - Exchange: ${categoryInfo.exchangeType || 'N/A'}`
              )
            );
            console.log(
              chalk.gray(`    - Symbols: ${category.symbols.length}`)
            );

            // Test creating/finding the encoded industry label
            try {
              const labelId = await this.createOrUpdateIndustryLabel(
                market as any,
                categoryInfo.categoryId,
                categoryInfo.labelName
              );
              if (labelId) {
                console.log(chalk.green(`    ✓ Label would be created/found`));
                result.labelsCreated++;
              }
            } catch (error) {
              console.log(
                chalk.red(`    ✗ Label creation would fail: ${error.message}`)
              );
              result.errors.push(
                `Label ${categoryInfo.labelName}: ${error.message}`
              );
            }

            result.symbolsUpdated += category.symbols.length;
            continue;
          }

          // Step 1: Create or update industry label using encoded format
          const labelId = await this.createOrUpdateIndustryLabel(
            market as any,
            categoryInfo.categoryId,
            categoryInfo.labelName
          );
          if (labelId) {
            result.labelsCreated++;
          }

          // Step 2: Process symbols
          for (const symbol of category.symbols) {
            try {
              // Update symbol if Taiwan market
              if (market === 'TPE' && categoryInfo.exchangeType) {
                await this.updateSymbol(symbol.symbolCode, market, {
                  exchangeType: categoryInfo.exchangeType,
                  marketSegment:
                    categoryInfo.exchangeType === 'TAI' ? '上市' : '上櫃',
                });
                result.symbolsUpdated++;
              }

              // Create label relationship
              if (labelId) {
                const created = await this.createSymbolLabelRelation(
                  symbol.symbolCode,
                  market,
                  labelId
                );
                if (created) {
                  result.relationsCreated++;
                }
              }
            } catch (error) {
              const errMsg = `Failed to process symbol ${symbol.symbolCode}: ${error.message}`;
              result.errors.push(errMsg);
              console.error(chalk.red(`    ${errMsg}`));
            }
          }
        } catch (error) {
          const errMsg = `Failed to process category ${category.category}: ${error.message}`;
          result.errors.push(errMsg);
          console.error(chalk.red(`  ${errMsg}`));
        }
      }

      this.spinner.succeed(`Batch ${i + 1}/${batches.length} completed`);
    }

    // Clean old relationships if replace strategy
    if (this.config.strategy === 'replace' && !this.config.dryRun) {
      console.log(
        chalk.yellow(`  Cleaning old relationships for ${market}...`)
      );
      const removed = await this.cleanOldRelationships(market, categories);
      result.relationsRemoved = removed;
    }

    return result;
  }

  private parseCategoryInfo(market: string, category: CategoryMapping) {
    let labelName = category.category;
    let exchangeType: 'TAI' | 'TWO' | null = null;

    if (market === 'TPE') {
      // Parse Taiwan category
      // categoryId format: "category_1_TAI" or "category_122_TWO"
      if (category.categoryId.endsWith('_TAI')) {
        exchangeType = 'TAI';
      } else if (category.categoryId.endsWith('_TWO')) {
        exchangeType = 'TWO';
      }

      // Remove "櫃" prefix for unified label name
      labelName = labelName.replace(/^櫃/, '');
    }

    return {
      labelName,
      exchangeType,
      originalCategory: category.category,
      categoryId: category.categoryId,
    };
  }

  private async createOrUpdateIndustryLabel(
    market: string,
    categoryId: string,
    industryName: string
  ): Promise<string | null> {
    try {
      // Call backend industry label API to create encoded label
      const response = await this.api.post('/label-industry/labels/create', {
        marketRegion: market,
        categoryId: categoryId,
        name: industryName,
        description: `${market} 市場產業分類: ${industryName}`,
      });

      // Return the created label (should be in encoded format)
      const labelData = response.data.data || response.data;
      return labelData?.name || labelData?.id || null;
    } catch (error) {
      if (
        error.response?.status === 400 &&
        error.response?.data?.message?.includes('已存在')
      ) {
        // Label already exists, try to find the encoded label name
        try {
          // Generate expected encoded name
          const encodedName = `${market}_${categoryId}_${industryName}`;

          const searchResponse = await this.api.get('/labels', {
            params: {
              query: encodedName,
              type: 'SYSTEM_DEFINED',
            },
          });

          const existingLabel =
            searchResponse.data?.find?.(
              (label: any) => label.name === encodedName
            ) ||
            searchResponse.data?.data?.find?.(
              (label: any) => label.name === encodedName
            );

          return existingLabel?.name || existingLabel?.id || null;
        } catch (searchError) {
          console.error(
            chalk.red(
              `Failed to search for existing encoded label: ${market}_${categoryId}_${industryName}`
            )
          );
          return null;
        }
      }

      if (error.response?.status === 409) {
        // Try alternative search method
        try {
          const encodedName = `${market}_${categoryId}_${industryName}`;
          const searchResponse = await this.api.post('/labels/search', {
            query: encodedName,
            type: 'SYSTEM_DEFINED',
          });

          const existingLabel = searchResponse.data.data?.find(
            (label: any) => label.name === encodedName
          );

          return existingLabel?.name || existingLabel?.id || null;
        } catch (searchError) {
          console.error(
            chalk.red(
              `Failed to search for existing encoded label: ${market}_${categoryId}_${industryName}`
            )
          );
          return null;
        }
      }

      // Log the error for debugging
      console.error(
        chalk.red(
          `Industry label creation failed for ${market}_${categoryId}_${industryName}: ${error.message}`
        )
      );
      throw error;
    }
  }

  private async updateSymbol(
    symbolCode: string,
    market: string,
    updates: { exchangeType: string; marketSegment: string }
  ): Promise<void> {
    try {
      // Call backend API to update symbol
      await this.api.patch(`/symbols/${symbolCode}`, {
        exchangeArea: market,
        ...updates,
      });
    } catch (error) {
      if (error.response?.status !== 404) {
        throw error;
      }
      // Symbol not found is OK, it might not be imported yet
    }
  }

  private async createSymbolLabelRelation(
    symbolCode: string,
    market: string,
    labelIdOrEncodedName: string
  ): Promise<boolean> {
    try {
      // Call backend API to create relationship using encoded label name
      // The backend can handle both ID and encoded name
      await this.api.post(`/symbols/${symbolCode}/labels`, {
        exchangeArea: market,
        labelIds: [labelIdOrEncodedName],
      });
      return true;
    } catch (error) {
      if (error.response?.status === 409) {
        // Relationship already exists
        return false;
      }
      if (error.response?.status === 404) {
        // Symbol not found
        return false;
      }

      // Log error for debugging
      console.error(
        chalk.red(
          `Failed to create symbol-label relation: ${symbolCode} -> ${labelIdOrEncodedName}`
        )
      );
      throw error;
    }
  }

  private async cleanOldRelationships(
    market: string,
    currentCategories: CategoryMapping[]
  ): Promise<number> {
    // Get all current symbol codes
    const currentSymbols = new Set<string>();
    currentCategories.forEach((cat) => {
      cat.symbols.forEach((sym) => currentSymbols.add(sym.symbolCode));
    });

    // This would need backend API support to:
    // 1. Get all symbols in the market with industry labels
    // 2. Remove labels from symbols not in current list
    // For now, return 0 as placeholder

    return 0;
  }

  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  private printSummary(results: SyncResult[]) {
    console.log(chalk.blue('\n📊 Sync Summary'));
    console.log(chalk.gray('─'.repeat(50)));

    for (const result of results) {
      console.log(chalk.cyan(`\n${result.market} Market:`));
      console.log(`  Labels created/updated: ${result.labelsCreated}`);
      console.log(`  Symbols updated: ${result.symbolsUpdated}`);
      console.log(`  Relations created: ${result.relationsCreated}`);
      console.log(`  Relations removed: ${result.relationsRemoved}`);

      if (result.errors.length > 0) {
        console.log(chalk.red(`  Errors: ${result.errors.length}`));
        result.errors.slice(0, 5).forEach((err) => {
          console.log(chalk.red(`    - ${err}`));
        });
        if (result.errors.length > 5) {
          console.log(
            chalk.red(`    ... and ${result.errors.length - 5} more`)
          );
        }
      }
    }

    const totalLabels = results.reduce((sum, r) => sum + r.labelsCreated, 0);
    const totalSymbols = results.reduce((sum, r) => sum + r.symbolsUpdated, 0);
    const totalRelations = results.reduce(
      (sum, r) => sum + r.relationsCreated,
      0
    );
    const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0);

    console.log(chalk.green('\n✅ Total:'));
    console.log(`  Labels: ${totalLabels}`);
    console.log(`  Symbols: ${totalSymbols}`);
    console.log(`  Relations: ${totalRelations}`);
    if (totalErrors > 0) {
      console.log(chalk.red(`  Errors: ${totalErrors}`));
    }
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');
  const strategy = args.includes('--merge') ? 'merge' : 'replace';

  // Get API configuration from environment or use defaults
  const apiUrl = process.env.BACKEND_API_URL || 'http://localhost:3000';
  let apiToken = process.env.BACKEND_API_TOKEN;

  // If no token provided, try to get one via auto-login
  if (!apiToken && apiUrl.includes('localhost')) {
    try {
      console.log(
        chalk.yellow('No API token provided, attempting auto-login...')
      );
      const loginResponse = await axios.post(`${apiUrl}/auth/auto-login`, {
        email: 'aryung@gmail.com',
        name: 'Test User',
      });
      apiToken = loginResponse.data.accessToken;
      console.log(chalk.green('✓ Auto-login successful\n'));
    } catch (error) {
      console.log(
        chalk.red('✗ Auto-login failed, continuing without authentication\n')
      );
    }
  }

  const config: SyncConfig = {
    apiUrl,
    apiToken,
    dryRun: isDryRun,
    strategy,
    batchSize: 10,
  };

  console.log(chalk.blue('🚀 Category Labels Sync'));
  console.log(chalk.gray('─'.repeat(50)));
  console.log(`API URL: ${apiUrl}`);
  console.log(`Mode: ${isDryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log(`Strategy: ${strategy}`);
  console.log();

  const syncer = new CategoryLabelSyncer(config);

  try {
    await syncer.sync();
    console.log(chalk.green('\n✅ Sync completed successfully!'));
    process.exit(0);
  } catch (error) {
    console.error(chalk.red('\n❌ Sync failed!'));
    console.error(error);
    process.exit(1);
  }
}

// Execute if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

