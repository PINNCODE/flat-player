import { Injectable, OnDestroy } from '@angular/core';

declare const tizen: {
  tvinputdevice: {
    registerKey: (keyName: string) => void;
    sendKey: (keyName: string) => void;
  };
} | undefined;

type KeyAction = 'chup' | 'chdown' | 'volup' | 'voldown' | 'volmute'
  | 'playpause' | 'play' | 'stop' | 'pause' | 'fastforward' | 'rewind'
  | 'info' | 'guide'
  | 'red' | 'green' | 'yellow' | 'blue'
  | 'menu' | 'tools';

interface KeyMapping {
  readonly key: string;
  readonly action: KeyAction;
  readonly keyCode: number;
}

@Injectable({ providedIn: 'root' })
export class TizenRemoteInputService implements OnDestroy {
  private pollingTimer: ReturnType<typeof setInterval> | null = null;
  private lastPressedKeys = new Set<string>();

  private static readonly POLLING_INTERVAL_MS = 100;

  private static readonly KEY_MAPPINGS: KeyMapping[] = [
    { key: 'ChannelUp', action: 'chup', keyCode: 427 },
    { key: 'ChannelDown', action: 'chdown', keyCode: 428 },
    { key: 'VolumeUp', action: 'volup', keyCode: 447 },
    { key: 'VolumeDown', action: 'voldown', keyCode: 448 },
    { key: 'VolumeMute', action: 'volmute', keyCode: 449 },
    { key: 'MediaPlayPause', action: 'playpause', keyCode: 10252 },
    { key: 'MediaStop', action: 'stop', keyCode: 413 },
    { key: 'MediaPlay', action: 'play', keyCode: 415 },
    { key: 'MediaPause', action: 'pause', keyCode: 19 },
    { key: 'MediaFastForward', action: 'fastforward', keyCode: 417 },
    { key: 'MediaRewind', action: 'rewind', keyCode: 412 },
    { key: 'Info', action: 'info', keyCode: 457 },
    { key: 'Guide', action: 'guide', keyCode: 458 },
    { key: 'ColorF0Red', action: 'red', keyCode: 403 },
    { key: 'ColorF1Green', action: 'green', keyCode: 404 },
    { key: 'ColorF2Yellow', action: 'yellow', keyCode: 405 },
    { key: 'ColorF3Blue', action: 'blue', keyCode: 406 },
    { key: 'Menu', action: 'menu', keyCode: 10282 },
    { key: 'Tools', action: 'tools', keyCode: 10240 },
  ];

  initialize(): void {
    this.registerKeys();
    this.startPolling();
  }

  destroy(): void {
    this.stopPolling();
  }

  ngOnDestroy(): void {
    this.destroy();
  }

  private registerKeys(): void {
    try {
      const tizenApi = (window as unknown as { tizen?: typeof tizen }).tizen;
      if (!tizenApi?.tvinputdevice) {
        console.log('[TizenRemoteInput] Tizen API not available');
        return;
      }

      for (const mapping of TizenRemoteInputService.KEY_MAPPINGS) {
        try {
          tizenApi.tvinputdevice.registerKey(mapping.key);
        } catch (e) {
          console.warn(`[TizenRemoteInput] Failed to register key: ${mapping.key}`, e);
        }
      }

      console.log('[TizenRemoteInput] Keys registered successfully');
    } catch {
      console.log('[TizenRemoteInput] Running in browser dev environment');
    }
  }

  private startPolling(): void {
    if (this.pollingTimer) return;

    this.pollingTimer = setInterval(() => {
      this.checkKeyStates();
    }, TizenRemoteInputService.POLLING_INTERVAL_MS);

    console.log('[TizenRemoteInput] Polling started');
  }

  private stopPolling(): void {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
      console.log('[TizenRemoteInput] Polling stopped');
    }
  }

  private checkKeyStates(): void {
    const tizenApi = (window as unknown as { tizen?: typeof tizen }).tizen;
    if (!tizenApi?.tvinputdevice) return;

    for (const mapping of TizenRemoteInputService.KEY_MAPPINGS) {
      const isPressed = this.isKeyPressed(tizenApi, mapping.key);

      if (isPressed && !this.lastPressedKeys.has(mapping.key)) {
        this.lastPressedKeys.add(mapping.key);
        this.dispatchKeyEvent(mapping.key, mapping.keyCode, 'keydown');
      } else if (!isPressed && this.lastPressedKeys.has(mapping.key)) {
        this.lastPressedKeys.delete(mapping.key);
        this.dispatchKeyEvent(mapping.key, mapping.keyCode, 'keyup');
      }
    }
  }

  private isKeyPressed(tizenApi: typeof tizen, keyName: string): boolean {
    if (!tizenApi?.tvinputdevice) return false;
    try {
      tizenApi.tvinputdevice.sendKey(keyName);
      return false;
    } catch {
      return false;
    }
  }

  private dispatchKeyEvent(key: string, keyCode: number, type: 'keydown' | 'keyup'): void {
    const event = new KeyboardEvent(type, {
      key: key,
      code: key,
      keyCode: keyCode,
      which: keyCode,
      bubbles: true,
      cancelable: true,
    });

    console.log(`[TizenRemoteInput] Dispatching ${type}: ${key} (${keyCode})`);
    document.dispatchEvent(event);
  }
}
