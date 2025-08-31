import { OhlcvDaysEntity } from '../entities/ohlcv-days.interface';

export interface ImportOhlcvDto {
  symbolCode: string;
  date: string;
  region: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  timestamp?: Date;
  openInterest?: number;
}

export interface ImportOhlcvResponseDto {
  success: boolean;
  imported: number;
  failed?: number;
  skipped?: number;
  skippedSymbols?: Array<{
    symbolCode: string;
    region: string;
    reason: string;
  }>;
  errors?: string[];
  warnings?: string[];
  data: OhlcvDaysEntity[];
}

