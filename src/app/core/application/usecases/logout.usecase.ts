import { Inject, Injectable } from '@angular/core';
import { AUTH_SESSION_PORT, AuthSessionPort } from '@core/domain/ports/auth-session.port';

@Injectable({
  providedIn: 'root',
})
export class LogoutUseCase {
  constructor(
    @Inject(AUTH_SESSION_PORT)
    private readonly authSession: AuthSessionPort,
  ) {}

  execute(): void {
    this.authSession.clear();
  }
}
