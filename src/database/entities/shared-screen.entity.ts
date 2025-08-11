import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { UserEntity } from './user.entity';
// import { SymbolScreenRequestDto } from '../dtos/strategy.dto'; // TODO: Fix DTO import path
type SymbolScreenRequestDto = any; // Temporary fix

@Entity('shared_screens')
@Index(['shareId'], { unique: true })
@Index(['expiresAt'])
export class SharedScreenEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'share_id', type: 'varchar', length: 36, unique: true })
  shareId!: string;

  @Column({ name: 'conditions', type: 'jsonb' })
  conditions: SymbolScreenRequestDto;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId!: string;

  @ManyToOne(() => UserEntity, { nullable: true })
  @JoinColumn({ name: 'user_id' })
  user!: UserEntity;

  @Column({ name: 'expires_at', type: 'timestamp' })
  expiresAt!: Date;

  @Column({ name: 'access_count', type: 'int', default: 0 })
  accessCount!: number;

  @Column({ name: 'last_accessed_at', type: 'timestamp', nullable: true })
  lastAccessedAt!: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ name: 'ip_address', type: 'varchar', length: 45, nullable: true })
  ipAddress!: string;

  @Column({ name: 'user_agent', type: 'text', nullable: true })
  userAgent!: string;
}
