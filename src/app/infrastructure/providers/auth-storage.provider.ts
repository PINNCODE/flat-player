import { Injectable, inject } from '@angular/core';
import { Observable, from, of } from 'rxjs';
import { TizenStorageAdapter } from '../adapters/tizen/tizen-storage.adapter';
import { WebStorageAdapter } from '../adapters/web/web-storage.adapter';

/**
 * Provider unificado de almacenamiento de autenticación
 * Usa TizenStorageAdapter en Tizen y WebStorageAdapter como fallback
 */
@Injectable({
  providedIn: 'root'
})
export class AuthStorageProvider {
  private tizenStorage = inject(TizenStorageAdapter);
  private webStorage = inject(WebStorageAdapter);
  private isTizen: boolean;

  constructor() {
    this.isTizen = this.detectTizen();
  }

  /**
   * Detecta si corre en entorno Tizen
   */
  private detectTizen(): boolean {
    return typeof window !== 'undefined' && 
           typeof (window as any).tizen !== 'undefined';
  }

  /**
   * Guarda datos en el almacenamiento apropiado
   */
  setItem(key: string, value: string): Observable<void> {
    if (this.isTizen) {
      return this.tizenStorage.setItem(key, value);
    }
    return this.webStorage.setItem(key, value);
  }

  /**
   * Obtiene datos del almacenamiento apropiado
   */
  getItem(key: string): Observable<string | null> {
    if (this.isTizen) {
      return this.tizenStorage.getItem(key);
    }
    return this.webStorage.getItem(key);
  }

  /**
   * Elimina datos del almacenamiento apropiado
   */
  removeItem(key: string): Observable<void> {
    if (this.isTizen) {
      return this.tizenStorage.removeItem(key);
    }
    return this.webStorage.removeItem(key);
  }

  /**
   * Limpia todo el almacenamiento apropiado
   */
  clear(): Observable<void> {
    if (this.isTizen) {
      return this.tizenStorage.clear();
    }
    return this.webStorage.clear();
  }
}
