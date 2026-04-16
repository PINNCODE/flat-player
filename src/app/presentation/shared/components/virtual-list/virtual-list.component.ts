import { 
  Component, 
  Input, 
  Output, 
  EventEmitter, 
  ViewChild, 
  ElementRef,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  OnDestroy,
  OnInit,
  AfterViewInit,
  inject,
  contentChild,
  TemplateRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject } from 'rxjs';
import { takeUntil, debounceTime } from 'rxjs/operators';

/**
 * Interfaz para items de la lista virtual
 */
export interface VirtualListItem {
  id: string;
  [key: string]: any;
}

/**
 * Interfaz para eventos de scroll
 */
export interface ScrollEvent {
  scrollTop: number;
  scrollLeft: number;
  startIndex: number;
  endIndex: number;
}

/**
 * Componente de lista virtual para manejar grandes listas sin degradar la UI
 * Optimizado para Samsung TV con navegación por control remoto
 * Implementa ChangeDetectionStrategy.OnPush para optimización de memoria
 * 
 * Uso:
 * <app-virtual-list
 *   [items]="channels"
 *   [itemHeight]="80"
 *   [bufferSize]="5"
 *   (itemSelected)="onChannelSelect($event)"
 * >
 *   <ng-template let-item>
 *     <div [appFocus]="focusId='channel-' + item.id">
 *       {{ item.name }}
 *     </div>
 *   </ng-template>
 * </app-virtual-list>
 */
