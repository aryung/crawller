import { UserEntity } from '../entities/user.interface';
import { SymbolScreenRequestDto } from '../dtos/strategy.dto';

export interface SharedScreenEntity {
  id: string;
  shareId: string;
  conditions: SymbolScreenRequestDto;
  userId: string;
  user: UserEntity;
  expiresAt: Date;
  accessCount: number;
  lastAccessedAt: Date;
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
  ipAddress: string;
  userAgent: string;
}
