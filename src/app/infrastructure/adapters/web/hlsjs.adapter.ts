import { Injectable } from '@angular/core';
import { Subject, Observable } from 'rxjs';
import Hls from 'hls.js';

/**
 * Adaptador para HLS.js (fallback para desarrollo web)
 * Se usa cuando AVPlay no está disponible (entorno de desarrollo)
 * Configurado con los mismos parámetros de buffer que AVPlay
 */
@Injectable({
  providedIn: 'root'
})
export class HlsjsAdapter {
  private hls: Hls | null = null;
  private videoElement: HTMLVideoElement | null = null;
  private isInitialized: boolean = false;

  // Subjects para eventos de reproducción
  private bufferingStart$ = new Subject<void>();
  private bufferingProgress$ = new Subject<number>();
  private bufferingComplete$ = new Subject<void>();
  private currentTimeUpdate$ = new Subject<number>();
  private streamCompleted$ = new Subject<void>();
  private error$ = new Subject<any>();

  constructor() {
    // HLS.js se carga dinámicamente o está disponible globalmente
  }

  /**
   * Verifica si HLS.js está disponible
   */
  isAvailable(): boolean {
    if (typeof Hls !== 'undefined' && Hls.isSupported()) {
      return true;
    }

    // Verificar soporte nativo HLS (Safari)
    if (typeof document !== 'undefined') {
      const video = document.createElement('video');
      return video.canPlayType('application/vnd.apple.mpegurl') !== '';
    }

    return false;
  }

  /**
   * Inicializa el reproductor HLS.js
   * @param url URL del stream HLS
   * @param videoElement Elemento de video HTML5
   */
  async initialize(url: string, videoElement: HTMLVideoElement): Promise<void> {
    if (!this.isAvailable()) {
      throw new Error('HLS is not supported in this environment');
    }

    if (this.isInitialized && this.hls) {
      await this.cleanup();
    }

    this.videoElement = videoElement;

    try {
      if (Hls.isSupported()) {
        // Configurar HLS.js con parámetros equivalentes a AVPlay
        this.hls = new Hls({
          // Configuración de buffer (equivalente a AVPlay)
          maxBufferLength: 40, // 40 segundos máximo
          maxMaxBufferLength: 40,
          backBufferLength: 10, // 10 segundos de retroceso
          
          // Configuración de latencia para live streams
          liveSyncDuration: 30, // 30 segundos detrás del borde en vivo
          liveMaxLatencyDuration: 90, // Máxima latencia permitida (debe ser > liveSyncDuration)
          liveMaxLatencyDurationCount: 10, // Número de segmentos
          
          // Velocidad de catch-up máxima
          maxFragLookUpTolerance: 0.2,
          
          // Configuración de calidad
          startLevel: -1, // Auto calidad
          capLevelToPlayerSize: true,
          
          // Manejo de errores
          enableWorker: true,
          enableSoftwareAES: true,
          
          // Debug (desactivar en producción)
          debug: false
        });

        // Cargar el stream
        this.hls.loadSource(url);
        this.hls.attachMedia(videoElement);

        // Configurar listeners de eventos
        this.setupHlsListeners();

        // Esperar que el manifiesto sea parseado
        await new Promise<void>((resolve, reject) => {
          this.hls!.on(Hls.Events.MANIFEST_PARSED, () => {
            this.isInitialized = true;
            resolve();
          });

          this.hls!.on(Hls.Events.ERROR, (event, data) => {
            if (data.fatal) {
              reject(new Error(`HLS.js fatal error: ${data.type}`));
            }
          });
        });
      } else if (videoElement.canPlayType('application/vnd.apple.mpegurl')) {
        // Soporte nativo HLS (Safari)
        videoElement.src = url;
        this.isInitialized = true;
        
        // Configurar listeners nativos
        this.setupNativeListeners();
      }
    } catch (error) {
      await this.cleanup();
      throw new Error(`Failed to initialize HLS: ${error}`);
    }
  }

