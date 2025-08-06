# 爬蟲資料標準化與後端整合 PRD

**文件版本**: 1.0  
**撰寫日期**: 2025-08-06  
**作者**: AI Assistant  
**專案**: AHA 智投系統 - 爬蟲與後端資料整合

## 1. 專案概述

### 1.1 背景說明

AHA 智投系統目前使用爬蟲系統從 Yahoo Finance 各地區（台灣、美國、日本）抓取財務資料，但爬蟲輸出的 JSON 格式各異，無法直接匯入後端的 `FundamentalDataEntity` 資料表。需要建立一個標準化的資料轉換和匯入流程。

### 1.2 目標與價值

- **主要目標**：建立爬蟲資料到後端資料庫的自動化匯入流程
- **商業價值**：
  - 減少手動資料處理時間 90%
  - 確保資料格式一致性
  - 支援即時更新財務資料
  - 提高資料準確性

### 1.3 範圍定義

**包含範圍**：
- Yahoo Finance 台灣、美國、日本的財務資料
- 資產負債表、損益表、現金流量表、EPS 等財務報表
- 資料標準化轉換邏輯
- 後端匯入 API 開發
- Upsert 機制實作

**不包含範圍**：
- 其他資料來源（如 MoneyDJ）
- 即時股價資料
- 歷史資料回補

## 2. 現況分析

### 2.1 爬蟲系統架構

```
@crawler/
├── config/              # 爬蟲配置檔案
├── output/              # JSON 輸出檔案
└── src/transforms/sites/ # 資料轉換函數
    ├── yahoo-finance-tw.ts
    ├── yahoo-finance-us.ts
    └── yahoo-finance-jp.ts
```

### 2.2 爬蟲輸出格式

#### 台灣 (TW)
```typescript
interface TWCashFlowData {
  fiscalPeriod: string;        // "2024-Q3"
  operatingCashFlow?: number;  // 仟元
  investingCashFlow?: number;  // 仟元
  // ...
}
```

#### 美國 (US)
```typescript
interface USFinancialData {
  fiscalPeriod: string;        // "2024-09-30"
  totalRevenue?: number;       // 美元
  grossProfit?: number;        // 美元
  // ...
}
```

#### 日本 (JP)
```typescript
interface FinancialData {
  fiscalPeriod: string;        // "2024/3"
  revenue?: number;            // 百万円
  eps?: number;               // 円
  // ...
}
```

### 2.3 後端資料結構

```typescript
@Entity('fundamental_data')
export class FundamentalDataEntity {
  @PrimaryColumn() id: string;
  @Column() symbolCode: string;
  @Column() exchangeArea: string;
  @Column() reportDate: Date;
  @Column() fiscalYear: number;
  @Column() fiscalQuarter?: number;
  @Column() reportType: FiscalReportType;
  
  // 財務數據（統一以基礎單位儲存）
  @Column() revenue?: number;         // 元/美元/円
  @Column() operatingCashFlow?: number;
  // ... 60+ 財務指標欄位
}
```

### 2.4 痛點與問題

1. **格式不一致**：各地區資料格式差異大
2. **單位不統一**：仟元、百万円、美元混用
3. **期間格式差異**：2024-Q3、2024/3、2024-09-30
4. **無驗證機制**：資料完整性無法保證
5. **手動處理**：需要人工轉換和匯入

## 3. 解決方案設計

### 3.1 架構設計

```
爬蟲系統                          後端系統
┌─────────────────┐              ┌─────────────────┐
│ Yahoo Finance   │              │ NestJS API      │
│ Crawler         │              │                 │
├─────────────────┤              ├─────────────────┤
│ Transform       │              │ DTO Validation  │
│ Functions       │              │                 │
│ ┌─────────────┐ │              │ ┌─────────────┐ │
│ │Standardized │ │   HTTP POST  │ │Import API   │ │
│ │Output       │ ├──────────────> │Controller   │ │
│ └─────────────┘ │              │ └─────────────┘ │
└─────────────────┘              │        ↓        │
                                 │ ┌─────────────┐ │
                                 │ │Upsert       │ │
                                 │ │Service      │ │
                                 │ └─────────────┘ │
                                 │        ↓        │
                                 │ ┌─────────────┐ │
                                 │ │PostgreSQL   │ │
                                 │ │Database     │ │
                                 │ └─────────────┘ │
                                 └─────────────────┘
```

