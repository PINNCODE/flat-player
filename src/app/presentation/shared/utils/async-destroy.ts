import { Directive, inject, OnDestroy, Input } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

/**
 * Directiva que proporciona un patrón de destrucción consistente
 * Se puede usar como directiva en elementos para limpiar suscripciones
 * 
 * Uso:
 * ```html
 * <div appAsyncDestroy (destroy)="cleanup()">
 *   Contenido con suscripciones
 * </div>
 * ```
 */
@Directive({
  selector: '[appAsyncDestroy]',
  standalone: true
})
export class AsyncDestroyDirective implements OnDestroy {
  private destroy$ = new Subject<void>();
  private destroyCallback: (() => void) | null = null;

  /**
   * Callback que se ejecuta cuando se destruye el elemento
   */
  @Input('appAsyncDestroy') set destroy(callback: () => void) {
    this.destroyCallback = callback;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    
    if (this.destroyCallback) {
      this.destroyCallback();
    }
  }

  /**
   * Obtiene el observable de destrucción
   */
  getDestroy(): Subject<void> {
    return this.destroy$;
  }
}
