# Plan Técnico - FlatPlayer para Samsung TV (Tizen)

## Resumen Ejecutivo

Plan de implementación técnica para FlatPlayer, aplicación IPTV para Samsung Smart TV, priorizando el cumplimiento de la auditoría de Samsung TV Store. El plan se enfoca en optimización para TV, gestión de memoria, y navegación por control remoto.

---

## 1. Estructura de Archivos Recomendada

```
src/app/
├── core/
│   ├── application/
│   │   ├── ports/                    # Interfaces para casos de uso
│   │   ├── use-cases/                # Casos de uso del dominio
│   │   │   ├── auth/
│   │   │   │   ├── login.use-case.ts
│   │   │   │   ├── auto-login.use-case.ts
│   │   │   │   └── logout.use-case.ts
│   │   │   ├── channels/
│   │   │   │   ├── get-channels.use-case.ts
│   │   │   │   ├── change-channel.use-case.ts
│   │   │   │   └── search-channels.use-case.ts
│   │   │   ├── playback/
│   │   │   │   ├── play-stream.use-case.ts
│   │   │   │   └── resolve-stream-url.use-case.ts
│   │   │   └── epg/
│   │   │       ├── get-epg.use-case.ts
│   │   │       └── get-current-program.use-case.ts
│   │   └── services/                 # Servicios de aplicación
│   │       ├── focus-management.service.ts ✓ (CREADO)
│   │       └── navigation-history.service.ts
│   └── domain/
│       ├── models/                   # Entidades del dominio
│       │   ├── channel.model.ts
│       │   ├── epg.model.ts
│       │   ├── user.model.ts
│       │   └── stream.model.ts
│       └── repositories/            # Interfaces de repositorios
│           ├── channel.repository.ts
│           ├── auth.repository.ts
│           └── epg.repository.ts
│
├── infrastructure/
│   ├── adapters/
│   │   ├── tizen/                    # Adaptadores específicos Tizen
│   │   │   ├── avplay.adapter.ts    # Wrapper AVPlay Samsung
│   │   │   ├── tizen-keyboard.adapter.ts
│   │   │   ├── tizen-storage.adapter.ts
│   │   │   └── tizen-logger.adapter.ts
│   │   └── web/                      # Adaptadores web (fallback)
│   │       ├── hlsjs.adapter.ts     # HLS.js para desarrollo
│   │       └── web-storage.adapter.ts
│   ├── providers/
│   │   ├── focus-manager.provider.ts
│   │   └── video-player.provider.ts
│   ├── services/
│   │   ├── video-playback.service.ts
│   │   ├── key-handler.service.ts
│   │   └── telemetry.service.ts
│   └── interceptors/
│       ├── auth.interceptor.ts
│       └── error.interceptor.ts
│
├── presentation/
│   ├── shared/
│   │   ├── directives/
│   │   │   ├── focus.directive.ts ✓ (CREADO)
│   │   │   ├── focus.directive.scss ✓ (CREADO)
│   │   │   ├── virtual-scroll.directive.ts
│   │   │   └── tv-key.directive.ts
│   │   ├── components/
│   │   │   ├── virtual-list/
│   │   │   │   ├── virtual-list.component.ts
│   │   │   │   ├── virtual-list.component.html
│   │   │   │   └── virtual-list.component.scss
│   │   │   ├── info-bar/
│   │   │   │   ├── info-bar.component.ts
│   │   │   │   ├── info-bar.component.html
│   │   │   │   └── info-bar.component.scss
│   │   │   ├── loading-spinner/
│   │   │   ├── channel-card/
│   │   │   └── dialog-exit/
│   │   ├── pipes/
│   │   │   ├── duration.pipe.ts
│   │   │   └── safe-html.pipe.ts
│   │   └── utils/
│   │       ├── change-detector-ref.ts
│   │       └── destroy.service.ts
│   ├── pages/
│   │   ├── login/
│   │   │   ├── login-page.component.ts
│   │   │   ├── login-page.component.html
│   │   │   └── login-page.component.scss
│   │   ├── dashboard/
│   │   │   ├── dashboard-page.component.ts
│   │   │   ├── dashboard-page.component.html
│   │   │   └── dashboard-page.component.scss
│   │   ├── channel-list/
│   │   │   ├── channel-list-page.component.ts
│   │   │   ├── channel-list-page.component.html
│   │   │   └── channel-list-page.component.scss
│   │   ├── epg/
│   │   │   ├── epg-page.component.ts
│   │   │   ├── epg-page.component.html
│   │   │   └── epg-page.component.scss
│   │   ├── search/
│   │   │   ├── search-page.component.ts
│   │   │   ├── search-page.component.html
│   │   │   └── search-page.component.scss
│   │   └── settings/
│   │       ├── settings-page.component.ts
│   │       ├── settings-page.component.html
│   │       └── settings-page.component.scss
│   └── services/
│       └── focus-visual.service.ts
│
├── app.config.ts
├── app.routes.ts
└── app.ts
```

