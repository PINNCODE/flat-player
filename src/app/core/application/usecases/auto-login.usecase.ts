import { Inject, Injectable } from '@angular/core';
import { AUTH_REPOSITORY, AuthRepository } from '@core/domain/ports/auth.repository';
import { AUTH_SESSION_PORT, AuthSessionPort } from '@core/domain/ports/auth-session.port';
import {
  CREDENTIALS_PERSISTENCE_PORT,
  CredentialsPersistencePort,
} from '@core/domain/ports/credentials-persistence.port';

@Injectable({ providedIn: 'root' })
export class AutoLoginUseCase {
  constructor(
    @Inject(CREDENTIALS_PERSISTENCE_PORT)
    private readonly credentialsPersistence: CredentialsPersistencePort,
    @Inject(AUTH_REPOSITORY) private readonly authRepository: AuthRepository,
    @Inject(AUTH_SESSION_PORT) private readonly authSession: AuthSessionPort,
  ) {}

  async execute(): Promise<boolean> {
    const credentials = await this.credentialsPersistence.load();
    if (!credentials) return false;

    try {
      await this.authRepository.login(credentials);
      this.authSession.store(credentials);
      return true;
    } catch {
      return false;
    }
  }
}
