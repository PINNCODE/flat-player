import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import Hls from 'hls.js';

@Component({
  selector: 'app-video-player',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="video-container">
      <form class="panel form" (ngSubmit)="loadStream()">
        <label>
          Dominio
          <input [(ngModel)]="domain" name="domain" placeholder="ftvpro.net:8443" />
        </label>
        <label>
          Usuario
          <input [(ngModel)]="username" name="username" placeholder="TU_USUARIO" />
        </label>
        <label>
          Contraseña
          <input [(ngModel)]="password" name="password" placeholder="TU_CONTRASENA" />
        </label>
        <label>
          Stream ID
          <input [(ngModel)]="streamId" name="streamId" placeholder="STREAM_ID" />
        </label>
        <div class="actions">
          <button type="submit">Cargar stream</button>
          <button type="button" (click)="playNow()">Play manual</button>
        </div>
      </form>
      <video
        #videoPlayer
        controls
        autoplay
        muted
        playsinline
        style="width: 100%; max-width: 800px;"
      ></video>
      <div class="panel">
        <button type="button" (click)="playNow()">Play manual</button>
        <p><strong>Estado:</strong> {{ status }}</p>
        <p><strong>Error:</strong> {{ errorMessage || 'Ninguno' }}</p>
      </div>
    </div>
  `,
  styles: [
    `
      .video-container {
        display: grid;
        gap: 0.75rem;
        justify-items: center;
        padding: 0.75rem;
        background: #000;
      }

      .panel {
        width: 100%;
        max-width: 800px;
        background: #111;
        color: #f3f4f6;
        padding: 0.75rem;
        border-radius: 8px;
      }

      .panel p {
        margin: 0.45rem 0 0;
        word-break: break-word;
      }

      .form {
        display: grid;
        gap: 0.75rem;
      }

      label {
        display: grid;
        gap: 0.35rem;
      }

      input {
        padding: 0.55rem 0.7rem;
      }

      .actions {
        display: flex;
        gap: 0.75rem;
        flex-wrap: wrap;
      }

      button {
        padding: 0.45rem 0.8rem;
      }
    `
  ]
})
export class VideoPlayerComponent implements OnInit, OnDestroy {
  @ViewChild('videoPlayer', { static: true }) videoElement!: ElementRef<HTMLVideoElement>;

  domain = 'ftvpro.net:8443';
  username = 'Trujillo2303';
  password = 'SAFJC4xWVRp5';
  streamId = '877173';
  private hls?: Hls;
  private readonly proxyBaseUrl = 'https://ftvpro.net:8443';
  private readonly storageKey = 'flat-player.stream-config';
  status = 'Inicializando...';
  errorMessage = '';

  ngOnInit(): void {
    this.restoreConfig();
    this.initPlayer();
  }

  initPlayer(): void {
    const video = this.videoElement.nativeElement;
    const streamUrl = this.getStreamUrl();
    this.bindVideoEvents(video);
    this.destroyPlayers();
    this.errorMessage = '';
    this.status = 'Probando reproduccion nativa...';

    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      this.playNativeFirst(video, streamUrl);
      return;
    }

    this.status = 'Sin soporte HLS nativo, probando HLS.js...';
    this.initHlsPlayer(video, streamUrl);
  }

  loadStream(): void {
    this.persistConfig();
    this.initPlayer();
  }

  private playNativeFirst(video: HTMLVideoElement, streamUrl: string): void {
    let switchedToHls = false;
    const fallbackToHls = () => {
      if (switchedToHls) {
        return;
      }
      switchedToHls = true;
      this.status = 'Fallback a HLS.js...';
      this.errorMessage = 'Nativo sin inicio de video, cambiando motor.';
      video.pause();
      video.removeAttribute('src');
      video.load();
      this.initHlsPlayer(video, streamUrl);
    };

    const timeoutId = window.setTimeout(() => {
      if (video.paused || video.readyState < 2) {
        fallbackToHls();
      }
    }, 5000);

    video.addEventListener('playing', () => {
      window.clearTimeout(timeoutId);
      this.status = 'Reproduciendo (nativo)';
      this.errorMessage = '';
    }, { once: true });

    video.addEventListener('error', () => {
      window.clearTimeout(timeoutId);
      fallbackToHls();
    }, { once: true });

    video.src = streamUrl;
    video.load();
    this.tryPlay(video);
  }

  private initHlsPlayer(video: HTMLVideoElement, streamUrl: string): void {
    if (Hls.isSupported()) {
      this.status = 'Usando HLS.js';
      this.hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        liveSyncDurationCount: 3,
        maxBufferLength: 30
      });
      this.hls.loadSource(streamUrl);
      this.hls.attachMedia(video);
      this.hls.on(Hls.Events.MEDIA_ATTACHED, () => {
        this.status = 'Media adjuntada, esperando manifest...';
      });
      this.hls.on(Hls.Events.MANIFEST_PARSED, () => {
        this.status = 'Manifest cargado, intentando reproducir...';
        this.tryPlay(video);
      });
      this.hls.on(Hls.Events.ERROR, (_event, data) => {
        this.errorMessage = `[HLS ${data.type}] ${data.details}`;
        this.status = data.fatal ? 'Error fatal de HLS' : 'Error recuperable de HLS';

        if (!data.fatal || !this.hls) {
          return;
        }

        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
          this.status = 'Recuperando error de red...';
          this.hls.startLoad();
        } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
          this.status = 'Recuperando error de media...';
          this.hls.recoverMediaError();
        } else {
          this.hls.destroy();
          this.hls = undefined;
        }
      });
      return;
    }

    this.status = 'Sin soporte HLS en este entorno';
    this.errorMessage = 'Este navegador/WebView no soporta HLS ni MSE compatible.';
  }

  playNow(): void {
    const video = this.videoElement.nativeElement;
    this.tryPlay(video);
  }

  ngOnDestroy(): void {
    this.destroyPlayers();
  }

  private destroyPlayers(): void {
    this.hls?.destroy();
    this.hls = undefined;
  }

  private tryPlay(video: HTMLVideoElement): void {
    video.play()
      .then(() => {
        this.status = 'Reproduciendo';
        this.errorMessage = '';
      })
      .catch((err) => {
        this.status = 'Play bloqueado o fallido';
        this.errorMessage = String(err?.message ?? err);
      });
  }

  private bindVideoEvents(video: HTMLVideoElement): void {
    video.addEventListener('error', () => {
      const mediaError = video.error;
      if (!mediaError) {
        return;
      }
      this.errorMessage = `HTMLMediaError code=${mediaError.code}`;
      this.status = 'Error de decodificacion/reproduccion';
    });

    video.addEventListener('waiting', () => {
      this.status = 'Buffering...';
    });

    video.addEventListener('playing', () => {
      this.status = 'Reproduciendo';
      this.errorMessage = '';
    });
  }

  private getStreamUrl(): string {
    const isLocalDev =
      (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') &&
      window.location.port === '4200';

    const directBaseUrl = this.normalizeBaseUrl(this.domain);
    if (isLocalDev && directBaseUrl === this.proxyBaseUrl) {
      return `/iptv/live/${encodeURIComponent(this.username)}/${encodeURIComponent(this.password)}/${encodeURIComponent(this.streamId)}.m3u8`;
    }

    return `${directBaseUrl}/live/${encodeURIComponent(this.username)}/${encodeURIComponent(this.password)}/${encodeURIComponent(this.streamId)}.m3u8`;
  }

  private normalizeBaseUrl(domain: string): string {
    const trimmedDomain = domain.trim().replace(/\/+$/, '');
    if (trimmedDomain.startsWith('http://') || trimmedDomain.startsWith('https://')) {
      return trimmedDomain;
    }

    return `https://${trimmedDomain}`;
  }

  private restoreConfig(): void {
    const rawConfig = localStorage.getItem(this.storageKey);
    if (!rawConfig) {
      return;
    }

    try {
      const config = JSON.parse(rawConfig) as {
        domain?: string;
        username?: string;
        password?: string;
        streamId?: string;
      };

      this.domain = config.domain || this.domain;
      this.username = config.username || this.username;
      this.password = config.password || this.password;
      this.streamId = config.streamId || this.streamId;
    } catch {
      localStorage.removeItem(this.storageKey);
    }
  }

  private persistConfig(): void {
    localStorage.setItem(this.storageKey, JSON.stringify({
      domain: this.domain,
      username: this.username,
      password: this.password,
      streamId: this.streamId
    }));
  }
}
