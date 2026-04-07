import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Credentials } from '@core/domain/models/credentials.model';
import { LoginUseCase } from '@core/application/usecases/login.usecase';

type LoginFocusIndex = 0 | 1 | 2 | 3; // 0=host, 1=username, 2=password, 3=button

const FOCUSABLE_COUNT = 4;

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
  protected readonly focusedIndex = signal<LoginFocusIndex>(0);
  protected readonly isEditing = signal(false);

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
}