### 3.2 資料流程

1. **爬蟲執行**：抓取 Yahoo Finance 資料
2. **資料轉換**：在 transform 函數中轉為標準格式
3. **輸出 JSON**：儲存標準化的 JSON 檔案
4. **API 呼叫**：匯入腳本讀取 JSON 並呼叫後端 API
5. **資料驗證**：DTO 驗證資料完整性
6. **Upsert 處理**：新增或更新資料庫記錄

### 3.3 標準化資料格式

```typescript
interface StandardizedFundamentalData {
  // 基本資訊
  symbolCode: string;        // "2330" (不含 .TW)
  exchangeArea: string;      // "TW" | "US" | "JP"
  reportDate: string;        // "2024-09-30" (ISO 格式)
  fiscalYear: number;        // 2024
  fiscalQuarter?: number;    // 1-4
  fiscalMonth?: number;      // 1-12 (月度資料)
  reportType: string;        // "quarterly" | "annual" | "monthly"
  
  // 財務數據（統一單位）
  revenue?: number;          // 基礎單位（元/美元/円）
  grossProfit?: number;
  operatingCashFlow?: number;
  // ... 其他欄位
  
  // 財務比率（小數格式）
  grossMargin?: number;      // 0.25 = 25%
  roe?: number;             // 0.15 = 15%
  currentRatio?: number;     // 1.5 = 1.5倍
  
  // 元數據
  dataSource: string;        // "yahoo-finance-tw"
  lastUpdated: string;       // ISO timestamp
}
```

## 4. 實施細節

### 4.1 爬蟲端改動

#### 4.1.1 轉換函數實作

**檔案位置**：`@crawler/src/transforms/sites/yahoo-finance-tw.ts`

```typescript
// 新增標準化轉換函數
export const toStandardizedFundamentalData = {
  fromCashFlow: (data: TWCashFlowData, symbolCode: string): StandardizedFundamentalData => {
    const [year, quarter] = parseFiscalPeriod(data.fiscalPeriod);
    
    return {
      symbolCode: symbolCode.replace('.TW', ''),
      exchangeArea: 'TW',
      reportDate: new Date().toISOString().split('T')[0],
      fiscalYear: year,
      fiscalQuarter: quarter,
      reportType: 'quarterly',
      
      // 單位轉換：仟元 → 元
      operatingCashFlow: data.operatingCashFlow ? data.operatingCashFlow * 1000 : undefined,
      investingCashFlow: data.investingCashFlow ? data.investingCashFlow * 1000 : undefined,
      financingCashFlow: data.financingCashFlow ? data.financingCashFlow * 1000 : undefined,
      freeCashFlow: data.freeCashFlow ? data.freeCashFlow * 1000 : undefined,
      netCashFlow: data.netCashFlow ? data.netCashFlow * 1000 : undefined,
      
      dataSource: 'yahoo-finance-tw',
      lastUpdated: new Date().toISOString()
    };
  }
};
```

#### 4.1.2 配置檔案更新

**檔案**：`config/templates/yahoo-finance-tw-cash-flow-statement.json`

```json
{
  "selectors": {
    // 現有選擇器...
    "standardizedData": {
      "selector": "body",
      "multiple": false,
      "transform": "toStandardizedCashFlowData"
    }
  }
}
```

### 4.2 後端 API 設計

#### 4.2.1 DTO 定義

**檔案**：`@finance-strategy/src/common/dtos/fundamental-data.dto.ts`

