import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { UserInfo } from '@core/domain/models/auth-response.model';

@Component({
  selector: 'app-dashboard-settings-panel',
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dashboard-settings-panel.html',
  styleUrl: './dashboard-settings-panel.scss',
})
export class DashboardSettingsPanel {
  readonly userInfo = input<UserInfo | null>(null);
  readonly userCountry = input<string | null>(null);
  readonly settingsFocusedIndex = input.required<number>();
  readonly createdAtLabel = input('');
  readonly expiresAtLabel = input('');

  protected readonly selectedCountryLabel = computed(
    () => this.userCountry() || 'Seleccionar...',
  );
}
