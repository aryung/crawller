/**
 * 通知設定架構 - 分離頻率控制與時段管理
 *
 * 設計理念：
 * 1. 頻率控制 (Frequency/Cooldown) - 避免垃圾通知
 * 2. 時段控制 (Time Windows) - 避免非適當時間打擾
 * 3. 組合模式 - 可同時啟用多種限制
 */

export enum NotificationMode {
  IMMEDIATE = 'immediate', // 即時通知
  FREQUENCY_LIMITED = 'frequency_limited', // 頻率限制
  SCHEDULED = 'scheduled', // 時段控制
  COMBINED = 'combined', // 組合模式
}

export interface TimeWindow {
  /** 開始時間 格式: "HH:mm" 例如: "09:00" */
  startTime: string;

  /** 結束時間 格式: "HH:mm" 例如: "17:00" */
  endTime: string;

  /** 星期幾 (1=週一, 7=週日) 例如: [1,2,3,4,5] 代表週一到週五 */
  days: number[];
}

export interface NotificationScheduleSettings {
  /** 是否啟用時段控制 */
  enabled: boolean;

  /** 允許通知的時間窗口列表 */
  windows: TimeWindow[];

  /** 時區 (預設為 Asia/Taipei) */
  timezone?: string;
}

export interface NotificationFrequencySettings {
  /** 是否啟用頻率控制 */
  enabled: boolean;

  /** 冷卻時間(分鐘) 0=無限制, >0=最少間隔時間 */
  cooldownMinutes: number;
}

export interface NotificationSettings {
  /** 通知模式 */
  mode: NotificationMode;

  /** 頻率控制設定 */
  frequency: NotificationFrequencySettings;

  /** 時段控制設定 */
  schedule: NotificationScheduleSettings;
}

// 預設設定模板
export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  mode: NotificationMode.IMMEDIATE,
  frequency: {
    enabled: false,
    cooldownMinutes: 0,
  },
  schedule: {
    enabled: false,
    windows: [],
    timezone: 'Asia/Taipei',
  },
};