```typescript
import { IsString, IsNumber, IsOptional, IsEnum, IsDateString, ValidateNested, Type } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { FiscalReportType } from '../shared-types';

export class CreateFundamentalDataDto {
  @ApiProperty({ description: '股票代碼' })
  @IsString()
  @IsNotEmpty()
  symbolCode: string;

  @ApiProperty({ description: '交易所區域', enum: ['TW', 'US', 'JP'] })
  @IsString()
  @IsNotEmpty()
  exchangeArea: string;

  @ApiProperty({ description: '報告日期', example: '2024-09-30' })
  @IsDateString()
  @IsNotEmpty()
  reportDate: string;

  @ApiProperty({ description: '財務年度' })
  @IsNumber()
  @IsNotEmpty()
  fiscalYear: number;

  @ApiProperty({ description: '財務季度', required: false })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(4)
  fiscalQuarter?: number;

  @ApiProperty({ description: '報表類型' })
  @IsEnum(FiscalReportType)
  @IsNotEmpty()
  reportType: FiscalReportType;

  // 財務數據欄位
  @ApiProperty({ description: '營業收入', required: false })
  @IsOptional()
  @IsNumber()
  revenue?: number;

  @ApiProperty({ description: '營業現金流', required: false })
  @IsOptional()
  @IsNumber()
  operatingCashFlow?: number;

  // ... 其他財務欄位

  @ApiProperty({ description: '資料來源' })
  @IsString()
  @IsNotEmpty()
  dataSource: string;

  @ApiProperty({ description: '最後更新時間' })
  @IsDateString()
  @IsNotEmpty()
  lastUpdated: string;
}

export class ImportFundamentalDataDto {
  @ApiProperty({ 
    description: '基本面資料陣列',
    type: [CreateFundamentalDataDto]
  })
  @ValidateNested({ each: true })
  @Type(() => CreateFundamentalDataDto)
  data: CreateFundamentalDataDto[];
}
```

#### 4.2.2 Controller 實作

**檔案**：`@finance-strategy/src/fundamental-data/fundamental-data.controller.ts`

```typescript
@Controller('api/fundamental-data')
@ApiTags('Fundamental Data')
export class FundamentalDataController {
  constructor(
    private readonly fundamentalDataService: FundamentalDataService
  ) {}

  @Post('import')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: '批量匯入基本面資料' })
  @ApiResponse({ status: 201, description: '匯入成功' })
  @ApiResponse({ status: 400, description: '資料驗證失敗' })
  async importData(@Body() dto: ImportFundamentalDataDto) {
    return this.fundamentalDataService.importFundamentalData(dto.data);
  }

  @Post('upsert')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: '新增或更新單筆基本面資料' })
  async upsertData(@Body() dto: CreateFundamentalDataDto) {
    return this.fundamentalDataService.upsertFundamentalData(dto);
  }
}
```

#### 4.2.3 Service 實作

```typescript
@Injectable()
export class FundamentalDataService {
  constructor(
    @InjectRepository(FundamentalDataEntity)
    private readonly fundamentalRepository: Repository<FundamentalDataEntity>,
    @InjectRepository(SymbolEntity)
    private readonly symbolRepository: Repository<SymbolEntity>
  ) {}

  async upsertFundamentalData(dto: CreateFundamentalDataDto): Promise<FundamentalDataEntity> {
    // 1. 查找 symbol
    const symbol = await this.symbolRepository.findOne({
      where: { 
        code: dto.symbolCode,
        exchangeArea: dto.exchangeArea as MarketRegion
      }
    });

    if (!symbol) {
      throw new BadRequestException(
        `Symbol ${dto.symbolCode} not found in ${dto.exchangeArea}`
      );
    }

    // 2. 建立唯一鍵條件
    const whereCondition: any = {
      symbolCode: dto.symbolCode,
      fiscalYear: dto.fiscalYear,
      reportType: dto.reportType
    };

    if (dto.fiscalQuarter) {
      whereCondition.fiscalQuarter = dto.fiscalQuarter;
    }
    if (dto.fiscalMonth) {
      whereCondition.fiscalMonth = dto.fiscalMonth;
    }

    // 3. 查找現有記錄
    const existing = await this.fundamentalRepository.findOne({
      where: whereCondition
    });

    // 4. Upsert 處理
    const dataToSave = {
      ...dto,
      symbolId: symbol.id,
      exchangeArea: dto.exchangeArea,
      reportDate: new Date(dto.reportDate),
      lastUpdated: new Date(dto.lastUpdated),
      updatedAt: new Date()
    };

    if (existing) {
      // 更新現有記錄
      Object.assign(existing, dataToSave);
      return this.fundamentalRepository.save(existing);
    } else {
      // 創建新記錄
      const newData = this.fundamentalRepository.create(dataToSave);
      return this.fundamentalRepository.save(newData);
    }
  }

  async importFundamentalData(
    dtos: CreateFundamentalDataDto[]
  ): Promise<{ success: number; failed: number; errors: any[] }> {
    const results = {
      success: 0,
      failed: 0,
      errors: []
    };

    for (const dto of dtos) {
      try {
        await this.upsertFundamentalData(dto);
        results.success++;
      } catch (error) {
        results.failed++;
        results.errors.push({
          symbolCode: dto.symbolCode,
          fiscalPeriod: `${dto.fiscalYear}-Q${dto.fiscalQuarter || ''}`,
          error: error.message
        });
      }
    }

    return results;
  }
}
```