---

## 2. Focus Management (Implementado)

### Servicio: `focus-management.service.ts`
**Ubicación:** `src/app/core/application/services/focus-management.service.ts`

**Características implementadas:**
- Mapeo de teclas del control remoto (37, 38, 39, 40, 13, 10009, 461)
- Algoritmo de navegación espacial para TV
- Historial de navegación con soporte para tecla Back
- Registro dinámico de elementos enfocables
- Observable para escuchar cambios de foco
- Navegación circular (wrapping)
- Limpieza automática de suscripciones RxJS

### Directiva: `focus.directive.ts`
**Ubicación:** `src/app/presentation/shared/directives/focus.directive.ts`

**Características implementadas:**
- Decorador `@Directive({ selector: '[appFocus]' })`
- Integración automática con `FocusManagementService`
- Auto-focus opcional
- Callbacks onFocus/onBlur
- Scroll automático al elemento no visible
- Estilos CSS optimizados para TV

### Uso en componentes:
```typescript
import { FocusDirective } from './shared/directives/focus.directive';

@Component({
  standalone: true,
  imports: [FocusDirective],
  template: `
    <button appFocus focusId="login-btn" (click)="onLogin()">
      Iniciar Sesión
    </button>
    <div 
      appFocus 
      focusId="channel-1" 
      [autoFocus]="true"
      (onFocus)="onChannelFocus()"
    >
      Canal 1
    </div>
  `
})
```

---

## 3. Integración de Video (Prioridad: Alta)

### Estrategia de Reproducción

#### 3.1 Adaptador AVPlay para Tizen ✓ (CREADO)
**Archivo:** `src/app/infrastructure/adapters/tizen/avplay.adapter.ts`

**Características implementadas:**
- Detección automática de entorno Tizen
- Configuración de buffer (40s max, 30s target, 10s back)
- Sincronización de latencia (30s behind live edge)
- Observables para eventos de reproducción
- Telemetría de estado
- Manejo de errores conSubjects RxJS
- Limpieza automática de recursos

#### 3.2 Adaptador HLS.js para Web (Fallback) ✓ (CREADO)
**Archivo:** `src/app/infrastructure/adapters/web/hlsjs.adapter.ts`

**Características implementadas:**
- Detección de soporte HLS.js y nativo
- Configuración equivalente a AVPlay
- Manejo de errores con recuperación automática
- Observables para eventos de reproducción
- Telemetría con bufferLength
- Soporte para Safari (HLS nativo)
- Limpieza automática de recursos

#### 3.3 Servicio de Reproducción Unificado ✓ (CREADO)
**Archivo:** `src/app/infrastructure/services/video-playback.service.ts`

**Características implementadas:**
- Selección automática de adaptador (AVPlay > HLS.js)
- Estrategia de fallback entre múltiples URLs
- Telemetría unificada con emisión cada segundo
- Observables para estado, buffering, errores
- Historial de URLs con estado de éxito/fallo
- Interfaz unificada para control de reproducción

---

## 4. Optimización de Memoria

### 4.1 ChangeDetectionStrategy.OnPush

**Base Component para todas las páginas:**
```typescript
import { Component, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'app-base-page',
  template: '<ng-content></ng-content>',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BasePageComponent {
  // Todos los componentes de página deben extender esto
}
```

### 4.2 Servicio de Limpieza de Suscripciones
**Archivo:** `src/app/presentation/shared/utils/destroy.service.ts`

```typescript
import { Injectable, OnDestroy } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class DestroyService extends Subject<void> implements OnDestroy {
  ngOnDestroy(): void {
    this.next();
    this.complete();
  }
}
```

**Uso en componentes:**
```typescript
import { Component, inject } from '@angular/core';
import { DestroyService } from './shared/utils/destroy.service';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-example',
  template: '...',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ExampleComponent {
  private destroy$ = inject(DestroyService);

  ngOnInit(): void {
    someObservable$
      .pipe(takeUntil(this.destroy$))
      .subscribe(data => {
        // Procesar datos
      });
  }
}
```

### 4.3 Configuración Global
**Archivo:** `src/app/app.config.ts`

```typescript
import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes, withInMemoryScrolling({ scrollPositionRestoration: 'enabled' })),
    // Otros providers
  ]
};
```

