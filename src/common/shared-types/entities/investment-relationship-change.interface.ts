import { InvestmentRelationshipChangeType } from '..';

export interface InvestmentRelationshipChangeEntity {
  id: string;
  strategyId: string;
  portfolioId: string;
  changeType: InvestmentRelationshipChangeType;
  changeTime: Date;
  previousParameters: object;
  newParameters: object;
}