### 4.3 資料對應表

#### 4.3.1 損益表欄位對應

| 爬蟲欄位 | 後端欄位 | TW單位轉換 | US單位轉換 | JP單位轉換 | 計算依賴 |
|---------|----------|-----------|-----------|-----------|----------|
| revenue/totalRevenue/operatingRevenue | revenue | ×1000(仟元→元) | 不轉換 | ×1000000(百万円→円) | 毛利率、營業利益率、淨利率、周轉率計算 |
| costOfRevenue/costOfGoodsSold | costOfGoodsSold | ×1000 | 不轉換 | ×1000000 | **存貨周轉率計算必需** |
| grossProfit | grossProfit | ×1000 | 不轉換 | ×1000000 | 毛利率計算 |
| operatingExpenses | operatingExpenses | ×1000 | 不轉換 | ×1000000 | - |
| operatingIncome/operatingProfit | operatingIncome | ×1000 | 不轉換 | ×1000000 | 營業利益率計算 |
| incomeBeforeTax/pretaxIncome | **建議新增** incomeBeforeTax | ×1000 | 不轉換 | ×1000000 | 稅務分析 |
| incomeTax/taxProvision | taxExpense/incomeTax | ×1000 | 不轉換 | ×1000000 | 稅後淨利計算 |
| netIncome/netProfit | netIncome | ×1000 | 不轉換 | ×1000000 | ROE、ROA、淨利率計算 |
| ebitda | ebitda | ×1000 | 不轉換 | ×1000000 | EBITDA利潤率 |
| basicEPS/eps | eps | 不轉換 | 不轉換 | 不轉換 | PE比率、EPS成長率計算 |
| dilutedEPS | **建議新增** dilutedEPS | 不轉換 | 不轉換 | - | 稀釋每股盈餘分析 |

#### 4.3.2 資產負債表欄位對應

| 爬蟲欄位 | 後端欄位 | TW單位轉換 | US單位轉換 | JP單位轉換 | 計算依賴 |
|---------|----------|-----------|-----------|-----------|----------|
| totalAssets | totalAssets | ×1000 | 不轉換 | ×1000000 | ROA、資產周轉率計算 |
| currentAssets | currentAssets | ×1000 | 不轉換 | ×1000000 | 流動比率計算 |
| cashAndEquivalents | cashAndEquivalents | ×1000 | 不轉換 | ×1000000 | 現金比率計算 |
| accountsReceivable | accountsReceivable | ×1000 | 不轉換 | ×1000000 | 應收帳款周轉率計算 |
| inventory | inventory | ×1000 | 不轉換 | ×1000000 | 存貨周轉率計算 |
| propertyPlantEquipment | **建議新增** propertyPlantEquipment | ×1000 | - | - | 重資產分析 |
| intangibleAssets | **建議新增** intangibleAssets | ×1000 | - | - | 無形資產分析 |
| totalLiabilities | totalLiabilities | ×1000 | 不轉換 | ×1000000 | 負債比率計算 |
| currentLiabilities | currentLiabilities | ×1000 | 不轉換 | ×1000000 | 流動比率計算 |
| accountsPayable | accountsPayable | ×1000 | 不轉換 | ×1000000 | 應付帳款分析 |
| shortTermDebt | shortTermDebt | ×1000 | 不轉換 | ×1000000 | 短期償債能力 |
| longTermDebt | longTermDebt | ×1000 | 不轉換 | ×1000000 | 長期負債結構 |
| totalDebt | totalDebt | ×1000 | 不轉換 | ×1000000 | 負債權益比計算 |
| shareholdersEquity/stockholdersEquity/totalEquity | shareholdersEquity | ×1000 | 不轉換 | ×1000000 | ROE、權益周轉率計算 |
| retainedEarnings | **建議新增** retainedEarnings | ×1000 | - | - | 保留盈餘分析 |
| bookValuePerShare | bookValuePerShare | 不轉換 | 不轉換 | 不轉換 | PB比率計算 |
| capital | **建議新增至regionalData** | - | - | ×1000000 | 日本資本金分析 |

