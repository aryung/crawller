import { MarketRegion } from '..';
import { SymbolEntity } from '../entities/symbol.interface';

export interface OhlcvDaysEntity {
  id: string;
  symbolCode: string;
  timestamp: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  openInterest: number;
  createdAt?: Date;
  updatedAt?: Date;
  date: Date;
  region: MarketRegion;
  symbol: SymbolEntity;
}
