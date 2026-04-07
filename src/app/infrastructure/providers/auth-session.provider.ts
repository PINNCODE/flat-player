import { Provider } from '@angular/core';
import { AUTH_SESSION_PORT } from '@core/domain/ports/auth-session.port';
import { AuthSessionService } from '@infrastructure/services/auth-session.service';

export const authSessionProvider: Provider = {
  provide: AUTH_SESSION_PORT,
  useClass: AuthSessionService,
};
