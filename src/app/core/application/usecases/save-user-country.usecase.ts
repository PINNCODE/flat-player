import { Injectable, inject } from '@angular/core';
import { UserSettingsPort } from '../../domain/ports/user-settings.port';

@Injectable({
  providedIn: 'root'
})
export class SaveUserCountryUseCase {
  private readonly userSettingsPort: UserSettingsPort = inject(UserSettingsPort);

  execute(country: string | null): void {
    this.userSettingsPort.setCountry(country);
  }
}
