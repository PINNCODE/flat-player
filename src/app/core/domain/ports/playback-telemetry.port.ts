export interface PlaybackErrorTelemetryEvent {
  readonly channelId: string;
  readonly channelName: string;
  readonly streamType: string;
  readonly message: string;
  readonly hasDirectSource: boolean;
  readonly usedFallback: boolean;
  readonly timestamp: string;
}

export const PLAYBACK_TELEMETRY_PORT = Symbol('PLAYBACK_TELEMETRY_PORT');

export interface PlaybackTelemetryPort {
  trackPlaybackError(event: PlaybackErrorTelemetryEvent): void;
}
