import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { AUTH_SESSION_PORT, AuthSessionPort } from '@core/domain/ports/auth-session.port';

function resolveNavigation(hasSession: boolean, target: '/login' | '/dashboard'): true | UrlTree {
  if (hasSession) {
    return true;
  }

  return inject(Router).createUrlTree([target]);
}

export const authGuard: CanActivateFn = (): true | UrlTree => {
  const authSession = inject<AuthSessionPort>(AUTH_SESSION_PORT);

  return resolveNavigation(authSession.retrieve() !== null, '/login');
};

export const guestGuard: CanActivateFn = (): true | UrlTree => {
  const authSession = inject<AuthSessionPort>(AUTH_SESSION_PORT);

  if (authSession.retrieve() === null) {
    return true;
  }

  return inject(Router).createUrlTree(['/dashboard']);
};