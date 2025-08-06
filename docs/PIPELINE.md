# Crawler Pipeline Documentation

## Overview

The Crawler Pipeline is a complete end-to-end solution that orchestrates the entire data collection workflow from source data files to database storage.

## Pipeline Flow

```
1. Data Sources (data/)
   ↓
2. Config Generation (configs/)
   ↓
3. Crawler Execution (sequential)
   ↓
4. Output Files (output/)
   ↓
5. Data Aggregation (by symbol)
   ↓
6. Standardization (regional transforms)
   ↓
7. Database Import (PostgreSQL)
```

## Installation

```bash
# Install dependencies
npm install

# Copy environment configuration
cp .env.example .env

# Edit .env with your database credentials
vim .env
```

## Usage

### Basic Commands

```bash
# Run complete pipeline
npm run pipeline:run

# Run for specific regions
npm run pipeline:run -- --regions tw,us

# Run for specific symbols
npm run pipeline:run -- --symbols 2330.TW,2454.TW,AAPL

# View statistics
npm run pipeline:stats

# Clean old files
npm run pipeline:clean -- --days 30
```

### Advanced Options

```bash
# Skip configuration generation (use existing configs)
npm run pipeline:run -- --skip-config

# Skip crawler execution (use existing output files)
npm run pipeline:run -- --skip-crawl

# Skip database import (only crawl and aggregate)
npm run pipeline:run -- --skip-db

# Run with higher concurrency
npm run pipeline:run -- --concurrent 3

# Custom batch size for database import
npm run pipeline:run -- --batch-size 200
```

## Pipeline Components

### 1. Configuration Generation

Automatically generates crawler configurations from stock code data sources:

- **Taiwan**: `data/yahoo-finance-tw-stockcodes.json`
- **US**: `data/yahoo-finance-us-stockcodes.json`
- **Japan**: `data/yahoo-finance-jp-stockcodes.json`

### 2. Crawler Execution

Sequentially executes crawlers for each generated configuration:

- Processes configurations in batches
- Supports concurrent execution
- Progress tracking and error handling
- Automatic retry on failures

### 3. Output File Management

Manages and filters crawler output files:

- Pattern: `yahoo-finance-{region}-{type}-{symbol}_{date}.json`
- Filters out non-financial data files
- Groups files by symbol for aggregation

### 4. Data Aggregation

Combines multiple report types per symbol:

- Cash flow statements
- Income statements
- Balance sheets
- EPS data
- Dividend information

### 5. Standardization

Applies region-specific data transformations:

- **Taiwan**: TWD conversion, traditional Chinese parsing
- **US**: USD normalization, quarterly/annual alignment
- **Japan**: JPY conversion, fiscal year handling

### 6. Database Import

Imports standardized data to PostgreSQL:

- UPSERT operations (insert or update)
- Batch processing with transactions
- Data validation before import
- Conflict resolution

## Database Schema

The pipeline uses the `fundamental_data` table with the following key fields:

```sql
CREATE TABLE fundamental_data (
  id UUID PRIMARY KEY,
  symbol_code VARCHAR NOT NULL,
  exchange_area VARCHAR NOT NULL,
  report_date DATE,
  fiscal_year INTEGER,
  fiscal_quarter INTEGER,
  fiscal_month INTEGER,
  report_type VARCHAR,
  
  -- Income Statement
  revenue DECIMAL(15,2),
  cost_of_goods_sold DECIMAL(15,2),
  gross_profit DECIMAL(15,2),
  operating_income DECIMAL(15,2),
  net_income DECIMAL(15,2),
  eps DECIMAL(10,4),
  
  -- Balance Sheet
  total_assets DECIMAL(15,2),
  total_liabilities DECIMAL(15,2),
  shareholders_equity DECIMAL(15,2),
  book_value_per_share DECIMAL(10,4),
  
  -- Cash Flow
  operating_cash_flow DECIMAL(15,2),
  investing_cash_flow DECIMAL(15,2),
  financing_cash_flow DECIMAL(15,2),
  free_cash_flow DECIMAL(15,2),
  net_cash_flow DECIMAL(15,2),
  
  -- Metadata
  data_source VARCHAR,
  currency_code VARCHAR(3),
  shares_outstanding BIGINT,
  regional_data JSONB,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

## Configuration

### Environment Variables

```bash
# Database Configuration
POSTGRES_DB_IP=localhost
POSTGRES_DB_PORT=5432
POSTGRES_DB_USER=your_db_user
POSTGRES_DB_PASSWORD=your_db_password
POSTGRES_DB_NAME_AHA_DEV=aha-development
POSTGRES_DB_NAME_AHA=aha-production

