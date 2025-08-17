import { getSiteConcurrencyConfig, extractDomainFromUrl, SiteConcurrencyConfig } from '../common/constants/setting';

/**
 * Site execution state tracking
 */
interface SiteExecutionState {
  domain: string;
  runningCount: number;
  lastRequestTime: number;
  queuedTasks: string[];
  config: SiteConcurrencyConfig;
}

/**
 * Task information for site-based concurrency management
 */
export interface ConcurrencyTask {
  taskId: string;
  url: string;
  priority: number;
  createdAt: number;
}

/**
 * Site-based Concurrency Manager
 * 
 * Manages concurrent execution limits per website domain instead of global limits.
 * This prevents blocking individual sites while allowing parallel processing across
 * different domains.
 */
export class SiteConcurrencyManager {
  private siteStates: Map<string, SiteExecutionState> = new Map();
  private taskQueue: Map<string, ConcurrencyTask> = new Map();
  private isShuttingDown: boolean = false;

  constructor() {
    this.initializeManager();
  }

  private initializeManager(): void {
    console.log('🚀 SiteConcurrencyManager initialized with per-site concurrency control');
  }

  /**
   * Get or create site execution state
   */
  private getSiteState(domain: string): SiteExecutionState {
    if (!this.siteStates.has(domain)) {
      const config = getSiteConcurrencyConfig(`https://${domain}`);
      this.siteStates.set(domain, {
        domain,
        runningCount: 0,
        lastRequestTime: 0,
        queuedTasks: [],
        config
      });
    }
    return this.siteStates.get(domain)!;
  }

  /**
   * Check if a site can accept new requests
   */
  public canExecute(url: string): boolean {
    if (this.isShuttingDown) {
      return false;
    }

    const domain = extractDomainFromUrl(url);
    const siteState = this.getSiteState(domain);

    // Check concurrent limit
    if (siteState.runningCount >= siteState.config.maxConcurrent) {
      return false;
    }

    // Check delay requirement
    const timeSinceLastRequest = Date.now() - siteState.lastRequestTime;
    if (timeSinceLastRequest < siteState.config.delayBetweenRequests) {
      return false;
    }

    return true;
  }

  /**
   * Acquire execution slot for a URL
   */
  public async acquireSlot(taskId: string, url: string, priority: number = 1): Promise<boolean> {
    const domain = extractDomainFromUrl(url);
    const siteState = this.getSiteState(domain);

    if (this.canExecute(url)) {
      // Can execute immediately
      siteState.runningCount++;
      siteState.lastRequestTime = Date.now();
      
      console.log(`🟢 [${domain}] Acquired slot for ${taskId} (${siteState.runningCount}/${siteState.config.maxConcurrent})`);
      return true;
    } else {
      // Add to queue
      const task: ConcurrencyTask = {
        taskId,
        url,
        priority,
        createdAt: Date.now()
      };
      
      this.taskQueue.set(taskId, task);
      siteState.queuedTasks.push(taskId);
      
      console.log(`🟡 [${domain}] Queued ${taskId} (${siteState.queuedTasks.length} queued, ${siteState.runningCount} running)`);
      return false;
    }
  }

  /**
   * Release execution slot and try to start queued tasks
   */
  public releaseSlot(taskId: string, url: string): void {
    const domain = extractDomainFromUrl(url);
    const siteState = this.getSiteState(domain);

    if (siteState.runningCount > 0) {
      siteState.runningCount--;
      console.log(`🔴 [${domain}] Released slot for ${taskId} (${siteState.runningCount}/${siteState.config.maxConcurrent})`);
    }

    // Remove from task queue if present
    if (this.taskQueue.has(taskId)) {
      this.taskQueue.delete(taskId);
      const queueIndex = siteState.queuedTasks.indexOf(taskId);
      if (queueIndex > -1) {
        siteState.queuedTasks.splice(queueIndex, 1);
      }
    }

    // Try to start next queued task for this site
    this.tryStartNextTask(domain);
  }