  /**
   * Configura los listeners de eventos de HLS.js
   */
  private setupHlsListeners(): void {
    if (!this.hls) return;

    // Evento de inicio de buffering
    this.hls.on(Hls.Events.FRAG_LOADING, () => {
      this.bufferingStart$.next();
    });

    // Evento de progreso de buffering
    this.hls.on(Hls.Events.FRAG_LOADED, () => {
      // Estimar progreso basado en buffer length
      if (this.videoElement) {
        const buffered = this.videoElement.buffered;
        if (buffered.length > 0) {
          const bufferedEnd = buffered.end(buffered.length - 1);
          const currentTime = this.videoElement.currentTime;
          const bufferedSeconds = bufferedEnd - currentTime;
          const progress = Math.min(100, (bufferedSeconds / 40) * 100);
          this.bufferingProgress$.next(progress);
        }
      }
    });

    // Evento de buffering completado
    this.hls.on(Hls.Events.BUFFER_APPENDED, () => {
      this.bufferingComplete$.next();
    });

    // Error de recuperación
    this.hls.on(Hls.Events.ERROR, (event, data) => {
      if (data.fatal) {
        switch (data.type) {
          case Hls.ErrorTypes.NETWORK_ERROR:
            console.error('Network error, trying to recover...');
            this.hls!.startLoad();
            break;
          case Hls.ErrorTypes.MEDIA_ERROR:
            console.error('Media error, trying to recover...');
            this.hls!.recoverMediaError();
            break;
          default:
            console.error('Fatal error, cannot recover');
            this.error$.next(data);
            break;
        }
      }
    });
  }

  /**
   * Configura listeners nativos para Safari
   */
  private setupNativeListeners(): void {
    if (!this.videoElement) return;

    this.videoElement.addEventListener('waiting', () => {
      this.bufferingStart$.next();
    });

    this.videoElement.addEventListener('progress', () => {
      const buffered = this.videoElement!.buffered;
      if (buffered.length > 0) {
        const bufferedEnd = buffered.end(buffered.length - 1);
        const currentTime = this.videoElement!.currentTime;
        const bufferedSeconds = bufferedEnd - currentTime;
        const progress = Math.min(100, (bufferedSeconds / 40) * 100);
        this.bufferingProgress$.next(progress);
      }
    });

    this.videoElement.addEventListener('playing', () => {
      this.bufferingComplete$.next();
    });

    this.videoElement.addEventListener('timeupdate', () => {
      this.currentTimeUpdate$.next(this.videoElement!.currentTime * 1000);
    });

    this.videoElement.addEventListener('ended', () => {
      this.streamCompleted$.next();
    });

    this.videoElement.addEventListener('error', (event) => {
      this.error$.next(event);
    });
  }

  /**
   * Reproduce el stream
   */
  async play(): Promise<void> {
    if (!this.videoElement || !this.isInitialized) {
      throw new Error('HLS player not initialized');
    }

    try {
      await this.videoElement.play();
    } catch (error) {
      throw new Error(`Failed to play stream: ${error}`);
    }
  }

  /**
   * Pausa la reproducción
   */
  async pause(): Promise<void> {
    if (!this.videoElement || !this.isInitialized) {
      throw new Error('HLS player not initialized');
    }

    this.videoElement.pause();
  }

  /**
   * Reanuda la reproducción
   */
  async resume(): Promise<void> {
    if (!this.videoElement || !this.isInitialized) {
      throw new Error('HLS player not initialized');
    }

    await this.videoElement.play();
  }

  /**
   * Detiene la reproducción y limpia recursos
   */
  async stop(): Promise<void> {
    if (!this.videoElement || !this.isInitialized) {
      return;
    }

    try {
      this.videoElement.pause();
      this.videoElement.currentTime = 0;
    } catch (error) {
      console.error('Error stopping video:', error);
    } finally {
      await this.cleanup();
    }
  }

