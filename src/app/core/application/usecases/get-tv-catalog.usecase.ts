import { Inject, Injectable } from '@angular/core';
import {
  TV_CATALOG_REPOSITORY,
  TvCatalogRepository,
} from '@core/domain/ports/tv-catalog.repository';
import { TvCategory } from '@core/domain/models/tv-catalog.model';

@Injectable({
  providedIn: 'root',
})
export class GetTvCatalogUseCase {
  constructor(
    @Inject(TV_CATALOG_REPOSITORY)
    private readonly tvCatalogRepository: TvCatalogRepository,
  ) {}

  execute(): Promise<readonly TvCategory[]> {
    return this.tvCatalogRepository.getCatalog();
  }
}
