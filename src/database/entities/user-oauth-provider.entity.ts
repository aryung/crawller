import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserEntity } from './user.entity';
import { OAuthProvider } from '../../common/shared-types';

@Entity('user_oauth_providers')
export class UserOAuthProviderEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({
    name: 'user_id',
    type: 'uuid',
  })
  userId!: string;

  @Column({
    name: 'oauth_provider',
    type: 'varchar',
  })
  oauthProvider!: OAuthProvider;

  @Column({
    name: 'oauth_provider_id',
    type: 'varchar',
  })
  oauthProviderId!: string;

  @Column({
    name: 'provider_email',
    type: 'varchar',
    nullable: true,
  })
  providerEmail?: string;

  @Column({
    name: 'profile_image_url',
    type: 'varchar',
    nullable: true,
  })
  profileImageUrl?: string;

  @Column({
    name: 'is_primary',
    type: 'boolean',
    default: false,
  })
  isPrimary!: boolean;

  @CreateDateColumn({
    type: 'timestamptz',
    name: 'created_at',
  })
  createdAt!: Date;

  @UpdateDateColumn({
    type: 'timestamptz',
    name: 'updated_at',
  })
  updatedAt!: Date;

  @ManyToOne(() => UserEntity, (user) => user.oauthProviders, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'user_id',
    foreignKeyConstraintName: 'FK_user_oauth_providers_user_id',
  })
  user!: UserEntity;
}
