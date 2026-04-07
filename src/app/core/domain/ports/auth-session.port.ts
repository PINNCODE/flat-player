import { InjectionToken } from '@angular/core';
import { Credentials } from '@core/domain/models/credentials.model';

export interface AuthSessionPort {
  store(credentials: Credentials): void;
  retrieve(): Credentials | null;
  clear(): void;
}

export const AUTH_SESSION_PORT = new InjectionToken<AuthSessionPort>('AUTH_SESSION_PORT');
