import { Injectable } from '@angular/core';
import { UserSettingsPort } from '../../core/domain/ports/user-settings.port';
import { UserSettings } from '../../core/domain/models/user-settings.model';

@Injectable({
  providedIn: 'root'
})
export class LocalUserSettingsService implements UserSettingsPort {
  private readonly STORAGE_KEY = 'user_settings';

  getSettings(): UserSettings {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored) as UserSettings;
      }
    } catch {
      // Ignore parse errors
    }
    return {} as UserSettings;
  }

}