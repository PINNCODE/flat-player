import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { AuthRepositoryImpl } from '../../../../infrastructure/services/auth.repository.impl';

/**
 * Caso de uso para cerrar sesión
 * Limpia la sesión local y notifica al servidor
 */
@Injectable({
  providedIn: 'root'
})
export class LogoutUseCase {
  private authRepository = inject(AuthRepositoryImpl);

  /**
   * Ejecuta el logout
   * @returns Observable que se completa cuando el logout es exitoso
   */
  execute(): Observable<void> {
    return this.authRepository.logout();
  }

  /**
   * Ejecuta el logout sin notificar al servidor
   * Útil para casos donde la conexión a internet no está disponible
   * @returns Observable que se completa inmediatamente
   */
  executeLocalOnly(): Observable<void> {
    return new Observable<void>(observer => {
      this.authRepository.clearSession();
      observer.next();
      observer.complete();
    });
  }

  /**
   * Verifica si hay una sesión activa
   * @returns true si hay sesión activa
   */
  hasActiveSession(): boolean {
    return this.authRepository.hasValidSession();
  }
}
