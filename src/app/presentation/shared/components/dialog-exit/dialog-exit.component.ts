import { 
  Component, 
  inject, 
  OnInit, 
  OnDestroy,
  ChangeDetectionStrategy 
} from '@angular/core';
import { KeyHandlerService } from '../../../../infrastructure/services/key-handler.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { CommonModule } from '@angular/common';

/**
 * Componente de diálogo de salida para Samsung TV
 * Se muestra cuando el usuario presiona Back y no hay más historial
 * Cumple con los requisitos de auditoría Samsung
 */
@Component({
  selector: 'app-dialog-exit',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dialog-exit.component.html',
  styleUrls: ['./dialog-exit.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DialogExitComponent implements OnInit, OnDestroy {
  private keyHandler = inject(KeyHandlerService);
  private destroy$ = new Subject<void>();

  isVisible = false;

  constructor() {
    // Constructor vacío - inyección via inject()
  }

  ngOnInit(): void {
    // Escuchar solicitudes de salida
    this.keyHandler.getExitRequested()
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.show();
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Muestra el diálogo de salida
   */
  show(): void {
    this.isVisible = true;
  }

  /**
   * Oculta el diálogo de salida
   */
  hide(): void {
    this.isVisible = false;
    this.keyHandler.cancelExit();
  }

  /**
   * Confirma la salida de la aplicación
   */
  onConfirm(): void {
    this.keyHandler.confirmExit();
  }

  /**
   * Cancela la salida de la aplicación
   */
  onCancel(): void {
    this.hide();
  }
}