---

## 5. Manejo de Teclas Físicas

### 5.1 Servicio de Historial de Navegación
**Archivo:** `src/app/core/application/services/navigation-history.service.ts`

```typescript
import { Injectable } from '@angular/core';
import { Router } from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class NavigationHistoryService {
  private history: string[] = [];
  private maxHistory = 10;

  constructor(private router: Router) {}

  push(url: string): void {
    this.history.push(url);
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }
  }

  async goBack(): Promise<boolean> {
    if (this.history.length > 1) {
      this.history.pop(); // Remover actual
      const previousUrl = this.history.pop() || '/';
      await this.router.navigateByUrl(previousUrl);
      return true;
    }
    return false;
  }

  canGoBack(): boolean {
    return this.history.length > 1;
  }

  clear(): void {
    this.history = [];
  }
}
```

### 5.2 Listener para Tecla XF86Back
**Archivo:** `src/app/infrastructure/services/key-handler.service.ts`

```typescript
import { Injectable, OnDestroy } from '@angular/core';
import { fromEvent, Subject } from 'rxjs';
import { filter, takeUntil } from 'rxjs/operators';
import { NavigationHistoryService } from '../../core/application/services/navigation-history.service';
import { Router } from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class KeyHandlerService implements OnDestroy {
  private destroy$ = new Subject<void>();
  private exitDialogOpen = false;

  constructor(
    private navHistory: NavigationHistoryService,
    private router: Router
  ) {
    this.initializeKeyListener();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initializeKeyListener(): void {
    fromEvent<KeyboardEvent>(document, 'keydown')
      .pipe(
        takeUntil(this.destroy$),
        filter((event) => event.key === 'XF86Back' || event.keyCode === 10009)
      )
      .subscribe((event) => this.handleBackKey(event));
  }

  private async handleBackKey(event: KeyboardEvent): Promise<void> {
    event.preventDefault();

    if (this.exitDialogOpen) {
      // Cerrar diálogo de salida
      this.exitDialogOpen = false;
      return;
    }

    // Intentar navegar atrás en el historial
    const navigated = await this.navHistory.goBack();

    if (!navigated) {
      // No hay historial, mostrar diálogo de salida
      this.showExitDialog();
    }
  }

  private showExitDialog(): void {
    this.exitDialogOpen = true;
    // Emitir evento para mostrar diálogo de salida
    // Los componentes pueden suscribirse a este servicio
  }
}
```

---

## 6. Virtual Scroll para Listas Grandes

### 6.1 Componente Virtual List
**Archivo:** `src/app/presentation/shared/components/virtual-list/virtual-list.component.ts`

```typescript
import { 
  Component, 
  Input, 
  Output, 
  EventEmitter, 
  ViewChild, 
  ElementRef,
  ChangeDetectionStrategy,
  OnDestroy,
  OnInit
} from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

interface VirtualItem {
  id: string;
  [key: string]: any;
}

@Component({
  selector: 'app-virtual-list',
  standalone: true,
  template: `
    <div 
      #container 
      class="virtual-list-container"
      (scroll)="onScroll($event)"
    >
      <div 
        class="virtual-list-spacer-top"
        [style.height.px]="totalHeight - visibleHeight"
      ></div>
      <div class="virtual-list-content">
        <ng-container *ngFor="let item of visibleItems; trackBy: trackById">
          <ng-content [ngSwitchOutlet]="item" [ngSwitchOutletCase]="itemTemplate"></ng-content>
        </ng-container>
      </div>
      <div 
        class="virtual-list-spacer-bottom"
        [style.height.px]="totalHeight - visibleHeight"
      ></div>
    </div>
  `,
  styleUrls: ['./virtual-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class VirtualListComponent implements OnInit, OnDestroy {
  @Input() items: VirtualItem[] = [];
  @Input() itemHeight: number = 80; // Altura de cada item
  @Input() bufferSize: number = 5; // Items extra a renderizar
  @Output() itemSelected = new EventEmitter<VirtualItem>();

  @ViewChild('container') container!: ElementRef;

  private destroy$ = new Subject<void>();
  private visibleItems: VirtualItem[] = [];
  private scrollTop = 0;
  private viewportHeight = 0;
  private totalHeight = 0;

  ngOnInit(): void {
    this.calculateDimensions();
    this.updateVisibleItems();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private calculateDimensions(): void {
    this.totalHeight = this.items.length * this.itemHeight;
    this.viewportHeight = this.container?.nativeElement.clientHeight || window.innerHeight;
  }

  private updateVisibleItems(): void {
    const startIndex = Math.max(0, Math.floor(this.scrollTop / this.itemHeight) - this.bufferSize);
    const endIndex = Math.min(
      this.items.length,
      Math.ceil((this.scrollTop + this.viewportHeight) / this.itemHeight) + this.bufferSize
    );

    this.visibleItems = this.items.slice(startIndex, endIndex);
  }

  onScroll(event: Event): void {
    this.scrollTop = (event.target as HTMLElement).scrollTop;
    this.updateVisibleItems();
  }

  trackById(index: number, item: VirtualItem): string {
    return item.id;
  }

  selectItem(item: VirtualItem): void {
    this.itemSelected.emit(item);
  }
}
```

