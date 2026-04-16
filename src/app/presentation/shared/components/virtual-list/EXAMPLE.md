# VirtualListComponent - Ejemplo de Uso

El componente `VirtualListComponent` está diseñado para manejar listas grandes (2000+ items) sin degradar el rendimiento de la UI.

## Importación

```typescript
import { VirtualListComponent, VirtualListItem } from './shared/components/virtual-list';
import { FocusDirective } from './shared/directives/focus.directive';
```

## Ejemplo Básico - Lista de Canales

```typescript
import { Component } from '@angular/core';
import { VirtualListComponent, VirtualListItem } from './shared/components/virtual-list';
import { FocusDirective } from './shared/directives/focus.directive';

interface Channel extends VirtualListItem {
  id: string;
  name: string;
  logo: string;
  category: string;
}

@Component({
  selector: 'app-channel-list',
  standalone: true,
  imports: [VirtualListComponent, FocusDirective],
  template: `
    <div class="channel-list-container">
      <h2>Canales Disponibles</h2>
      
      <app-virtual-list
        [items]="channels"
        [itemHeight]="80"
        [bufferSize]="5"
        (itemSelected)="onChannelSelect($event)"
        (endReached)="loadMoreChannels()"
      >
        <ng-template let-channel>
          <div 
            class="channel-item"
            [appFocus]="focusId='channel-' + channel.id"
            (click)="onChannelSelect(channel)"
            role="button"
            [attr.aria-label]="channel.name"
          >
            <img [src]="channel.logo" [alt]="channel.name" class="channel-logo" />
            <div class="channel-info">
              <h3>{{ channel.name }}</h3>
              <p>{{ channel.category }}</p>
            </div>
          </div>
        </ng-template>
      </app-virtual-list>
    </div>
  `,
  styles: [`
    .channel-list-container {
      height: 100vh;
      padding: 20px;
    }

    .channel-item {
      display: flex;
      align-items: center;
      padding: 10px 20px;
      margin: 5px 0;
      background: #1a1a1a;
      border-radius: 8px;
      cursor: pointer;
    }

    .channel-logo {
      width: 60px;
      height: 60px;
      border-radius: 8px;
      margin-right: 15px;
    }

    .channel-info h3 {
      margin: 0;
      font-size: 18px;
    }

    .channel-info p {
      margin: 5px 0 0;
      color: #888;
    }
  `]
})
export class ChannelListComponent {
  channels: Channel[] = [];
  loading = false;

  constructor() {
    // Simular carga de canales
    this.loadChannels();
  }

  async loadChannels(): Promise<void> {
    // En producción, esto vendría de una API
    this.channels = Array.from({ length: 2000 }, (_, i) => ({
      id: `channel-${i}`,
      name: `Canal ${i + 1}`,
      logo: `https://example.com/logo-${i}.png`,
      category: i % 2 === 0 ? 'Deportes' : 'Noticias'
    }));
  }

  onChannelSelect(channel: Channel): void {
    console.log('Canal seleccionado:', channel.name);
    // Navegar a página de reproducción
  }

  loadMoreChannels(): void {
    // Implementar infinite scroll
    console.log('Cargando más canales...');
  }
}
```

## Ejemplo Horizontal - Recomendaciones

```typescript
@Component({
  selector: 'app-recommendations',
  standalone: true,
  imports: [VirtualListComponent, FocusDirective],
  template: `
    <div class="recommendations-container">
      <h2>Recomendados para ti</h2>
      
      <app-virtual-list
        [items]="recommendations"
        [itemHeight]="200"
        [bufferSize]="3"
        [horizontal]="true"
        (itemSelected)="onRecommendationSelect($event)"
      >
        <ng-template let-item>
          <div 
            class="recommendation-card"
            [appFocus]="focusId='rec-' + item.id"
            (click)="onRecommendationSelect(item)"
          >
            <img [src]="item.thumbnail" [alt]="item.title" />
            <div class="card-info">
              <h3>{{ item.title }}</h3>
              <p>{{ item.description }}</p>
            </div>
          </div>
        </ng-template>
      </app-virtual-list>
    </div>
  `,
  styles: [`
    .recommendations-container {
      padding: 20px;
    }

    .recommendation-card {
      width: 200px;
      height: 200px;
      margin: 0 10px;
      background: #1a1a1a;
      border-radius: 12px;
      overflow: hidden;
    }

    .recommendation-card img {
      width: 100%;
      height: 150px;
      object-fit: cover;
    }

    .card-info {
      padding: 10px;
    }

    .card-info h3 {
      margin: 0;
      font-size: 14px;
    }

    .card-info p {
      margin: 5px 0 0;
      font-size: 12px;
      color: #888;
    }
  `]
})
export class RecommendationsComponent {
  recommendations: any[] = [];

  constructor() {
    this.loadRecommendations();
  }

  loadRecommendations(): void {
    this.recommendations = Array.from({ length: 50 }, (_, i) => ({
      id: `rec-${i}`,
      title: `Programa ${i + 1}`,
      description: `Descripción del programa ${i + 1}`,
      thumbnail: `https://example.com/thumb-${i}.jpg`
    }));
  }

  onRecommendationSelect(item: any): void {
    console.log('Recomendación seleccionada:', item.title);
  }
}
```

## API del Componente

### Inputs

| Input | Tipo | Default | Descripción |
|-------|------|---------|-------------|
| `items` | `VirtualListItem[]` | `[]` | Lista completa de items |
| `itemHeight` | `number` | `80` | Altura de cada item en px |
| `bufferSize` | `number` | `5` | Items extra a renderizar fuera del viewport |
| `horizontal` | `boolean` | `false` | Si es true, la lista es horizontal |

### Outputs

| Output | Tipo | Descripción |
|--------|------|-------------|
| `itemSelected` | `EventEmitter<VirtualListItem>` | Emitido cuando se selecciona un item |
| `scroll` | `EventEmitter<ScrollEvent>` | Emitido cuando ocurre scroll |
| `endReached` | `EventEmitter<void>` | Emitido cuando se alcanza el final de la lista |

### Métodos Públicos

| Método | Parámetros | Descripción |
|--------|------------|-------------|
| `scrollToIndex(index, smooth)` | `index: number, smooth: boolean = true` | Scroll a un item por índice |
| `scrollToId(id, smooth)` | `id: string, smooth: boolean = true` | Scroll a un item por ID |
| `scrollToTop(smooth)` | `smooth: boolean = true` | Scroll al inicio |
| `scrollToBottom(smooth)` | `smooth: boolean = true` | Scroll al final |
| `recalculate()` | - | Recalcula dimensiones después de cambios de layout |

## Integración con Focus Management

El componente se integra perfectamente con la directiva `appFocus`:

```html
<ng-template let-item>
  <div 
    [appFocus]="focusId='item-' + item.id"
    (click)="selectItem(item)"
  >
    {{ item.name }}
  </div>
</ng-template>
```

## Performance

- **ChangeDetectionStrategy.OnPush**: Optimizado para evitar detección de cambios innecesaria
- **Virtual rendering**: Solo renderiza items visibles + buffer
- **Debounce de scroll**: Actualizaciones limitadas a ~60fps
- **CSS containment**: Optimización de rendering con `contain: layout style paint`

## Accesibilidad

- `role="list"` en el contenedor
- `role="listitem"` en cada item
- `aria-label` dinámico para cada item
- Navegación por teclado soportada
