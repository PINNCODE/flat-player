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

      // Navegación y selección
      tizenApi.tvinputdevice.registerKey('XF86Back');
      tizenApi.tvinputdevice.registerKey('Enter');

      // Control de playback
      tizenApi.tvinputdevice.registerKey('MediaPlayPause');
      tizenApi.tvinputdevice.registerKey('MediaStop');
      tizenApi.tvinputdevice.registerKey('MediaPlay');
      tizenApi.tvinputdevice.registerKey('MediaPause');
      tizenApi.tvinputdevice.registerKey('MediaFastForward');
      tizenApi.tvinputdevice.registerKey('MediaRewind');

      // Canales
      tizenApi.tvinputdevice.registerKey('ChannelUp');
      tizenApi.tvinputdevice.registerKey('ChannelDown');

      // Volumen
      tizenApi.tvinputdevice.registerKey('VolumeUp');
      tizenApi.tvinputdevice.registerKey('VolumeDown');
      tizenApi.tvinputdevice.registerKey('VolumeMute');

      // Info y guía
      tizenApi.tvinputdevice.registerKey('Info');
      tizenApi.tvinputdevice.registerKey('Guide');

      // Menú y herramientas
      tizenApi.tvinputdevice.registerKey('Menu');
      tizenApi.tvinputdevice.registerKey('Tools');

      // Playback adicional
      tizenApi.tvinputdevice.registerKey('MediaRecord');
      tizenApi.tvinputdevice.registerKey('MediaNext');
      tizenApi.tvinputdevice.registerKey('MediaPrevious');

      // Otros
      tizenApi.tvinputdevice.registerKey('Source');
      tizenApi.tvinputdevice.registerKey('CHList');
      tizenApi.tvinputdevice.registerKey('PreCh');
      tizenApi.tvinputdevice.registerKey('Sleep');
      tizenApi.tvinputdevice.registerKey('PictureSize');
      tizenApi.tvinputdevice.registerKey('AD');
      tizenApi.tvinputdevice.registerKey('Subtitle');
      tizenApi.tvinputdevice.registerKey('3D');
      tizenApi.tvinputdevice.registerKey('HDMI');
      tizenApi.tvinputdevice.registerKey('EWB');
      tizenApi.tvinputdevice.registerKey('FF');
      tizenApi.tvinputdevice.registerKey('REW');
      tizenApi.tvinputdevice.registerKey('Stop');
      tizenApi.tvinputdevice.registerKey('Pause');

      // Teclas de canal adicionales (por si acaso)
      tizenApi.tvinputdevice.registerKey('0');
      tizenApi.tvinputdevice.registerKey('1');
      tizenApi.tvinputdevice.registerKey('2');
      tizenApi.tvinputdevice.registerKey('3');
      tizenApi.tvinputdevice.registerKey('4');
      tizenApi.tvinputdevice.registerKey('5');
      tizenApi.tvinputdevice.registerKey('6');
      tizenApi.tvinputdevice.registerKey('7');
      tizenApi.tvinputdevice.registerKey('8');
      tizenApi.tvinputdevice.registerKey('9');

    } catch {
      // Running in browser dev environment — Tizen APIs unavailable
    }
  }
}
