# 基本面數據欄位映射技術規範

**文件版本**: 1.0  
**撰寫日期**: 2025-01-06  
**作者**: AI Assistant  
**專案**: AHA 智投系統 - 基本面數據欄位映射規範

## 1. 規範目標

本文件定義了爬蟲系統與後端 `FundamentalDataEntity` 之間的精確欄位映射規則，確保：
- 欄位名稱統一
- 單位轉換正確
- 計算依賴完整
- 資料驗證一致

## 2. 核心原則

### 2.1 命名規範
- 後端使用 camelCase 命名
- 統一使用美式英語拼寫
- 避免縮寫，除非業界通用（如 EPS、ROE）

### 2.2 單位規範
- **金額**：統一使用基礎貨幣單位（元、美元、日圓）
- **比率**：統一使用小數格式（0.15 = 15%）
- **倍數**：保持原始數值（如 PE = 20）

### 2.3 資料類型
- **金額類**：decimal(15,2)
- **比率類**：decimal(10,4)
- **數量類**：bigint
- **日期類**：date 或 timestamp

## 3. 必要欄位映射規則

### 3.1 營業收入 (Revenue)
```typescript
// 爬蟲欄位
revenue | totalRevenue | operatingRevenue

// 後端欄位
revenue: number

// 單位轉換
TW: value * 1000     // 仟元 → 元
US: value           // 保持美元
JP: value * 1000000 // 百万円 → 円

// 驗證規則
- 必須 >= 0
- 不可為 null（計算依賴）
```

### 3.2 銷貨成本 (Cost of Goods Sold)
```typescript
// 爬蟲欄位
costOfGoodsSold | costOfRevenue

// 後端欄位
costOfGoodsSold: number

// 單位轉換
TW: value * 1000
US: value
JP: value * 1000000

// 驗證規則
- 必須 >= 0
- 不可為 null（存貨周轉率計算必需）
- 應該 <= revenue
```

### 3.3 淨利 (Net Income)
```typescript
// 爬蟲欄位
netIncome | netProfit

// 後端欄位
netIncome: number

// 單位轉換
TW: value * 1000
US: value
JP: value * 1000000

// 驗證規則
- 可以為負數（虧損）
- 不可為 null（ROE、ROA計算必需）
```

### 3.4 股東權益 (Shareholders Equity)
```typescript
// 爬蟲欄位
shareholdersEquity | stockholdersEquity | totalEquity

// 後端欄位
shareholdersEquity: number

// 單位轉換
TW: value * 1000
US: value
JP: value * 1000000

// 驗證規則
- 可以為負數（資不抵債）
- 不可為 null（ROE計算必需）
- 用於計算時需檢查 > 0
```

### 3.5 每股盈餘 (EPS)
```typescript
// 爬蟲欄位
eps | basicEPS | dilutedEPS

// 後端欄位
eps: number           // 基本每股盈餘
dilutedEPS: number   // 稀釋每股盈餘（建議新增）

// 單位轉換
所有地區：不轉換（已是每股金額）

// 驗證規則
- 可以為負數
- 用於 PE 計算時需檢查 > 0
```

## 4. 單位轉換對照表

### 4.1 台灣 (TW)
| 原始單位 | 目標單位 | 轉換倍數 | 範例 |
|---------|---------|---------|------|
| 仟元 | 元 | ×1000 | 500,000仟元 → 500,000,000元 |
| 元 | 元 | ×1 | 10元 → 10元 |
| % | 小數 | ÷100 | 25% → 0.25 |

### 4.2 美國 (US)
| 原始單位 | 目標單位 | 轉換倍數 | 範例 |
|---------|---------|---------|------|
| USD | USD | ×1 | $1M → $1,000,000 |
| % | 小數 | ÷100 | 15% → 0.15 |

### 4.3 日本 (JP)
| 原始單位 | 目標單位 | 轉換倍數 | 範例 |
|---------|---------|---------|------|
| 百万円 | 円 | ×1,000,000 | 100百万円 → 100,000,000円 |
| 円 | 円 | ×1 | 50円 → 50円 |
| % | 小數 | ÷100 | 3.5% → 0.035 |

