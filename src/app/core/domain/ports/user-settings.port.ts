import { UserSettings } from '../models/user-settings.model';

export abstract class UserSettingsPort {
  abstract getSettings(): UserSettings;
}
