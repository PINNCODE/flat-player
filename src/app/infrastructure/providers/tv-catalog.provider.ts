import { Provider } from '@angular/core';

import { TV_CATALOG_REPOSITORY } from '@core/domain/ports/tv-catalog.repository';
import { TvCatalogHttpAdapter } from '@infrastructure/adapters/http/tv-catalog-http.adapter';

export const tvCatalogProvider: Provider = {
  provide: TV_CATALOG_REPOSITORY,
  useClass: TvCatalogHttpAdapter,
};
