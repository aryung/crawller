import { ConditionGroup, MarketRegion, ScopeType } from '..';

export interface CreateConditionDto {
  name: string;
  description?: string;
  conditionExpression?: string;
  conditionGroup?: ConditionGroup;
  category?: string;
  marketRegion?: MarketRegion;
  applicableSymbols?: string[] | null;
  excludedSymbols?: string[] | null;
  scopeType?: ScopeType;
  isPublic?: boolean;
  tags?: string[] | null;
}

export interface UpdateConditionDto {
  name?: string;
  description?: string;
  conditionExpression?: string;
  conditionGroup?: ConditionGroup;
  category?: string;
  marketRegion?: MarketRegion;
  applicableSymbols?: string[] | null;
  excludedSymbols?: string[] | null;
  scopeType?: ScopeType;
  isActive?: boolean;
  isPublic?: boolean;
  tags?: string[] | null;
}

export interface DuplicateConditionDto {
  newName: string;
}

export interface ConvertAlertToTemplateDto {
  name: string;
  description?: string;
  category?: string;
  isPublic?: boolean;
  tags?: string[] | null;
}

export interface ConvertAlertToTemplateResponseDto {
  success: boolean;
  templateId?: string;
  message: string;
  error?: string;
}

