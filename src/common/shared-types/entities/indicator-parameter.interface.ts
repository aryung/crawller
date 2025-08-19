import { IndicatorEntity } from '../entities/indicator.interface';

export interface IndicatorParameterEntity {
  id: number;
  indicatorId: number;
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
  isActive: boolean;
  createdAt: Date;
  indicator: IndicatorEntity;
}