## 5. 財務期間格式統一

### 5.1 輸入格式處理
```typescript
// 台灣格式
"2024-Q3" → { fiscalYear: 2024, fiscalQuarter: 3 }
"2024/09" → { fiscalYear: 2024, fiscalMonth: 9 }

// 美國格式
"2024-09-30" → { fiscalYear: 2024, fiscalQuarter: 3 }
"Sep 30, 2024" → { fiscalYear: 2024, fiscalQuarter: 3 }

// 日本格式
"2024/3" → { fiscalYear: 2024, fiscalQuarter: 1 }  // 3月決算
"2024年3月期" → { fiscalYear: 2024, fiscalQuarter: 1 }
```

### 5.2 季度對應規則
```typescript
// 標準季度（1-3月=Q1, 4-6月=Q2, 7-9月=Q3, 10-12月=Q4）
function getQuarter(month: number): number {
  return Math.ceil(month / 3);
}

// 日本財年特殊處理（4月開始）
function getJapanFiscalQuarter(month: number): number {
  if (month >= 4) {
    return Math.ceil((month - 3) / 3);
  } else {
    return 4; // 1-3月屬於Q4
  }
}
```

## 6. 資料驗證規則

### 6.1 基本驗證
```typescript
interface ValidationRule {
  field: string;
  rules: {
    required?: boolean;
    min?: number;
    max?: number;
    nonZero?: boolean;
    nonNegative?: boolean;
  };
}

const VALIDATION_RULES: ValidationRule[] = [
  { field: 'revenue', rules: { required: true, nonNegative: true, nonZero: true } },
  { field: 'costOfGoodsSold', rules: { required: true, nonNegative: true } },
  { field: 'netIncome', rules: { required: true } },
  { field: 'shareholdersEquity', rules: { required: true } },
  { field: 'totalAssets', rules: { required: true, nonNegative: true, nonZero: true } },
  { field: 'eps', rules: { required: true } },
];
```

### 6.2 邏輯一致性驗證
```typescript
interface LogicalValidation {
  validate(data: FundamentalData): ValidationError[];
}

const LOGICAL_VALIDATIONS: LogicalValidation[] = [
  {
    // 資產負債表平衡
    validate: (data) => {
      const diff = Math.abs(data.totalAssets - (data.totalLiabilities + data.shareholdersEquity));
      if (diff > data.totalAssets * 0.01) { // 允許1%誤差
        return [{ field: 'balance_sheet', error: 'Assets != Liabilities + Equity' }];
      }
      return [];
    }
  },
  {
    // 毛利邏輯
    validate: (data) => {
      if (data.grossProfit > data.revenue) {
        return [{ field: 'gross_profit', error: 'Gross profit > Revenue' }];
      }
      return [];
    }
  }
];
```

## 7. 爬蟲端實作指引

### 7.1 標準化輸出結構
```typescript
interface StandardizedFundamentalData {
  // 識別資訊
  symbolCode: string;         // "2330" (不含.TW)
  exchangeArea: string;       // "TW" | "US" | "JP"
  reportDate: string;         // "2024-09-30" ISO格式
  fiscalYear: number;         // 2024
  fiscalQuarter?: number;     // 1-4
  fiscalMonth?: number;       // 1-12
  reportType: string;         // "quarterly" | "annual" | "monthly"
  
  // 財務數據（基礎單位）
  revenue?: number;
  costOfGoodsSold?: number;
  grossProfit?: number;
  operatingIncome?: number;
  netIncome?: number;
  // ... 其他欄位
  
  // 元數據
  dataSource: string;         // "yahoo-finance-tw"
  lastUpdated: string;        // ISO timestamp
  currencyCode: string;       // "TWD" | "USD" | "JPY"
}
```

