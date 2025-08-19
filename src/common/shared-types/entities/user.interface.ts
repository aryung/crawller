import { PortfolioEntity } from '../entities/portfolio.interface';
import { StrategyEntity } from '../entities/strategy.interface';
import { PositionEntity } from '../entities/position.interface';
import { UserOAuthProviderEntity } from '../entities/user-oauth-provider.interface';
import { UserRole } from '..';

export interface UserEntity {
  id: string;
  username?: string;
  email?: string;
  password?: string;
  identifier: string;
  chatId?: string;
  role: UserRole;
  emailVerified: boolean;
  registrationDate: Date;
  createdAt?: Date;
  updatedAt?: Date;
  strategies?: StrategyEntity[];
  portfolios?: PortfolioEntity[];
  positions?: PositionEntity[];
  oauthProviders?: UserOAuthProviderEntity[];
}
