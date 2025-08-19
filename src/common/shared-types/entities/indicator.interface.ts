import { IndicatorCategoryEntity } from '../entities/indicator-category.interface';
import { IndicatorParameterEntity } from '../entities/indicator-parameter.interface';
import { IndicatorTemplateEntity } from '../entities/indicator-template.interface';
import { EntityLabelEntity } from '../entities/entity-label.interface';
import { LabelEntity } from '../entities/label.interface';

export interface IndicatorEntity {
  id: number;
  type: string;
  name: string;
  description?: string;
  icon?: string;
  categoryId: number;
  contextModes: string[];
  matchSignature?: string;
  signatureTemplate?: string;
  isActive: boolean;
  displayOrder: number;
  createdAt: Date;
  updatedAt: Date;
  category: IndicatorCategoryEntity;
  parameters: IndicatorParameterEntity[];
  templates: IndicatorTemplateEntity[];
  entityLabels?: EntityLabelEntity[];
  labels?: LabelEntity[];
}
