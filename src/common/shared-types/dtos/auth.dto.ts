import { OAuthProvider, UserRegistrationStatus } from '..';
import { UserEntity } from '../entities/user.interface';

export interface LoginDto {
  email: string;
  password: string;
}

export interface TokenPayloadDto {
  userId: string;
  role: string;
}

export interface LoginResponseDto {
  accessToken: string;
  refreshToken?: string;
  user: UserEntity;
  isNewUser?: boolean;
}

export interface TelegramTokenDto {
  email: string;
  identifier: string;
}

export interface SimpleLoginDto {
  email: string;
  identifier?: string;
}

export interface GetIdentifierDto {
  email: string;
}

export interface GetIdentifierResponseDto {
  email: string;
  identifier: string;
}

export interface AutoLoginDto {
  name?: string;
  email: string;
  chatId?: string;
  guestId?: string;
}

export interface RefreshTokenDto {
  refreshToken: string;
}

export interface BindChatIdDto {
  email: string;
  chatId: string;
  identifier?: string;
  username?: string;
}

export interface UnbindChatIdDto {
  email: string;
  identifier: string;
}

export interface CheckBindingStatusDto {
  email: string;
}

export interface BatchCheckBindingStatusDto {
  emails: string[];
}

export interface UserTypeInfoDto {
  isGuest: boolean;
  isRegistered: boolean;
  hasChatId: boolean;
  registrationStatus: UserRegistrationStatus;
}

export interface BindingStatusResponseDto {
  canBind: boolean;
  currentStatus: string;
  requiresIdentifier: boolean;
  userTypeInfo: UserTypeInfoDto;
  message: string;
}

export interface BindingResultDto {
  success: boolean;
  user: UserEntity;
  userTypeInfo: UserTypeInfoDto;
  message: string;
  accessToken?: string;
  refreshToken?: string;
}

export interface CreateOAuthUserDto {
  oauthProviderId: string;
  oauthProvider: OAuthProvider;
  email: string;
  username: string;
  profileImageUrl?: string;
  emailVerified?: boolean;
}

