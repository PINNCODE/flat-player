import { Injectable, signal } from '@angular/core';
import Hls, { ErrorData, Events } from 'hls.js';
import { LiveLatencySyncUtil } from './live-latency-sync.util';

type PlaybackErrorHandler = (message: string, usedFallback: boolean) => void;

@Injectable({ providedIn: 'root' })
export class VideoPlaybackFacade {
  private static readonly MONITOR_INTERVAL_MS = 5000;
  private static readonly MIN_BUFFER_AHEAD_SECONDS = 0.5;
  private static readonly BACK_BUFFER_FLUSH_INTERVAL_MS = 20000;
  /** Buffer mínimo para salir del modo de recuperación post-stall. */
  private static readonly STALL_RECOVERY_BUFFER_SECONDS = 8;

  private hls: Hls | null = null;
  private nativeErrorHandler: ((event: Event) => void) | null = null;
  private nativeStalledHandler: ((event: Event) => void) | null = null;
  private nativeLoadedDataHandler: ((event: Event) => void) | null = null;
  private nativeErrorTimer: ReturnType<typeof setTimeout> | null = null;
  private nativeVideoElement: HTMLVideoElement | null = null;
  private latencyMonitorTimer: ReturnType<typeof setInterval> | null = null;
  private seekGuardTimeout: ReturnType<typeof setTimeout> | null = null;
  private isSeekInProgress = false;
  private isBuffering = false;
  /** true tras un bufferStalledError; se limpia cuando el buffer recupera >= 8s. */
  private isStalledRecovery = false;
  private monitorVideoElement: HTMLVideoElement | null = null;
  private monitorWaitingHandler: ((event: Event) => void) | null = null;
  private monitorPlayingHandler: ((event: Event) => void) | null = null;
  private monitorCanPlayHandler: ((event: Event) => void) | null = null;
  private lastBackBufferFlushAt = 0;
  private readonly liveLatencySyncUtil = new LiveLatencySyncUtil();

  readonly liveEdgeSeconds = signal(0);
  readonly currentTimeSeconds = signal(0);
  readonly latencySeconds = signal(0);
  readonly bufferAheadSeconds = signal(0);

  start(
    videoElement: HTMLVideoElement,
    primaryUrl: string,
    fallbackUrl: string | null,
    onError: PlaybackErrorHandler,
  ): void {
    this.destroy();
    this.attachSource(videoElement, primaryUrl, fallbackUrl, onError, false);
    this.startLatencyMonitoring(videoElement);
  }

