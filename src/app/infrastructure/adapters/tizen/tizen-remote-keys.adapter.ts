import { Injectable } from '@angular/core';

declare const tizen: {
  tvinputdevice: {
    registerKey: (keyName: string) => void;
  };
} | undefined;

@Injectable({ providedIn: 'root' })
export class TizenRemoteKeysAdapter {
  registerKeys(): void {
    try {
      const tizenApi = (window as unknown as { tizen?: typeof tizen }).tizen;
      if (!tizenApi?.tvinputdevice) return;
      tizenApi.tvinputdevice.registerKey('XF86Back');
      tizenApi.tvinputdevice.registerKey('MediaPlayPause');
      tizenApi.tvinputdevice.registerKey('MediaStop');
    } catch {
      // Running in browser dev environment — Tizen APIs unavailable
    }
  }
}
