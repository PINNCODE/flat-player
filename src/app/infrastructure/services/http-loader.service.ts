import { Injectable, computed, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class HttpLoaderService {
  private readonly pendingRequestCount = signal(0);

  readonly isLoading = computed(() => this.pendingRequestCount() > 0);

  startRequest(): void {
    this.pendingRequestCount.update((count) => count + 1);
  }

  endRequest(): void {
    this.pendingRequestCount.update((count) => Math.max(0, count - 1));
  }
}
