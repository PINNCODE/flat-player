import { Component, inject, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, Validators, FormGroup } from '@angular/forms';
import { LoginUseCase } from '../../../core/application/use-cases/auth/login.use-case';
import { AutoLoginUseCase } from '../../../core/application/use-cases/auth/auto-login.use-case';
import { AuthCredentials } from '../../../core/domain/models/user.model';
import { FocusDirective, VirtualKeyboardDirective } from '../../shared/directives';
import { DestroyService } from '../../shared/utils/destroy.service';
import { takeUntil } from 'rxjs/operators';

/**
 * Página de Login para FlatPlayer
 * Navegación completa mediante control remoto Samsung TV
 * Integración con teclado virtual de Tizen
 */
@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FocusDirective, VirtualKeyboardDirective],
  templateUrl: './login-page.component.html',
  styleUrls: ['./login-page.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LoginPageComponent implements OnInit {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private loginUseCase = inject(LoginUseCase);
  private autoLoginUseCase = inject(AutoLoginUseCase);
  private destroy$ = inject(DestroyService);

  loginForm: FormGroup;
  isLoading = false;
  errorMessage = '';
  showPassword = false;

  constructor() {
    this.loginForm = this.fb.group({
      serverUrl: ['', [Validators.required, Validators.pattern(/^https?:\/\/.+/)]],
      username: ['', [Validators.required, Validators.minLength(3)]],
      password: ['', [Validators.required, Validators.minLength(4)]]
    });
  }

  ngOnInit(): void {
    this.attemptAutoLogin();
  }

  /**
   * Intenta auto-login si hay sesión guardada
   */
  private attemptAutoLogin(): void {
    if (this.autoLoginUseCase.hasSavedSession()) {
      this.isLoading = true;
      
      this.autoLoginUseCase.execute().pipe(
        takeUntil(this.destroy$)
      ).subscribe({
        next: (user) => {
          if (user) {
            // Auto-login exitoso, navegar al dashboard
            this.navigateToDashboard();
          } else {
            // Sesión expirada o inválida
            this.isLoading = false;
          }
        },
        error: (error) => {
          console.error('Auto-login error:', error);
          this.isLoading = false;
        }
      });
    }
  }

  /**
   * Maneja el envío del formulario de login
   */
  onSubmit(): void {
    if (this.loginForm.invalid || this.isLoading) {
      return;
    }

    const credentials: AuthCredentials = {
      serverUrl: this.loginForm.value.serverUrl!,
      username: this.loginForm.value.username!,
      password: this.loginForm.value.password!
    };

    // Validar credenciales antes de enviar
    const validation = this.loginUseCase.validateCredentials(credentials);
    
    if (!validation.isValid) {
      this.errorMessage = Object.values(validation.errors).join('\n');
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    this.loginUseCase.execute(credentials).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (user) => {
        this.isLoading = false;
        // Login exitoso, navegar al dashboard
        this.navigateToDashboard();
      },
      error: (error) => {
        this.isLoading = false;
        this.errorMessage = error.message || 'Error al iniciar sesión';
      }
    });
  }

  /**
   * Navega al dashboard
   */
  private navigateToDashboard(): void {
    this.router.navigate(['/dashboard']);
  }

  /**
   * Alterna visibilidad de contraseña
   */
  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  /**
   * Limpia el mensaje de error
   */
  clearError(): void {
    this.errorMessage = '';
  }

  /**
   * Obtiene el mensaje de error para un campo específico
   */
  getFieldError(fieldName: string): string {
    const field = this.loginForm.get(fieldName);
    if (!field || !field.errors || !field.touched) {
      return '';
    }

    const errors = field.errors;
    
    if (errors['required']) {
      return 'Este campo es requerido';
    }
    
    if (errors['minlength']) {
      const requiredLength = errors['minlength'].requiredLength;
      return `Mínimo ${requiredLength} caracteres`;
    }
    
    if (errors['pattern']) {
      return 'Formato inválido (debe comenzar con http:// o https://)';
    }

    return 'Error de validación';
  }

  /**
   * Verifica si un campo tiene error
   */
  hasFieldError(fieldName: string): boolean {
    const field = this.loginForm.get(fieldName);
    return !!(field && field.errors && field.touched);
  }

  /**
   * Maneja el foco en un campo
   */
  onFieldFocus(fieldName: string): void {
    this.clearError();
    const field = this.loginForm.get(fieldName);
    if (field) {
      field.markAsTouched();
    }
  }
}
