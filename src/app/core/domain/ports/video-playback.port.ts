import { InjectionToken } from '@angular/core';

export const VIDEO_PLAYBACK_PORT = new InjectionToken<VideoPlaybackPort>('VIDEO_PLAYBACK_PORT');

export interface VideoPlaybackPort {
  start(videoElement: HTMLVideoElement, primaryUrl: string, fallbackUrl: string | null): void;
  pause(): void;
  resume(): void;
  stop(): void;
  destroy(): void;
}