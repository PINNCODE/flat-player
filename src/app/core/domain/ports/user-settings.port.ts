import { UserSettings } from '../models/user-settings.model';

export abstract class UserSettingsPort {
  abstract getSettings(): UserSettings;
  abstract setCountry(country: string | null): void;
}
