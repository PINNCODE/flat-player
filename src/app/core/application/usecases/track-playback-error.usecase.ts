import { Inject, Injectable } from '@angular/core';
import {
  PlaybackErrorTelemetryEvent,
  PlaybackTelemetryPort,
  PLAYBACK_TELEMETRY_PORT,
} from '@core/domain/ports/playback-telemetry.port';

@Injectable({
  providedIn: 'root',
})
export class TrackPlaybackErrorUseCase {
  constructor(
    @Inject(PLAYBACK_TELEMETRY_PORT)
    private readonly playbackTelemetry: PlaybackTelemetryPort,
  ) {}

  execute(event: PlaybackErrorTelemetryEvent): void {
    this.playbackTelemetry.trackPlaybackError(event);
  }
}
