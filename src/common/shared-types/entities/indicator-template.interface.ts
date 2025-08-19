import { IndicatorEntity } from '../entities/indicator.interface';

export interface IndicatorTemplateEntity {
  id: number;
  indicatorId: number;
  templateType: string;
  templateValues: Record<string, unknown>;
  createdAt: Date;
  indicator: IndicatorEntity;
}
