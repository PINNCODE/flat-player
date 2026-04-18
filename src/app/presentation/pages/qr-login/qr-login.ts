import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { QrLoginFirebaseService } from '@infrastructure/services/qr-login-firebase.service';

@Component({
  selector: 'app-qr-login',
  imports: [CommonModule, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './qr-login.html',
  styleUrl: './qr-login.scss',
})
export class QrLogin implements OnInit {
  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly qrLoginService = inject(QrLoginFirebaseService);

  protected readonly form = this.formBuilder.group({
    host: ['', [Validators.required, Validators.pattern(/^https?:\/\/.+/i)]],
    username: ['', [Validators.required]],
    password: ['', [Validators.required]],
  });

  protected readonly isSubmitting = signal(false);
  protected readonly submitStatus = signal<'idle' | 'success' | 'error'>('idle');
  protected readonly statusMessage = signal('');

  private sessionId = '';

  ngOnInit(): void {
    const params = new URLSearchParams(window.location.search);
    this.sessionId = params.get('session') || '';

    if (!this.sessionId) {
      this.submitStatus.set('error');
      this.statusMessage.set('Código de sesión inválido. Escanea el QR nuevamente.');
    }
  }

  protected async onSubmit(): Promise<void> {
    if (this.form.invalid || !this.sessionId) {
      this.form.markAllAsTouched();
      return;
    }

    const { host, username, password } = this.form.getRawValue();

    try {
      this.isSubmitting.set(true);
      this.submitStatus.set('idle');

      await this.qrLoginService.sendCredentials(this.sessionId, {
        host,
        user: username,
        password,
      });

      this.submitStatus.set('success');
      this.statusMessage.set('¡Credenciales enviadas a la TV!');
    } catch (error) {
      this.submitStatus.set('error');
      this.statusMessage.set('Error al enviar. Intenta de nuevo.');
    } finally {
      this.isSubmitting.set(false);
    }
  }

  protected hasControlError(controlName: 'host' | 'username' | 'password'): boolean {
    const control = this.form.controls[controlName];
    return control.invalid && (control.touched || control.dirty);
  }

  protected getErrorMessage(controlName: 'host' | 'username' | 'password'): string {
    const control = this.form.controls[controlName];

    if (control.hasError('required')) {
      switch (controlName) {
        case 'host':
          return 'Ingresa la URL del servidor';
        case 'username':
          return 'Ingresa el usuario';
        case 'password':
          return 'Ingresa la contraseña';
      }
    }

    if (controlName === 'host' && control.hasError('pattern')) {
      return 'La URL debe comenzar con http:// o https://';
    }

    return 'Valor inválido';
  }
}
