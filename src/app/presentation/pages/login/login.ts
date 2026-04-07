import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Credentials } from '@core/domain/models/credentials.model';
import { LoginUseCase } from '@core/application/usecases/login.usecase';

@Component({
  selector: 'app-login',
  imports: [CommonModule, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {
  protected readonly isSubmitting = signal(false);
  protected readonly submitError = signal('');

  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly loginUseCase = inject(LoginUseCase);
  private readonly router = inject(Router);
  protected readonly loginForm = this.formBuilder.group({
    host: ['', [Validators.required, Validators.pattern(/^https?:\/\/.+/i)]],
    username: ['', [Validators.required]],
    password: ['', [Validators.required]],
  });

  protected async onSubmit(): Promise<void> {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    const { host, username, password } = this.loginForm.getRawValue();

    try {
      this.isSubmitting.set(true);
      this.submitError.set('');

      await this.loginUseCase.execute(new Credentials(username, password, host));

      await this.router.navigate(['/dashboard']);
    } catch (error) {
      this.submitError.set(this.resolveErrorMessage(error));
    } finally {
      this.isSubmitting.set(false);
    }
  }

  protected hasControlError(controlName: 'host' | 'username' | 'password'): boolean {
    const control = this.loginForm.controls[controlName];

    return control.invalid && (control.touched || control.dirty);
  }

  protected getControlErrorMessage(controlName: 'host' | 'username' | 'password'): string {
    const control = this.loginForm.controls[controlName];

    if (control.hasError('required')) {
      switch (controlName) {
        case 'host':
          return 'Debes ingresar el host.';
        case 'username':
          return 'Debes ingresar el usuario.';
        case 'password':
          return 'Debes ingresar la contraseña.';
      }
    }

    if (controlName === 'host' && control.hasError('pattern')) {
      return 'El host debe comenzar con http:// o https://.';
    }

    return 'Valor inválido.';
  }

  private resolveErrorMessage(error: unknown): string {
    if (error instanceof Error && error.message) {
      return error.message;
    }

    return 'No se pudo completar el login.';
  }
}