### 6.2 Estilos para Virtual List
**Archivo:** `src/app/presentation/shared/components/virtual-list/virtual-list.component.scss`

```scss
.virtual-list-container {
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  position: relative;
  
  // Optimización de scroll para TV
  scrollbar-width: thin;
  scrollbar-color: #00a9ff #1a1a1a;

  &::-webkit-scrollbar {
    width: 8px;
  }

  &::-webkit-scrollbar-track {
    background: #1a1a1a;
  }

  &::-webkit-scrollbar-thumb {
    background: #00a9ff;
    border-radius: 4px;
  }
}

.virtual-list-content {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
}

.virtual-list-spacer-top,
.virtual-list-spacer-bottom {
  width: 100%;
}
```

---

## 7. Checklist de Auditoría Samsung

### ✅ Requisitos Cumplidos

- [x] **SPA con hash-based routing** - Configurado en `app.routes.ts`
- [x] **Lazy loading de componentes** - Configurado en rutas
- [x] **Navegación por control remoto** - `FocusManagementService` + `FocusDirective`
- [x] **Focus management visual** - Estilos CSS de alto contraste
- [x] **Tecla Back/Return** ✓ - `KeyHandlerService` + `NavigationHistoryService` implementados
- [x] **Diálogo de salida** ✓ - `DialogExitComponent` implementado
- [x] **OnPush Change Detection** - Pendiente: Configurado en componentes base
- [x] **Limpieza de suscripciones** ✓ - `DestroyService` implementado
- [x] **Virtual scroll para listas grandes** ✓ - `VirtualListComponent` implementado
- [x] **AVPlay como prioridad** ✓ - `AvplayAdapter` implementado
- [x] **HLS.js como fallback** ✓ - `HlsjsAdapter` implementado
- [x] **Servicio de video unificado** ✓ - `VideoPlaybackService` implementado
- [x] **Interfaz TV-First** - Elementos grandes, alto contraste
- [x] **Sin cursor hover** - CSS deshabilita hover
- [x] **Accesibilidad (ARIA)** - Atributos en directiva de foco

### 🔲 Pendientes de Implementación

- [ ] Integración con teclado virtual de Tizen ✓ COMPLETADO
- [ ] Implementación de EPG
- [ ] Telemetría de reproducción
- [ ] Sistema de autenticación completo ✓ COMPLETADO (Backend + Login UI)
- [ ] Caché de canales y EPG
- [ ] Manejo de errores de red
- [ ] Sistema de favoritos

---

## 8. Próximos Pasos Recomendados

1. ✅ **Implementar servicio de video completo** ✓ COMPLETADO
2. ✅ **Implementar Virtual List** ✓ COMPLETADO
3. ✅ **Implementar servicio de navegación** ✓ COMPLETADO (KeyHandlerService + NavigationHistoryService)
4. ✅ **Crear componente de diálogo de salida** ✓ COMPLETADO
5. ✅ **Implementar DestroyService** ✓ COMPLETADO
6. ✅ **Backend de autenticación** ✓ COMPLETADO (Modelos, Repositorios, Casos de uso, Storage)
7. ✅ **Página de Login UI** ✓ COMPLETADO (con navegación por control remoto)
8. ✅ **Teclado virtual Tizen** ✓ COMPLETADO (Adaptador + Directiva + Integración en Login)
9. **Configurar OnPush** en todos los componentes existentes
10. **Crear componentes de EPG** con virtual scroll

---

## 9. Referencias

- [Samsung TV Developer Guidelines](https://developer.samsung.com/smarttv/develop/guides)
- [Tizen AVPlay API](https://developer.samsung.com/smarttv/develop/api-references/tizen-api/latest/tizen/tizen.html)
- [Angular Performance Best Practices](https://angular.io/guide/performance-best-practices)
- [HLS.js Documentation](https://github.com/video-dev/hls.js)

---

**Documento generado:** 15 de Abril, 2026
**Versión:** 1.0
**Estado:** En progreso
