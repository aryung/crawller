import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { PortfolioEntity } from './portfolio.entity';
import { StrategyEntity } from './strategy.entity';
import { PositionEntity } from './position.entity';
import { UserOAuthProviderEntity } from './user-oauth-provider.entity';
import { UserRole } from '../../common/shared-types';

@Entity('users')
export class UserEntity {
  @PrimaryColumn({
    type: 'uuid',
    default: () => 'uuid_generate_v4()', // 明確指定資料庫使用此函數作為預設值
  })
  id!: string;

  @Column({
    name: 'username',
    type: 'varchar',
    nullable: true,
  })
  username?: string;

  @Column({
    name: 'email',
    type: 'varchar',
    nullable: true,
    unique: true,
  })
  email?: string;

  @Column({
    name: 'password',
    type: 'varchar',
    nullable: true,
  })
  password?: string;

  @Column({
    name: 'identifier',
    type: 'varchar',
    nullable: false,
    unique: true,
  })
  identifier!: string;

  @Column({
    name: 'chat_id',
    type: 'varchar',
    nullable: true,
  })
  chatId?: string;

  @Column({
    name: 'role',
    type: 'varchar',
    default: UserRole.USER,
  })
  role!: UserRole;

  @Column({
    name: 'email_verified',
    type: 'boolean',
    default: false,
  })
  emailVerified!: boolean;

  @Column({
    name: 'registration_date',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
  })
  registrationDate!: Date;

  @CreateDateColumn({
    type: 'timestamptz',
    name: 'created_at',
  })
  createdAt?: Date;

  @UpdateDateColumn({
    type: 'timestamptz',
    name: 'updated_at',
  })
  updatedAt?: Date;

  @OneToMany(() => StrategyEntity, (strategy) => strategy.user, {
    nullable: true,
  })
  strategies?: StrategyEntity[];

  @OneToMany(() => PortfolioEntity, (portfolio) => portfolio.user, {
    nullable: true,
  })
  portfolios?: PortfolioEntity[];

  @OneToMany(() => PositionEntity, (position) => position.user, {
    nullable: true,
  })
  positions?: PositionEntity[];

  @OneToMany(
    () => UserOAuthProviderEntity,
    (oauthProvider) => oauthProvider.user,
    {
      nullable: true,
    }
  )
  oauthProviders?: UserOAuthProviderEntity[];
}
