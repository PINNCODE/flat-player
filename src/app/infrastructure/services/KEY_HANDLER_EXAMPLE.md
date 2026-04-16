# KeyHandlerService y NavigationHistoryService - Ejemplo de Uso

Estos servicios manejan la navegación por tecla Back/Return del control remoto Samsung TV.

## KeyHandlerService

Servicio que escucha la tecla Back/Return del control remoto y gestiona la navegación.

### Características

- Escucha teclas: Back (10009), Return (461), Escape (27)
- Navegación automática atrás en el historial
- Emite evento cuando no hay historial suficiente (para mostrar diálogo de salida)
- Soporte para agregar listeners de teclas personalizadas

### Uso Básico

```typescript
import { Component } from '@angular/core';
import { KeyHandlerService } from './infrastructure/services/key-handler.service';

@Component({
  selector: 'app-example',
  standalone: true,
  template: `<div>Contenido</div>`
})
export class ExampleComponent {
  constructor(private keyHandler: KeyHandlerService) {
    // Escuchar eventos de tecla Back
    this.keyHandler.getBackKeyPress().subscribe(event => {
      console.log('Tecla Back presionada:', event);
    });

    // Escuchar solicitud de salida (cuando no hay historial)
    this.keyHandler.getExitRequested().subscribe(() => {
      console.log('Se solicitó salir de la app');
      // Mostrar diálogo de confirmación
    });
  }
}
```

### Agregar Listeners de Teclas Personalizadas

```typescript
@Component({
  selector: 'app-example',
  standalone: true,
  template: `<div>Contenido</div>`
})
export class ExampleComponent {
  constructor(private keyHandler: KeyHandlerService) {
    // Escuchar teclas de flechas
    this.keyHandler.addKeyListener([37, 38, 39, 40], (event) => {
      console.log('Flecha presionada:', event.keyCode);
      // 37: Left, 38: Up, 39: Right, 40: Down
    });

    // Escuchar tecla Enter
    this.keyHandler.addKeyListener([13], (event) => {
      console.log('Enter presionado');
    });
  }
}
```

## NavigationHistoryService

Servicio que maneja el historial de navegación para la tecla Back.

### Características

- Historial de navegación con máximo configurable (default: 10)
- Navegación atrás automática
- Evita duplicados consecutivos
- Observable para escuchar cambios en el historial
- Métodos para manipular el historial

### Uso Básico

```typescript
import { Component } from '@angular/core';
import { NavigationHistoryService } from './core/application/services/navigation-history.service';

@Component({
  selector: 'app-example',
  standalone: true,
  template: `<div>Contenido</div>`
})
export class ExampleComponent {
  constructor(private navHistory: NavigationHistoryService) {
    // Agregar URL actual al historial
    this.navHistory.push('/dashboard');
    
    // Navegar atrás
    this.navHistory.goBack().then(success => {
      if (success) {
        console.log('Navegación exitosa');
      } else {
        console.log('No hay historial suficiente');
      }
    });

    // Escuchar cambios en el historial
    this.navHistory.getHistoryChanges().subscribe(history => {
      console.log('Historial actual:', history);
    });
  }
}
```

### Métodos Disponibles

| Método | Parámetros | Descripción |
|--------|------------|-------------|
| `push(url)` | `url: string` | Agrega URL al historial |
| `goBack()` | - | Navega a la página anterior |
| `canGoBack()` | - | Verifica si se puede navegar atrás |
| `getCurrentUrl()` | - | Obtiene URL actual |
| `getPreviousUrl()` | - | Obtiene URL anterior |
| `getHistory()` | - | Obtiene todo el historial |
| `clear()` | - | Limpia todo el historial |
| `replace(url)` | `url: string` | Reemplaza URL actual |
| `navigateTo(url)` | `url: string` | Navega y agrega al historial |
| `hasUrl(url)` | `url: string` | Verifica si URL está en historial |

## Integración con Router

Para integrar con el Router de Angular, agregar interceptor o guard:

```typescript
import { Injectable } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { NavigationHistoryService } from './core/application/services/navigation-history.service';

export const navigationGuard: CanActivateFn = (route, state) => {
  const router = inject(Router);
  const navHistory = inject(NavigationHistoryService);
  
  // Agregar URL al historial al navegar
  navHistory.push(state.url);
  
  return true;
};
```

Configurar en `app.routes.ts`:

```typescript
export const routes: Routes = [
  {
    path: 'dashboard',
    loadComponent: () => import('./pages/dashboard/dashboard-page.component'),
    canActivate: [navigationGuard]
  },
  // ... otras rutas
];
```

## DialogExitComponent

Componente de diálogo de salida que se muestra cuando no hay historial suficiente.

### Uso

Agregar al componente principal (app.component.ts o layout):

```typescript
import { Component } from '@angular/core';
import { DialogExitComponent } from './shared/components/dialog-exit';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [DialogExitComponent],
  template: `
    <router-outlet></router-outlet>
    <app-dialog-exit></app-dialog-exit>
  `
})
export class AppComponent {}
```

### Personalización

El componente se puede personalizar modificando los estilos en `dialog-exit.component.scss`.

## Ejemplo Completo

```typescript
import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { NavigationHistoryService } from './core/application/services/navigation-history.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  template: `
    <div class="dashboard">
      <h1>Dashboard</h1>
      <button (click)="navigateToChannels()">Ir a Canales</button>
      <button (click)="navigateToSettings()">Ir a Ajustes</button>
    </div>
  `
})
export class DashboardComponent {
  constructor(
    private router: Router,
    private navHistory: NavigationHistoryService
  ) {}

  async navigateToChannels(): Promise<void> {
    await this.navHistory.navigateTo('/channels');
  }

  async navigateToSettings(): Promise<void> {
    await this.navHistory.navigateTo('/settings');
  }
}
```

## Testing

Para testing en navegador (sin Tizen), las teclas Escape (27) también funcionan como Back.

```typescript
// En tests o desarrollo
document.dispatchEvent(new KeyboardEvent('keydown', { keyCode: 27 }));
```

## Consideraciones de Auditoría Samsung

- ✅ Manejo de tecla Back/Return implementado
- ✅ Diálogo de confirmación de salida
- ✅ Historial de navegación con límite de 10 items
- ✅ Navegación circular no aplicada (por seguridad)
- ✅ Accesibilidad con ARIA labels en diálogo