  /**
   * Try to start the next queued task for a site
   */
  private tryStartNextTask(domain: string): void {
    const siteState = this.getSiteState(domain);
    
    if (siteState.queuedTasks.length === 0 || !this.canExecute(`https://${domain}`)) {
      return;
    }

    // Find highest priority task
    const nextTaskId = siteState.queuedTasks
      .map(taskId => this.taskQueue.get(taskId))
      .filter(task => task !== undefined)
      .sort((a, b) => b!.priority - a!.priority)[0]?.taskId;

    if (nextTaskId) {
      const task = this.taskQueue.get(nextTaskId);
      if (task && this.canExecute(task.url)) {
        // Start the task (this would trigger the actual execution)
        siteState.runningCount++;
        siteState.lastRequestTime = Date.now();
        
        // Remove from queue
        this.taskQueue.delete(nextTaskId);
        const queueIndex = siteState.queuedTasks.indexOf(nextTaskId);
        if (queueIndex > -1) {
          siteState.queuedTasks.splice(queueIndex, 1);
        }

        console.log(`🚀 [${domain}] Started queued task ${nextTaskId} (${siteState.runningCount}/${siteState.config.maxConcurrent})`);
      }
    }
  }

  /**
   * Wait for a task to be ready for execution
   */
  public async waitForSlot(taskId: string, url: string, priority: number = 1): Promise<void> {
    const acquired = await this.acquireSlot(taskId, url, priority);
    if (acquired) {
      return; // Can execute immediately
    }

    // Wait for slot to become available
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (this.canExecute(url)) {
          clearInterval(checkInterval);
          this.acquireSlot(taskId, url, priority).then(() => {
            resolve();
          });
        }
      }, 1000); // Check every second
    });
  }

  /**
   * Get current site statistics
   */
  public getSiteStatistics(): Record<string, any> {
    const stats: Record<string, any> = {};
    
    for (const [domain, state] of this.siteStates) {
      stats[domain] = {
        running: state.runningCount,
        maxConcurrent: state.config.maxConcurrent,
        queued: state.queuedTasks.length,
        lastRequestTime: state.lastRequestTime,
        utilization: (state.runningCount / state.config.maxConcurrent) * 100,
        description: state.config.description
      };
    }

    return stats;
  }

  /**
   * Get overall queue statistics
   */
  public getQueueStatistics(): {
    totalQueued: number;
    totalRunning: number;
    totalCapacity: number;
    siteBreakdown: Record<string, { queued: number; running: number; capacity: number }>;
  } {
    let totalQueued = 0;
    let totalRunning = 0;
    let totalCapacity = 0;
    const siteBreakdown: Record<string, { queued: number; running: number; capacity: number }> = {};

    for (const [domain, state] of this.siteStates) {
      totalQueued += state.queuedTasks.length;
      totalRunning += state.runningCount;
      totalCapacity += state.config.maxConcurrent;

      siteBreakdown[domain] = {
        queued: state.queuedTasks.length,
        running: state.runningCount,
        capacity: state.config.maxConcurrent
      };
    }

    return {
      totalQueued,
      totalRunning,
      totalCapacity,
      siteBreakdown
    };
  }

  /**
   * Graceful shutdown - wait for all running tasks to complete
   */
  public async shutdown(timeoutMs: number = 30000): Promise<void> {
    this.isShuttingDown = true;
    console.log('🛑 SiteConcurrencyManager shutting down...');

    const startTime = Date.now();
    
    while (this.getTotalRunningTasks() > 0 && (Date.now() - startTime) < timeoutMs) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    const remainingTasks = this.getTotalRunningTasks();
    if (remainingTasks > 0) {
      console.warn(`⚠️ Shutdown timeout: ${remainingTasks} tasks still running`);
    } else {
      console.log('✅ SiteConcurrencyManager shutdown complete');
    }
  }

  /**
   * Get total number of running tasks across all sites
   */
  private getTotalRunningTasks(): number {
    return Array.from(this.siteStates.values())
      .reduce((total, state) => total + state.runningCount, 0);
  }

  /**
   * Clear all queues (for testing or emergency scenarios)
   */
  public clearAllQueues(): void {
    this.taskQueue.clear();
    for (const state of this.siteStates.values()) {
      state.queuedTasks = [];
    }
    console.log('🧹 All task queues cleared');
  }
}