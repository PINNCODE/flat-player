import { Directive, ElementRef, Input, OnInit, OnDestroy, inject } from '@angular/core';
import { FocusManagementService } from '../../../core/application/services/focus-management.service';

/**
 * Directiva para manejar el foco visual en elementos de la UI
 * Se integra con FocusManagementService para navegación por control remoto
 * Cumple con requisitos de auditoría Samsung para accesibilidad TV
 * 
 * Uso:
 * <button appFocus focusId="my-button">Click me</button>
 * <div appFocus focusId="my-item" [focusGroup]="channel-list"></div>
 */
@Directive({
  selector: '[appFocus]',
  standalone: true
})
export class FocusDirective implements OnInit, OnDestroy {
  private focusService = inject(FocusManagementService);
  private elementRef = inject(ElementRef);

  /**
   * Identificador único del elemento enfocable
   * Requerido para el registro en el servicio de foco
   */
  @Input('focusId') focusId!: string;

  /**
   * Grupo al que pertenece el elemento (opcional)
   * Útil para organizar elementos en secciones lógicas
   */
  @Input('focusGroup') focusGroup?: string;

  /**
   * Si es true, el elemento se enfoca automáticamente al iniciarse
   */
  @Input('autoFocus') autoFocus: boolean = false;

  /**
   * Callback cuando el elemento recibe el foco
   */
  @Input('onFocus') onFocus?: () => void;

  /**
   * Callback cuando el elemento pierde el foco
   */
  @Input('onBlur') onBlur?: () => void;

  ngOnInit(): void {
    if (!this.focusId) {
      console.warn('FocusDirective: focusId is required for proper focus management');
      return;
    }

    // Registrar elemento en el servicio de foco
    this.focusService.registerFocusable(this.focusId, this.elementRef);

    // Aplicar estilos iniciales
    this.applyInitialStyles();

    // Auto-focus si está configurado
    if (this.autoFocus) {
      // Pequeño delay para asegurar que el DOM esté listo
      setTimeout(() => {
        this.focusService.focusById(this.focusId);
      }, 100);
    }

    // Suscribirse a cambios de foco
    this.focusService.getFocusChanges().subscribe((focusedId) => {
      if (focusedId === this.focusId) {
        this.handleFocusGain();
      } else if (focusedId !== this.focusId && this.elementRef.nativeElement.classList.contains('focused')) {
        this.handleFocusLoss();
      }
    });
  }

  ngOnDestroy(): void {
    if (this.focusId) {
      this.focusService.unregisterFocusable(this.focusId);
    }
  }

  /**
   * Aplica estilos iniciales al elemento
   */
  private applyInitialStyles(): void {
    const element = this.elementRef.nativeElement;
    
    // Asegurar que el elemento sea enfocable
    element.style.outline = 'none';
    element.style.cursor = 'pointer';
    
    // Agregar atributos de accesibilidad
    element.setAttribute('aria-label', this.focusId);
  }

  /**
   * Maneja cuando el elemento gana el foco
   */
  private handleFocusGain(): void {
    const element = this.elementRef.nativeElement;
    
    // Aplicar estilos de foco visual (pueden ser personalizados vía CSS)
    element.classList.add('focused');
    
    // Scroll al elemento si no es visible
    this.scrollIntoViewIfNeeded();
    
    // Ejecutar callback si existe
    if (this.onFocus) {
      this.onFocus();
    }
  }

  /**
   * Maneja cuando el elemento pierde el foco
   */
  private handleFocusLoss(): void {
    const element = this.elementRef.nativeElement;
    
    // Remover estilos de foco
    element.classList.remove('focused');
    
    // Ejecutar callback si existe
    if (this.onBlur) {
      this.onBlur();
    }
  }

  /**
   * Hace scroll al elemento si no está visible en el viewport
   * Optimizado para TV con scroll suave
   */
  private scrollIntoViewIfNeeded(): void {
    const element = this.elementRef.nativeElement;
    const rect = element.getBoundingClientRect();
    const isVisible = (
      rect.top >= 0 &&
      rect.left >= 0 &&
      rect.bottom <= window.innerHeight &&
      rect.right <= window.innerWidth
    );

    if (!isVisible) {
      element.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'center'
      });
    }
  }
}
