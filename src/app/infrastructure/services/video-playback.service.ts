import { Injectable, inject, OnDestroy } from '@angular/core';
import { Subject, Observable, combineLatest, fromEvent } from 'rxjs';
import { takeUntil, filter, debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { AvplayAdapter } from '../adapters/tizen/avplay.adapter';
import { HlsjsAdapter } from '../adapters/web/hlsjs.adapter';

/**
 * Interfaz para opciones de reproducción
 */
export interface PlaybackOptions {
  autoPlay?: boolean;
  startTime?: number;
  videoElement?: HTMLVideoElement; // Requerido para HLS.js
}

/**
 * Interfaz para telemetría de reproducción
 */
export interface PlaybackTelemetry {
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  bufferLength?: number;
  latency?: number;
  adapter: 'avplay' | 'hlsjs' | 'native' | 'unknown';
  currentUrl: string;
}

/**
 * Servicio unificado de reproducción de video
 * Prioriza AVPlay (Tizen) y usa HLS.js como fallback para web
 * Implementa estrategia de fallback automática entre URLs
 * Proporciona telemetría de reproducción para monitoreo
 */
@Injectable({
  providedIn: 'root'
})
export class VideoPlaybackService implements OnDestroy {
  private avplayAdapter = inject(AvplayAdapter);
  private hlsjsAdapter = inject(HlsjsAdapter);
  
  private currentAdapter: 'avplay' | 'hlsjs' | null = null;
  private currentUrl: string = '';
  private isPlaying: boolean = false;
  private currentVideoElement: HTMLVideoElement | null = null;

  private destroy$ = new Subject<void>();
  
  // Subjects para eventos unificados
  private playbackState$ = new Subject<'playing' | 'paused' | 'stopped' | 'error'>();
  private bufferingState$ = new Subject<'buffering' | 'ready'>();
  private telemetry$ = new Subject<PlaybackTelemetry>();
  private error$ = new Subject<{ message: string; code?: number; adapter: string }>();

  // Historial de URLs para fallback
  private urlHistory: Map<string, boolean> = new Map(); // URL -> success/failure

  constructor() {
    this.initializeTelemetry();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.stop();
    this.cleanupSubjects();
  }

  /**
   * Inicializa el sistema de telemetría
   * Emite datos cada segundo cuando está reproduciendo
   */
  private initializeTelemetry(): void {
    combineLatest([
      this.getCurrentAdapter().getCurrentTimeUpdate(),
      this.getCurrentAdapter().getBufferingComplete()
    ]).pipe(
      takeUntil(this.destroy$),
      debounceTime(1000),
      filter(() => this.isPlaying)
    ).subscribe(() => {
      this.emitTelemetry();
    });
  }

  /**
   * Obtiene el adaptador activo actual
   */
  private getCurrentAdapter() {
    if (this.currentAdapter === 'avplay') {
      return this.avplayAdapter;
    } else if (this.currentAdapter === 'hlsjs') {
      return this.hlsjsAdapter;
    }
    // Por defecto, intentar AVPlay primero
    return this.avplayAdapter;
  }

  /**
   * Reproduce un stream con estrategia de fallback
   * @param url URL del stream (puede ser array para fallback)
   * @param options Opciones de reproducción
   */
  async playStream(
    url: string | string[],
    options: PlaybackOptions = {}
  ): Promise<void> {
    const urls = Array.isArray(url) ? url : [url];
    
    // Intentar cada URL hasta que una funcione
    for (const streamUrl of urls) {
      try {
        await this.playSingleStream(streamUrl, options);
        this.currentUrl = streamUrl;
        this.urlHistory.set(streamUrl, true);
        return;
      } catch (error) {
        console.error(`Failed to play ${streamUrl}:`, error);
        this.urlHistory.set(streamUrl, false);
        
        // Notificar fallback si hay más URLs
        if (urls.indexOf(streamUrl) < urls.length - 1) {
          this.error$.next({
            message: `Falling back to next URL after failure: ${streamUrl}`,
            adapter: this.currentAdapter || 'unknown'
          });
        }
      }
    }

    // Todas las URLs fallaron
    throw new Error('All stream URLs failed');
  }

  /**
   * Reproduce un stream individual
   */
  private async playSingleStream(
    url: string,
    options: PlaybackOptions
  ): Promise<void> {
    // Detener reproducción actual si existe
    if (this.currentAdapter) {
      await this.stop();
    }

    // Seleccionar adaptador: AVPlay (Tizen) > HLS.js (Web)
    if (this.avplayAdapter.isAvailable()) {
      this.currentAdapter = 'avplay';
      await this.avplayAdapter.initialize(url);
      this.setupAdapterListeners(this.avplayAdapter);
    } else if (this.hlsjsAdapter.isAvailable()) {
      this.currentAdapter = 'hlsjs';
      
      if (!options.videoElement) {
        throw new Error('videoElement is required for HLS.js adapter');
      }
      
      this.currentVideoElement = options.videoElement;
      await this.hlsjsAdapter.initialize(url, options.videoElement);
      this.setupAdapterListeners(this.hlsjsAdapter);
    } else {
      throw new Error('No video playback adapter available');
    }

    // Aplicar tiempo inicial si se especificó
    if (options.startTime && options.startTime > 0) {
      await this.seek(options.startTime);
    }

    // Reproducir si autoPlay es true (default)
    if (options.autoPlay !== false) {
      await this.getCurrentAdapter().play();
      this.isPlaying = true;
      this.playbackState$.next('playing');
    }
  }

  /**
   * Configura los listeners del adaptador seleccionado
   */
  private setupAdapterListeners(adapter: any): void {
    // Buffering
    adapter.getBufferingStart().pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.bufferingState$.next('buffering');
    });

    adapter.getBufferingComplete().pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.bufferingState$.next('ready');
    });

    // Errores
    adapter.getError().pipe(takeUntil(this.destroy$)).subscribe((error: any) => {
      this.error$.next({
        message: error.message || 'Playback error',
        code: error.code,
        adapter: this.currentAdapter || 'unknown'
      });
      this.playbackState$.next('error');
    });

    // Stream completado
    adapter.getStreamCompleted().pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.isPlaying = false;
      this.playbackState$.next('stopped');
    });
  }

  /**
   * Pausa la reproducción
   */
  async pause(): Promise<void> {
    if (!this.currentAdapter) return;

    await this.getCurrentAdapter().pause();
    this.isPlaying = false;
    this.playbackState$.next('paused');
  }

  /**
   * Reanuda la reproducción
   */
  async resume(): Promise<void> {
    if (!this.currentAdapter) return;

    await this.getCurrentAdapter().resume();
    this.isPlaying = true;
    this.playbackState$.next('playing');
  }

  /**
   * Detiene la reproducción y limpia recursos
   */
  async stop(): Promise<void> {
    if (!this.currentAdapter) return;

    try {
      await this.getCurrentAdapter().stop();
    } catch (error) {
      console.error('Error stopping playback:', error);
    }

    this.currentAdapter = null;
    this.isPlaying = false;
    this.currentUrl = '';
    this.currentVideoElement = null;
    this.playbackState$.next('stopped');
  }

  /**
   * Busca a una posición específica
   */
  async seek(time: number): Promise<void> {
    if (!this.currentAdapter) return;

    await this.getCurrentAdapter().seek(time);
  }

  /**
   * Obtiene el tiempo actual de reproducción
   */
  getCurrentTime(): number {
    if (!this.currentAdapter) return 0;
    return this.getCurrentAdapter().getCurrentTime();
  }

  /**
   * Obtiene la duración total del stream
   */
  getDuration(): number {
    if (!this.currentAdapter) return 0;
    return this.getCurrentAdapter().getDuration();
  }

  /**
   * Verifica si está reproduciendo
   */
  isCurrentlyPlaying(): boolean {
    return this.isPlaying;
  }

  /**
   * Obtiene el adaptador actualmente en uso
   */
  getActiveAdapter(): 'avplay' | 'hlsjs' | null {
    return this.currentAdapter;
  }

  /**
   * Emite datos de telemetría
   */
  private emitTelemetry(): void {
    const adapter = this.getCurrentAdapter();
    const telemetry: PlaybackTelemetry = {
      ...adapter.getTelemetryInfo(),
      adapter: this.currentAdapter || 'unknown',
      currentUrl: this.currentUrl
    };

    // Calcular latencia para live streams
    if (this.currentAdapter === 'avplay') {
      // AVPlay maneja latencia internamente
      telemetry.latency = 30; // Configurado en AVPlay
    } else if (this.currentAdapter === 'hlsjs') {
      const hlsTelemetry = adapter.getTelemetryInfo();
      telemetry.latency = hlsTelemetry.bufferLength || 0;
    }

    this.telemetry$.next(telemetry);
  }

  /**
   * Observable para estado de reproducción
   */
  getPlaybackState(): Observable<'playing' | 'paused' | 'stopped' | 'error'> {
    return this.playbackState$.asObservable();
  }

  /**
   * Observable para estado de buffering
   */
  getBufferingState(): Observable<'buffering' | 'ready'> {
    return this.bufferingState$.asObservable();
  }

  /**
   * Observable para telemetría de reproducción
   */
  getTelemetry(): Observable<PlaybackTelemetry> {
    return this.telemetry$.asObservable();
  }

  /**
   * Observable para errores de reproducción
   */
  getError(): Observable<{ message: string; code?: number; adapter: string }> {
    return this.error$.asObservable();
  }

  /**
   * Obtiene información de telemetría actual (síncrono)
   */
  getCurrentTelemetry(): PlaybackTelemetry | null {
    if (!this.currentAdapter) return null;

    const adapter = this.getCurrentAdapter();
    const telemetry: PlaybackTelemetry = {
      ...adapter.getTelemetryInfo(),
      adapter: this.currentAdapter || 'unknown',
      currentUrl: this.currentUrl
    };

    if (this.currentAdapter === 'hlsjs') {
      const hlsTelemetry = adapter.getTelemetryInfo();
      telemetry.bufferLength = hlsTelemetry.bufferLength;
      telemetry.latency = hlsTelemetry.bufferLength || 0;
    } else {
      telemetry.latency = 30; // Configurado en AVPlay
    }

    return telemetry;
  }

  /**
   * Obtiene el historial de URLs con su estado
   */
  getUrlHistory(): Map<string, boolean> {
    return new Map(this.urlHistory);
  }

  /**
   * Limpia el historial de URLs
   */
  clearUrlHistory(): void {
    this.urlHistory.clear();
  }

  /**
   * Limpia todos los subjects
   */
  private cleanupSubjects(): void {
    this.playbackState$.complete();
    this.bufferingState$.complete();
    this.telemetry$.complete();
    this.error$.complete();
  }
}
