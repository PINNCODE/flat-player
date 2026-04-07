import { Injectable } from '@angular/core';
import {
  PlaybackErrorTelemetryEvent,
  PlaybackTelemetryPort,
} from '@core/domain/ports/playback-telemetry.port';

@Injectable({ providedIn: 'root' })
export class PlaybackTelemetryService implements PlaybackTelemetryPort {
  private readonly storageKey = 'flat-player-playback-telemetry';
  private readonly maxEntries = 100;

  trackPlaybackError(event: PlaybackErrorTelemetryEvent): void {
    this.writeToConsole(event);
    this.persist(event);
  }

  private writeToConsole(event: PlaybackErrorTelemetryEvent): void {
    console.error('[PlaybackTelemetry][ERROR]', event.message);
    console.warn('[PlaybackTelemetry][DETAILS]', {
      channelId: event.channelId,
      channelName: event.channelName,
      streamType: event.streamType,
      message: event.message,
      hasDirectSource: event.hasDirectSource,
      usedFallback: event.usedFallback,
      timestamp: event.timestamp,
    });
  }

  private persist(event: PlaybackErrorTelemetryEvent): void {
    try {
      const history = this.readHistory();
      history.push(event);

      const trimmed = history.slice(-this.maxEntries);
      localStorage.setItem(this.storageKey, JSON.stringify(trimmed));
    } catch {
      // Ignore telemetry persistence failures to avoid affecting playback.
    }
  }

  private readHistory(): PlaybackErrorTelemetryEvent[] {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (!raw) {
        return [];
      }

      const parsed = JSON.parse(raw) as PlaybackErrorTelemetryEvent[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
}
