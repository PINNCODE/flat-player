import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, UrlTree } from '@angular/router';
import { Credentials } from '@core/domain/models/credentials.model';
import { AUTH_SESSION_PORT, AuthSessionPort } from '@core/domain/ports/auth-session.port';
import { vi } from 'vitest';

import { authGuard, guestGuard } from './auth.guard';

describe('auth guards', () => {
  let authSessionMock: AuthSessionPort;
  let router: Router;

  beforeEach(() => {
    authSessionMock = {
      store: vi.fn(),
      retrieve: vi.fn(),
      retrieveUserInfo: vi.fn(),
      clear: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AUTH_SESSION_PORT, useValue: authSessionMock },
      ],
    });

    router = TestBed.inject(Router);
  });

  it('allows dashboard access when a session exists', () => {
    vi.mocked(authSessionMock.retrieve).mockReturnValue(
      new Credentials('demo-user', 'demo-pass', 'https://example.com'),
    );

    const result = TestBed.runInInjectionContext(() => authGuard({} as never, {} as never));

    expect(result).toBe(true);
  });

  it('redirects dashboard access to login when there is no session', () => {
    vi.mocked(authSessionMock.retrieve).mockReturnValue(null);

    const result = TestBed.runInInjectionContext(() => authGuard({} as never, {} as never));

    expect(result instanceof UrlTree).toBe(true);
    expect(router.serializeUrl(result as UrlTree)).toBe('/login');
  });

  it('redirects login access to dashboard when a session already exists', () => {
    vi.mocked(authSessionMock.retrieve).mockReturnValue(
      new Credentials('demo-user', 'demo-pass', 'https://example.com'),
    );

    const result = TestBed.runInInjectionContext(() => guestGuard({} as never, {} as never));

    expect(result instanceof UrlTree).toBe(true);
    expect(router.serializeUrl(result as UrlTree)).toBe('/dashboard');
  });

  it('allows login access when there is no session', () => {
    vi.mocked(authSessionMock.retrieve).mockReturnValue(null);

    const result = TestBed.runInInjectionContext(() => guestGuard({} as never, {} as never));

    expect(result).toBe(true);
  });
});