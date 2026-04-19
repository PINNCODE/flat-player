import { ChangeDetectionStrategy, Component, HostListener, signal } from '@angular/core';

@Component({
  selector: 'app-remote-debug-overlay',
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './remote-debug-overlay.html',
  styleUrl: './remote-debug-overlay.scss',
})
export class RemoteDebugOverlayComponent {
  protected readonly lastKey = signal<{ key: string; keyCode: number; code: string; time: string } | null>(null);
  private hideTimeoutId: ReturnType<typeof setTimeout> | null = null;

  @HostListener('window:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (this.hideTimeoutId) {
      clearTimeout(this.hideTimeoutId);
    }

    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-GB', { hour12: false });

    this.lastKey.set({
      key: event.key,
      keyCode: event.keyCode,
      code: event.code,
      time: timeStr,
    });

    console.log(`[RemoteDebug] ${event.key} | keyCode: ${event.keyCode} | code: ${event.code}`);

    this.hideTimeoutId = setTimeout(() => {
      this.lastKey.set(null);
    }, 3000);
  }

  get isVisible(): boolean {
    return this.lastKey() !== null;
  }
}