#### 4.3.3 現金流量表欄位對應

| 爬蟲欄位 | 後端欄位 | TW單位轉換 | US單位轉換 | JP單位轉換 | 計算依賴 |
|---------|----------|-----------|-----------|-----------|----------|
| operatingCashFlow | operatingCashFlow | ×1000 | 不轉換 | - | 現金流分析 |
| investingCashFlow | investingCashFlow | ×1000 | 不轉換 | - | 投資活動分析 |
| financingCashFlow | financingCashFlow | ×1000 | 不轉換 | - | 融資活動分析 |
| freeCashFlow | freeCashFlow | ×1000 | 不轉換 | - | FCF殖利率計算 |
| netCashFlow | netCashFlow | ×1000 | - | - | 淨現金流分析 |
| capex/capitalExpenditure | capex | ×1000 | 不轉換 | - | 資本支出分析 |
| debtIssuance/issuanceOfDebt | **建議新增** debtIssuance | ×1000 | 不轉換 | - | 債務融資分析 |
| debtRepayment/repaymentOfDebt | **建議新增** debtRepayment | ×1000 | 不轉換 | - | 債務償還分析 |
| dividendPayments | **建議新增** dividendPayments | ×1000 | 不轉換 | - | 股利支付分析 |

#### 4.3.4 市場數據欄位對應

| 爬蟲欄位 | 後端欄位 | TW單位轉換 | US單位轉換 | JP單位轉換 | 計算依賴 |
|---------|----------|-----------|-----------|-----------|----------|
| sharesOutstanding | sharesOutstanding | 不轉換 | 不轉換 | 不轉換 | 市值、PS比率計算 |
| marketCap | marketCap | ×1000 | 不轉換 | ×1000000 | 市值分析 |
| dividendPerShare/cashDividend | dividendPerShare | 不轉換 | 不轉換 | 不轉換 | 股息殖利率計算 |

#### 4.3.5 財務比率欄位對應（後端計算，爬蟲可提供但會重算）

| 爬蟲欄位 | 後端欄位 | 單位格式 | 說明 |
|---------|----------|----------|------|
| peRatio | peRatio | 倍數 | 本益比 |
| pbRatio | pbRatio | 倍數 | 股價淨值比 |
| roe | roe | 小數(0.15=15%) | 股東權益報酬率 |
| roa | roa | 小數(0.05=5%) | 資產報酬率 |
| grossMargin | grossMargin | 小數(0.25=25%) | 毛利率 |
| operatingMargin | operatingMargin | 小數(0.30=30%) | 營業利益率 |
| netMargin | netMargin | 小數(0.25=25%) | 淨利率 |
| currentRatio | currentRatio | 倍數 | 流動比率 |
| debtToEquity | debtToEquity | 倍數 | 負債權益比 |
| dividendYield/cashYield | dividendYield | 小數(0.035=3.5%) | 股息殖利率 |

#### 4.3.6 地區特有欄位建議

| 地區 | 特有欄位 | 建議處理方式 |
|------|---------|-------------|
| 日本 | ordinaryProfit(經常利益) | 新增 regionalData JSON 欄位儲存 |
| 日本 | ordinaryMargin(經常利益率) | 新增 regionalData JSON 欄位儲存 |
| 日本 | equityRatio(自有資本比率) | 新增 regionalData JSON 欄位儲存 |
| 台灣 | cumulativeRevenue(累計營收) | 不儲存，可自行計算 |
| 美國 | 各種細項收支 | 視重要性決定是否新增欄位 |

### 4.4 財務指標計算依賴說明

#### 4.4.1 必須存在的欄位（計算核心依賴）

以下欄位是後端計算各種財務指標的必要欄位，**必須**確保爬蟲提供並正確映射：

