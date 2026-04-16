import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { AuthRepositoryImpl } from '../../../../infrastructure/services/auth.repository.impl';
import { AuthCredentials, LoginResponse, User } from '../../../domain/models/user.model';

/**
 * Caso de uso para iniciar sesión
 * Orquesta el proceso de autenticación
 */
@Injectable({
  providedIn: 'root'
})
export class LoginUseCase {
  private authRepository = inject(AuthRepositoryImpl);

  /**
   * Ejecuta el login con las credenciales proporcionadas
   * @param credentials Credenciales de autenticación
   * @returns Observable con el usuario autenticado o error
   */
  execute(credentials: AuthCredentials): Observable<User> {
    return this.authRepository.login(credentials).pipe(
      map((response: LoginResponse) => {
        if (!response.success || !response.session) {
          throw new Error(response.error || 'Error al iniciar sesión');
        }
        return response.session.user;
      })
    );
  }

  /**
   * Valida las credenciales antes de enviarlas
   * @param credentials Credenciales a validar
   * @returns Objeto con resultado de validación
   */
  validateCredentials(credentials: AuthCredentials): { isValid: boolean; errors: Record<string, string> } {
    const errors: Record<string, string> = {};

    // Validar URL del servidor
    if (!credentials['serverUrl']) {
      errors['serverUrl'] = 'La URL del servidor es requerida';
    } else if (!this.isValidUrl(credentials['serverUrl'])) {
      errors['serverUrl'] = 'La URL debe comenzar con http:// o https://';
    }

    // Validar nombre de usuario
    if (!credentials['username']) {
      errors['username'] = 'El nombre de usuario es requerido';
    } else if (credentials['username'].length < 3) {
      errors['username'] = 'El nombre de usuario debe tener al menos 3 caracteres';
    }

    // Validar contraseña
    if (!credentials['password']) {
      errors['password'] = 'La contraseña es requerida';
    } else if (credentials['password'].length < 4) {
      errors['password'] = 'La contraseña debe tener al menos 4 caracteres';
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors
    };
  }

  /**
   * Valida el formato de una URL
   */
  private isValidUrl(url: string): boolean {
    try {
      const urlObj = new URL(url);
      return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
    } catch {
      return false;
    }
  }
}
