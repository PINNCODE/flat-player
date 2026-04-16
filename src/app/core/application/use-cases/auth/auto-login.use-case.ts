import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { AuthRepositoryImpl } from '../../../../infrastructure/services/auth.repository.impl';
import { User } from '../../../domain/models/user.model';

/**
 * Caso de uso para auto-login
 * Intenta recuperar y validar una sesión existente
 */
@Injectable({
  providedIn: 'root'
})
export class AutoLoginUseCase {
  private authRepository = inject(AuthRepositoryImpl);

  /**
   * Ejecuta el auto-login
   * @returns Observable con el usuario autenticado o null si no hay sesión válida
   */
  execute(): Observable<User | null> {
    const session = this.authRepository.getCurrentSession();
    
    if (!session) {
      return new Observable<User | null>(observer => {
        observer.next(null);
        observer.complete();
      });
    }

    // Verificar si la sesión es válida
    if (this.authRepository.hasValidSession()) {
      return new Observable<User | null>(observer => {
        observer.next(session.user);
        observer.complete();
      });
    }

    // Sesión expirada, limpiar y retornar null
    this.authRepository.clearSession();
    return new Observable<User | null>(observer => {
      observer.next(null);
      observer.complete();
    });
  }

  /**
   * Verifica si hay una sesión guardada
   * @returns true si hay sesión guardada
   */
  hasSavedSession(): boolean {
    return this.authRepository.getCurrentSession() !== null;
  }

  /**
   * Verifica si la sesión guardada es válida
   * @returns true si hay una sesión válida
   */
  hasValidSession(): boolean {
    return this.authRepository.hasValidSession();
  }
}
