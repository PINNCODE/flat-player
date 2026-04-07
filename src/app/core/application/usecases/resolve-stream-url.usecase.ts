import { Inject, Injectable } from '@angular/core';
import { TvChannel } from '@core/domain/models/tv-catalog.model';
import { AUTH_SESSION_PORT, AuthSessionPort } from '@core/domain/ports/auth-session.port';

type StreamFormat = 'm3u8' | 'ts';

export interface ResolvedStreamUrl {
  readonly primaryUrl: string;
  readonly fallbackUrl: string | null;
}

export interface ResolveStreamOptions {
  readonly useProxy?: boolean;
  readonly proxyBasePath?: string;
}

@Injectable({
  providedIn: 'root',
})
export class ResolveStreamUrlUseCase {
  constructor(
    @Inject(AUTH_SESSION_PORT)
    private readonly authSession: AuthSessionPort,
  ) {}

  execute(
    channel: TvChannel,
    preferredFormat: StreamFormat = 'm3u8',
    options?: ResolveStreamOptions,
  ): ResolvedStreamUrl | null {
    const fallbackFormat = preferredFormat === 'm3u8' ? 'ts' : 'm3u8';
    const primaryFromSession = this.buildFromSession(channel.streamId, preferredFormat, options);
    const fallbackFromSession = this.buildFromSession(channel.streamId, fallbackFormat, options);

    const directSource = this.resolveDirectSource(channel.directSource);

    const directSourceMatchesPreferred =
      directSource !== null &&
      ((preferredFormat === 'm3u8' && directSource.toLowerCase().includes('.m3u8')) ||
        (preferredFormat === 'ts' && directSource.toLowerCase().includes('.ts')));

    const primary = primaryFromSession
      ?? (directSourceMatchesPreferred ? directSource : null)
      ?? directSource
      ?? fallbackFromSession;

    if (!primary) {
      return null;
    }

    const fallback = this.resolveFallback(primary, fallbackFromSession, directSource);
    return {
      primaryUrl: primary,
      fallbackUrl: fallback,
    };
  }

  private resolveDirectSource(directSource: string | undefined): string | null {
    if (!directSource) {
      return null;
    }

    const normalized = directSource.trim();
    if (!normalized) {
      return null;
    }

    if (!/^https?:\/\//i.test(normalized)) {
      return null;
    }

    return normalized;
  }

  private buildFromSession(
    streamId: string,
    format: StreamFormat,
    options?: ResolveStreamOptions,
  ): string | null {
    const credentials = this.authSession.retrieve();
    if (!credentials) {
      return null;
    }

    const host = credentials.host.replace(/\/+$/, '');
    const safeUser = encodeURIComponent(credentials.user);
    const safePass = encodeURIComponent(credentials.password);
    const safeStreamId = encodeURIComponent(streamId);
    const proxyBasePath = options?.proxyBasePath?.replace(/\/+$/, '') || '/iptv';

    if (options?.useProxy) {
      if (format === 'm3u8') {
        return `${proxyBasePath}/live/${safeUser}/${safePass}/${safeStreamId}.m3u8`;
      }

      return `${proxyBasePath}/${safeUser}/${safePass}/${safeStreamId}.ts`;
    }

    if (format === 'm3u8') {
      return `${host}/live/${safeUser}/${safePass}/${safeStreamId}.m3u8`;
    }

    return `${host}/${safeUser}/${safePass}/${safeStreamId}.ts`;
  }

  private resolveFallback(
    primary: string,
    fallbackFromSession: string | null,
    directSource: string | null,
  ): string | null {
    if (fallbackFromSession && fallbackFromSession !== primary) {
      return fallbackFromSession;
    }

    if (directSource && directSource !== primary) {
      return directSource;
    }

    return null;
  }
}
