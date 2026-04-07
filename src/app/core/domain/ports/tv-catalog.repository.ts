import { TvCategory } from '@core/domain/models/tv-catalog.model';

export const TV_CATALOG_REPOSITORY = Symbol('TV_CATALOG_REPOSITORY');

export interface TvCatalogRepository {
  getCatalog(): Promise<readonly TvCategory[]>;
}
