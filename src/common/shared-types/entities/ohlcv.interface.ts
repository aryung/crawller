export interface OhlcvEntity {
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
  updatedAt: Date;
}
