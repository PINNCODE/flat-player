import { Provider } from '@angular/core';
import { PLAYBACK_TELEMETRY_PORT } from '@core/domain/ports/playback-telemetry.port';
import { PlaybackTelemetryService } from '@infrastructure/services/playback-telemetry.service';

export const playbackTelemetryProvider: Provider = {
  provide: PLAYBACK_TELEMETRY_PORT,
  useClass: PlaybackTelemetryService,
};
