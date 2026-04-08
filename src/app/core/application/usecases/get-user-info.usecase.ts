import { Inject, Injectable } from '@angular/core';
import { AUTH_SESSION_PORT, AuthSessionPort } from '@core/domain/ports/auth-session.port';
import { UserInfo } from '@core/domain/models/auth-response.model';

@Injectable({
  providedIn: 'root',
})
export class GetUserInfoUseCase {
  constructor(
    @Inject(AUTH_SESSION_PORT)
    private readonly authSession: AuthSessionPort,
  ) {}

  execute(): UserInfo | null {
    return this.authSession.retrieveUserInfo();
  }
}
