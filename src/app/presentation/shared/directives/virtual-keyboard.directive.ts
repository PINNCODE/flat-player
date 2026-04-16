import { Directive, ElementRef, inject, Input, Output, EventEmitter, OnDestroy, OnInit } from '@angular/core';
import { TizenKeyboardAdapter, TizenKeyboardOptions } from '../../../infrastructure/adapters/tizen/tizen-keyboard.adapter';
import { Subject } from 'rxjs';

/**
 * Directiva que integra el teclado virtual de Tizen con inputs de Angular
 * Se activa cuando el input recibe el foco en entorno Tizen
 */
@Directive({
  selector: '[appVirtualKeyboard]',
  standalone: true
})
export class VirtualKeyboardDirective implements OnInit, OnDestroy {
  private elementRef = inject(ElementRef<HTMLInputElement>);
  private keyboardAdapter = inject(TizenKeyboardAdapter);
  private destroy$ = new Subject<void>();

  /**
   * Tipo de teclado a mostrar
   * Valores: 'text', 'url', 'email', 'number', 'password'
   */
  @Input() appVirtualKeyboard: 'text' | 'url' | 'email' | 'number' | 'password' = 'text';

  /**
   * Placeholder del teclado
   */
  @Input() keyboardPlaceholder?: string;

  /**
   * Longitud máxima del texto
   */
  @Input() keyboardMaxLength?: number;

  /**
   * Corrección automática
   */
  @Input() keyboardAutocorrect = true;

  /**
   * Capitalización automática
   */
  @Input() keyboardAutocapitalize = true;

  /**
   * Deshabilitar el teclado virtual
   */
  @Input() disableVirtualKeyboard = false;

  /**
   * Emitido cuando el teclado se muestra
   */
  @Output() keyboardShown = new EventEmitter<void>();

  /**
   * Emitido cuando el teclado se oculta
   */
  @Output() keyboardHidden = new EventEmitter<void>();

  /**
   * Emitido cuando el usuario confirma el texto
   */
  @Output() keyboardConfirm = new EventEmitter<string>();

  /**
   * Emitido cuando el usuario cancela el teclado
   */
  @Output() keyboardCancel = new EventEmitter<void>();

  private isKeyboardOpen = false;

  constructor() {
    // Constructor vacío - inyección via inject()
  }

  ngOnInit(): void {
    // Solo activar en Tizen si está disponible
    if (this.keyboardAdapter.isAvailable() && !this.disableVirtualKeyboard) {
      this.attachKeyboardListener();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Adjunta listener para mostrar teclado al recibir foco
   */
  private attachKeyboardListener(): void {
    const input = this.elementRef.nativeElement;

    // Mostrar teclado al recibir foco
    input.addEventListener('focus', () => this.onFocus());

    // Ocultar teclado al perder foco
    input.addEventListener('blur', () => this.onBlur());
  }

  /**
   * Maneja el evento de foco en el input
   */
  private onFocus(): void {
    if (this.isKeyboardOpen || this.disableVirtualKeyboard) {
      return;
    }

    this.showKeyboard();
  }

  /**
   * Maneja el evento de blur en el input
   */
  private onBlur(): void {
    // No ocultar automáticamente, esperar confirmación del usuario
  }

  /**
   * Muestra el teclado virtual
   */
  private showKeyboard(): void {
    const input = this.elementRef.nativeElement;
    const currentValue = input.value || '';

    const options: TizenKeyboardOptions = {
      type: this.appVirtualKeyboard,
      placeholder: this.keyboardPlaceholder || input.placeholder || '',
      initialValue: currentValue,
      maxLength: this.keyboardMaxLength || input.maxLength || 0,
      autocorrect: this.keyboardAutocorrect,
      autocapitalize: this.keyboardAutocapitalize
    };

    this.isKeyboardOpen = true;
    this.keyboardShown.emit();

    this.keyboardAdapter.show(options).subscribe({
      next: (result) => {
        this.isKeyboardOpen = false;
        this.keyboardHidden.emit();

        if (!result.cancelled) {
          // Actualizar valor del input
          input.value = result.text;
          // Emitir evento de cambio
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
          this.keyboardConfirm.emit(result.text);
        } else {
          this.keyboardCancel.emit();
        }
      },
      error: (error) => {
        console.error('Keyboard error:', error);
        this.isKeyboardOpen = false;
        this.keyboardHidden.emit();
      }
    });
  }

  /**
   * Fuerza la apertura del teclado virtual
   */
  openKeyboard(): void {
    if (!this.isKeyboardOpen && !this.disableVirtualKeyboard) {
      this.showKeyboard();
    }
  }

  /**
   * Fuerza el cierre del teclado virtual
   */
  closeKeyboard(): void {
    if (this.isKeyboardOpen) {
      this.keyboardAdapter.hide();
      this.isKeyboardOpen = false;
      this.keyboardHidden.emit();
    }
  }

  /**
   * Verifica si el teclado está abierto
   */
  isOpen(): boolean {
    return this.isKeyboardOpen;
  }
}
