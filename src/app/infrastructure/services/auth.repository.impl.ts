import { Injectable, inject } from '@angular/core';
import { Observable, of, from } from 'rxjs';
import { map, switchMap, catchError } from 'rxjs/operators';
import { AuthRepository } from '../../core/domain/repositories/auth.repository';
import { AuthCredentials, AuthSession, LoginResponse } from '../../core/domain/models/user.model';
import { AuthHttpService } from './auth-http.service';
import { AuthStorageProvider } from '../providers/auth-storage.provider';

/**
 * Implementación del repositorio de autenticación
 * Coordina HTTP service y storage provider
 */
@Injectable({
  providedIn: 'root'
})
export class AuthRepositoryImpl implements AuthRepository {
  private httpService = inject(AuthHttpService);
  private storageProvider = inject(AuthStorageProvider);
  
  private readonly SESSION_KEY = 'auth_session';

  /**
   * Inicia sesión con las credenciales proporcionadas
   */
  login(credentials: AuthCredentials): Observable<LoginResponse> {
    return this.httpService.login(credentials).pipe(
      switchMap(response => {
        if (response.success && response.session) {
          // Guardar sesión si el login fue exitoso
          return from(this.saveSessionSync(response.session)).pipe(
            map(() => response)
          );
        }
        return of(response);
      }),
      catchError(error => {
        console.error('Login error:', error);
        return of({
          success: false,
          error: 'Error al iniciar sesión',
          errorCode: 'REPOSITORY_ERROR'
        });
      })
    );
  }

  /**
   * Refresca el token de sesión actual
   */
  refreshToken(refreshToken: string): Observable<AuthSession> {
    return this.httpService.refreshToken(refreshToken).pipe(
      switchMap(session => {
        return from(this.saveSessionSync(session)).pipe(
          map(() => session)
        );
      }),
      catchError(error => {
        console.error('Token refresh error:', error);
        // Si falla el refresh, limpiar sesión
        this.clearSession();
        throw error;
      })
    );
  }

  /**
   * Cierra la sesión actual
   */
  logout(): Observable<void> {
    const session = this.getCurrentSession();
    
    if (session) {
      // Llamar logout en servidor
      return this.httpService.logout(session.user.serverUrl, session.token).pipe(
        map(() => {
          // Limpiar sesión local
          this.clearSession();
        }),
        catchError(error => {
          console.error('Logout error:', error);
          // Limpiar sesión local aunque falle el logout en servidor
          this.clearSession();
          return of(void 0);
        })
      );
    }
    
    // No hay sesión, solo limpiar
    this.clearSession();
    return of(void 0);
  }

  /**
   * Obtiene la sesión actual almacenada
   */
  getCurrentSession(): AuthSession | null {
    const sessionJson = localStorage.getItem(this.SESSION_KEY);
    if (!sessionJson) return null;

    try {
      const session: AuthSession = JSON.parse(sessionJson);
      
      // Verificar si la sesión expiró
      if (this.isSessionExpired(session)) {
        this.clearSession();
        return null;
      }
      
      return session;
    } catch (error) {
      console.error('Error parsing session:', error);
      this.clearSession();
      return null;
    }
  }

  /**
   * Guarda la sesión actual
   */
  saveSession(session: AuthSession): Observable<void> {
    return from(this.saveSessionSync(session));
  }

  /**
   * Elimina la sesión actual
   */
  clearSession(): void {
    localStorage.removeItem(this.SESSION_KEY);
    this.storageProvider.removeItem(this.SESSION_KEY).subscribe();
  }

  /**
   * Verifica si hay una sesión activa
   */
  hasValidSession(): boolean {
    const session = this.getCurrentSession();
    return session !== null && !this.isSessionExpired(session);
  }

  /**
   * Guarda sesión de forma síncrona (para uso interno)
   */
  private saveSessionSync(session: AuthSession): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const sessionJson = JSON.stringify(session);
        localStorage.setItem(this.SESSION_KEY, sessionJson);
        
        // También guardar en storage provider (Tizen o Web)
        this.storageProvider.setItem(this.SESSION_KEY, sessionJson).subscribe({
          next: () => resolve(),
          error: (error) => {
            console.error('Error saving to storage provider:', error);
            // Resolver aunque falle el storage provider, ya que localStorage funcionó
            resolve();
          }
        });
      } catch (error) {
        console.error('Error saving session:', error);
        reject(error);
      }
    });
  }

  /**
   * Verifica si la sesión expiró
   */
  private isSessionExpired(session: AuthSession): boolean {
    if (!session.expiresAt) return false;
    
    const expiryDate = new Date(session.expiresAt);
    const now = new Date();
    
    return now > expiryDate;
  }
}
