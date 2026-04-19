import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter, withHashLocation } from '@angular/router';

import { routes } from './app.routes';
import { authProvider } from '@infrastructure/providers/auth.provider';
import { httpLoaderInterceptor } from '@infrastructure/interceptors/http-loader.interceptor';
import { authSessionProvider } from '@infrastructure/providers/auth-session.provider';
import { playbackTelemetryProvider } from '@infrastructure/providers/playback-telemetry.provider';
import { tvCatalogProvider } from '@infrastructure/providers/tv-catalog.provider';
import { epgProvider } from '@infrastructure/providers/epg.provider';
import { tizenRemoteKeysProvider } from '@infrastructure/providers/tizen-remote-keys.provider';
import { tizenRemoteInputProvider } from '@infrastructure/providers/tizen-remote-input.provider';
import { credentialsPersistenceProvider } from '@infrastructure/providers/credentials-persistence.provider';

import { userSettingsProvider } from '@infrastructure/providers/user-settings.provider';
import { videoPlaybackProvider } from '@infrastructure/providers/video-playback.provider';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(withInterceptors([httpLoaderInterceptor])),
    provideRouter(routes, withHashLocation()),
    authProvider,
    authSessionProvider,
    credentialsPersistenceProvider,
    playbackTelemetryProvider,
    tvCatalogProvider,
    epgProvider,
    tizenRemoteKeysProvider,
    tizenRemoteInputProvider,
    userSettingsProvider,
    videoPlaybackProvider,
  ],
};
