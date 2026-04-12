import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-dashboard-logout-dialog',
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dashboard-logout-dialog.html',
  styleUrl: './dashboard-logout-dialog.scss',
})
export class DashboardLogoutDialog {
  readonly focusedActionIndex = input.required<number>();
}