  destroy(): void {
    this.teardownNativeListeners();
    this.stopLatencyMonitoring();

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

      // ── Sincronización (Modo SeguridadChunks) ────
      // Ajuste a 30s (3 chunks detrás del vivo absoluto).
      // Es el límite físico para evitar que el buffer llegue a 0s.
      liveSyncDuration: 30,
      // Latencia máxima tolerable antes del resync (debe ser > liveSyncDuration).
      liveMaxLatencyDuration: 60,

      // ── Aceleración automática ────────────────────────────────────────
      // Catch-up suave para acomodarse a la latencia de 20s.
      maxLiveSyncPlaybackRate: 1.15,

      // ── Gestión de buffer ─────────────────────────────────────────────
      // Alivio enfocado a web (sin límite agresivo de backBuffer).
      maxBufferLength: 30,
      maxMaxBufferLength: 40,
      backBufferLength: 10,
    });
    this.hls.loadSource(sourceUrl);
    this.hls.attachMedia(videoElement);

    this.hls.on(Events.LEVEL_UPDATED, () => {
      this.isBuffering = false;
      this.syncToLiveEdge(videoElement);
    });

    this.hls.on(Events.FRAG_BUFFERED, () => {
      // Trigger de catch-up event-driven: se evalúa la lógica cada vez que
      // llega un fragmento (óptimo para fragmentos largos de ~10s).
      this.syncToLiveEdge(videoElement);
      this.flushOldBuffer(videoElement);
    });

    this.hls.on(Events.ERROR, (_, data: ErrorData) => {
      if (data.details === 'bufferStalledError') {
        this.isBuffering = true;
        this.isStalledRecovery = true;
        // Freno inmediato: cancelar cualquier aceleración activa.
        this.applyPlaybackRate(videoElement, 1);

        // -- Registro de Telemetría Empírica --
        const currentTime = videoElement.currentTime || 0;
        const bufferAhead = this.getBufferAhead(videoElement, currentTime);
        const liveEdge = this.getLiveEdge(videoElement, currentTime, bufferAhead);
        const latency = Number.isFinite(liveEdge) ? Math.max(0, liveEdge - currentTime) : 0;

        this.logStallTelemetry(liveEdge, currentTime, latency, bufferAhead);
      }

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

  private startLatencyMonitoring(videoElement: HTMLVideoElement): void {
    this.stopLatencyMonitoring();
    this.monitorVideoElement = videoElement;

    this.monitorWaitingHandler = () => {
      this.isBuffering = true;
    };

    this.monitorPlayingHandler = () => {
      this.isBuffering = false;
    };

    this.monitorCanPlayHandler = () => {
      this.isBuffering = false;
    };

    videoElement.addEventListener('waiting', this.monitorWaitingHandler);
    videoElement.addEventListener('playing', this.monitorPlayingHandler);
    videoElement.addEventListener('canplay', this.monitorCanPlayHandler);

    // Primer muestreo inmediato para no mostrar valores en cero al abrir debug.
    this.syncToLiveEdge(videoElement);

    this.latencyMonitorTimer = setInterval(() => {
      this.syncToLiveEdge(videoElement);
    }, VideoPlaybackFacade.MONITOR_INTERVAL_MS);
  }

  private stopLatencyMonitoring(): void {
    if (this.latencyMonitorTimer) {
      clearInterval(this.latencyMonitorTimer);
      this.latencyMonitorTimer = null;
    }

    if (this.seekGuardTimeout) {
      clearTimeout(this.seekGuardTimeout);
      this.seekGuardTimeout = null;
    }

    if (this.monitorVideoElement) {
      if (this.monitorWaitingHandler) {
        this.monitorVideoElement.removeEventListener('waiting', this.monitorWaitingHandler);
      }

      if (this.monitorPlayingHandler) {
        this.monitorVideoElement.removeEventListener('playing', this.monitorPlayingHandler);
      }

      if (this.monitorCanPlayHandler) {
        this.monitorVideoElement.removeEventListener('canplay', this.monitorCanPlayHandler);
      }

      this.monitorVideoElement = null;
    }

    this.monitorWaitingHandler = null;
    this.monitorPlayingHandler = null;
    this.monitorCanPlayHandler = null;
    this.isBuffering = false;
    this.isSeekInProgress = false;
    this.isStalledRecovery = false;
    this.lastBackBufferFlushAt = 0;
  }

  private syncToLiveEdge(videoElement: HTMLVideoElement): void {
    const currentTime = Number.isFinite(videoElement.currentTime) ? videoElement.currentTime : 0;
    const bufferAhead = this.getBufferAhead(videoElement, currentTime);
    const liveEdge = this.getLiveEdge(videoElement, currentTime, bufferAhead);
    const latency = Number.isFinite(liveEdge) ? Math.max(0, liveEdge - currentTime) : 0;

    // Actualizar signals de debug (el effect() del dashboard filtra cambios pequeños).
    this.liveEdgeSeconds.set(liveEdge);
    this.currentTimeSeconds.set(currentTime);
    this.latencySeconds.set(latency);
    this.bufferAheadSeconds.set(bufferAhead);

    // Limpiar isStalledRecovery en cuanto el buffer supere el umbral de recuperación.
    if (
      this.isStalledRecovery &&
      bufferAhead >= VideoPlaybackFacade.STALL_RECOVERY_BUFFER_SECONDS
    ) {
      this.isStalledRecovery = false;
    }

    if (!Number.isFinite(liveEdge)) {
      return;
    }

    if (videoElement.readyState < 2) {
      return;
    }

    const decision = this.liveLatencySyncUtil.evaluate({
      currentTime,
      liveEdge,
      liveSyncPosition: this.getLiveSyncPosition(),
      bufferAhead,
      paused: videoElement.paused,
      buffering: this.isBuffering,
      stalledRecovery: this.isStalledRecovery,
      nowMs: Date.now(),
    });

    switch (decision.action) {
      case 'catch-up':
        // Soft catch-up explícito: buffer sano, latencia por encima del objetivo.
        // Se fija en 1.1x — puede convivir con maxLiveSyncPlaybackRate (1.15x)
        // ya que ambos empujan en la misma dirección.
        this.applyPlaybackRate(videoElement, LiveLatencySyncUtil.CATCHUP_RATE);
        break;

      case 'brake':
        // Freno de emergencia: anula la aceleración de hls.js.
        // hls.js recuperará el control cuando el buffer suba.
        this.applyPlaybackRate(videoElement, 1);
        break;

      case 'seek':
        if (decision.targetTime !== null) {
          this.applyPlaybackRate(videoElement, 1);
          this.forceSeek(videoElement, decision.targetTime, currentTime);
        }
        break;

      case 'resync':
        this.resyncManifest();
        break;

      case 'none':
        // hls.js gestiona la tasa con maxLiveSyncPlaybackRate: 1.15.
        // No interferir.
        break;
    }
  }

  private forceSeek(
    videoElement: HTMLVideoElement,
    targetTime: number,
    currentTime: number,
  ): void {
    if (this.isSeekInProgress || videoElement.paused || this.isBuffering) {
      return;
    }

    if (Math.abs(targetTime - currentTime) < 0.5) {
      return;
    }

    this.isSeekInProgress = true;
    videoElement.currentTime = targetTime;

    const onSeeked = () => {
      this.isSeekInProgress = false;
      videoElement.removeEventListener('seeked', onSeeked);

      if (this.seekGuardTimeout) {
        clearTimeout(this.seekGuardTimeout);
        this.seekGuardTimeout = null;
      }
    };

    videoElement.addEventListener('seeked', onSeeked, { once: true });

    this.seekGuardTimeout = setTimeout(() => {
      this.isSeekInProgress = false;
      this.seekGuardTimeout = null;
    }, 1500);
  }

  private resyncManifest(): void {
    if (!this.hls) {
      return;
    }

    this.hls.stopLoad();
    this.hls.startLoad(-1, true);
  }

  private flushOldBuffer(videoElement: HTMLVideoElement): void {
    if (!this.hls) {
      return;
    }

    const nowMs = Date.now();
    if (nowMs - this.lastBackBufferFlushAt < VideoPlaybackFacade.BACK_BUFFER_FLUSH_INTERVAL_MS) {
      return;
    }

    const flushEnd = this.liveLatencySyncUtil.getBackBufferFlushEnd(videoElement.currentTime);
    if (flushEnd <= 0) {
      return;
    }

    this.hls.trigger(Events.BUFFER_FLUSHING, {
      startOffset: 0,
      endOffset: flushEnd,
      type: null,
    });
    this.lastBackBufferFlushAt = nowMs;
  }

  private getLiveSyncPosition(): number | null {
    const liveSyncPosition = this.hls?.liveSyncPosition;
    if (liveSyncPosition === null || liveSyncPosition === undefined || !Number.isFinite(liveSyncPosition)) {
      return null;
    }

    return liveSyncPosition;
  }

  private applyPlaybackRate(videoElement: HTMLVideoElement, rate: number): void {
    if (videoElement.playbackRate === rate) {
      return;
    }

    videoElement.playbackRate = rate;
  }

  private getLiveEdge(
    videoElement: HTMLVideoElement,
    currentTime: number,
    bufferAhead: number,
  ): number {
    if (videoElement.seekable.length > 0) {
      return videoElement.seekable.end(videoElement.seekable.length - 1);
    }

    if (this.hls?.liveSyncPosition !== null && this.hls?.liveSyncPosition !== undefined) {
      return this.hls.liveSyncPosition;
    }

    if (videoElement.buffered.length > 0) {
      return videoElement.buffered.end(videoElement.buffered.length - 1);
    }

    if (bufferAhead > 0) {
      return currentTime + bufferAhead;
    }

    return Number.isFinite(videoElement.duration) ? videoElement.duration : currentTime;
  }

  private getBufferAhead(videoElement: HTMLVideoElement, currentTime: number): number {
    if (videoElement.buffered.length === 0) {
      return 0;
    }

    for (let index = 0; index < videoElement.buffered.length; index += 1) {
      const start = videoElement.buffered.start(index);
      const end = videoElement.buffered.end(index);
      if (currentTime >= start && currentTime <= end) {
        return Math.max(0, end - currentTime);
      }
    }

    const lastEnd = videoElement.buffered.end(videoElement.buffered.length - 1);
    return Math.max(0, lastEnd - currentTime);
  }

  private logStallTelemetry(liveEdge: number, currentTime: number, latency: number, bufferAhead: number): void {
    try {
      const STORAGE_KEY = 'iptv_stall_telemetry';
      const MAX_LOGS = 50;

      const historyStr = localStorage.getItem(STORAGE_KEY);
      let history: any[] = [];

      if (historyStr) {
        try {
          history = JSON.parse(historyStr);
        } catch (e) {
          history = [];
        }
      }

      history.push({
        timestamp: new Date().toISOString(),
        liveEdge: Number(liveEdge.toFixed(2)),
        currentTime: Number(currentTime.toFixed(2)),
        latency: Number(latency.toFixed(2)),
        bufferAhead: Number(bufferAhead.toFixed(2))
      });

      if (history.length > MAX_LOGS) {
        history = history.slice(-MAX_LOGS);
      }

      localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    } catch (e) {
      console.warn('No se pudo guardar la telemetría del stall en localStorage', e);
    }
  }
}
