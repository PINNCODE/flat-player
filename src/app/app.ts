import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { AutoLoginUseCase } from '@core/application/usecases/auto-login.usecase';
import { HttpLoaderService } from '@infrastructure/services/http-loader.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnInit {
  protected readonly isHttpLoading = inject(HttpLoaderService).isLoading;
  protected readonly isAutoLogging = signal(true);

  private readonly autoLoginUseCase = inject(AutoLoginUseCase);
  private readonly router = inject(Router);

  ngOnInit(): void {
    const currentPath = window.location.pathname;
    if (currentPath.includes('qr-login')) {
      this.isAutoLogging.set(false);
      return;
    }
    void this.runAutoLogin();
  }

  private async runAutoLogin(): Promise<void> {
    const success = await this.autoLoginUseCase.execute();
    this.isAutoLogging.set(false);
    if (success) {
      await this.router.navigate(['/dashboard']);
    }
  }
}
