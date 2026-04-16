import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { catchError, map, timeout } from 'rxjs/operators';
import { AuthCredentials, AuthSession, LoginResponse, User } from '../../core/domain/models/user.model';

/**
 * Servicio HTTP para autenticación
 * Maneja las llamadas al API de autenticación del servidor IPTV
 */
@Injectable({
  providedIn: 'root'
})
export class AuthHttpService {
  private http = inject(HttpClient);
  private timeoutDuration = 10000; // 10 segundos timeout

  /**
   * Inicia sesión con las credenciales proporcionadas
   */
  login(credentials: AuthCredentials): Observable<LoginResponse> {
    // Validar formato de URL
    if (!this.isValidUrl(credentials.serverUrl)) {
      return of({
        success: false,
        error: 'URL del servidor inválida. Debe comenzar con http:// o https://',
        errorCode: 'INVALID_URL'
      });
    }

    // Validar campos requeridos
    if (!credentials.username || !credentials.password) {
      return of({
        success: false,
        error: 'Usuario y contraseña son requeridos',
        errorCode: 'MISSING_CREDENTIALS'
      });
    }

    // Construir URL del endpoint de login
    const loginUrl = this.buildLoginUrl(credentials.serverUrl);

    return this.http.post<any>(loginUrl, {
      username: credentials.username,
      password: credentials.password
    }).pipe(
      timeout(this.timeoutDuration),
      map(response => this.handleLoginSuccess(response, credentials)),
      catchError(error => this.handleLoginError(error))
    );
  }

  /**
   * Refresca el token de sesión
   */
  refreshToken(refreshToken: string): Observable<AuthSession> {
    // Implementar según la API del servidor IPTV
    // Por ahora, retornar un observable vacío
    return of({} as AuthSession);
  }

  /**
   * Cierra la sesión en el servidor
   */
  logout(serverUrl: string, token?: string): Observable<void> {
    const logoutUrl = `${serverUrl}/logout`;
    
    return this.http.post<void>(logoutUrl, {
      token: token
    }).pipe(
      timeout(this.timeoutDuration),
      catchError(error => {
        console.error('Error during logout:', error);
        // Retornar éxito aunque falle el logout en servidor
        return of(void 0);
      })
    );
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

  /**
   * Construye la URL del endpoint de login
   */
  private buildLoginUrl(serverUrl: string): string {
    // Remover trailing slash si existe
    const cleanUrl = serverUrl.replace(/\/$/, '');
    return `${cleanUrl}/api/login`;
  }

  /**
   * Maneja respuesta exitosa de login
   */
  private handleLoginSuccess(response: any, credentials: AuthCredentials): LoginResponse {
    try {
      // Adaptar según la respuesta real del servidor IPTV
      const user: User = {
        id: response.user?.id || credentials.username,
        username: response.user?.username || credentials.username,
        serverUrl: credentials.serverUrl,
        createdAt: new Date().toISOString(),
        expiresAt: response.expiresAt || this.calculateExpiryDate()
      };

      const session: AuthSession = {
        user,
        token: response.token,
        refreshToken: response.refreshToken,
        expiresAt: response.expiresAt || this.calculateExpiryDate()
      };

      return {
        success: true,
        session
      };
    } catch (error) {
      return {
        success: false,
        error: 'Error al procesar la respuesta del servidor',
        errorCode: 'PARSE_ERROR'
      };
    }
  }

  /**
   * Maneja errores de login
   */
  private handleLoginError(error: any): Observable<LoginResponse> {
    console.error('Login error:', error);

    let errorMessage = 'Error al iniciar sesión';
    let errorCode = 'UNKNOWN_ERROR';

    if (error.name === 'TimeoutError') {
      errorMessage = 'Tiempo de espera agotado. Verifica tu conexión.';
      errorCode = 'TIMEOUT';
    } else if (error.status === 401) {
      errorMessage = 'Credenciales inválidas';
      errorCode = 'INVALID_CREDENTIALS';
    } else if (error.status === 404) {
      errorMessage = 'Servidor no encontrado. Verifica la URL.';
      errorCode = 'SERVER_NOT_FOUND';
    } else if (error.status === 0) {
      errorMessage = 'No se pudo conectar al servidor. Verifica tu conexión.';
      errorCode = 'CONNECTION_ERROR';
    } else if (error.error?.message) {
      errorMessage = error.error.message;
    }

    return of({
      success: false,
      error: errorMessage,
      errorCode
    });
  }

  /**
   * Calcula la fecha de expiración (30 días por defecto)
   */
  private calculateExpiryDate(): string {
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + 30);
    return expiry.toISOString();
  }
}
