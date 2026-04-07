import { Injectable } from '@angular/core';
import { Credentials } from '@core/domain/models/credentials.model';
import { AuthSessionPort } from '@core/domain/ports/auth-session.port';

@Injectable({ providedIn: 'root' })
export class AuthSessionService implements AuthSessionPort {
  private readonly storageKey = 'flat-player-auth-session';
  private readonly legacyStorage = globalThis.localStorage;
  private readonly sessionStorageRef = globalThis.sessionStorage;
  private credentials: Credentials | null = null;

  store(credentials: Credentials): void {
    this.credentials = credentials;
    this.persist(credentials);
  }

  retrieve(): Credentials | null {
    if (this.credentials) {
      return this.credentials;
    }

    this.credentials = this.restore();
    return this.credentials;
  }

  clear(): void {
    this.credentials = null;

    try {
      this.sessionStorageRef.removeItem(this.storageKey);
      this.legacyStorage.removeItem(this.storageKey);
    } catch {
      // Ignore storage cleanup failures to keep logout flow resilient.
    }
  }

  private persist(credentials: Credentials): void {
    try {
      this.sessionStorageRef.setItem(
        this.storageKey,
        JSON.stringify({
          host: credentials.host,
          user: credentials.user,
          password: credentials.password,
        }),
      );
    } catch {
      // Ignore persistence errors to avoid blocking login flow on storage failures.
    }
  }

  private restore(): Credentials | null {
    try {
      const rawSession = this.sessionStorageRef.getItem(this.storageKey)
        ?? this.restoreLegacySession();

      if (!rawSession) {
        return null;
      }

      const parsed = JSON.parse(rawSession) as {
        host?: string;
        user?: string;
        password?: string;
      };

      if (!parsed.user || !parsed.password || !parsed.host) {
        this.clear();
        return null;
      }

      return new Credentials(parsed.user, parsed.password, parsed.host);
    } catch {
      this.clear();
      return null;
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
