import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { LoginUseCase } from '@core/application/usecases/login.usecase';
import { Credentials } from '@core/domain/models/credentials.model';
import { HttpLoaderService } from '@infrastructure/services/http-loader.service';
import { environment } from '../environments/environment';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnInit {
  protected readonly title = signal('flat-player');
  protected readonly loginStatus = signal<'disabled' | 'loading' | 'success' | 'error'>('disabled');
  protected readonly loginMessage = signal('');
  protected readonly isHttpLoading = inject(HttpLoaderService).isLoading;
  private readonly loginUseCase = inject(LoginUseCase);

  ngOnInit(): void {
    void this.runLogin();
  }

  private async runLogin(): Promise<void> {
    const credentials = this.getAutoLoginCredentials();
    if (!credentials) {
      this.loginStatus.set('disabled');
      this.loginMessage.set('Autologin deshabilitado. Configuralo en environments si lo necesitas.');
      return;
    }

    try {
      this.loginStatus.set('loading');
      this.loginMessage.set('Iniciando sesion...');

      await this.loginUseCase.execute(credentials);

      this.loginStatus.set('success');
      this.loginMessage.set('');
    } catch (error) {
      this.loginStatus.set('error');
      this.loginMessage.set(this.resolveLoginErrorMessage(error));
    }
  }

  private getAutoLoginCredentials(): Credentials | null {
    const { autoLogin } = environment;
    if (!autoLogin.enabled) {
      return null;
    }

    return new Credentials(autoLogin.user, autoLogin.password, autoLogin.host);
  }

  private resolveLoginErrorMessage(error: unknown): string {
    if (error instanceof Error && error.message) {
      return error.message;
    }

    return 'No se pudo completar el login.';
  }
}
