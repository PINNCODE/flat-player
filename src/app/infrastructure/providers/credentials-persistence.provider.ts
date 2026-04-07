import { Provider } from '@angular/core';
import { EncryptedCredentialsAdapter } from '@infrastructure/adapters/local-storage/encrypted-credentials.adapter';
import { CREDENTIALS_PERSISTENCE_PORT } from '@core/domain/ports/credentials-persistence.port';

export const credentialsPersistenceProvider: Provider = {
  provide: CREDENTIALS_PERSISTENCE_PORT,
  useClass: EncryptedCredentialsAdapter,
};