### 7.2 轉換函數模板
```typescript
export function convertToStandardFormat(
  rawData: any,
  region: 'TW' | 'US' | 'JP'
): StandardizedFundamentalData {
  const standardized: StandardizedFundamentalData = {
    symbolCode: extractSymbolCode(rawData.symbol, region),
    exchangeArea: region,
    reportDate: new Date().toISOString().split('T')[0],
    fiscalYear: extractFiscalYear(rawData.fiscalPeriod),
    fiscalQuarter: extractFiscalQuarter(rawData.fiscalPeriod),
    reportType: 'quarterly',
    dataSource: `yahoo-finance-${region.toLowerCase()}`,
    lastUpdated: new Date().toISOString(),
    currencyCode: REGION_CURRENCY[region],
  };

  // 應用單位轉換
  const multiplier = UNIT_MULTIPLIERS[region];
  
  // 金額類欄位轉換
  if (rawData.revenue !== undefined) {
    standardized.revenue = rawData.revenue * multiplier.amount;
  }
  
  // 比率類欄位轉換
  if (rawData.grossMargin !== undefined) {
    standardized.grossMargin = rawData.grossMargin * multiplier.percentage;
  }
  
  return standardized;
}
```

## 8. 後端處理指引

### 8.1 DTO 驗證裝飾器
```typescript
export class CreateFundamentalDataDto {
  @IsNotEmpty()
  @IsString()
  @Matches(/^[A-Z0-9]+$/)
  symbolCode: string;

  @IsNotEmpty()
  @IsIn(['TW', 'US', 'JP'])
  exchangeArea: string;

  @IsNotEmpty()
  @IsDateString()
  reportDate: string;

  @IsNotEmpty()
  @IsInt()
  @Min(2000)
  @Max(2100)
  fiscalYear: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(4)
  fiscalQuarter?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  revenue?: number;

  @IsOptional()
  @IsNumber()
  costOfGoodsSold?: number;

  // ... 其他欄位驗證
}
```

### 8.2 Service 層處理
```typescript
async upsertFundamentalData(dto: CreateFundamentalDataDto): Promise<FundamentalDataEntity> {
  // 1. 欄位映射處理
  const mappedData = this.mapDtoToEntity(dto);
  
  // 2. 計算衍生指標
  this.calculateDerivedMetrics(mappedData);
  
  // 3. 驗證邏輯一致性
  const errors = this.validateLogicalConsistency(mappedData);
  if (errors.length > 0) {
    throw new BadRequestException(errors);
  }
  
  // 4. Upsert 操作
  return this.fundamentalRepository.upsert(mappedData, {
    conflictPaths: ['symbolCode', 'fiscalYear', 'fiscalQuarter', 'reportType'],
  });
}

private mapDtoToEntity(dto: CreateFundamentalDataDto): Partial<FundamentalDataEntity> {
  return {
    ...dto,
    // 確保關鍵欄位映射
    revenue: dto.revenue || dto.totalRevenue || dto.operatingRevenue,
    netIncome: dto.netIncome || dto.netProfit,
    shareholdersEquity: dto.shareholdersEquity || dto.stockholdersEquity || dto.totalEquity,
    // ... 其他映射邏輯
  };
}
```

## 9. 測試案例

### 9.1 單位轉換測試
```typescript
describe('Unit Conversion', () => {
  it('should convert TW thousands to base unit', () => {
    const input = { revenue: 500000 }; // 500,000 仟元
    const output = convertToStandardFormat(input, 'TW');
    expect(output.revenue).toBe(500000000); // 500,000,000 元
  });

  it('should convert JP millions to base unit', () => {
    const input = { revenue: 1000 }; // 1,000 百万円
    const output = convertToStandardFormat(input, 'JP');
    expect(output.revenue).toBe(1000000000); // 1,000,000,000 円
  });
});
```

### 9.2 欄位映射測試
```typescript
describe('Field Mapping', () => {
  it('should map alternative field names', () => {
    const input = {
      totalRevenue: 1000000,
      netProfit: 100000,
      totalEquity: 500000
    };
    const output = mapDtoToEntity(input);
    expect(output.revenue).toBe(1000000);
    expect(output.netIncome).toBe(100000);
    expect(output.shareholdersEquity).toBe(500000);
  });
});
```

## 10. 版本歷史

| 版本 | 日期 | 修改內容 |
|------|------|---------|
| 1.0 | 2025-01-06 | 初始版本，定義基本映射規則 |

---

**文件結束**