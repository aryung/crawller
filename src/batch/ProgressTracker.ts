import * as fs from 'fs-extra';
import * as path from 'path';
import { logger } from '../utils';

export enum TaskStatus {
  PENDING = 'pending',
  RUNNING = 'running', 
  COMPLETED = 'completed',
  FAILED = 'failed',
  SKIPPED = 'skipped'
}

export interface TaskProgress {
  configName: string;
  status: TaskStatus;
  startTime?: number;
  endTime?: number;
  error?: string;
  attempts?: number;
  outputPath?: string;
}

export interface ProgressSummary {
  id: string;
  category?: string;
  market?: string;
  type?: string;
  total: number;
  completed: number;
  failed: number;
  skipped: number;
  running: number;
  pending: number;
  percentage: number;
  estimatedTimeRemaining: number;
  averageTimePerTask: number;
  currentItem?: string;
  startTime: number;
  lastUpdateTime: number;
  tasks: Map<string, TaskProgress>;
  errors: string[];
}

export type ProgressCallback = (summary: ProgressSummary) => void;
export type ErrorCallback = (configName: string, error: string) => void;
export type CompleteCallback = (summary: ProgressSummary) => void;

export class ProgressTracker {
  private summary: ProgressSummary;
  private progressCallbacks: ProgressCallback[] = [];
  private errorCallbacks: ErrorCallback[] = [];
  private completeCallbacks: CompleteCallback[] = [];
  private saveInterval?: NodeJS.Timeout;
  private progressDir: string;

  constructor(
    configNames: string[],
    options: {
      category?: string;
      market?: string;
      type?: string;
      progressDir?: string;
    } = {}
  ) {
    this.progressDir = options.progressDir || '.progress';
    
    this.summary = {
      id: this.generateProgressId(options),
      category: options.category,
      market: options.market,
      type: options.type,
      total: configNames.length,
      completed: 0,
      failed: 0,
      skipped: 0,
      running: 0,
      pending: configNames.length,
      percentage: 0,
      estimatedTimeRemaining: 0,
      averageTimePerTask: 0,
      startTime: Date.now(),
      lastUpdateTime: Date.now(),
      tasks: new Map(),
      errors: []
    };

    // 初始化所有任務為 pending 狀態
    configNames.forEach(name => {
      this.summary.tasks.set(name, {
        configName: name,
        status: TaskStatus.PENDING
      });
    });

    // 自動定期保存進度（每30秒）
    this.saveInterval = setInterval(() => {
      this.autoSave();
    }, 30000);
  }

  /**
   * 生成唯一的進度 ID
   */
  private generateProgressId(options: {
    category?: string;
    market?: string;
    type?: string;
  }): string {
    const parts = [
      'batch',
      options.category || 'all',
      options.market || 'all',
      options.type || 'all',
      new Date().toISOString().slice(0, 19).replace(/[:-]/g, '')
    ];
    return parts.join('-');
  }

  /**
   * 更新任務進度
   */
  updateProgress(configName: string, status: TaskStatus, error?: string): void {
    const task = this.summary.tasks.get(configName);
    if (!task) {
      logger.warn(`Task not found: ${configName}`);
      return;
    }

    const oldStatus = task.status;
    task.status = status;
    task.attempts = (task.attempts || 0) + (status === TaskStatus.RUNNING ? 1 : 0);

    // 更新時間戳
    if (status === TaskStatus.RUNNING && !task.startTime) {
      task.startTime = Date.now();
    }
    if ([TaskStatus.COMPLETED, TaskStatus.FAILED, TaskStatus.SKIPPED].includes(status)) {
      task.endTime = Date.now();
    }

    // 處理錯誤
    if (error) {
      task.error = error;
      this.summary.errors.push(`${configName}: ${error}`);
      this.errorCallbacks.forEach(callback => callback(configName, error));
    }

    // 更新統計數據
    this.updateCounts(oldStatus, status);
    this.calculateMetrics();
    this.summary.lastUpdateTime = Date.now();
    this.summary.currentItem = status === TaskStatus.RUNNING ? configName : undefined;

    // 觸發進度回調
    this.progressCallbacks.forEach(callback => callback(this.summary));

    // 檢查是否全部完成
    if (this.summary.running === 0 && this.summary.pending === 0) {
      this.completeCallbacks.forEach(callback => callback(this.summary));
      this.cleanup();
    }

    logger.debug(`Progress updated: ${configName} -> ${status} (${this.summary.percentage.toFixed(1)}%)`);
  }

