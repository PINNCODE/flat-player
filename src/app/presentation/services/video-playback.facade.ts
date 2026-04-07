import { Injectable } from '@angular/core';
import Hls, { ErrorData, Events } from 'hls.js';

type PlaybackErrorHandler = (message: string, usedFallback: boolean) => void;

@Injectable({ providedIn: 'root' })
export class VideoPlaybackFacade {
  private hls: Hls | null = null;
  private nativeErrorHandler: ((event: Event) => void) | null = null;
  private nativeStalledHandler: ((event: Event) => void) | null = null;
  private nativeLoadedDataHandler: ((event: Event) => void) | null = null;
  private nativeErrorTimer: ReturnType<typeof setTimeout> | null = null;
  private nativeVideoElement: HTMLVideoElement | null = null;

  start(
    videoElement: HTMLVideoElement,
    primaryUrl: string,
    fallbackUrl: string | null,
    onError: PlaybackErrorHandler,
  ): void {
    this.destroy();
    this.attachSource(videoElement, primaryUrl, fallbackUrl, onError, false);
  }

  destroy(): void {
    this.teardownNativeListeners();

    if (this.hls) {
      this.hls.destroy();
      this.hls = null;
    }
  }

  private attachSource(
    videoElement: HTMLVideoElement,
    sourceUrl: string,
    fallbackUrl: string | null,
    onError: PlaybackErrorHandler,
    isFallback: boolean,
  ): void {
    const isM3u8Source = sourceUrl.toLowerCase().includes('.m3u8');
    const isTsSource = sourceUrl.toLowerCase().includes('.ts');
    const canPlayNativeHls = videoElement.canPlayType('application/vnd.apple.mpegurl') !== '';

    if (isTsSource) {
      this.attachNativeSource(videoElement, sourceUrl, fallbackUrl, onError, isFallback);
      return;
    }

    if (canPlayNativeHls && isM3u8Source) {
      this.attachNativeHlsFirst(videoElement, sourceUrl, fallbackUrl, onError, isFallback);
      return;
    }

    if (Hls.isSupported() && isM3u8Source) {
      this.attachHlsSource(videoElement, sourceUrl, fallbackUrl, onError, isFallback);
      return;
    }

    if (!isFallback && fallbackUrl) {
      this.attachSource(videoElement, fallbackUrl, null, onError, true);
      return;
    }

    onError('Este dispositivo no soporta HLS.', isFallback);
  }

  private attachNativeHlsFirst(
    videoElement: HTMLVideoElement,
    sourceUrl: string,
    fallbackUrl: string | null,
    onError: PlaybackErrorHandler,
    isFallback: boolean,
  ): void {
    this.teardownNativeListeners();
    this.nativeVideoElement = videoElement;

    const fallbackToHlsJs = () => {
      this.teardownNativeListeners();
      this.attachHlsSource(videoElement, sourceUrl, fallbackUrl, onError, isFallback);
    };

    this.nativeErrorHandler = () => {
      fallbackToHlsJs();
    };

    this.nativeStalledHandler = () => {
      fallbackToHlsJs();
    };

    this.nativeLoadedDataHandler = () => {
      this.clearNativeErrorTimer();
    };

    videoElement.addEventListener('error', this.nativeErrorHandler, { once: true });
    videoElement.addEventListener('stalled', this.nativeStalledHandler, { once: true });
    videoElement.addEventListener('loadeddata', this.nativeLoadedDataHandler, { once: true });

    videoElement.src = sourceUrl;
    void videoElement.play().catch(() => {
      // Playback can still begin with user interaction.
    });

    this.nativeErrorTimer = setTimeout(() => {
      if (!videoElement.currentSrc || videoElement.readyState >= 2) {
        return;
      }

      fallbackToHlsJs();
    }, 5000);
  }

  private attachHlsSource(
    videoElement: HTMLVideoElement,
    sourceUrl: string,
    fallbackUrl: string | null,
    onError: PlaybackErrorHandler,
    isFallback: boolean,
  ): void {
    this.destroy();
    this.hls = new Hls({
      enableWorker: true,
      lowLatencyMode: false,
      liveSyncDurationCount: 3,
      maxBufferLength: 30,
    });
    this.hls.loadSource(sourceUrl);
    this.hls.attachMedia(videoElement);
    this.hls.on(Events.ERROR, (_, data: ErrorData) => {
      if (!data.fatal) {
        return;
      }

      this.destroy();

      if (!isFallback && fallbackUrl) {
        this.attachSource(videoElement, fallbackUrl, null, onError, true);
        return;
      }

      onError('No se pudo reproducir el stream.', isFallback);
    });
  }

  private attachNativeSource(
    videoElement: HTMLVideoElement,
    sourceUrl: string,
    fallbackUrl: string | null,
    onError: PlaybackErrorHandler,
    isFallback: boolean,
  ): void {
    this.teardownNativeListeners();

    this.nativeVideoElement = videoElement;

    this.nativeErrorHandler = () => {
      this.teardownNativeListeners();

      if (!isFallback && fallbackUrl) {
        this.attachSource(videoElement, fallbackUrl, null, onError, true);
        return;
      }

      onError('No se pudo reproducir el stream.', isFallback);
    };

    this.nativeStalledHandler = () => {
      this.teardownNativeListeners();

      if (!isFallback && fallbackUrl) {
        this.attachSource(videoElement, fallbackUrl, null, onError, true);
        return;
      }

      onError('La reproduccion del canal se detuvo.', isFallback);
    };

    this.nativeLoadedDataHandler = () => {
      this.clearNativeErrorTimer();
    };

    videoElement.addEventListener('error', this.nativeErrorHandler, { once: true });
    videoElement.addEventListener('stalled', this.nativeStalledHandler, { once: true });
    videoElement.addEventListener('loadeddata', this.nativeLoadedDataHandler, { once: true });

    videoElement.src = sourceUrl;
    void videoElement.play().catch(() => {
      // Playback can still start after user interaction; error handlers remain active.
    });

    this.nativeErrorTimer = setTimeout(() => {
      if (!videoElement.currentSrc) {
        return;
      }

      this.teardownNativeListeners();

      if (!isFallback && fallbackUrl) {
        this.attachSource(videoElement, fallbackUrl, null, onError, true);
        return;
      }

      onError('Timeout al iniciar la reproduccion del stream.', isFallback);
    }, 10000);
  }

  private teardownNativeListeners(): void {
    this.clearNativeErrorTimer();

    if (!this.nativeVideoElement) {
      return;
    }

    if (this.nativeErrorHandler) {
      this.nativeVideoElement.removeEventListener('error', this.nativeErrorHandler);
      this.nativeErrorHandler = null;
    }

    if (this.nativeStalledHandler) {
      this.nativeVideoElement.removeEventListener('stalled', this.nativeStalledHandler);
      this.nativeStalledHandler = null;
    }

    if (this.nativeLoadedDataHandler) {
      this.nativeVideoElement.removeEventListener('loadeddata', this.nativeLoadedDataHandler);
      this.nativeLoadedDataHandler = null;
    }

    this.nativeVideoElement = null;
  }

  private clearNativeErrorTimer(): void {
    if (!this.nativeErrorTimer) {
      return;
    }

    clearTimeout(this.nativeErrorTimer);
    this.nativeErrorTimer = null;
  }
}
