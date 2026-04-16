/**
 * Modelo de dominio para Usuario
 * Representa la información del usuario autenticado
 */
export interface User {
  id: string;
  username: string;
  serverUrl: string;
  createdAt: string;
  expiresAt?: string;
  country?: string;
}

/**
 * Modelo para credenciales de autenticación
 */
export interface AuthCredentials {
  serverUrl: string;
  username: string;
  password: string;
}

/**
 * Modelo para sesión de autenticación
 */
export interface AuthSession {
  user: User;
  token?: string;
  refreshToken?: string;
  expiresAt: string;
}

/**
 * Modelo para respuesta de login
 */
export interface LoginResponse {
  success: boolean;
  session?: AuthSession;
  error?: string;
  errorCode?: string;
}

/**
 * Modelo para validación de campos
 */
export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}