  /**
   * 更新計數統計
   */
  private updateCounts(oldStatus: TaskStatus, newStatus: TaskStatus): void {
    // 減少舊狀態計數
    switch (oldStatus) {
      case TaskStatus.PENDING: this.summary.pending--; break;
      case TaskStatus.RUNNING: this.summary.running--; break;
      case TaskStatus.COMPLETED: this.summary.completed--; break;
      case TaskStatus.FAILED: this.summary.failed--; break;
      case TaskStatus.SKIPPED: this.summary.skipped--; break;
    }

    // 增加新狀態計數
    switch (newStatus) {
      case TaskStatus.PENDING: this.summary.pending++; break;
      case TaskStatus.RUNNING: this.summary.running++; break;
      case TaskStatus.COMPLETED: this.summary.completed++; break;
      case TaskStatus.FAILED: this.summary.failed++; break;
      case TaskStatus.SKIPPED: this.summary.skipped++; break;
    }
  }

  /**
   * 計算進度指標
   */
  private calculateMetrics(): void {
    const finishedTasks = this.summary.completed + this.summary.failed + this.summary.skipped;
    this.summary.percentage = this.summary.total > 0 ? (finishedTasks / this.summary.total) * 100 : 0;

    // 計算平均執行時間和預估剩餘時間
    const completedTasks = Array.from(this.summary.tasks.values())
      .filter(task => task.status === TaskStatus.COMPLETED && task.startTime && task.endTime);

    if (completedTasks.length > 0) {
      const totalTime = completedTasks.reduce((sum, task) => 
        sum + (task.endTime! - task.startTime!), 0);
      this.summary.averageTimePerTask = totalTime / completedTasks.length;

      const remainingTasks = this.summary.pending + this.summary.running;
      this.summary.estimatedTimeRemaining = remainingTasks * this.summary.averageTimePerTask;
    }
  }

  /**
   * 獲取當前進度摘要
   */
  getProgress(): ProgressSummary {
    return { ...this.summary, tasks: new Map(this.summary.tasks) };
  }

  /**
   * 獲取失敗的配置列表
   */
  getFailedConfigs(): string[] {
    return Array.from(this.summary.tasks.values())
      .filter(task => task.status === TaskStatus.FAILED)
      .map(task => task.configName);
  }

  /**
   * 獲取可重試的配置列表 (失敗次數少於3次)
   */
  getRetryableConfigs(): string[] {
    return Array.from(this.summary.tasks.values())
      .filter(task => task.status === TaskStatus.FAILED && (task.attempts || 0) < 3)
      .map(task => task.configName);
  }

  /**
   * 重置特定配置的狀態為待執行
   */
  resetConfig(configName: string): void {
    const task = this.summary.tasks.get(configName);
    if (task) {
      const oldStatus = task.status;
      task.status = TaskStatus.PENDING;
      task.error = undefined;
      task.endTime = undefined;
      this.updateCounts(oldStatus, TaskStatus.PENDING);
      this.calculateMetrics();
    }
  }

