#!/usr/bin/env node
/**
 * Script to import symbols from various Yahoo Finance data sources
 * 
 * Data sources:
 * - Taiwan: data/yahoo-tw-stock-details.json
 * - Japan: data/yahoo-jp-stock-details.json  
 * - US: data/yahoo-us-*-20250809.json files
 */

import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { SymbolEntity } from '../src/database/entities/symbol.entity.js';
import { AppDataSource } from '../src/database/ormconfig.js';
import { AssetType, MarketRegion } from '../src/common/shared-types/index.js';
import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface TWJPStockDetails {
  [category: string]: Array<{
    name: string;
    symbolCode: string;
  }>;
}

interface USStockData {
  metadata: any;
  data: Array<{
    symbol: string;
    sector?: string;
  }>;
}

interface ImportStats {
  total: number;
  inserted: number;
  skipped: number;
  failed: number;
}

class SymbolImporter {
  private dataSource: DataSource;
  private stats: ImportStats = {
    total: 0,
    inserted: 0,
    skipped: 0,
    failed: 0,
  };

  constructor(dataSource: DataSource) {
    this.dataSource = dataSource;
  }

  /**
   * Import Taiwan stock symbols
   */
  async importTWSymbols(): Promise<void> {
    console.log('\n📊 Importing Taiwan (TPE) symbols...');
    const filePath = join(__dirname, '../data/yahoo-tw-stock-details.json');
    
    try {
      const fileContent = readFileSync(filePath, 'utf-8');
      const data: TWJPStockDetails = JSON.parse(fileContent);
      
      const symbols: Array<{ symbolCode: string; name: string }> = [];
      
      // Extract all symbols from all categories
      for (const category in data) {
        if (Array.isArray(data[category])) {
          for (const stock of data[category]) {
            symbols.push({
              symbolCode: stock.symbolCode,
              name: stock.name,
            });
          }
        }
      }
      
      console.log(`Found ${symbols.length} Taiwan symbols`);
      await this.batchInsertSymbols(symbols, MarketRegion.TPE);
      
    } catch (error) {
      console.error('❌ Error importing Taiwan symbols:', error);
    }
  }

  /**
   * Import Japan stock symbols
   */
  async importJPSymbols(): Promise<void> {
    console.log('\n📊 Importing Japan (JP) symbols...');
    const filePath = join(__dirname, '../data/yahoo-jp-stock-details.json');
    
    try {
      const fileContent = readFileSync(filePath, 'utf-8');
      const data: TWJPStockDetails = JSON.parse(fileContent);
      
      const symbols: Array<{ symbolCode: string; name: string }> = [];
      
      // Extract all symbols from all categories
      for (const category in data) {
        if (Array.isArray(data[category])) {
          for (const stock of data[category]) {
            symbols.push({
              symbolCode: stock.symbolCode,
              name: stock.name,
            });
          }
        }
      }
      
      console.log(`Found ${symbols.length} Japan symbols`);
      await this.batchInsertSymbols(symbols, MarketRegion.JP);
      
    } catch (error) {
      console.error('❌ Error importing Japan symbols:', error);
    }
  }

  /**
   * Import US stock symbols from multiple sector files
   */
  async importUSSymbols(): Promise<void> {
    console.log('\n📊 Importing US symbols...');
    const dataDir = join(__dirname, '../data');
    
    try {
      // Find all US sector files
      const files = readdirSync(dataDir);
      const usFiles = files.filter(f => f.startsWith('yahoo-us-') && f.endsWith('-20250809.json'));
      
      console.log(`Found ${usFiles.length} US sector files`);
      
      const allSymbols = new Set<string>(); // Use Set to avoid duplicates
      
      for (const fileName of usFiles) {
        const filePath = join(dataDir, fileName);
        const fileContent = readFileSync(filePath, 'utf-8');
        const data: USStockData = JSON.parse(fileContent);
        
        if (data.data && Array.isArray(data.data)) {
          for (const stock of data.data) {
            if (stock.symbol) {
              allSymbols.add(stock.symbol);
            }
          }
        }
        
        console.log(`  - ${fileName}: ${data.data?.length || 0} records`);
      }
      
      // Convert to array with name = symbolCode (no company names in US data)
      const symbols = Array.from(allSymbols).map(symbol => ({
        symbolCode: symbol,
        name: symbol, // Use symbol as name since we don't have company names
      }));
      
      console.log(`Total unique US symbols: ${symbols.length}`);
      await this.batchInsertSymbols(symbols, MarketRegion.US);
      
    } catch (error) {
      console.error('❌ Error importing US symbols:', error);
    }
  }

  /**
   * Batch insert symbols with conflict handling
   */
  private async batchInsertSymbols(
    symbols: Array<{ symbolCode: string; name: string }>,
    exchangeArea: MarketRegion,
    batchSize: number = 100
  ): Promise<void> {
    const startStats = { ...this.stats };
    
    for (let i = 0; i < symbols.length; i += batchSize) {
      const batch = symbols.slice(i, i + batchSize);
      
      try {
        await this.dataSource.transaction(async (manager) => {
          for (const symbol of batch) {
            this.stats.total++;
            
            try {
              // Check if symbol already exists
              const existing = await manager.findOne(SymbolEntity, {
                where: {
                  symbolCode: symbol.symbolCode,
                  exchangeArea: exchangeArea,
                },
              });
              
              if (existing) {
                this.stats.skipped++;
              } else {
                // Create new symbol entity
                const entity = manager.create(SymbolEntity, {
                  symbolCode: symbol.symbolCode,
                  name: symbol.name,
                  assetType: AssetType.EQUITY,
                  exchangeArea: exchangeArea,
                });
                
                await manager.save(entity);
                this.stats.inserted++;
              }
            } catch (error) {
              this.stats.failed++;
              console.error(`Failed to insert ${symbol.symbolCode}:`, error.message);
            }
          }
        });
        
        // Show progress
        if ((i + batch.length) % 500 === 0 || i + batch.length === symbols.length) {
          console.log(`  Progress: ${i + batch.length}/${symbols.length}`);
        }
      } catch (error) {
        console.error('Batch transaction failed:', error);
        this.stats.failed += batch.length;
      }
    }
    
    // Report statistics for this exchange
    const inserted = this.stats.inserted - startStats.inserted;
    const skipped = this.stats.skipped - startStats.skipped;
    const failed = this.stats.failed - startStats.failed;
    
    console.log(`  ✅ Inserted: ${inserted}, ⏭️  Skipped: ${skipped}, ❌ Failed: ${failed}`);
  }

  /**
   * Get final statistics
   */
  getStats(): ImportStats {
    return this.stats;
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('🚀 Starting symbol import process...');
  console.log('================================');
  
  try {
    // Initialize database connection
    await AppDataSource.initialize();
    console.log('✅ Database connection established');
    
    const importer = new SymbolImporter(AppDataSource);
    
    // Import symbols from each region
    await importer.importTWSymbols();
    await importer.importJPSymbols();
    await importer.importUSSymbols();
    
    // Display final statistics
    const stats = importer.getStats();
    console.log('\n================================');
    console.log('📊 Import Summary:');
    console.log(`  Total processed: ${stats.total}`);
    console.log(`  ✅ Successfully inserted: ${stats.inserted}`);
    console.log(`  ⏭️  Skipped (already exists): ${stats.skipped}`);
    console.log(`  ❌ Failed: ${stats.failed}`);
    console.log('================================');
    
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  } finally {
    // Close database connection
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
      console.log('\n📤 Database connection closed');
    }
  }
}

// Run the script
main().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});