# Environment
NODE_ENV=development
```

### Pipeline Configuration

```typescript
interface PipelineConfig {
  dataDir?: string;          // Default: 'data'
  configDir?: string;        // Default: 'configs'
  outputDir?: string;        // Default: 'output'
  scriptsDir?: string;       // Default: 'scripts'
  batchSize?: number;        // Default: 100
  maxConcurrent?: number;    // Default: 1
  regions?: string[];        // Default: ['tw', 'us', 'jp']
  symbolCodes?: string[];    // Default: [] (all symbols)
  skipConfigGeneration?: boolean;
  skipCrawling?: boolean;
  skipAggregation?: boolean;
  skipDatabaseImport?: boolean;
}
```

## Monitoring

### Progress Tracking

The pipeline provides real-time progress updates:

```
[25%] ⋯ Processing 2330.TW - cash_flow_statement
[26%] ✓ Processing 2330.TW - income_statement
[27%] ✗ Processing 2330.TW - balance_sheet
```

### Statistics

View current pipeline statistics:

```bash
npm run pipeline:stats

# Output:
📊 Pipeline Statistics
====================================
📁 Output Files:
  Total Files: 450
  Total Size: 125.34 MB
  Unique Symbols: 45
  By Region:
    TW: 300 files
    US: 100 files
    JP: 50 files

💾 Database:
  Total Records: 3600
  By Region:
    TW: 2400 records
    US: 800 records
    JP: 400 records
  By Report Type:
    quarterly: 3000 records
    annual: 600 records
  Latest Report: 2025-08-01
```

## Error Handling

### Common Issues

1. **Database Connection Failed**
   - Check PostgreSQL is running
   - Verify credentials in `.env`
   - Ensure database exists

2. **Config Generation Failed**
   - Check data source files exist in `data/`
   - Verify template files in `configs/templates/`

3. **Crawler Execution Failed**
   - Check network connectivity
   - Verify target websites are accessible
   - Review crawler logs in console output

4. **Data Aggregation Failed**
   - Ensure output files follow naming pattern
   - Check file content is valid JSON

5. **Import Failed**
   - Verify data validation rules
   - Check for duplicate key conflicts
   - Review database constraints

### Troubleshooting

```bash
# Check database connection
psql -h localhost -U your_db_user -d aha-development

# Verify output files
ls -la output/yahoo-finance-*.json | head -10

# Test single configuration
npx tsx src/cli.ts --config configs/yahoo-finance-tw-eps-2330_TW.json

# Check TypeScript compilation
npm run typecheck
```

## Performance Optimization

### Batch Processing

- Default batch size: 100 records
- Adjust based on available memory
- Larger batches = fewer transactions

### Concurrent Crawling

- Default: 1 concurrent crawler
- Increase for faster processing
- Monitor system resources

### Database Optimization

- Use UPSERT for idempotent imports
- Create appropriate indexes
- Regular VACUUM and ANALYZE

## Maintenance

### Regular Tasks

```bash
# Daily: Clean old output files
npm run pipeline:clean -- --days 7

# Weekly: Full pipeline run
npm run pipeline:run

# Monthly: Database maintenance
psql -d aha-development -c "VACUUM ANALYZE fundamental_data;"
```

### Backup

```bash
# Backup output files
tar -czf output_backup_$(date +%Y%m%d).tar.gz output/

# Backup database
pg_dump -U your_db_user -d aha-development > backup_$(date +%Y%m%d).sql
```

## Development

### Adding New Regions

1. Create data source file: `data/yahoo-finance-{region}-stockcodes.json`
2. Create config generator: `scripts/generate-yahoo-{region}-configs.js`
3. Add transform functions: `src/transforms/sites/yahoo-finance-{region}.ts`
4. Update aggregator to handle new region

### Adding New Report Types

1. Create template: `configs/templates/yahoo-finance-{region}-{type}.json`
2. Update config generator to include new type
3. Add standardization function for new report type
4. Update database schema if needed

### Testing

```bash
# Test pipeline with small dataset
npm run pipeline:run -- --symbols 2330.TW --skip-db

# Verify aggregation
cat output/aggregated_*.json | jq '.'

# Test database import
npm run pipeline:run -- --symbols 2330.TW --skip-config --skip-crawl
```

## Best Practices

1. **Incremental Updates**: Use `--skip-config` for daily runs
2. **Error Recovery**: Pipeline is idempotent, safe to re-run
3. **Resource Management**: Monitor disk space in `output/`
4. **Data Validation**: Always validate before database import
5. **Logging**: Keep logs for troubleshooting

## Support

For issues or questions:
- Check logs in console output
- Review this documentation
- Check `CLAUDE.md` for development guidelines
- Contact the development team

---

Last Updated: 2025-08-06
Version: 1.0.0