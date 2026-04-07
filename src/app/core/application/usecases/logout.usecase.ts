import { Inject, Injectable } from '@angular/core';
import { AUTH_SESSION_PORT, AuthSessionPort } from '@core/domain/ports/auth-session.port';
import { CREDENTIALS_PERSISTENCE_PORT, CredentialsPersistencePort } from '@core/domain/ports/credentials-persistence.port';

@Injectable({
  providedIn: 'root',
})
export class LogoutUseCase {
  constructor(
    @Inject(AUTH_SESSION_PORT)
    private readonly authSession: AuthSessionPort,
    @Inject(CREDENTIALS_PERSISTENCE_PORT)
    private readonly credentialsPersistence: CredentialsPersistencePort,
  ) {}

  execute(): void {
    this.authSession.clear();
    void this.credentialsPersistence.delete();
  }
}
