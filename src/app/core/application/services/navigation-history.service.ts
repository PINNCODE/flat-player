import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { Subject, Observable } from 'rxjs';

/**
 * Servicio de historial de navegación para Samsung TV
 * Maneja el historial de navegación para la tecla Back/Return
 * Cumple con los requisitos de auditoría Samsung para navegación TV
 */
@Injectable({
  providedIn: 'root'
})
export class NavigationHistoryService {
  private history: string[] = [];
  private maxHistory = 10;
  private historyChange$ = new Subject<string[]>();

  constructor(private router: Router) {}

  /**
   * Agrega una URL al historial de navegación
   * @param url URL actual a agregar
   */
  push(url: string): void {
    // Evitar duplicados consecutivos
    if (this.history.length > 0 && this.history[this.history.length - 1] === url) {
      return;
    }

    this.history.push(url);
    
    // Limitar historial a maxHistory items
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }

    this.historyChange$.next([...this.history]);
  }

  /**
   * Navega a la página anterior en el historial
   * @returns true si navegó exitosamente, false si no hay historial
   */
  async goBack(): Promise<boolean> {
    if (this.history.length <= 1) {
      // Solo hay una página (la actual), no hay a dónde volver
      return false;
    }

    // Remover la página actual
    this.history.pop();
    
    // Obtener la página anterior
    const previousUrl = this.history.pop() || '/';
    
    try {
      await this.router.navigateByUrl(previousUrl);
      this.historyChange$.next([...this.history]);
      return true;
    } catch (error) {
      console.error('Error navigating back:', error);
      // Si falla, restaurar la URL actual
      this.history.push(previousUrl);
      return false;
    }
  }

  /**
   * Verifica si es posible navegar atrás
   * @returns true si hay historial suficiente para navegar atrás
   */
  canGoBack(): boolean {
    return this.history.length > 1;
  }

  /**
   * Obtiene la URL actual del historial
   * @returns URL actual o '/' si el historial está vacío
   */
  getCurrentUrl(): string {
    if (this.history.length === 0) {
      return '/';
    }
    return this.history[this.history.length - 1];
  }

  /**
   * Obtiene la URL anterior en el historial
   * @returns URL anterior o null si no existe
   */
  getPreviousUrl(): string | null {
    if (this.history.length < 2) {
      return null;
    }
    return this.history[this.history.length - 2];
  }

  /**
   * Obtiene todo el historial de navegación
   * @returns Array de URLs en orden cronológico
   */
  getHistory(): string[] {
    return [...this.history];
  }

  /**
   * Limpia todo el historial de navegación
   * Útil al hacer logout o cambiar de usuario
   */
  clear(): void {
    this.history = [];
    this.historyChange$.next([]);
  }

  /**
   * Reemplaza la URL actual en el historial
   * Útil cuando la navegación es interna (sin cambio de ruta)
   * @param url Nueva URL para reemplazar la actual
   */
  replace(url: string): void {
    if (this.history.length > 0) {
      this.history[this.history.length - 1] = url;
      this.historyChange$.next([...this.history]);
    }
  }

  /**
   * Observable para escuchar cambios en el historial
   * @returns Observable que emite el historial actualizado
   */
  getHistoryChanges(): Observable<string[]> {
    return this.historyChange$.asObservable();
  }

  /**
   * Obtiene el tamaño actual del historial
   * @returns Número de URLs en el historial
   */
  getHistorySize(): number {
    return this.history.length;
  }

  /**
   * Verifica si una URL específica está en el historial
   * @param url URL a buscar
   * @returns true si la URL está en el historial
   */
  hasUrl(url: string): boolean {
    return this.history.includes(url);
  }

  /**
   * Navega a una URL específica y la agrega al historial
   * @param url URL a navegar
   */
  async navigateTo(url: string): Promise<boolean> {
    try {
      await this.router.navigateByUrl(url);
      this.push(url);
      return true;
    } catch (error) {
      console.error('Error navigating to:', url, error);
      return false;
    }
  }
}
