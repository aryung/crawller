import { UserEntity } from '../entities/user.interface';
import { OAuthProvider } from '..';

export interface UserOAuthProviderEntity {
  id: string;
  userId: string;
  oauthProvider: OAuthProvider;
  oauthProviderId: string;
  providerEmail?: string;
  profileImageUrl?: string;
  isPrimary: boolean;
  createdAt: Date;
  updatedAt: Date;
  user: UserEntity;
}
