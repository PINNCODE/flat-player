import { Observable } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { DestroyService } from './destroy.service';
import { inject } from '@angular/core';

/**
 * Operador personalizado que usa DestroyService automáticamente
 * Simplifica el uso de takeUntil con destroy$
 * 
 * Uso:
 * ```typescript
 * import { takeUntilDestroyed } from './shared/utils/take-until-destroyed';
 * 
 * export class MyComponent {
 *   ngOnInit() {
 *     someObservable$.pipe(takeUntilDestroyed()).subscribe();
 *   }
 * }
 * ```
 */
export function takeUntilDestroyed<T>(destroyService?: DestroyService) {
  const destroy = destroyService || inject(DestroyService);
  return takeUntil<T>(destroy as any);
}
