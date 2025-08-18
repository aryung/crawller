import { IndicatorEntity } from '../entities/indicator.interface';

export interface IndicatorCategoryEntity {
  id: number;
  name: string;
  type: string;
  description?: string;
  parentId?: number;
  displayOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  parent?: IndicatorCategoryEntity;
  children: IndicatorCategoryEntity[];
  indicators: IndicatorEntity[];
}
