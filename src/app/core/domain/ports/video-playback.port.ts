import { InjectionToken, Signal } from '@angular/core';

export const VIDEO_PLAYBACK_PORT = new InjectionToken<VideoPlaybackPort>('VIDEO_PLAYBACK_PORT');

type PlaybackErrorHandler = (message: string, usedFallback: boolean) => void;
type PlaybackStatus = 'playing' | 'paused' | 'stopped' | 'buffering';

export interface VideoPlaybackPort {
  start(videoElement: HTMLVideoElement, primaryUrl: string, fallbackUrl: string | null, onError: PlaybackErrorHandler): void;
  pause(): void;
  resume(): void;
  stop(): void;
  destroy(): void;
  togglePlayPause(videoElement: HTMLVideoElement): void;
  readonly playbackStatus: Signal<PlaybackStatus>;
  readonly liveEdgeSeconds: Signal<number>;
  readonly currentTimeSeconds: Signal<number>;
  readonly latencySeconds: Signal<number>;
  readonly bufferAheadSeconds: Signal<number>;
}