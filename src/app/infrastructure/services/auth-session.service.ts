import { Injectable } from '@angular/core';
import { Credentials } from '@core/domain/models/credentials.model';
import { AuthSessionPort } from '@core/domain/ports/auth-session.port';

@Injectable({ providedIn: 'root' })
export class AuthSessionService implements AuthSessionPort {
  private readonly storageKey = 'flat-player-auth-session';
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
      localStorage.removeItem(this.storageKey);
    } catch {
      // Ignore storage cleanup failures to keep logout flow resilient.
    }
  }

  private persist(credentials: Credentials): void {
    try {
      localStorage.setItem(
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
      const rawSession = localStorage.getItem(this.storageKey);

      if (!rawSession) {
        return null;
      }

      const parsed = JSON.parse(rawSession) as {
        host?: string;
        user?: string;
        password?: string;
      };

      if (!parsed.user || !parsed.password || !parsed.host) {
        localStorage.removeItem(this.storageKey);
        return null;
      }

      return new Credentials(parsed.user, parsed.password, parsed.host);
    } catch {
      localStorage.removeItem(this.storageKey);
      return null;
    }
  }
}
