export interface IndicatorCategoryDto {
  id: number;
  name: string;
  type: string;
  description?: string;
  parentId?: number;
  displayOrder: number;
  isActive: boolean;
}

export interface IndicatorDto {
  id: number;
  type: string;
  name: string;
  description?: string;
  icon?: string;
  category: string;
  categoryId: number;
  contextModes: string[];
  displayOrder: number;
  isActive: boolean;
}

export interface IndicatorParameterDto {
  indicatorType: string;
  parameterId: string;
  name: string;
  description?: string;
  parameterType: string;
  minValue?: number;
  maxValue?: number;
  stepValue?: number;
  defaultValue?: number;
  unit?: string;
  suggestedValues: number[];
  impactType: string;
  displayOrder: number;
}

export interface IndicatorTemplateDto {
  indicatorType: string;
  templateType: string;
  templateValues: Record<string, unknown>;
}

export interface IndicatorParameterRangeDto {
  min: number;
  max: number;
  step: number;
  default: number;
  suggested: number[];
  unit?: string;
}

export interface IndicatorParameterExampleDto {
  value: number;
  label: string;
  description: string;
}

export interface UnifiedIndicatorParameterDto {
  id: string;
  name: string;
  description: string;
  type: string;
  range: IndicatorParameterRangeDto;
  category: string;
  impact: string;
  examples: IndicatorParameterExampleDto[];
}

export interface IndicatorFullConfigDto {
  indicatorTypes: string[];
  templateTypes: string[];
  indicatorCategories: IndicatorCategoryDto[];
  indicators: IndicatorDto[];
  parameters: Record<string, IndicatorParameterDto[]>;
  templates: Record<string, Record<string, unknown>>;
  technicalTemplates: Record<string, Record<string, unknown>>;
  momentumTemplates: Record<string, Record<string, unknown>>;
  fundamentalTemplates: Record<string, Record<string, unknown>>;
  strategyDefaults: {
    conservative: Record<string, unknown>;
    standard: Record<string, unknown>;
    aggressive: Record<string, unknown>;
  };
  conditionTemplates: {
    long: Record<string, unknown>[];
    short: Record<string, unknown>[];
    neutral: Record<string, unknown>[];
  };
}

export interface ApiResponseDto<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

