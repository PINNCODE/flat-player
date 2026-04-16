import { Injectable, inject } from '@angular/core';
import { Subject, Observable } from 'rxjs';

/**
 * Interfaz para opciones del teclado Tizen
 */
export interface TizenKeyboardOptions {
  type?: 'text' | 'url' | 'email' | 'number' | 'password';
  placeholder?: string;
  initialValue?: string;
  maxLength?: number;
  autocorrect?: boolean;
  autocapitalize?: boolean;
}

/**
 * Interfaz para resultado del teclado
 */
export interface TizenKeyboardResult {
  text: string;
  cancelled: boolean;
}

/**
 * Adaptador para teclado virtual de Tizen
 * Proporciona una API unificada para el teclado virtual de Samsung TV
 */
@Injectable({
  providedIn: 'root'
})
export class TizenKeyboardAdapter {
  private isTizen: boolean;

  constructor() {
    this.isTizen = this.detectTizen();
  }

  /**
   * Detecta si corre en entorno Tizen
   */
  private detectTizen(): boolean {
    return typeof window !== 'undefined' && 
           typeof (window as any).tizen !== 'undefined';
  }

  /**
   * Verifica si el teclado virtual está disponible
   */
  isAvailable(): boolean {
    if (!this.isTizen) {
      return false;
    }

    try {
      const tizen = (window as any).tizen;
      return !!tizen && !!tizen.textinput && !!tizen.textinput.show;
    } catch {
      return false;
    }
  }

  /**
   * Muestra el teclado virtual con las opciones especificadas
   * @param options Opciones del teclado
   * @returns Observable con el resultado del teclado
   */
  show(options: TizenKeyboardOptions = {}): Observable<TizenKeyboardResult> {
    return new Observable<TizenKeyboardResult>(observer => {
      if (!this.isAvailable()) {
        // Fallback: retornar texto vacío si no está disponible
        observer.next({ text: '', cancelled: true });
        observer.complete();
        return;
      }

      try {
        const tizen = (window as any).tizen;
        const textinput = tizen.textinput;

        // Configurar opciones por defecto
        const keyboardOptions: any = {
          type: options.type || 'text',
          placeholder: options.placeholder || '',
          text: options.initialValue || '',
          maxlength: options.maxLength || 0,
          autocorrect: options.autocorrect !== false,
          autocapitalize: options.autocapitalize !== false,
          returnKeyType: 'done',
          guideText: options.placeholder || ''
        };

        // Callback cuando el usuario confirma
        const onConfirm = (text: string) => {
          cleanup();
          observer.next({ text, cancelled: false });
          observer.complete();
        };

        // Callback cuando el usuario cancela
        const onCancel = () => {
          cleanup();
          observer.next({ text: '', cancelled: true });
          observer.complete();
        };

        // Callback de cambio de texto
        const onChange = (text: string) => {
          // Opcional: emitir cambios de texto en tiempo real
        };

        // Mostrar teclado
        textinput.show(
          keyboardOptions,
          onConfirm,
          onCancel,
          onChange
        );

        // Función de limpieza
        const cleanup = () => {
          try {
            if (textinput && textinput.hide) {
              textinput.hide();
            }
          } catch (error) {
            console.error('Error hiding keyboard:', error);
          }
        };

      } catch (error) {
        console.error('Error showing Tizen keyboard:', error);
        observer.next({ text: '', cancelled: true });
        observer.complete();
      }
    });
  }

  /**
   * Oculta el teclado virtual
   */
  hide(): void {
    if (!this.isAvailable()) {
      return;
    }

    try {
      const tizen = (window as any).tizen;
      const textinput = tizen.textinput;

      if (textinput && textinput.hide) {
        textinput.hide();
      }
    } catch (error) {
      console.error('Error hiding keyboard:', error);
    }
  }

  /**
   * Muestra el teclado con tipo específico
   */
  showText(options?: Partial<TizenKeyboardOptions>): Observable<TizenKeyboardResult> {
    return this.show({ ...options, type: 'text' });
  }

  showUrl(options?: Partial<TizenKeyboardOptions>): Observable<TizenKeyboardResult> {
    return this.show({ ...options, type: 'url' });
  }

  showEmail(options?: Partial<TizenKeyboardOptions>): Observable<TizenKeyboardResult> {
    return this.show({ ...options, type: 'email' });
  }

  showNumber(options?: Partial<TizenKeyboardOptions>): Observable<TizenKeyboardResult> {
    return this.show({ ...options, type: 'number' });
  }

  showPassword(options?: Partial<TizenKeyboardOptions>): Observable<TizenKeyboardResult> {
    return this.show({ ...options, type: 'password' });
  }
}