| 欄位名稱 | 計算依賴的指標 | 影響範圍 |
|---------|---------------|----------|
| **revenue** | 毛利率、營業利益率、淨利率、PS比率、所有周轉率 | 所有獲利能力和效率指標 |
| **costOfGoodsSold** | 存貨周轉率 | 營運效率分析 |
| **netIncome** | ROE、ROA、淨利率、淨利成長率 | 獲利能力核心指標 |
| **shareholdersEquity** | ROE、負債權益比、權益周轉率 | 股東權益報酬分析 |
| **totalAssets** | ROA、資產周轉率、負債比率 | 資產使用效率分析 |
| **eps** | PE比率、EPS成長率 | 每股價值分析 |
| **dividendPerShare** | 股息殖利率 | 股利報酬分析 |
| **sharesOutstanding** | PS比率、市值計算 | 市場估值分析 |

#### 4.4.2 計算公式與欄位需求

**估值指標：**
- PE Ratio = Price / EPS（需要：eps）
- PB Ratio = Price / BookValuePerShare（需要：bookValuePerShare）
- PS Ratio = MarketCap / Revenue = (Price × SharesOutstanding) / Revenue（需要：revenue, sharesOutstanding）
- Dividend Yield = DividendPerShare / Price（需要：dividendPerShare）

**獲利能力指標：**
- ROE = NetIncome / ShareholdersEquity（需要：netIncome, shareholdersEquity）
- ROA = NetIncome / TotalAssets（需要：netIncome, totalAssets）
- Gross Margin = GrossProfit / Revenue（需要：grossProfit, revenue）
- Operating Margin = OperatingIncome / Revenue（需要：operatingIncome, revenue）
- Net Margin = NetIncome / Revenue（需要：netIncome, revenue）

**財務結構指標：**
- Debt-to-Equity = TotalDebt / ShareholdersEquity（需要：totalDebt, shareholdersEquity）
- Current Ratio = CurrentAssets / CurrentLiabilities（需要：currentAssets, currentLiabilities）
- Debt Ratio = TotalDebt / TotalAssets（需要：totalDebt, totalAssets）

**營運效率指標：**
- Inventory Turnover = CostOfGoodsSold / Inventory（需要：**costOfGoodsSold**, inventory）
- Receivables Turnover = Revenue / AccountsReceivable（需要：revenue, accountsReceivable）
- Asset Turnover = Revenue / TotalAssets（需要：revenue, totalAssets）
- Equity Turnover = Revenue / ShareholdersEquity（需要：revenue, shareholdersEquity）

**成長性指標（需要歷史資料）：**
- Revenue Growth YoY = (CurrentRevenue - PreviousRevenue) / PreviousRevenue
- EPS Growth YoY = (CurrentEPS - PreviousEPS) / PreviousEPS
- Net Income Growth YoY = (CurrentNetIncome - PreviousNetIncome) / PreviousNetIncome

#### 4.4.3 欄位改名對計算的影響

當進行欄位映射時，必須確保以下對應關係正確，否則計算會失敗：

| 原爬蟲欄位 | 映射到後端欄位 | 受影響的計算 |
|-----------|---------------|-------------|
| costOfRevenue (US) | costOfGoodsSold | calculateInventoryTurnover() |
| netProfit (JP) | netIncome | calculateROE(), calculateROA(), calculateNetMargin() |
| totalEquity/stockholdersEquity (TW) | shareholdersEquity | calculateROE(), calculateDebtToEquity() |
| basicEPS/dilutedEPS | eps | calculatePE(), calculateEPSGrowth() |

#### 4.4.4 建議的資料驗證規則

在爬蟲端和後端都應該實施以下驗證：

1. **非負數驗證**：revenue, totalAssets, shareholdersEquity 等不應為負數
2. **非零驗證**：用於除數的欄位（如 revenue, totalAssets）不應為零
3. **合理範圍**：
   - 比率類：應在 0-10 之間（如 currentRatio）
   - 百分比類：應在 -1 到 1 之間（如 margins, growth rates）
   - 倍數類：應在合理範圍內（如 PE ratio 通常在 0-100）
