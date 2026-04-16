import { Injectable, OnDestroy } from '@angular/core';
import { fromEvent, Subject, Observable } from 'rxjs';
import { filter, takeUntil, debounceTime } from 'rxjs/operators';
import { NavigationHistoryService } from '../../core/application/services/navigation-history.service';

/**
 * Interfaz para eventos de tecla Back
 */
export interface BackKeyEvent {
  keyCode: number;
  key: string;
  timestamp: number;
}

/**
 * Servicio de manejo de teclas físicas para Samsung TV
 * Prioriza el manejo de la tecla Back/Return del control remoto
 * Cumple con los requisitos de auditoría Samsung para navegación TV
 */
@Injectable({
  providedIn: 'root'
})
export class KeyHandlerService implements OnDestroy {
  private destroy$ = new Subject<void>();
  private exitDialogOpen = false;
  private backKeyPress$ = new Subject<BackKeyEvent>();
  private exitRequested$ = new Subject<void>();

  // Códigos de tecla para Samsung TV
  private readonly KEY_CODES = {
    BACK: 10009, // Tizen Back key
    RETURN: 461, // Tizen Return key
    ESCAPE: 27 // Escape key (testing en navegador)
  };

  constructor(private navHistory: NavigationHistoryService) {
    this.initializeKeyListener();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.backKeyPress$.complete();
    this.exitRequested$.complete();
  }

  /**
   * Inicializa el listener de teclas del control remoto
   */
  private initializeKeyListener(): void {
    fromEvent<KeyboardEvent>(document, 'keydown')
      .pipe(
        takeUntil(this.destroy$),
        filter((event) => this.isBackKey(event.keyCode))
      )
      .subscribe((event) => this.handleBackKey(event));
  }

  /**
   * Verifica si el keyCode corresponde a una tecla Back
   */
  private isBackKey(keyCode: number): boolean {
    return Object.values(this.KEY_CODES).includes(keyCode);
  }

  /**
   * Maneja el evento de tecla Back/Return
   */
  private handleBackKey(event: KeyboardEvent): void {
    event.preventDefault();

    const keyEvent: BackKeyEvent = {
      keyCode: event.keyCode,
      key: event.key,
      timestamp: Date.now()
    };

    // Emitir evento de tecla Back presionada
    this.backKeyPress$.next(keyEvent);

    if (this.exitDialogOpen) {
      // Si el diálogo de salida está abierto, cerrarlo
      this.closeExitDialog();
      return;
    }

    // Intentar navegar atrás en el historial
    this.navigateBack();
  }

  /**
   * Intenta navegar atrás en el historial
   */
  private async navigateBack(): Promise<void> {
    const canNavigateBack = await this.navHistory.goBack();

    if (!canNavigateBack) {
      // No hay historial suficiente, mostrar diálogo de salida
      this.showExitDialog();
    }
  }

  /**
   * Muestra el diálogo de salida de la aplicación
   * Emite un evento que los componentes pueden escuchar
   */
  private showExitDialog(): void {
    this.exitDialogOpen = true;
    this.exitRequested$.next();
  }

  /**
   * Cierra el diálogo de salida
   */
  private closeExitDialog(): void {
    this.exitDialogOpen = false;
  }

  /**
   * Confirma la salida de la aplicación
   * Debe ser llamado por el componente del diálogo de salida
   */
  confirmExit(): void {
    // En Tizen, esto cerraría la aplicación
    // En desarrollo, podríamos mostrar un mensaje
    if (typeof (window as any).tizen !== 'undefined') {
      try {
        (window as any).tizen.application.getCurrentApplication().exit();
      } catch (error) {
        console.error('Error exiting Tizen application:', error);
      }
    } else {
      // En desarrollo, simplemente recargar o navegar a login
      console.log('Exit requested (development mode)');
      window.location.reload();
    }
    
    this.exitDialogOpen = false;
  }

  /**
   * Cancela la salida de la aplicación
   * Debe ser llamado por el componente del diálogo de salida
   */
  cancelExit(): void {
    this.closeExitDialog();
  }

  /**
   * Observable para escuchar eventos de tecla Back presionada
   * @returns Observable que emite información de la tecla presionada
   */
  getBackKeyPress(): Observable<BackKeyEvent> {
    return this.backKeyPress$.asObservable();
  }

  /**
   * Observable para escuchar solicitudes de salida
   * Los componentes pueden suscribirse para mostrar un diálogo de confirmación
   * @returns Observable que emite cuando se solicita salir de la app
   */
  getExitRequested(): Observable<void> {
    return this.exitRequested$.asObservable();
  }

  /**
   * Verifica si el diálogo de salida está actualmente abierto
   * @returns true si el diálogo está abierto
   */
  isExitDialogOpen(): boolean {
    return this.exitDialogOpen;
  }

  /**
   * Fuerza el cierre del diálogo de salida
   * Útil para casos donde el diálogo se cierra externamente
   */
  forceCloseExitDialog(): void {
    this.closeExitDialog();
  }

  /**
   * Agrega un listener adicional para teclas específicas
   * Útil para manejar otras teclas del control remoto
   * @param keyCodes Array de códigos de tecla a escuchar
   * @param callback Función a ejecutar cuando se presiona la tecla
   */
  addKeyListener(keyCodes: number[], callback: (event: KeyboardEvent) => void): void {
    fromEvent<KeyboardEvent>(document, 'keydown')
      .pipe(
        takeUntil(this.destroy$),
        filter((event) => keyCodes.includes(event.keyCode)),
        debounceTime(50) // Debounce para evitar múltiples disparos
      )
      .subscribe(callback);
  }

  /**
   * Remueve todos los listeners de teclas
   * Llamado automáticamente en ngOnDestroy
   */
  removeAllKeyListeners(): void {
    this.destroy$.next();
  }
}
