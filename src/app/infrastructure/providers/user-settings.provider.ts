import { Provider } from '@angular/core';
import { UserSettingsPort } from '../../core/domain/ports/user-settings.port';
import { LocalUserSettingsService } from '../services/local-user-settings.service';

export const userSettingsProvider: Provider = {
  provide: UserSettingsPort,
  useClass: LocalUserSettingsService,
};
