import { InjectionToken } from '@angular/core';
import { Credentials } from '@core/domain/models/credentials.model';
import { UserInfo } from '@core/domain/models/auth-response.model';

export interface AuthSessionPort {
  store(credentials: Credentials, userInfo?: UserInfo): void;
  retrieve(): Credentials | null;
  retrieveUserInfo(): UserInfo | null;
  clear(): void;
}

export const AUTH_SESSION_PORT = new InjectionToken<AuthSessionPort>('AUTH_SESSION_PORT');