  /**
   * 保存進度到檔案
   */
  async save(filePath?: string): Promise<void> {
    try {
      const savePath = filePath || path.join(this.progressDir, `${this.summary.id}.json`);
      await fs.ensureDir(path.dirname(savePath));
      
      // 將 Map 轉換為 Object 以便 JSON 序列化
      const serializable = {
        ...this.summary,
        tasks: Object.fromEntries(this.summary.tasks)
      };
      
      await fs.writeJson(savePath, serializable, { spaces: 2 });
      logger.debug(`Progress saved to: ${savePath}`);
    } catch (error) {
      logger.error('Failed to save progress:', error);
    }
  }

  /**
   * 從檔案載入進度
   */
  static async load(filePath: string): Promise<ProgressTracker> {
    try {
      const data = await fs.readJson(filePath);
      
      // 重建 ProgressTracker 實例
      const configNames = Object.keys(data.tasks);
      const tracker = new ProgressTracker(configNames, {
        category: data.category,
        market: data.market,
        type: data.type,
        progressDir: path.dirname(filePath)
      });

      // 恢復進度數據
      tracker.summary = {
        ...data,
        tasks: new Map(Object.entries(data.tasks))
      };

      logger.info(`Progress loaded from: ${filePath}`);
      return tracker;
    } catch (error) {
      throw new Error(`Failed to load progress from ${filePath}: ${error}`);
    }
  }

  /**
   * 列出所有可用的進度檔案
   */
  static async listProgressFiles(progressDir: string = '.progress'): Promise<string[]> {
    try {
      if (!await fs.pathExists(progressDir)) {
        return [];
      }
      
      const files = await fs.readdir(progressDir);
      return files
        .filter(file => file.endsWith('.json') && file.startsWith('batch-'))
        .map(file => path.join(progressDir, file));
    } catch (error) {
      logger.error('Failed to list progress files:', error);
      return [];
    }
  }

  /**
   * 自動保存進度
   */
  private async autoSave(): Promise<void> {
    await this.save();
  }

  /**
   * 註冊進度更新回調
   */
  onProgress(callback: ProgressCallback): void {
    this.progressCallbacks.push(callback);
  }

  /**
   * 註冊錯誤回調
   */
  onError(callback: ErrorCallback): void {
    this.errorCallbacks.push(callback);
  }

  /**
   * 註冊完成回調
   */
  onComplete(callback: CompleteCallback): void {
    this.completeCallbacks.push(callback);
  }

  /**
   * 清理資源
   */
  cleanup(): void {
    if (this.saveInterval) {
      clearInterval(this.saveInterval);
      this.saveInterval = undefined;
    }
    
    // 最後保存一次進度
    this.autoSave();
  }

  /**
   * 生成進度報告
   */
  generateReport(): string {
    const { total, completed, failed, skipped, percentage, estimatedTimeRemaining } = this.summary;
    const duration = Date.now() - this.summary.startTime;
    
    const formatTime = (ms: number): string => {
      const seconds = Math.floor(ms / 1000);
      const minutes = Math.floor(seconds / 60);
      const hours = Math.floor(minutes / 60);
      
      if (hours > 0) return `${hours}h ${minutes % 60}m`;
      if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
      return `${seconds}s`;
    };

    return `
批量爬取進度報告
=====================================
ID: ${this.summary.id}
類別: ${this.summary.category || 'all'} | 市場: ${this.summary.market || 'all'} | 類型: ${this.summary.type || 'all'}

進度統計:
- 總數: ${total}
- 完成: ${completed} (${((completed / total) * 100).toFixed(1)}%)
- 失敗: ${failed} (${((failed / total) * 100).toFixed(1)}%)
- 跳過: ${skipped} (${((skipped / total) * 100).toFixed(1)}%)
- 進行中: ${this.summary.running}
- 待處理: ${this.summary.pending}

時間統計:
- 總進度: ${percentage.toFixed(1)}%
- 已執行時間: ${formatTime(duration)}
- 預估剩餘時間: ${formatTime(estimatedTimeRemaining)}
- 平均執行時間: ${formatTime(this.summary.averageTimePerTask)} / 任務

當前狀態: ${this.summary.currentItem || '空閒'}
`;
  }
}