import { Provider } from '@angular/core';
import { EPG_REPOSITORY } from '@core/domain/ports/epg.repository';
import { EpgHttpAdapter } from '@infrastructure/adapters/http/epg-http.adapter';

export const epgProvider: Provider = {
  provide: EPG_REPOSITORY,
  useClass: EpgHttpAdapter,
};
