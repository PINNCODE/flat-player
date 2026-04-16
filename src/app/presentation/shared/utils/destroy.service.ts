import { Injectable, OnDestroy, Optional } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

/**
 * Servicio que extiende Subject para limpieza automática de suscripciones
 * Se inyecta en componentes para manejar automáticamente la destrucción de observables
 * 
 * Uso típico:
 * ```typescript
 * export class MyComponent {
 *   private destroy$ = inject(DestroyService);
 * 
 *   ngOnInit() {
 *     someObservable$.pipe(takeUntil(this.destroy$)).subscribe();
 *   }
 * }
 * ```
 * 
 * El servicio llama automáticamente next() y complete() en ngOnDestroy
 */
@Injectable({
  providedIn: 'root'
})
export class DestroyService extends Subject<void> implements OnDestroy {
  constructor(@Optional() parentDestroy?: DestroyService) {
    super();

    // Si hay un padre DestroyService, suscribirse para propagar destrucción
    if (parentDestroy) {
      parentDestroy.pipe(takeUntil(this)).subscribe(() => {
        this.next();
        this.complete();
      });
    }
  }

  ngOnDestroy(): void {
    this.next();
    this.complete();
  }
}
