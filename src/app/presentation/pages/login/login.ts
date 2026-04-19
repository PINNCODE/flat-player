import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  inject,
  signal,
  viewChild,
  OnDestroy,
} from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Credentials } from '@core/domain/models/credentials.model';
import { LoginUseCase } from '@core/application/usecases/login.usecase';
import { QrLoginFirebaseService } from '@infrastructure/services/qr-login-firebase.service';
import { environment } from '../../../../environments/environment';
import QRCode from 'qrcode';

type LoginFocusIndex = 0 | 1 | 2 | 3 | 4; // 0=host, 1=username, 2=password, 3=button, 4=qr-button

const FOCUSABLE_COUNT = 5;

@Component({
  selector: 'app-login',
  imports: [CommonModule, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login implements OnDestroy {
  protected readonly isSubmitting = signal(false);
  protected readonly submitError = signal('');
  protected readonly focusedIndex = signal<LoginFocusIndex>(0);
  protected readonly isEditing = signal(false);
  protected readonly showQrModal = signal(false);
  protected readonly qrCodeDataUrl = signal('');
  protected readonly qrLoading = signal(false);
  protected readonly qrTimeRemaining = signal(0);

  private readonly qrLoginService = inject(QrLoginFirebaseService);
  private readonly QR_BASE_URL = 'https://pinncode.github.io/flat-player/#/qr-login';
  private currentSessionId = '';
  private qrCountdownInterval: ReturnType<typeof setInterval> | null = null;
  private qrSubmitTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private sessionCreatedAt = 0;

  private readonly hostInputRef = viewChild<ElementRef<HTMLInputElement>>('hostInput');
  private readonly usernameInputRef = viewChild<ElementRef<HTMLInputElement>>('usernameInput');
  private readonly passwordInputRef = viewChild<ElementRef<HTMLInputElement>>('passwordInput');
  private readonly submitButtonRef = viewChild<ElementRef<HTMLButtonElement>>('submitButton');

  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly loginUseCase = inject(LoginUseCase);
  private readonly router = inject(Router);
  protected readonly loginForm = this.formBuilder.group({
    host: ['', [Validators.required, Validators.pattern(/^https?:\/\/.+/i)]],
    username: ['', [Validators.required]],
    password: ['', [Validators.required]],
  });

  @HostListener('window:keydown', ['$event'])
  protected onRemoteKeydown(event: KeyboardEvent): void {
    if (this.isEditing()) {
      if (event.key === 'XF86Back' || event.key === 'Escape') {
        event.preventDefault();
        this.deactivateInput();
      }
      // All other keys pass through to the active input (virtual keyboard typing)
      return;
    }

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.moveFocus(1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.moveFocus(-1);
        break;
      case 'Enter':
      case 'NumpadEnter':
      case 'OK':
        event.preventDefault();
        this.activateFocused();
        break;
    }
  }

  private moveFocus(direction: 1 | -1): void {
    const next = ((this.focusedIndex() + direction + FOCUSABLE_COUNT) % FOCUSABLE_COUNT) as LoginFocusIndex;
    this.focusedIndex.set(next);
  }

  private activateFocused(): void {
    const index = this.focusedIndex();
    if (index === 3) {
      this.onSubmit();
      return;
    }
    if (index === 4) {
      void this.openQrModal();
      return;
    }
    this.isEditing.set(true);
    this.getInputRefAt(index)?.nativeElement.focus();
  }

  private deactivateInput(): void {
    this.isEditing.set(false);
    this.getInputRefAt(this.focusedIndex())?.nativeElement.blur();
  }

  private getInputRefAt(index: LoginFocusIndex): ElementRef<HTMLInputElement> | undefined {
    const refs = [this.hostInputRef(), this.usernameInputRef(), this.passwordInputRef()];
    return refs[index];
  }

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

  protected async openQrModal(): Promise<void> {
    if (this.qrLoading()) return;

    try {
      this.qrLoading.set(true);
      this.qrCodeDataUrl.set('');

      console.log('[TV] Creating QR session...');
      this.currentSessionId = await this.qrLoginService.createSession();
      this.sessionCreatedAt = Date.now();
      console.log('[TV] Session created:', this.currentSessionId);

      const url = `${this.QR_BASE_URL}?session=${this.currentSessionId}`;
      console.log('[TV] QR URL:', url);

      const dataUrl = await QRCode.toDataURL(url, {
        width: 280,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
      });

      this.qrCodeDataUrl.set(dataUrl);
      this.showQrModal.set(true);
      this.startQrTimer();
      console.log('[TV] QR modal opened, waiting for credentials...');

      this.qrLoginService.listenForCredentials(this.currentSessionId, (credentials) => {
        console.log('[TV] Credentials received!', {
          host: credentials.host,
          user: credentials.user,
          password: '***'
        });
        this.stopQrTimer();
        this.loginForm.patchValue({
          host: credentials.host,
          username: credentials.user,
          password: credentials.password,
        });
        this.closeQrModal();
        console.log('[TV] Calling onSubmit...');
        this.qrSubmitTimeoutId = setTimeout(() => this.onSubmit(), 300);
      });

      this.qrLoginService.listenForExpiration(this.currentSessionId, () => {
        console.log('[TV] Session expired detected via Firebase');
        this.stopQrTimer();
        this.cleanupCurrentSession();
      });
    } catch (error) {
      console.error('[TV] QR Error:', error);
      this.submitError.set('Error al generar QR. Intenta de nuevo.');
    } finally {
      this.qrLoading.set(false);
    }
  }

  protected closeQrModal(): void {
    this.showQrModal.set(false);
    this.qrCodeDataUrl.set('');
    this.stopQrTimer();
    if (this.currentSessionId) {
      this.qrLoginService.cleanupSession(this.currentSessionId);
      this.currentSessionId = '';
    }
  }

  private startQrTimer(): void {
    this.stopQrTimer();
    const expiryMs = 5 * 60 * 1000;
    const updateInterval = 1000;

    const tick = () => {
      const elapsed = Date.now() - this.sessionCreatedAt;
      const remaining = Math.max(0, Math.ceil((expiryMs - elapsed) / 1000));
      this.qrTimeRemaining.set(remaining);

      if (remaining <= 0) {
        this.stopQrTimer();
        this.cleanupCurrentSession();
      }
    };

    tick();
    this.qrCountdownInterval = setInterval(tick, updateInterval);
  }

  private stopQrTimer(): void {
    if (this.qrCountdownInterval) {
      clearInterval(this.qrCountdownInterval);
      this.qrCountdownInterval = null;
    }
  }

  private async cleanupCurrentSession(): Promise<void> {
    if (this.currentSessionId) {
      await this.qrLoginService.cleanupSession(this.currentSessionId);
      this.currentSessionId = '';
    }
  }

  protected async regenerateQr(): Promise<void> {
    await this.cleanupCurrentSession();
    await this.openQrModal();
  }

  formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  protected getQrTimerDescription(): string {
    return 'Apunta la cámara de tu celular al código QR para ingresar tus credenciales';
  }

  ngOnDestroy(): void {
    this.qrLoginService.cleanup();
    if (this.qrSubmitTimeoutId) {
      clearTimeout(this.qrSubmitTimeoutId);
      this.qrSubmitTimeoutId = null;
    }
    if (this.qrCountdownInterval) {
      clearInterval(this.qrCountdownInterval);
      this.qrCountdownInterval = null;
    }
  }
}
