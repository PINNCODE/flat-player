import { Injectable, inject } from '@angular/core';
import { UserSettingsPort } from '../../domain/ports/user-settings.port';
import { UserSettings } from '../../domain/models/user-settings.model';

@Injectable({
  providedIn: 'root'
})
export class GetUserSettingsUseCase {
  private readonly userSettingsPort: UserSettingsPort = inject(UserSettingsPort);

  execute(): UserSettings {
    return this.userSettingsPort.getSettings();
  }
}
