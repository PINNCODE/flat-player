import { InjectionToken } from '@angular/core';
import { Credentials } from '@core/domain/models/credentials.model';

export interface CredentialsPersistencePort {
  save(credentials: Credentials): Promise<void>;
  load(): Promise<Credentials | null>;
  delete(): Promise<void>;
}

export const CREDENTIALS_PERSISTENCE_PORT = new InjectionToken<CredentialsPersistencePort>(
  'CREDENTIALS_PERSISTENCE_PORT',
);
