# DestroyService - Ejemplo de Uso

El `DestroyService` es un servicio que simplifica la limpieza de suscripciones RxJS para evitar memory leaks en aplicaciones Angular, especialmente crítico para Samsung TV donde la memoria es limitada.

## DestroyService

Servicio que extiende `Subject<void>` y se limpia automáticamente en `ngOnDestroy`.

### Uso Básico

```typescript
import { Component, inject } from '@angular/core';
import { DestroyService } from './shared/utils/destroy.service';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-example',
  standalone: true,
  template: `<div>Contenido</div>`
})
export class ExampleComponent {
  private destroy$ = inject(DestroyService);

  ngOnInit(): void {
    // Suscripción con limpieza automática
    someObservable$
      .pipe(takeUntil(this.destroy$))
      .subscribe(data => {
        console.log(data);
      });

    // Múltiples suscripciones
    observable1$.pipe(takeUntil(this.destroy$)).subscribe();
    observable2$.pipe(takeUntil(this.destroy$)).subscribe();
    observable3$.pipe(takeUntil(this.destroy$)).subscribe();
  }

  // No es necesario llamar destroy$.next() manualmente
  // El servicio lo hace automáticamente en ngOnDestroy
}
```

### Uso con takeUntilDestroyed

Operador personalizado que simplifica aún más el uso:

```typescript
import { Component } from '@angular/core';
import { takeUntilDestroyed } from './shared/utils/take-until-destroyed';

@Component({
  selector: 'app-example',
  standalone: true,
  template: `<div>Contenido</div>`
})
export class ExampleComponent {
  ngOnInit(): void {
    // Sin necesidad de inyectar DestroyService
    someObservable$
      .pipe(takeUntilDestroyed())
      .subscribe(data => {
        console.log(data);
      });
  }
}
```

## AsyncDestroyDirective

Directiva para limpieza de suscripciones en elementos del template.

### Uso en Template

```typescript
import { Component } from '@angular/core';
import { AsyncDestroyDirective } from './shared/utils/async-destroy';

@Component({
  selector: 'app-example',
  standalone: true,
  imports: [AsyncDestroyDirective],
  template: `
    <div 
      appAsyncDestroy 
      [appAsyncDestroy]="cleanup"
    >
      <!-- Contenido con suscripciones -->
    </div>
  `
})
export class ExampleComponent {
  cleanup(): void {
    console.log('Limpiando recursos');
    // Lógica de limpieza personalizada
  }
}
```

## Ejemplo Completo con Múltiples Suscripciones

```typescript
import { Component, inject } from '@angular/core';
import { DestroyService } from './shared/utils/destroy.service';
import { HttpClient } from '@angular/common/http';
import { takeUntil, switchMap, debounceTime } from 'rxjs/operators';

@Component({
  selector: 'app-channels',
  standalone: true,
  template: `
    <div class="channels">
      <h1>Canales</h1>
      <input 
        type="text" 
        placeholder="Buscar canales..." 
        (input)="onSearch($event)"
      />
      <ul>
        <li *ngFor="let channel of channels">
          {{ channel.name }}
        </li>
      </ul>
    </div>
  `
})
export class ChannelsComponent {
  private http = inject(HttpClient);
  private destroy$ = inject(DestroyService);
  
  channels: any[] = [];
  searchSubject = new Subject<string>();

  ngOnInit(): void {
    // Búsqueda con debounce
    this.searchSubject
      .pipe(
        debounceTime(300),
        switchMap(query => this.http.get(`/api/channels?q=${query}`)),
        takeUntil(this.destroy$)
      )
      .subscribe(channels => {
        this.channels = channels;
      });

    // Suscripción a actualizaciones en tiempo real
    this.http.get('/api/channels/updates')
      .pipe(takeUntil(this.destroy$))
      .subscribe(updates => {
        // Procesar actualizaciones
      });
  }

  onSearch(event: Event): void {
    const query = (event.target as HTMLInputElement).value;
    this.searchSubject.next(query);
  }

  ngOnDestroy(): void {
    // No es necesario limpiar manualmente
    // DestroyService lo hace automáticamente
  }
}
```

## Integración con Servicios Existentes