4. **邏輯一致性**：
   - totalAssets ≥ currentAssets
   - totalLiabilities + shareholdersEquity ≈ totalAssets
   - grossProfit ≤ revenue

## 5. 開發計劃

### 5.1 階段劃分

#### Phase 1：爬蟲端改造（3天）
- [ ] 實作標準化轉換函數
- [ ] 更新配置檔案模板
- [ ] 測試各地區資料轉換

#### Phase 2：後端 API 開發（3天）
- [ ] 建立 DTO 和驗證規則
- [ ] 實作 Controller 和 Service
- [ ] 實作 Upsert 邏輯
- [ ] 單元測試和整合測試

#### Phase 3：匯入腳本開發（2天）
- [ ] 建立匯入腳本
- [ ] 實作批量處理邏輯
- [ ] 錯誤處理和重試機制

#### Phase 4：測試與部署（2天）
- [ ] 端到端測試
- [ ] 效能測試
- [ ] 部署到生產環境

### 5.2 驗收標準

1. **功能驗收**
   - 支援台灣、美國、日本三地區資料匯入
   - 實現 Upsert 機制，避免重複資料
   - 資料單位正確轉換

2. **效能驗收**
   - 單筆資料匯入 < 100ms
   - 批量匯入 1000 筆 < 30秒
   - API 並發處理能力 > 10 req/s

3. **品質驗收**
   - 單元測試覆蓋率 > 80%
   - 資料驗證錯誤率 < 1%
   - 零資料遺失

## 6. 風險評估

### 6.1 技術風險

| 風險項目 | 影響程度 | 發生機率 | 緩解措施 |
|---------|---------|---------|---------|
| 資料格式變更 | 高 | 中 | 建立格式監控機制 |
| 大量資料匯入效能 | 中 | 高 | 實作批次處理和佇列 |
| 單位轉換錯誤 | 高 | 低 | 完整測試覆蓋 |

### 6.2 資料一致性

- **問題**：並發更新可能造成資料不一致
- **解決**：使用資料庫事務和樂觀鎖

### 6.3 錯誤處理

- **爬蟲失敗**：保留原始資料，記錄錯誤日誌
- **API 失敗**：實作重試機制（3次）
- **驗證失敗**：返回詳細錯誤訊息

## 7. 附錄

### 7.1 相關文件
- [爬蟲系統 CLAUDE.md](@crawler/CLAUDE.md)
- [後端系統 CLAUDE.md](@finance-strategy/CLAUDE.md)
- [FundamentalDataEntity 定義](@finance-strategy/src/common/entities/fundamental-data.entity.ts)

### 7.2 API 範例

**請求範例**：
```bash
curl -X POST http://localhost:3000/api/fundamental-data/import \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "data": [{
      "symbolCode": "2330",
      "exchangeArea": "TW",
      "reportDate": "2024-09-30",
      "fiscalYear": 2024,
      "fiscalQuarter": 3,
      "reportType": "quarterly",
      "revenue": 500000000000,
      "operatingCashFlow": 200000000000,
      "grossMargin": 0.53,
      "dataSource": "yahoo-finance-tw",
      "lastUpdated": "2024-10-15T08:00:00Z"
    }]
  }'
```

**回應範例**：
```json
{
  "success": 1,
  "failed": 0,
  "errors": []
}
```

### 7.3 測試案例

1. **正常匯入測試**
   - 新資料匯入
   - 現有資料更新
   - 批量匯入

2. **異常處理測試**
   - 缺少必要欄位
   - 資料類型錯誤
   - 股票代碼不存在

3. **邊界測試**
   - 極大數值
   - 負數處理
   - 空值處理

## 8. 後端 Entity 欄位更新計劃

### 8.1 必須新增的欄位

基於計算依賴分析，以下欄位必須新增到 `FundamentalDataEntity`：

