import { Injectable, ElementRef, OnDestroy } from '@angular/core';
import { Subject, Observable, fromEvent } from 'rxjs';
import { takeUntil, filter, debounceTime } from 'rxjs/operators';

/**
 * Servicio de gestión de foco para Samsung TV
 * Maneja la navegación mediante control remoto y mantiene el estado del foco visual
 * Cumple con los requisitos de auditoría Samsung para navegación TV-First
 */
@Injectable({
  providedIn: 'root'
})
export class FocusManagementService implements OnDestroy {
  private focusableElements: Map<string, ElementRef> = new Map();
  private currentFocusId: string | null = null;
  private focusHistory: string[] = [];
  private destroy$ = new Subject<void>();

  // Teclas del control remoto Samsung
  private readonly KEY_CODES = {
    LEFT: 37,
    UP: 38,
    RIGHT: 39,
    DOWN: 40,
    ENTER: 13,
    BACK: 10009, // Tizen Back key
    RETURN: 461 // Tizen Return key
  };

  // Subject para emitir cambios de foco
  private focusChange$ = new Subject<string | null>();

  constructor() {
    this.initializeKeyListener();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.focusChange$.complete();
  }

  /**
   * Inicializa el listener de teclas del control remoto
   * Mapea las teclas físicas a acciones de navegación
   */
  private initializeKeyListener(): void {
    fromEvent<KeyboardEvent>(document, 'keydown')
      .pipe(
        takeUntil(this.destroy$),
        filter((event) => this.isRemoteKey(event.keyCode))
      )
      .subscribe((event) => this.handleKeyDown(event));
  }

  /**
   * Verifica si el keyCode corresponde a una tecla del control remoto
   */
  private isRemoteKey(keyCode: number): boolean {
    return Object.values(this.KEY_CODES).includes(keyCode);
  }

  /**
   * Maneja los eventos de teclado del control remoto
   */
  private handleKeyDown(event: KeyboardEvent): void {
    event.preventDefault();

    switch (event.keyCode) {
      case this.KEY_CODES.LEFT:
        this.navigateFocus('left');
        break;
      case this.KEY_CODES.UP:
        this.navigateFocus('up');
        break;
      case this.KEY_CODES.RIGHT:
        this.navigateFocus('right');
        break;
      case this.KEY_CODES.DOWN:
        this.navigateFocus('down');
        break;
      case this.KEY_CODES.ENTER:
        this.activateFocusedElement();
        break;
      case this.KEY_CODES.BACK:
      case this.KEY_CODES.RETURN:
        this.handleBackKey();
        break;
    }
  }

  /**
   * Navega el foco en la dirección especificada
   * Implementa navegación circular según requisitos de auditoría
   */
  private navigateFocus(direction: 'left' | 'up' | 'right' | 'down'): void {
    if (!this.currentFocusId) {
      // Si no hay foco actual, enfocar el primer elemento
      this.focusFirstElement();
      return;
    }

    const currentElement = this.focusableElements.get(this.currentFocusId);
    if (!currentElement) return;

    const nextElement = this.findNextFocusableElement(currentElement, direction);
    
    if (nextElement) {
      this.setFocus(nextElement);
    }
  }

  /**
   * Busca el siguiente elemento enfocable en la dirección especificada
   * Implementa algoritmo de búsqueda espacial para TV
   */
  private findNextFocusableElement(
    current: ElementRef,
    direction: 'left' | 'up' | 'right' | 'down'
  ): ElementRef | null {
    const currentRect = current.nativeElement.getBoundingClientRect();
    const candidates: Array<{ element: ElementRef; distance: number }> = [];

    this.focusableElements.forEach((element, id) => {
      if (id === this.currentFocusId) return;

      const rect = element.nativeElement.getBoundingClientRect();
      const isVisible = this.isElementVisible(rect);
      
      if (!isVisible) return;

      const distance = this.calculateDistance(currentRect, rect, direction);
      
      if (distance !== null) {
        candidates.push({ element, distance });
      }
    });

    // Ordenar por distancia y retornar el más cercano
    candidates.sort((a, b) => a.distance - b.distance);
    
    return candidates.length > 0 ? candidates[0].element : null;
  }

  /**
   * Calcula la distancia entre elementos considerando la dirección de navegación
   * Retorna null si el elemento no es válido para la dirección especificada
   */
  private calculateDistance(
    current: DOMRect,
    target: DOMRect,
    direction: 'left' | 'up' | 'right' | 'down'
  ): number | null {
    const centerX = current.left + current.width / 2;
    const centerY = current.top + current.height / 2;
    const targetCenterX = target.left + target.width / 2;
    const targetCenterY = target.top + target.height / 2;

    switch (direction) {
      case 'left':
        // Elemento debe estar a la izquierda
        if (targetCenterX >= centerX - current.width / 2) return null;
        return Math.sqrt(
          Math.pow(centerX - targetCenterX, 2) + 
          Math.pow(centerY - targetCenterY, 2)
        );
      case 'right':
        // Elemento debe estar a la derecha
        if (targetCenterX <= centerX + current.width / 2) return null;
        return Math.sqrt(
          Math.pow(centerX - targetCenterX, 2) + 
          Math.pow(centerY - targetCenterY, 2)
        );
      case 'up':
        // Elemento debe estar arriba
        if (targetCenterY >= centerY - current.height / 2) return null;
        return Math.sqrt(
          Math.pow(centerX - targetCenterX, 2) + 
          Math.pow(centerY - targetCenterY, 2)
        );
      case 'down':
        // Elemento debe estar abajo
        if (targetCenterY <= centerY + current.height / 2) return null;
        return Math.sqrt(
          Math.pow(centerX - targetCenterX, 2) + 
          Math.pow(centerY - targetCenterY, 2)
        );
    }
  }

