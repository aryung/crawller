import * as fs from 'fs-extra';
import * as path from 'path';

export interface FileInfo {
  filePath: string;
  fileName: string;
  region: string;
  reportType: string;
  symbolCode: string;
  dateCreated: string;
  size: number;
}

export interface FileGroup {
  symbolCode: string;
  region: string;
  files: FileInfo[];
}

/**
 * Manages output files from crawler operations
 * Filters and organizes financial data files
 */
export class OutputFileManager {
  private outputDir: string;
  private useStructuredLayout: boolean;

  constructor(outputDir: string = 'output', useStructuredLayout: boolean = true) {
    this.outputDir = outputDir;
    this.useStructuredLayout = useStructuredLayout;
  }

  /**
   * Get all financial data files for a specific symbol
   * Supports both flat and structured directory layouts
   */
  async getFinancialDataFiles(symbolCode?: string, region?: string): Promise<FileInfo[]> {
    const fileInfos: FileInfo[] = [];

    if (this.useStructuredLayout) {
      // Scan structured directories: quarterly/, daily/, metadata/
      const categories = ['quarterly', 'daily', 'metadata'];
      
      for (const category of categories) {
        const categoryPath = path.join(this.outputDir, category);
        if (await fs.pathExists(categoryPath)) {
          await this.scanStructuredDirectory(categoryPath, fileInfos, symbolCode, region);
        }
      }
    } else {
      // Legacy flat directory structure
      const files = await fs.readdir(this.outputDir);
      
      for (const fileName of files) {
        // Parse financial data file pattern
        const match = fileName.match(
          /^yahoo-finance-(tw|us|jp)-([^-]+)-([\w\.]+)_(\d{8})\.json$/i
        );

        if (match) {
          const [, fileRegion, reportType, fileSymbol, dateStr] = match;
          
          // Apply filters if provided - 精確匹配
          if (symbolCode && fileSymbol !== symbolCode.replace('.', '_')) {
            continue;
          }
          if (region && fileRegion.toUpperCase() !== region.toUpperCase()) {
            continue;
          }

          const filePath = path.join(this.outputDir, fileName);
          const stats = await fs.stat(filePath);

          fileInfos.push({
            filePath,
            fileName,
            region: fileRegion.toUpperCase(),
            reportType: reportType.replace(/-/g, '_'),
            symbolCode: fileSymbol.replace('_', '.'),
            dateCreated: dateStr,
            size: stats.size,
          });
        }
      }
    }

    return fileInfos;
  }

  /**
   * Recursively scan structured directory for financial data files
   */
  private async scanStructuredDirectory(
    dirPath: string,
    fileInfos: FileInfo[],
    symbolCode?: string,
    region?: string
  ): Promise<void> {
    const items = await fs.readdir(dirPath);
    
    for (const item of items) {
      const itemPath = path.join(dirPath, item);
      const stats = await fs.stat(itemPath);
      
      if (stats.isDirectory()) {
        // Recursively scan subdirectories
        await this.scanStructuredDirectory(itemPath, fileInfos, symbolCode, region);
      } else if (item.endsWith('.json')) {
        // Parse financial data file pattern
        const match = item.match(
          /^yahoo-finance-(tw|us|jp)-([^-]+)-([\w\.]+)_(\d{8})\.json$/i
        );

        if (match) {
          const [, fileRegion, reportType, fileSymbol, dateStr] = match;
          
          // Apply filters if provided
          if (symbolCode && fileSymbol !== symbolCode.replace('.', '_')) {
            continue;
          }
          if (region && fileRegion.toUpperCase() !== region.toUpperCase()) {
            continue;
          }

          fileInfos.push({
            filePath: itemPath,
            fileName: item,
            region: fileRegion.toUpperCase(),
            reportType: reportType.replace(/-/g, '_'),
            symbolCode: fileSymbol.replace('_', '.'),
            dateCreated: dateStr,
            size: stats.size,
          });
        }
      }
    }
  }

  /**
   * Group files by symbol code
   */
  async groupFilesBySymbol(): Promise<Map<string, FileGroup>> {
    const files = await this.getFinancialDataFiles();
    const groups = new Map<string, FileGroup>();

    for (const file of files) {
      const key = `${file.symbolCode}_${file.region}`;
      
      if (!groups.has(key)) {
        groups.set(key, {
          symbolCode: file.symbolCode,
          region: file.region,
          files: [],
        });
      }

      groups.get(key)!.files.push(file);
    }

    return groups;
  }

  /**
   * Read and parse a financial data file
   */
  async readFinancialDataFile(filePath: string): Promise<any> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      console.error(`Error reading file ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Get latest files for each symbol and report type
   */
  async getLatestFiles(): Promise<FileInfo[]> {
    const allFiles = await this.getFinancialDataFiles();
    const latestMap = new Map<string, FileInfo>();

    for (const file of allFiles) {
      const key = `${file.symbolCode}_${file.region}_${file.reportType}`;
      const existing = latestMap.get(key);

      if (!existing || file.dateCreated > existing.dateCreated) {
        latestMap.set(key, file);
      }
    }

    return Array.from(latestMap.values());
  }

  /**
   * Clean old output files
   */
  async cleanOldFiles(daysToKeep: number = 30): Promise<number> {
    const files = await this.getFinancialDataFiles();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    const cutoffStr = cutoffDate.toISOString().slice(0, 10).replace(/-/g, '');

    let deletedCount = 0;

    for (const file of files) {
      if (file.dateCreated < cutoffStr) {
        try {
          await fs.unlink(file.filePath);
          deletedCount++;
          console.log(`Deleted old file: ${file.fileName}`);
        } catch (error) {
          console.error(`Error deleting file ${file.fileName}:`, error);
        }
      }
    }

    return deletedCount;
  }

  /**
   * Get statistics about output files
   */
  async getStatistics(): Promise<{
    totalFiles: number;
    totalSize: number;
    byRegion: Record<string, number>;
    byReportType: Record<string, number>;
    uniqueSymbols: number;
  }> {
    const files = await this.getFinancialDataFiles();
    const uniqueSymbols = new Set<string>();
    const byRegion: Record<string, number> = {};
    const byReportType: Record<string, number> = {};
    let totalSize = 0;

    for (const file of files) {
      uniqueSymbols.add(file.symbolCode);
      totalSize += file.size;
      
      byRegion[file.region] = (byRegion[file.region] || 0) + 1;
      byReportType[file.reportType] = (byReportType[file.reportType] || 0) + 1;
    }

    return {
      totalFiles: files.length,
      totalSize,
      byRegion,
      byReportType,
      uniqueSymbols: uniqueSymbols.size,
    };
  }

  /**
   * Check if files exist for a symbol
   */
  async hasDataForSymbol(symbolCode: string, region: string): Promise<boolean> {
    const files = await this.getFinancialDataFiles(symbolCode, region);
    return files.length > 0;
  }
}