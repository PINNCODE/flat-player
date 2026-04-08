import { Injectable } from '@angular/core';
import { Credentials } from '@core/domain/models/credentials.model';
import { AuthSessionPort } from '@core/domain/ports/auth-session.port';
import { UserInfo } from '@core/domain/models/auth-response.model';

@Injectable({ providedIn: 'root' })
export class AuthSessionService implements AuthSessionPort {
  private readonly storageKey = 'flat-player-auth-session';
  private readonly legacyStorage = globalThis.localStorage;
  private readonly sessionStorageRef = globalThis.sessionStorage;
  private credentials: Credentials | null = null;
  private userInfo: UserInfo | null = null;

  store(credentials: Credentials, userInfo?: UserInfo): void {
    this.credentials = credentials;
    if (userInfo) {
      this.userInfo = userInfo;
    }
    this.persist(credentials, userInfo);
  }

  retrieve(): Credentials | null {
    if (this.credentials) {
      return this.credentials;
    }

    this.restore();
    return this.credentials;
  }

  retrieveUserInfo(): UserInfo | null {
    if (this.userInfo) {
      return this.userInfo;
    }

    this.restore();
    return this.userInfo;
  }

  clear(): void {
    this.credentials = null;
    this.userInfo = null;

    try {
      this.sessionStorageRef.removeItem(this.storageKey);
      this.legacyStorage.removeItem(this.storageKey);
    } catch {
      // Ignore storage cleanup failures to keep logout flow resilient.
    }
  }

  private persist(credentials: Credentials, userInfo?: UserInfo): void {
    try {
      this.sessionStorageRef.setItem(
        this.storageKey,
        JSON.stringify({
          host: credentials.host,
          user: credentials.user,
          password: credentials.password,
          ...(userInfo ? { userInfo } : {}),
        }),
      );
    } catch {
      // Ignore persistence errors to avoid blocking login flow on storage failures.
    }
  }

  private restore(): void {
    try {
      const rawSession = this.sessionStorageRef.getItem(this.storageKey)
        ?? this.restoreLegacySession();

      if (!rawSession) {
        return;
      }

      const parsed = JSON.parse(rawSession) as {
        host?: string;
        user?: string;
        password?: string;
        userInfo?: UserInfo;
      };

      if (!parsed.user || !parsed.password || !parsed.host) {
        this.clear();
        return;
      }

      this.credentials = new Credentials(parsed.user, parsed.password, parsed.host);
      if (parsed.userInfo) {
        this.userInfo = parsed.userInfo;
      }
    } catch {
      this.clear();
    }
  }

  private restoreLegacySession(): string | null {
    const rawLegacySession = this.legacyStorage.getItem(this.storageKey);

    if (!rawLegacySession) {
      return null;
    }

    this.sessionStorageRef.setItem(this.storageKey, rawLegacySession);
    this.legacyStorage.removeItem(this.storageKey);
    return rawLegacySession;
  }
}
