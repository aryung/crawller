#!/usr/bin/env tsx
/**
 * Script to generate category-symbol mappings from various Yahoo Finance data sources
 *
 * Data sources:
 * - Taiwan: data/yahoo-tw-stock-details.json
 * - Japan: data/yahoo-jp-stock-details.json
 * - US: data/yahoo-us-*-20250809.json files
 *
 * Output: output/category-symbol-mappings.json
 */

// Load environment variables
import 'dotenv/config';
import {
  TW_CATEGORY_NAMES,
  JP_CATEGORY_NAMES,
} from '../src/common/shared-types';

import {
  readFileSync,
  writeFileSync,
  readdirSync,
  existsSync,
  mkdirSync,
} from 'fs';
import { join } from 'path';

const __dirname = process.cwd();

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
  TPE: CategoryMapping[];
  JP: CategoryMapping[];
  US: CategoryMapping[];
}

interface TWJPStockDetails {
  [categoryId: string]: Array<{
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

class CategorySymbolMapper {
  private categoryMappings: CategoryMappings = {
    TPE: [],
    JP: [],
    US: [],
  };

  /**
   * Process Taiwan stock data
   */
  processTaiwanData(): void {
    console.log('\n📊 Processing Taiwan (TPE) data...');
    const filePath = join(__dirname, 'data/yahoo-tw-stock-details.json');

    if (!existsSync(filePath)) {
      console.warn('⚠️  Taiwan data file not found:', filePath);
      return;
    }

    const fileContent = readFileSync(filePath, 'utf-8');
    const data: TWJPStockDetails = JSON.parse(fileContent);

    // Process each category
    for (const categoryId in data) {
      if (Array.isArray(data[categoryId]) && data[categoryId].length > 0) {
        const categoryName =
          TW_CATEGORY_NAMES[categoryId] || `產業${categoryId}`;

        const symbols: Symbol[] = data[categoryId].map((stock) => ({
          symbolCode: stock.symbolCode,
          name: stock.name,
        }));

        this.categoryMappings.TPE.push({
          category: categoryName,
          categoryId: categoryId,
          symbols: symbols,
        });

        console.log(
          `  ✅ ${categoryName} (${categoryId}): ${symbols.length} symbols`
        );
      }
    }

    console.log(
      `  Total Taiwan categories: ${this.categoryMappings.TPE.length}`
    );
  }

  /**
   * Process Japan stock data
   */
  processJapanData(): void {
    console.log('\n📊 Processing Japan (JP) data...');
    const filePath = join(__dirname, 'data/yahoo-jp-stock-details.json');

    if (!existsSync(filePath)) {
      console.warn('⚠️  Japan data file not found:', filePath);
      return;
    }

    const fileContent = readFileSync(filePath, 'utf-8');
    const data: TWJPStockDetails = JSON.parse(fileContent);

    // Process each category
    for (const categoryId in data) {
      if (Array.isArray(data[categoryId]) && data[categoryId].length > 0) {
        const categoryName =
          JP_CATEGORY_NAMES[categoryId] || `産業${categoryId}`;

        const symbols: Symbol[] = data[categoryId].map((stock) => ({
          symbolCode: stock.symbolCode,
          name: stock.name,
        }));

        this.categoryMappings.JP.push({
          category: categoryName,
          categoryId: categoryId,
          symbols: symbols,
        });

        console.log(
          `  ✅ ${categoryName} (${categoryId}): ${symbols.length} symbols`
        );
      }
    }

    console.log(`  Total Japan categories: ${this.categoryMappings.JP.length}`);
  }

  /**
   * Process US stock data from multiple sector files
   */
  processUSData(): void {
    console.log('\n📊 Processing US data...');
    const dataDir = join(__dirname, 'data');

    // Find all US sector files
    const files = readdirSync(dataDir);
    const usFiles = files.filter(
      (f) =>
        f.startsWith('yahoo-us-') &&
        f.endsWith('-20250809.json') &&
        f !== 'yahoo-us-sectors-20250809.json' // Exclude the sectors summary file
    );

    console.log(`  Found ${usFiles.length} US sector files`);

    for (const fileName of usFiles) {
      const filePath = join(dataDir, fileName);
      const fileContent = readFileSync(filePath, 'utf-8');
      const data: USStockData = JSON.parse(fileContent);

      // Extract category name from filename
      // e.g., "yahoo-us-technology-20250809.json" -> "technology"
      const categoryMatch = fileName.match(/yahoo-us-(.+)-\d+\.json$/);
      if (!categoryMatch) continue;

      const categoryId = categoryMatch[1];
      const categoryName = this.formatCategoryName(categoryId);

      if (data.data && Array.isArray(data.data)) {
        // Remove duplicates and create symbol list
        const uniqueSymbols = new Map<string, Symbol>();

        for (const stock of data.data) {
          if (stock.symbol && !uniqueSymbols.has(stock.symbol)) {
            uniqueSymbols.set(stock.symbol, {
              symbolCode: stock.symbol,
              name: stock.symbol, // US data doesn't have company names
            });
          }
        }

        const symbols = Array.from(uniqueSymbols.values());

        this.categoryMappings.US.push({
          category: categoryName,
          categoryId: categoryId,
          symbols: symbols,
        });

        console.log(
          `  ✅ ${categoryName}: ${symbols.length} unique symbols (from ${data.data.length} records)`
        );
      }
    }

    console.log(`  Total US categories: ${this.categoryMappings.US.length}`);
  }

  /**
   * Format category name from file name
   */
  private formatCategoryName(categoryId: string): string {
    // Capitalize first letter and replace underscores
    return categoryId
      .split(/[-_]/)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Save mappings to JSON file
   */
  saveMappings(): void {
    console.log('\n💾 Saving category-symbol mappings...');

    // Save to data directory instead of output
    const outputPath = join(__dirname, 'data', 'category-symbol-mappings.json');

    // Calculate statistics
    const stats = {
      TPE: {
        categories: this.categoryMappings.TPE.length,
        totalSymbols: this.categoryMappings.TPE.reduce(
          (sum, cat) => sum + cat.symbols.length,
          0
        ),
      },
      JP: {
        categories: this.categoryMappings.JP.length,
        totalSymbols: this.categoryMappings.JP.reduce(
          (sum, cat) => sum + cat.symbols.length,
          0
        ),
      },
      US: {
        categories: this.categoryMappings.US.length,
        totalSymbols: this.categoryMappings.US.reduce(
          (sum, cat) => sum + cat.symbols.length,
          0
        ),
      },
    };

    const output = {
      metadata: {
        generatedAt: new Date().toISOString(),
        statistics: stats,
      },
      categoryMappings: this.categoryMappings,
    };

    writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf-8');

    console.log(`  ✅ Saved to: ${outputPath}`);
    console.log('\n📊 Summary:');
    console.log(
      `  Taiwan: ${stats.TPE.categories} categories, ${stats.TPE.totalSymbols} symbols`
    );
    console.log(
      `  Japan: ${stats.JP.categories} categories, ${stats.JP.totalSymbols} symbols`
    );
    console.log(
      `  US: ${stats.US.categories} categories, ${stats.US.totalSymbols} symbols`
    );
    console.log(
      `  Total: ${stats.TPE.totalSymbols + stats.JP.totalSymbols + stats.US.totalSymbols} symbols`
    );
  }

  /**
   * Run the complete mapping process
   */
  run(): void {
    console.log('🚀 Starting category-symbol mapping generation...');
    console.log('================================================');

    this.processTaiwanData();
    this.processJapanData();
    this.processUSData();
    this.saveMappings();

    console.log('\n✅ Category-symbol mapping generation completed!');
  }
}

// Main execution
if (import.meta.url === `file://${__filename}`) {
  const mapper = new CategorySymbolMapper();
  mapper.run();
}

export { CategorySymbolMapper };

