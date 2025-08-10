import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('ohlcv')
export class OhlcvEntity {
  @PrimaryColumn({
    type: 'uuid',
    default: () => 'uuid_generate_v4()', // 明確指定資料庫使用此函數作為預設值
  })
  id: string;
  @Column({
    name: 'symbol_code',
    type: 'varchar',
    length: 12,
    nullable: false,
  })
  @Index()
  symbolCode: string;

  @Column({
    name: 'timestamp',
    type: 'timestamp',
    nullable: false,
  })
  @Index()
  timestamp: Date;

  @Column({
    name: 'open',
    type: 'numeric',
    precision: 10,
    scale: 2,
    nullable: false,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => Number(value),
    },
  })
  open: number;

  @Column({
    name: 'high',
    type: 'numeric',
    precision: 10,
    scale: 2,
    nullable: false,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => Number(value),
    },
  })
  high: number;

  @Column({
    name: 'low',
    type: 'numeric',
    precision: 10,
    scale: 2,
    nullable: false,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => Number(value),
    },
  })
  low: number;

  @Column({
    name: 'close',
    type: 'numeric',
    precision: 10,
    scale: 2,
    nullable: false,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => Number(value),
    },
  })
  close: number;

  @Column({
    name: 'volume',
    type: 'numeric',
    precision: 10,
    scale: 0,
    nullable: false,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => Number(value),
    },
  })
  volume: number;

  @Column({
    name: 'openinterest',
    type: 'numeric',
    precision: 18,
    scale: 0,
    nullable: true,
    default: 0,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => Number(value),
    },
  })
  openInterest: number;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamptz',
  })
  createdAt?: Date;

  @UpdateDateColumn({
    name: 'updated_at',
    type: 'timestamptz',
  })
  updatedAt: Date;
}