  /**
   * Verifica si un elemento es visible en el viewport
   */
  private isElementVisible(rect: DOMRect): boolean {
    return (
      rect.top >= 0 &&
      rect.left >= 0 &&
      rect.bottom <= window.innerHeight &&
      rect.right <= window.innerWidth
    );
  }

  /**
   * Enfoca el primer elemento registrable
   */
  private focusFirstElement(): void {
    const firstId = this.focusableElements.keys().next().value;
    if (firstId) {
      const element = this.focusableElements.get(firstId);
      if (element) {
        this.setFocus(element);
      }
    }
  }

  /**
   * Establece el foco en un elemento específico
   * Actualiza el historial de navegación
   */
  private setFocus(element: ElementRef): void {
    // Remover clase de foco del elemento anterior
    if (this.currentFocusId) {
      const prevElement = this.focusableElements.get(this.currentFocusId);
      if (prevElement) {
        prevElement.nativeElement.classList.remove('focused');
        prevElement.nativeElement.setAttribute('aria-selected', 'false');
      }
    }

    // Agregar al historial
    const elementId = this.getElementId(element);
    if (elementId !== this.currentFocusId) {
      this.focusHistory.push(this.currentFocusId || '');
      // Limitar historial a 10 elementos
      if (this.focusHistory.length > 10) {
        this.focusHistory.shift();
      }
    }

    this.currentFocusId = elementId;
    
    // Aplicar clase de foco visual
    element.nativeElement.classList.add('focused');
    element.nativeElement.setAttribute('aria-selected', 'true');
    element.nativeElement.focus();

    // Emitir cambio de foco
    this.focusChange$.next(elementId);
  }

  /**
   * Activa el elemento actualmente enfocado (simula click)
   */
  private activateFocusedElement(): void {
    if (!this.currentFocusId) return;

    const element = this.focusableElements.get(this.currentFocusId);
    if (element) {
      element.nativeElement.click();
    }
  }

  /**
   * Maneja la tecla Back/Return del control remoto
   * Navega al elemento anterior en el historial
   */
  private handleBackKey(): void {
    if (this.focusHistory.length > 0) {
      const previousId = this.focusHistory.pop();
      if (previousId) {
        const previousElement = this.focusableElements.get(previousId);
        if (previousElement) {
          this.setFocus(previousElement);
          // Remover del historial ya que estamos volviendo
          this.focusHistory.pop();
        }
      }
    }
  }

  /**
   * Registra un elemento como enfocable
   * @param id Identificador único del elemento
   * @param element Referencia al elemento DOM
   */
  registerFocusable(id: string, element: ElementRef): void {
    this.focusableElements.set(id, element);
    
    // Agregar atributos de accesibilidad
    element.nativeElement.setAttribute('tabindex', '0');
    element.nativeElement.setAttribute('role', 'button');
    element.nativeElement.setAttribute('data-focus-id', id);
  }

  /**
   * Desregistra un elemento enfocable
   * @param id Identificador del elemento a desregistrar
   */
  unregisterFocusable(id: string): void {
    const element = this.focusableElements.get(id);
    if (element) {
      element.nativeElement.classList.remove('focused');
      element.nativeElement.removeAttribute('tabindex');
      element.nativeElement.removeAttribute('role');
      element.nativeElement.removeAttribute('aria-selected');
      element.nativeElement.removeAttribute('data-focus-id');
    }
    
    this.focusableElements.delete(id);
    
    // Si el elemento desregistrado tenía el foco, limpiar
    if (this.currentFocusId === id) {
      this.currentFocusId = null;
      this.focusChange$.next(null);
    }
  }

  /**
   * Enfoca un elemento específico por su ID
   * @param id Identificador del elemento a enfocar
   */
  focusById(id: string): void {
    const element = this.focusableElements.get(id);
    if (element) {
      this.setFocus(element);
    }
  }

  /**
   * Limpia todo el estado de foco
   * Útil al cambiar de página/ruta
   */
  clearFocus(): void {
    this.focusableElements.forEach((element) => {
      element.nativeElement.classList.remove('focused');
      element.nativeElement.setAttribute('aria-selected', 'false');
    });
    
    this.currentFocusId = null;
    this.focusHistory = [];
    this.focusChange$.next(null);
  }

  /**
   * Observable para escuchar cambios de foco
   */
  getFocusChanges(): Observable<string | null> {
    return this.focusChange$.asObservable();
  }

  /**
   * Obtiene el ID del elemento actualmente enfocado
   */
  getCurrentFocusId(): string | null {
    return this.currentFocusId;
  }

  /**
   * Obtiene el ID de un elemento a partir de su ElementRef
   */
  private getElementId(element: ElementRef): string {
    return element.nativeElement.getAttribute('data-focus-id') || '';
  }
}
