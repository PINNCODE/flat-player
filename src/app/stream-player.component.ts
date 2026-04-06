import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import Hls from 'hls.js';

import { StreamService } from './stream.service';

@Component({
  selector: 'app-stream-player',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="player-shell">
      <h1>Reproductor IPTV</h1>

      <form (ngSubmit)="loadStream()" class="stream-form">
        <label>
          Usuario
          <input
            type="text"
            name="username"
            [(ngModel)]="username"
            placeholder="TU_USUARIO"
            required
          />
        </label>

        <label>
          Contraseña
          <input
            type="password"
            name="password"
            [(ngModel)]="password"
            placeholder="TU_CONTRASEÑA"
            required
          />
        </label>

        <label>
          Stream ID
          <input
            type="text"
            name="streamId"
            [(ngModel)]="streamId"
            placeholder="STREAM_ID"
            required
          />
        </label>

        <button type="submit">Cargar stream</button>
      </form>

      <p class="error" *ngIf="errorMessage()">{{ errorMessage() }}</p>

      <video #video controls autoplay playsinline></video>
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
        padding: 1rem;
      }

      .player-shell {
        max-width: 720px;
        margin: 0 auto;
        display: grid;
        gap: 0.75rem;
      }

      .stream-form {
        display: grid;
        gap: 0.75rem;
      }

      label {
        display: grid;
        gap: 0.35rem;
      }

      input {
        padding: 0.55rem 0.65rem;
      }

      button {
        width: fit-content;
        padding: 0.55rem 0.9rem;
      }

      .error {
        color: #b91c1c;
        font-weight: 600;
      }

      video {
        width: 100%;
        background: #000;
        border-radius: 8px;
      }
    `
  ]
})
export class StreamPlayerComponent implements AfterViewInit, OnDestroy {
  @ViewChild('video') videoRef?: ElementRef<HTMLVideoElement>;

  username = '';
  password = '';
  streamId = '';

  readonly errorMessage = signal('');

  private hls?: Hls;

  constructor(private readonly streamService: StreamService) {}

  ngAfterViewInit(): void {
    // ViewChild becomes available here.
  }

  loadStream(): void {
    const url = this.streamService.buildStreamUrl(this.username, this.password, this.streamId);

    this.errorMessage.set('');

    const video = this.videoRef?.nativeElement;
    if (!video) {
      this.errorMessage.set('No se pudo iniciar el reproductor.');
      return;
    }

    this.destroyHls();

    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = url;
      return;
    }

    if (Hls.isSupported()) {
      this.hls = new Hls();
      this.hls.loadSource(url);
      this.hls.attachMedia(video);
      this.hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          this.errorMessage.set('No se pudo reproducir el stream.');
        }
      });
      return;
    }

    this.errorMessage.set('Este dispositivo no soporta HLS.');
  }

  ngOnDestroy(): void {
    this.destroyHls();
  }

  private destroyHls(): void {
    this.hls?.destroy();
    this.hls = undefined;
  }
}