Los servicios existentes ya deberían usar `DestroyService`:

```typescript
// Antes (sin DestroyService)
export class VideoPlaybackService implements OnDestroy {
  private destroy$ = new Subject<void>();

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}

// Después (con DestroyService)
export class VideoPlaybackService {
  private destroy$ = inject(DestroyService);
  
  // ngOnDestroy no es necesario
}
```

## Patrón con Componentes Base

Crear un componente base que inyecte DestroyService:

```typescript
import { Directive, inject } from '@angular/core';
import { DestroyService } from './destroy.service';

@Directive()
export abstract class BaseComponent implements OnDestroy {
  protected destroy$ = inject(DestroyService);

  ngOnDestroy(): void {
    // DestroyService maneja la limpieza automáticamente
  }
}
```

Uso:

```typescript
@Component({
  selector: 'app-example',
  standalone: true,
  template: `<div>Contenido</div>`
})
export class ExampleComponent extends BaseComponent {
  ngOnInit(): void {
    someObservable$.pipe(takeUntil(this.destroy$)).subscribe();
  }
}
```

## Consideraciones de Memoria para TV

### Por qué es crítico en Samsung TV:

1. **Memoria limitada**: Las TVs tienen menos RAM que computadoras
2. **Sin recarga de página**: Las apps TV son SPA que corren por horas
3. **Acumulación de suscripciones**: Cada navegación puede dejar suscripciones activas
4. **Memory leaks causan crashes**: Samsung rechaza apps con memory leaks

### Mejores prácticas:

1. **Siempre usar takeUntil con DestroyService** para suscripciones en componentes
2. **Usar takeUntilDestroyed** para código más conciso
3. **Limpiar recursos pesados** (videos, sockets, timers) en ngOnDestroy
4. **Evitar crear Subjects nuevos** en componentes, usar DestroyService
5. **Monitorear memoria** durante desarrollo con Chrome DevTools

### Ejemplo de limpieza de recursos pesados:

```typescript
import { Component, inject } from '@angular/core';
import { DestroyService } from './shared/utils/destroy.service';
import { VideoPlaybackService } from './infrastructure/services/video-playback.service';

@Component({
  selector: 'app-player',
  standalone: true,
  template: `<div>Reproductor</div>`
})
export class PlayerComponent {
  private videoService = inject(VideoPlaybackService);
  private destroy$ = inject(DestroyService);
  private timer?: any;

  ngOnInit(): void {
    // Suscripción a telemetría
    this.videoService.getTelemetry()
      .pipe(takeUntil(this.destroy$))
      .subscribe(data => {
        console.log('Telemetría:', data);
      });

    // Timer para actualizaciones periódicas
    this.timer = setInterval(() => {
      this.updateStatus();
    }, 5000);
  }

  ngOnDestroy(): void {
    // Limpiar timer manualmente
    if (this.timer) {
      clearInterval(this.timer);
    }
    
    // Detener reproducción de video
    this.videoService.stop();
    
    // DestroyService limpia las suscripciones automáticamente
  }

  private updateStatus(): void {
    // Lógica de actualización
  }
}
```

## Testing

Para verificar que las suscripciones se limpian correctamente:

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DestroyService } from './destroy.service';

describe('ExampleComponent', () => {
  let component: ExampleComponent;
  let fixture: ComponentFixture<ExampleComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ExampleComponent],
      providers: [DestroyService]
    });
    fixture = TestBed.createComponent(ExampleComponent);
    component = fixture.componentInstance;
  });

  it('should clean up subscriptions on destroy', () => {
    const spy = jest.spyOn(component['destroy$'], 'next');
    
    fixture.detectChanges();
    fixture.destroy();
    
    expect(spy).toHaveBeenCalled();
  });
});
```

## Resumen

- **DestroyService**: Servicio que se limpia automáticamente en ngOnDestroy
- **takeUntilDestroyed**: Operador simplificado para uso sin inyección
- **AsyncDestroyDirective**: Directiva para limpieza en templates
- **Uso obligatorio**: En todos los componentes con suscripciones RxJS
- **Crítico para TV**: Evita memory leaks que causan crashes en Samsung TV