@Component({
  selector: 'app-virtual-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './virtual-list.component.html',
  styleUrls: ['./virtual-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class VirtualListComponent implements OnInit, AfterViewInit, OnDestroy {
  private cdr = inject(ChangeDetectorRef);
  private destroy$ = new Subject<void>();

  @ViewChild('container') container!: ElementRef<HTMLElement>;
  @ViewChild('content') content!: ElementRef<HTMLElement>;

  // Template para renderizar items
  itemTemplate = contentChild(TemplateRef);

  /**
   * Lista completa de items
   */
  @Input() items: VirtualListItem[] = [];

  /**
   * Altura de cada item en píxeles
   * Default: 80px (optimizado para TV)
   */
  @Input() itemHeight: number = 80;

  /**
   * Número de items extra a renderizar fuera del viewport
   * Default: 5 (buffer para scroll suave)
   */
  @Input() bufferSize: number = 5;

  /**
   * Si es true, la lista es horizontal
   * Default: false (vertical)
   */
  @Input() horizontal: boolean = false;

  /**
   * Evento emitido cuando se selecciona un item
   */
  @Output() itemSelected = new EventEmitter<VirtualListItem>();

  /**
   * Evento emitido cuando ocurre scroll
   */
  @Output() scroll = new EventEmitter<ScrollEvent>();

  /**
   * Evento emitido cuando se alcanza el final de la lista
   * Útil para implementación de infinite scroll
   */
  @Output() endReached = new EventEmitter<void>();

  // Estado interno (público para acceso desde template)
  visibleItems: VirtualListItem[] = [];
  scrollTop = 0;
  scrollLeft = 0;
  viewportHeight = 0;
  viewportWidth = 0;
  totalHeight = 0;
  totalWidth = 0;
  startIndex = 0;
  endIndex = 0;
  private isScrolling = false;
  private scrollTimeout: any;

  constructor() {
    // Constructor vacío - inyección de dependencias via inject()
  }

  ngOnInit(): void {
    this.calculateDimensions();
    this.updateVisibleItems();
  }

  ngAfterViewInit(): void {
    // Inicializar dimensiones después de que el DOM esté listo
    setTimeout(() => {
      this.calculateDimensions();
      this.updateVisibleItems();
      this.cdr.markForCheck();
    }, 0);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    
    if (this.scrollTimeout) {
      clearTimeout(this.scrollTimeout);
    }
  }

  /**
   * Calcula las dimensiones del viewport y contenido total
   */
  private calculateDimensions(): void {
    if (!this.container?.nativeElement) return;

    const containerEl = this.container.nativeElement;
    
    this.viewportHeight = containerEl.clientHeight;
    this.viewportWidth = containerEl.clientWidth;
    
    if (this.horizontal) {
      this.totalWidth = this.items.length * this.itemHeight;
      this.totalHeight = this.viewportHeight;
    } else {
      this.totalHeight = this.items.length * this.itemHeight;
      this.totalWidth = this.viewportWidth;
    }
  }

  /**
   * Actualiza la lista de items visibles basado en scroll
   */
  private updateVisibleItems(): void {
    if (this.items.length === 0) {
      this.visibleItems = [];
      return;
    }

    if (this.horizontal) {
      this.updateHorizontalVisibleItems();
    } else {
      this.updateVerticalVisibleItems();
    }

    this.cdr.markForCheck();
  }

  /**
   * Actualiza items visibles para lista vertical
   */
  private updateVerticalVisibleItems(): void {
    const visibleCount = Math.ceil(this.viewportHeight / this.itemHeight);
    
    this.startIndex = Math.max(0, Math.floor(this.scrollTop / this.itemHeight) - this.bufferSize);
    this.endIndex = Math.min(
      this.items.length,
      Math.ceil((this.scrollTop + this.viewportHeight) / this.itemHeight) + this.bufferSize
    );

    this.visibleItems = this.items.slice(this.startIndex, this.endIndex);

    // Emitir evento de scroll
    this.scroll.emit({
      scrollTop: this.scrollTop,
      scrollLeft: 0,
      startIndex: this.startIndex,
      endIndex: this.endIndex
    });

    // Emitir evento de final alcanzado
    if (this.endIndex >= this.items.length - this.bufferSize) {
      this.endReached.emit();
    }
  }

  /**
   * Actualiza items visibles para lista horizontal
   */
  private updateHorizontalVisibleItems(): void {
    const visibleCount = Math.ceil(this.viewportWidth / this.itemHeight);
    
    this.startIndex = Math.max(0, Math.floor(this.scrollLeft / this.itemHeight) - this.bufferSize);
    this.endIndex = Math.min(
      this.items.length,
      Math.ceil((this.scrollLeft + this.viewportWidth) / this.itemHeight) + this.bufferSize
    );

    this.visibleItems = this.items.slice(this.startIndex, this.endIndex);

    // Emitir evento de scroll
    this.scroll.emit({
      scrollTop: 0,
      scrollLeft: this.scrollLeft,
      startIndex: this.startIndex,
      endIndex: this.endIndex
    });

    // Emitir evento de final alcanzado
    if (this.endIndex >= this.items.length - this.bufferSize) {
      this.endReached.emit();
    }
  }

  /**
   * Maneja el evento de scroll
   */
  onScroll(event: Event): void {
    const target = event.target as HTMLElement;
    
    if (this.horizontal) {
      this.scrollLeft = target.scrollLeft;
    } else {
      this.scrollTop = target.scrollTop;
    }

    this.isScrolling = true;

    // Debounce para evitar actualizaciones excesivas
    if (this.scrollTimeout) {
      clearTimeout(this.scrollTimeout);
    }

    this.scrollTimeout = setTimeout(() => {
      this.updateVisibleItems();
      this.isScrolling = false;
      this.cdr.markForCheck();
    }, 16); // ~60fps
  }

  /**
   * Selecciona un item
   */
  selectItem(item: VirtualListItem): void {
    this.itemSelected.emit(item);
  }

  /**
   * Scroll a un item específico por índice
   */
  scrollToIndex(index: number, smooth: boolean = true): void {
    if (!this.container?.nativeElement || index < 0 || index >= this.items.length) {
      return;
    }

    const scrollPosition = index * this.itemHeight;
    
    if (this.horizontal) {
      this.container.nativeElement.scrollTo({
        left: scrollPosition,
        behavior: smooth ? 'smooth' : 'auto'
      });
    } else {
      this.container.nativeElement.scrollTo({
        top: scrollPosition,
        behavior: smooth ? 'smooth' : 'auto'
      });
    }
  }

  /**
   * Scroll a un item específico por ID
   */
  scrollToId(id: string, smooth: boolean = true): void {
    const index = this.items.findIndex(item => item.id === id);
    if (index !== -1) {
      this.scrollToIndex(index, smooth);
    }
  }

  /**
   * Scroll al inicio de la lista
   */
  scrollToTop(smooth: boolean = true): void {
    if (!this.container?.nativeElement) return;

    if (this.horizontal) {
      this.container.nativeElement.scrollTo({
        left: 0,
        behavior: smooth ? 'smooth' : 'auto'
      });
    } else {
      this.container.nativeElement.scrollTo({
        top: 0,
        behavior: smooth ? 'smooth' : 'auto'
      });
    }
  }

  /**
   * Scroll al final de la lista
   */
  scrollToBottom(smooth: boolean = true): void {
    if (!this.container?.nativeElement) return;

    if (this.horizontal) {
      this.container.nativeElement.scrollTo({
        left: this.totalWidth,
        behavior: smooth ? 'smooth' : 'auto'
      });
    } else {
      this.container.nativeElement.scrollTo({
        top: this.totalHeight,
        behavior: smooth ? 'smooth' : 'auto'
      });
    }
  }

  /**
   * Obtiene la posición de scroll actual
   */
  getScrollPosition(): { top: number; left: number } {
    return {
      top: this.scrollTop,
      left: this.scrollLeft
    };
  }

  /**
   * Obtiene el índice del primer item visible
   */
  getFirstVisibleIndex(): number {
    return this.startIndex;
  }

  /**
   * Obtiene el índice del último item visible
   */
  getLastVisibleIndex(): number {
    return this.endIndex;
  }

  /**
   * Obtiene el número total de items
   */
  getTotalItems(): number {
    return this.items.length;
  }

  /**
   * Obtiene el número de items visibles
   */
  getVisibleItemsCount(): number {
    return this.visibleItems.length;
  }

  /**
   * Verifica si está scrolleando
   */
  isCurrentlyScrolling(): boolean {
    return this.isScrolling;
  }

  /**
   * Recalcula dimensiones (útil después de cambios en el layout)
   */
  recalculate(): void {
    this.calculateDimensions();
    this.updateVisibleItems();
    this.cdr.markForCheck();
  }

  /**
   * TrackBy function para optimizar rendering de Angular
   */
  trackById(index: number, item: VirtualListItem): string {
    return item.id;
  }
}