  /**
   * Limpia los recursos del reproductor
   */
  private async cleanup(): Promise<void> {
    if (this.hls) {
      this.hls.destroy();
      this.hls = null;
    }

    if (this.videoElement) {
      // Remover listeners nativos
      this.videoElement.removeEventListener('waiting', () => {});
      this.videoElement.removeEventListener('progress', () => {});
      this.videoElement.removeEventListener('playing', () => {});
      this.videoElement.removeEventListener('timeupdate', () => {});
      this.videoElement.removeEventListener('ended', () => {});
      this.videoElement.removeEventListener('error', () => {});
      
      this.videoElement.src = '';
      this.videoElement.load();
      this.videoElement = null;
    }

    this.isInitialized = false;
  }

  /**
   * Obtiene el tiempo actual de reproducción en milisegundos
   */
  getCurrentTime(): number {
    if (!this.videoElement || !this.isInitialized) {
      return 0;
    }

    return this.videoElement.currentTime * 1000;
  }

  /**
   * Obtiene la duración total del stream en milisegundos
   */
  getDuration(): number {
    if (!this.videoElement || !this.isInitialized) {
      return 0;
    }

    const duration = this.videoElement.duration;
    return isNaN(duration) || !isFinite(duration) ? 0 : duration * 1000;
  }

  /**
   * Busca a una posición específica del stream
   */
  async seek(time: number): Promise<void> {
    if (!this.videoElement || !this.isInitialized) {
      throw new Error('HLS player not initialized');
    }

    this.videoElement.currentTime = time / 1000;
  }

  /**
   * Observable para eventos de inicio de buffering
   */
  getBufferingStart(): Observable<void> {
    return this.bufferingStart$.asObservable();
  }

  /**
   * Observable para progreso de buffering (0-100)
   */
  getBufferingProgress(): Observable<number> {
    return this.bufferingProgress$.asObservable();
  }

  /**
   * Observable para eventos de buffering completado
   */
  getBufferingComplete(): Observable<void> {
    return this.bufferingComplete$.asObservable();
  }

  /**
   * Observable para actualizaciones de tiempo actual
   */
  getCurrentTimeUpdate(): Observable<number> {
    return this.currentTimeUpdate$.asObservable();
  }

  /**
   * Observable para eventos de stream completado
   */
  getStreamCompleted(): Observable<void> {
    return this.streamCompleted$.asObservable();
  }

  /**
   * Observable para errores de reproducción
   */
  getError(): Observable<any> {
    return this.error$.asObservable();
  }

  /**
   * Verifica si el reproductor está reproduciendo
   */
  isPlaying(): boolean {
    if (!this.videoElement || !this.isInitialized) {
      return false;
    }

    return !this.videoElement.paused && !this.videoElement.ended;
  }

  /**
   * Obtiene información de estado para telemetría
   */
  getTelemetryInfo(): {
    currentTime: number;
    duration: number;
    isPlaying: boolean;
    isInitialized: boolean;
    bufferLength: number;
  } {
    let bufferLength = 0;
    
    if (this.videoElement && this.videoElement.buffered.length > 0) {
      const bufferedEnd = this.videoElement.buffered.end(this.videoElement.buffered.length - 1);
      const currentTime = this.videoElement.currentTime;
      bufferLength = bufferedEnd - currentTime;
    }

    return {
      currentTime: this.getCurrentTime(),
      duration: this.getDuration(),
      isPlaying: this.isPlaying(),
      isInitialized: this.isInitialized,
      bufferLength
    };
  }

  /**
   * Limpia todos los subjects al destruir el servicio
   */
  destroy(): void {
    this.bufferingStart$.complete();
    this.bufferingProgress$.complete();
    this.bufferingComplete$.complete();
    this.currentTimeUpdate$.complete();
    this.streamCompleted$.complete();
    this.error$.complete();
  }
}
