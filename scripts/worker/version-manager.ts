/**
 * 版本管理器 - Worker 版本控制核心
 * 負責版本檢測、切換、相容性檢查
 */

import { execSync } from 'child_process';
import { readFileSync, existsSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { VersionInfo, VersionCheckResult, WorkerError } from '../../src/common/shared-types/interfaces/crawler.interface';

export class VersionManager {
  private packageJsonPath: string;
  private projectRoot: string;
  private versionCacheDir: string;
  private preferGitVersion: boolean;
  private githubToken?: string;

  constructor(options: {
    projectRoot?: string;
    versionCacheDir?: string;
    preferGitVersion?: boolean;
    githubToken?: string;
  } = {}) {
    this.projectRoot = options.projectRoot || process.cwd();
    this.packageJsonPath = join(this.projectRoot, 'package.json');
    this.versionCacheDir = options.versionCacheDir || join(this.projectRoot, '.version-cache');
    this.preferGitVersion = options.preferGitVersion || false;
    this.githubToken = options.githubToken || process.env.GITHUB_TOKEN;
  }

  /**
   * 獲取當前版本資訊
   */
  getCurrentVersionInfo(): VersionInfo {
    try {
      // 1. 讀取 package.json 版本
      const packageVersion = this.getPackageVersion();
      
      // 2. 讀取 Git 標籤版本
      const gitTag = this.getGitVersion();
      
      // 3. 決定使用哪個版本
      let current: string;
      let source: 'git' | 'package' | 'unknown';
      
      if (gitTag && packageVersion) {
        const gitVersionNumber = gitTag.replace(/^v/, '');
        const consistent = gitVersionNumber === packageVersion;
        
        if (consistent) {
          current = this.preferGitVersion ? gitTag : `v${packageVersion}`;
          source = this.preferGitVersion ? 'git' : 'package';
        } else {
          console.warn(`版本不一致: package.json(${packageVersion}) vs git(${gitTag})`);
          current = this.preferGitVersion ? gitTag : `v${packageVersion}`;
          source = this.preferGitVersion ? 'git' : 'package';
        }
        
        return {
          current,
          gitTag,
          packageVersion,
          source,
          consistent
        };
      } else if (packageVersion) {
        return {
          current: `v${packageVersion}`,
          packageVersion,
          source: 'package',
          consistent: true
        };
      } else if (gitTag) {
        return {
          current: gitTag,
          gitTag,
          source: 'git',
          consistent: true
        };
      } else {
        return {
          current: 'unknown',
          source: 'unknown',
          consistent: false
        };
      }
    } catch (error) {
      console.error('取得版本資訊失敗:', error);
      return {
        current: 'unknown',
        source: 'unknown',
        consistent: false
      };
    }
  }

  /**
   * 獲取當前版本字符串
   */
  getCurrentVersion(): string {
    return this.getCurrentVersionInfo().current;
  }

  /**
   * 檢查版本相容性
   */
  checkVersionCompatibility(
    requiredVersion?: string,
    versionConstraints?: {
      min_version?: string;
      max_version?: string;
      preferred_versions?: string[];
      blacklist_versions?: string[];
    }
  ): VersionCheckResult {
    const currentVersion = this.getCurrentVersion();
    
    // 沒有版本要求，全部相容
    if (!requiredVersion && !versionConstraints) {
      return {
        compatible: true,
        currentVersion,
        reason: 'No version requirements'
      };
    }

    // 檢查黑名單
    if (versionConstraints?.blacklist_versions?.includes(currentVersion)) {
      return {
        compatible: false,
        currentVersion,
        requiredVersion,
        action: 'upgrade',
        reason: `Current version ${currentVersion} is blacklisted`,
        details: { blacklisted_versions: versionConstraints.blacklist_versions }
      };
    }

    // 檢查最小版本要求
    if (versionConstraints?.min_version) {
      const comparison = this.compareVersions(currentVersion, versionConstraints.min_version);
      if (comparison < 0) {
        return {
          compatible: false,
          currentVersion,
          requiredVersion: versionConstraints.min_version,
          action: 'upgrade',
          reason: `Current version ${currentVersion} is below minimum requirement ${versionConstraints.min_version}`,
          details: { min_version: versionConstraints.min_version }
        };
      }
    }

    // 檢查最大版本限制
    if (versionConstraints?.max_version) {
      const comparison = this.compareVersions(currentVersion, versionConstraints.max_version);
      if (comparison > 0) {
        return {
          compatible: false,
          currentVersion,
          requiredVersion: versionConstraints.max_version,
          action: 'downgrade',
          reason: `Current version ${currentVersion} exceeds maximum allowed ${versionConstraints.max_version}`,
          details: { max_version: versionConstraints.max_version }
        };
      }
    }

    // 檢查特定版本要求
    if (requiredVersion) {
      if (currentVersion === requiredVersion) {
        return {
          compatible: true,
          currentVersion,
          requiredVersion,
          reason: 'Exact version match'
        };
      } else {
        const comparison = this.compareVersions(currentVersion, requiredVersion);
        return {
          compatible: false,
          currentVersion,
          requiredVersion,
          action: comparison < 0 ? 'upgrade' : 'downgrade',
          reason: `Version mismatch: current ${currentVersion}, required ${requiredVersion}`
        };
      }
    }

    // 檢查優先版本
    if (versionConstraints?.preferred_versions?.length) {
      if (!versionConstraints.preferred_versions.includes(currentVersion)) {
        const latestPreferred = versionConstraints.preferred_versions
          .sort((a, b) => this.compareVersions(b, a))[0];
        
        return {
          compatible: false,
          currentVersion,
          requiredVersion: latestPreferred,
          action: this.compareVersions(currentVersion, latestPreferred) < 0 ? 'upgrade' : 'downgrade',
          reason: `Current version not in preferred list, suggest switching to ${latestPreferred}`,
          details: { preferred_versions: versionConstraints.preferred_versions }
        };
      }
    }

    return {
      compatible: true,
      currentVersion,
      requiredVersion,
      reason: 'Version constraints satisfied'
    };
  }

  /**
   * 切換到指定版本
   */
  async switchVersion(targetVersion: string): Promise<boolean> {
    try {
      console.log(`🔄 開始切換到版本: ${targetVersion}`);
      
      // 1. 設置 Git 認證（如果需要）
      if (this.githubToken) {
        this.setupGitAuth();
      }
      
      // 2. 拉取最新標籤
      console.log('📥 拉取最新 Git 標籤...');
      execSync('git fetch --tags', { 
        stdio: 'inherit', 
        cwd: this.projectRoot,
        timeout: 30000 
      });
      
      // 3. 檢查目標版本是否存在
      const availableTags = this.getAvailableTags();
      if (!availableTags.includes(targetVersion)) {
        throw new Error(`版本 ${targetVersion} 不存在。可用版本: ${availableTags.slice(0, 5).join(', ')}`);
      }
      
      // 4. 備份當前狀態
      await this.backupCurrentState();
      
      // 5. 切換到目標版本
      console.log(`📦 切換到版本 ${targetVersion}...`);
      execSync(`git checkout tags/${targetVersion}`, { 
        stdio: 'inherit', 
        cwd: this.projectRoot,
        timeout: 30000 
      });
      
      // 6. 更新依賴
      console.log('📚 更新依賴套件...');
      execSync('npm ci', { 
        stdio: 'inherit', 
        cwd: this.projectRoot,
        timeout: 120000 // 2分鐘超時
      });
      
      // 7. 驗證版本切換
      const newVersionInfo = this.getCurrentVersionInfo();
      console.log(`✅ 版本切換完成: ${newVersionInfo.current}`);
      
      // 8. 記錄切換歷史
      await this.recordVersionSwitch(targetVersion);
      
      return true;
      
    } catch (error) {
      console.error(`❌ 版本切換失敗: ${error instanceof Error ? error.message : error}`);
      
      // 嘗試恢復到切換前狀態
      try {
        console.log('🔙 嘗試恢復到切換前狀態...');
        await this.restoreFromBackup();
      } catch (restoreError) {
        console.error('❌ 恢復失敗:', restoreError);
      }
      
      return false;
    }
  }

  /**
   * 獲取可用的版本標籤
   */
  getAvailableTags(): string[] {
    try {
      const output = execSync('git tag -l', { 
        encoding: 'utf8', 
        cwd: this.projectRoot 
      });
      return output.split('\n')
        .filter(tag => tag.trim())
        .filter(tag => /^v?\d+\.\d+\.\d+/.test(tag)) // 只返回語義化版本
        .sort((a, b) => this.compareVersions(b, a)); // 降序排列
    } catch (error) {
      console.warn('無法獲取 Git 標籤:', error);
      return [];
    }
  }

  /**
   * 比較版本號
   */
  private compareVersions(a: string, b: string): number {
    const cleanA = a.replace(/^v/, '');
    const cleanB = b.replace(/^v/, '');
    
    const partsA = cleanA.split('.').map(Number);
    const partsB = cleanB.split('.').map(Number);
    
    for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
      const partA = partsA[i] || 0;
      const partB = partsB[i] || 0;
      
      if (partA !== partB) {
        return partA - partB;
      }
    }
    
    return 0;
  }

  /**
   * 獲取 package.json 版本
   */
  private getPackageVersion(): string | undefined {
    try {
      if (!existsSync(this.packageJsonPath)) {
        return undefined;
      }
      
      const packageJson = JSON.parse(readFileSync(this.packageJsonPath, 'utf8'));
      return packageJson.version;
    } catch (error) {
      console.warn('無法讀取 package.json:', error);
      return undefined;
    }
  }

  /**
   * 獲取 Git 版本標籤
   */
  private getGitVersion(): string | undefined {
    try {
      const output = execSync('git describe --tags --abbrev=0', {
        encoding: 'utf8',
        cwd: this.projectRoot,
        stdio: 'pipe'
      });
      return output.trim();
    } catch (error) {
      // Git 標籤不存在是正常情況，不需要警告
      return undefined;
    }
  }

  /**
   * 設置 Git 認證
   */
  private setupGitAuth(): void {
    if (!this.githubToken) {
      return;
    }
    
    try {
      // 為 HTTPS URL 設置認證
      execSync(
        `git config --global url."https://${this.githubToken}@github.com/".insteadOf "https://github.com/"`,
        { stdio: 'pipe', cwd: this.projectRoot }
      );
    } catch (error) {
      console.warn('設置 Git 認證失敗:', error);
    }
  }

  /**
   * 備份當前狀態
   */
  private async backupCurrentState(): Promise<void> {
    try {
      const currentBranch = execSync('git rev-parse --abbrev-ref HEAD', {
        encoding: 'utf8',
        cwd: this.projectRoot
      }).trim();
      
      const currentCommit = execSync('git rev-parse HEAD', {
        encoding: 'utf8',
        cwd: this.projectRoot
      }).trim();
      
      const backupInfo = {
        branch: currentBranch,
        commit: currentCommit,
        timestamp: new Date().toISOString(),
        version: this.getCurrentVersion()
      };
      
      // 確保備份目錄存在
      execSync(`mkdir -p ${this.versionCacheDir}`, { stdio: 'pipe' });
      
      const backupPath = join(this.versionCacheDir, 'backup-state.json');
      writeFileSync(backupPath, JSON.stringify(backupInfo, null, 2));
      
      console.log(`💾 已備份當前狀態到: ${backupPath}`);
    } catch (error) {
      console.warn('備份當前狀態失敗:', error);
    }
  }

  /**
   * 從備份恢復
   */
  private async restoreFromBackup(): Promise<void> {
    try {
      const backupPath = join(this.versionCacheDir, 'backup-state.json');
      
      if (!existsSync(backupPath)) {
        throw new Error('找不到備份檔案');
      }
      
      const backupInfo = JSON.parse(readFileSync(backupPath, 'utf8'));
      
      if (backupInfo.branch === 'HEAD') {
        // 恢復到特定 commit
        execSync(`git checkout ${backupInfo.commit}`, {
          stdio: 'inherit',
          cwd: this.projectRoot
        });
      } else {
        // 恢復到分支
        execSync(`git checkout ${backupInfo.branch}`, {
          stdio: 'inherit',
          cwd: this.projectRoot
        });
      }
      
      // 恢復依賴
      execSync('npm ci', {
        stdio: 'inherit',
        cwd: this.projectRoot
      });
      
      console.log(`✅ 已恢復到: ${backupInfo.branch} (${backupInfo.version})`);
    } catch (error) {
      throw new Error(`恢復備份失敗: ${error instanceof Error ? error.message : error}`);
    }
  }

  /**
   * 記錄版本切換歷史
   */
  private async recordVersionSwitch(targetVersion: string): Promise<void> {
    try {
      const historyPath = join(this.versionCacheDir, 'switch-history.json');
      
      let history: Array<{
        from: string;
        to: string;
        timestamp: string;
        success: boolean;
      }> = [];
      
      if (existsSync(historyPath)) {
        history = JSON.parse(readFileSync(historyPath, 'utf8'));
      }
      
      history.push({
        from: this.getCurrentVersion(),
        to: targetVersion,
        timestamp: new Date().toISOString(),
        success: true
      });
      
      // 只保留最近 50 次記錄
      if (history.length > 50) {
        history = history.slice(-50);
      }
      
      // 確保目錄存在
      execSync(`mkdir -p ${this.versionCacheDir}`, { stdio: 'pipe' });
      
      writeFileSync(historyPath, JSON.stringify(history, null, 2));
    } catch (error) {
      console.warn('記錄版本切換歷史失敗:', error);
    }
  }

  /**
   * 獲取版本切換歷史
   */
  getVersionSwitchHistory(): Array<{
    from: string;
    to: string;
    timestamp: string;
    success: boolean;
  }> {
    try {
      const historyPath = join(this.versionCacheDir, 'switch-history.json');
      
      if (!existsSync(historyPath)) {
        return [];
      }
      
      return JSON.parse(readFileSync(historyPath, 'utf8'));
    } catch (error) {
      console.warn('讀取版本切換歷史失敗:', error);
      return [];
    }
  }

  /**
   * 清理版本快取
   */
  async cleanVersionCache(): Promise<void> {
    try {
      if (existsSync(this.versionCacheDir)) {
        execSync(`rm -rf ${this.versionCacheDir}`, { stdio: 'pipe' });
        console.log(`🗑️ 已清理版本快取: ${this.versionCacheDir}`);
      }
    } catch (error) {
      console.warn('清理版本快取失敗:', error);
    }
  }
}

// 便利方法：直接使用的靜態方法
export const VersionUtils = {
  /**
   * 快速獲取當前版本
   */
  getCurrentVersion(): string {
    const manager = new VersionManager();
    return manager.getCurrentVersion();
  },

  /**
   * 快速檢查版本相容性
   */
  checkCompatibility(
    requiredVersion?: string,
    constraints?: any
  ): VersionCheckResult {
    const manager = new VersionManager();
    return manager.checkVersionCompatibility(requiredVersion, constraints);
  },

  /**
   * 比較兩個版本
   */
  compareVersions(a: string, b: string): number {
    const manager = new VersionManager();
    return (manager as any).compareVersions(a, b);
  }
};

export default VersionManager;