```typescript
// 損益表相關
@Column({ name: 'income_before_tax', type: 'decimal', precision: 15, scale: 2, nullable: true })
incomeBeforeTax?: number; // 稅前淨利

@Column({ name: 'income_tax', type: 'decimal', precision: 15, scale: 2, nullable: true })
incomeTax?: number; // 所得稅（與 taxExpense 並存）

@Column({ name: 'diluted_eps', type: 'decimal', precision: 10, scale: 4, nullable: true })
dilutedEPS?: number; // 稀釋每股盈餘

// 資產負債表相關
@Column({ name: 'property_plant_equipment', type: 'decimal', precision: 15, scale: 2, nullable: true })
propertyPlantEquipment?: number; // 不動產廠房設備

@Column({ name: 'intangible_assets', type: 'decimal', precision: 15, scale: 2, nullable: true })
intangibleAssets?: number; // 無形資產

@Column({ name: 'retained_earnings', type: 'decimal', precision: 15, scale: 2, nullable: true })
retainedEarnings?: number; // 保留盈餘

// 現金流相關
@Column({ name: 'debt_issuance', type: 'decimal', precision: 15, scale: 2, nullable: true })
debtIssuance?: number; // 債務發行

@Column({ name: 'debt_repayment', type: 'decimal', precision: 15, scale: 2, nullable: true })
debtRepayment?: number; // 債務償還

@Column({ name: 'dividend_payments', type: 'decimal', precision: 15, scale: 2, nullable: true })
dividendPayments?: number; // 股利支付

// 地區特有資料
@Column({ name: 'regional_data', type: 'jsonb', nullable: true })
regionalData?: {
  // 日本特有
  ordinaryProfit?: number;     // 經常利益
  ordinaryMargin?: number;     // 經常利益率
  equityRatio?: number;        // 自有資本比率
  capital?: number;            // 資本金
  // 其他地區特有欄位...
};
```

### 8.2 Migration 檔案範例

```typescript
// 1234567890123-add-fundamental-data-fields.ts
export class AddFundamentalDataFields1234567890123 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 新增損益表欄位
    await queryRunner.query(`
      ALTER TABLE "fundamental_data" 
      ADD COLUMN "income_before_tax" decimal(15,2),
      ADD COLUMN "income_tax" decimal(15,2),
      ADD COLUMN "diluted_eps" decimal(10,4)
    `);

    // 新增資產負債表欄位
    await queryRunner.query(`
      ALTER TABLE "fundamental_data" 
      ADD COLUMN "property_plant_equipment" decimal(15,2),
      ADD COLUMN "intangible_assets" decimal(15,2),
      ADD COLUMN "retained_earnings" decimal(15,2)
    `);

    // 新增現金流欄位
    await queryRunner.query(`
      ALTER TABLE "fundamental_data" 
      ADD COLUMN "debt_issuance" decimal(15,2),
      ADD COLUMN "debt_repayment" decimal(15,2),
      ADD COLUMN "dividend_payments" decimal(15,2)
    `);

    // 新增地區特有資料 JSONB 欄位
    await queryRunner.query(`
      ALTER TABLE "fundamental_data" 
      ADD COLUMN "regional_data" jsonb
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 移除所有新增欄位
    await queryRunner.query(`
      ALTER TABLE "fundamental_data" 
      DROP COLUMN "income_before_tax",
      DROP COLUMN "income_tax",
      DROP COLUMN "diluted_eps",
      DROP COLUMN "property_plant_equipment",
      DROP COLUMN "intangible_assets",
      DROP COLUMN "retained_earnings",
      DROP COLUMN "debt_issuance",
      DROP COLUMN "debt_repayment",
      DROP COLUMN "dividend_payments",
      DROP COLUMN "regional_data"
    `);
  }
}
```

### 8.3 FundamentalAnalysisService 更新

計算服務需要處理新的欄位名稱和邏輯：

```typescript
// 更新 calculateCurrentRatio 使用真實的流動資產/負債
private calculateCurrentRatio(data: FundamentalDataEntity): number | null {
  if (!data.currentAssets || !data.currentLiabilities || data.currentLiabilities <= 0) {
    return null;
  }
  return data.currentAssets / data.currentLiabilities;
}

// 確保 costOfGoodsSold 欄位存在性檢查
private calculateInventoryTurnover(data: FundamentalDataEntity): number | null {
  if (!data.costOfGoodsSold || !data.inventory || data.inventory <= 0) {
    this.logger.warn(`Missing costOfGoodsSold or inventory for inventory turnover calculation`);
    return null;
  }
  return data.costOfGoodsSold / data.inventory;
}
```

---

**文件結束**
