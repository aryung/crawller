/**
 * AHA 智投系統 - 業務邏輯介面定義
 *
 * 🎯 此目錄包含從後端 interfaces/ 目錄移動過來的業務邏輯介面
 * - 純 TypeScript 介面定義
 * - 供前後端業務邏輯使用
 * - 不包含 UI 專用類型
 *
 * 📋 來源對應：
 * - 後端 interfaces/ 目錄的介面定義
 * - 前端會使用相同的業務邏輯介面
 *
 * 🔄 維護原則：
 * - 與後端業務邏輯保持完全一致
 * - 不包含前端 UI 專用類型
 * - 由後端統一維護，前端透過 sync-types 同步
 *
 * @version 1.0.0
 * @since 2025-01-16
 */

// 警報相關介面
export * from './alert.interface';

// 認證相關介面
export * from './auth.interface';

// 條件相關介面
export * from './condition.interface';

// 通用枚舉定義
export * from './enums.interface';

// 錯誤碼定義
export * from './error.interface';

// 基本面數據介面
export * from './fundamental-data.interface';

// 指標相關介面
export * from './indicator.interface';

// 日誌相關介面
// export * from './log.interface';

// 市場數據介面
export * from './market-data.interface';

export * from './notification.interface';

// 通知設定介面
export * from './notification-settings.interface';

// 通知相關介面 (暫時移除重複的 CreateUserAlertDto 和 UpdateUserAlertDto)
export * from './notification.interface';

// 投資組合介面
export * from './portfolio.interface';

// 持倉相關介面
export * from './position.interface';

// 共享畫面介面
export * from './shared-screen.interface';

// 策略相關介面
export * from './strategy.interface';

// 用戶相關介面
export * from './user.interface';

export * from './label.interface';

export * from './entity.interface';

export enum InvestmentRelationshipChangeType {
  ASSIGNMENT = 'ASSIGNMENT',
  REMOVAL = 'REMOVAL',
  PARAMETER_CHANGE = 'PARAMETER_CHANGE',
}
