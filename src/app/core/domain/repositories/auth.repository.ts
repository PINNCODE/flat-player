import { Observable } from 'rxjs';
import { AuthCredentials, AuthSession, LoginResponse, User } from '../models/user.model';

/**
 * Interfaz del repositorio de autenticación
 * Define los contratos para operaciones de autenticación
 */
export interface AuthRepository {
  /**
   * Inicia sesión con las credenciales proporcionadas
   * @param credentials Credenciales de autenticación
   * @returns Observable con la respuesta de login
   */
  login(credentials: AuthCredentials): Observable<LoginResponse>;

  /**
   * Refresca el token de sesión actual
   * @param refreshToken Token de refresco
   * @returns Observable con la nueva sesión
   */
  refreshToken(refreshToken: string): Observable<AuthSession>;

  /**
   * Cierra la sesión actual
   * @returns Observable que se completa cuando el logout es exitoso
   */
  logout(): Observable<void>;

  /**
   * Obtiene la sesión actual almacenada
   * @returns Sesión actual o null si no existe
   */
  getCurrentSession(): AuthSession | null;

  /**
   * Guarda la sesión actual
   * @param session Sesión a guardar
   */
  saveSession(session: AuthSession): void;

  /**
   * Elimina la sesión actual
   */
  clearSession(): void;

  /**
   * Verifica si hay una sesión activa
   * @returns true si hay sesión activa y válida
   */
  hasValidSession(): boolean;
}
