import { UserEntity } from '.';
import { LabelType } from '..';

export interface LabelEntity {
  id: string;
  name: string;
  type: LabelType;
  color?: string;
  description?: string;
  createdBy?: string;
  creator?: UserEntity;
  isActive: boolean;
  usageCount: number;
  metadata?: {
    // 股票分類相關（可選）
    market?: string; // 'US', 'JP', 'TPE'
    category?: string; // 'technology', '3700', '24'
    subcategory?: string; // 'software', null
    categoryGroup?: string; // 'tech', 'manufacturing', 'finance'
    displayName?: string; // '軟體服務', '精密機器'

    // 其他未來可能的元資料
    [key: string]: string | number | undefined;
  };
  createdAt: Date;
  updatedAt: Date;
}
