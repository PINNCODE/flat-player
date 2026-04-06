import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterOutlet } from '@angular/router';
import { LoginUseCase } from '@core/application/usecases/login.usecase';
import { Credentials, ICredentials } from '@core/domain/models/credentials.model';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnInit {
  protected readonly title = signal('flat-player');
  private readonly loginUseCase = inject(LoginUseCase);
  private readonly destroyRef = inject(DestroyRef);

  private readonly credentialsMock: ICredentials = {
    user: 'admin',
    password: 'admin',
    host: 'http://localhost:8080',
  };

  ngOnInit(): void {
    try {
      const credentials = this.buildCredentials(this.credentialsMock);
      this.loginUseCase
        .execute(credentials)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (response) => {
            console.log('Login successful:', response);
          },
          error: (error) => {
            console.error('Login failed:', error);
          }
        });
    } catch (error) {
      console.error('Error during login:', error);
    }
  }

  private buildCredentials(input: ICredentials): ICredentials {
    return new Credentials(input.user, input.password, input.host).credentialsObject;
  }
}
