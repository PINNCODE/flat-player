import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';

/**
 * Adaptador para Web Storage (localStorage/sessionStorage)
 * Fallback para desarrollo en navegador
 */
@Injectable({
  providedIn: 'root'
})
export class WebStorageAdapter {
  private prefix = 'flatplayer_';

  /**
   * Guarda datos en localStorage
   */
  setItem(key: string, value: string): Observable<void> {
    try {
      localStorage.setItem(this.prefix + key, value);
      return of(void 0);
    } catch (error) {
      console.error('Error saving to localStorage:', error);
      throw new Error('Failed to save to storage');
    }
  }

  /**
   * Obtiene datos de localStorage
   */
  getItem(key: string): Observable<string | null> {
    try {
      const value = localStorage.getItem(this.prefix + key);
      return of(value);
    } catch (error) {
      console.error('Error reading from localStorage:', error);
      return of(null);
    }
  }

  /**
   * Elimina datos de localStorage
   */
  removeItem(key: string): Observable<void> {
    try {
      localStorage.removeItem(this.prefix + key);
      return of(void 0);
    } catch (error) {
      console.error('Error removing from localStorage:', error);
      throw new Error('Failed to remove from storage');
    }
  }

  /**
   * Limpia todos los datos de flatplayer en localStorage
   */
  clear(): Observable<void> {
    try {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith(this.prefix)) {
          localStorage.removeItem(key);
        }
      });
      return of(void 0);
    } catch (error) {
      console.error('Error clearing localStorage:', error);
      throw new Error('Failed to clear storage');
    }
  }

  /**
   * Verifica si una clave existe
   */
  hasKey(key: string): boolean {
    return localStorage.getItem(this.prefix + key) !== null;
  }
}
