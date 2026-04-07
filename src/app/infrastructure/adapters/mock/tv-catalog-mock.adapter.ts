import { Injectable } from '@angular/core';

import { TvCategory } from '@core/domain/models/tv-catalog.model';
import { TvCatalogRepository } from '@core/domain/ports/tv-catalog.repository';

const CATEGORY_NAMES: readonly string[] = [
  'Inicio',
  'Deportes',
  'Noticias',
  'Peliculas',
  'Series',
  'Documentales',
  'Infantil',
  'Musica',
  'Entretenimiento',
  'Cultura',
  'Internacional',
  'Nacionales',
  'Premium',
  'Retro',
  'Lifestyle',
  'Eventos',
];

const PROGRAM_NAMES: readonly string[] = [
  'Cobertura en Vivo',
  'Agenda del Dia',
  'Primera Edicion',
  'Especial Prime',
  'Reporte Central',
  'Zona de Analisis',
  'Panorama 24',
  'Noche Estelar',
];

@Injectable({ providedIn: 'root' })
export class TvCatalogMockAdapter implements TvCatalogRepository {
  private readonly catalog = this.buildCatalog();

  async getCatalog(): Promise<readonly TvCategory[]> {
    return this.catalog;
  }

  private buildCatalog(): readonly TvCategory[] {
    return CATEGORY_NAMES.map((categoryName, categoryIndex) => ({
      id: `category-${categoryIndex + 1}`,
      name: categoryName,
      iconLabel: categoryName.slice(0, 2).toUpperCase(),
      channels: this.buildChannels(categoryName, categoryIndex),
    }));
  }

  private buildChannels(categoryName: string, categoryIndex: number) {
    return Array.from({ length: 8 }, (_, channelIndex) => {
      const progress = ((categoryIndex * 13 + channelIndex * 17) % 88) + 8;

      return {
        id: `${categoryName.toLowerCase()}-${channelIndex + 1}`,
        name: `${categoryName} ${channelIndex + 1}`,
        logoLabel: `${categoryName.slice(0, 3).toUpperCase()}${channelIndex + 1}`,
        streamId: `${1000 + categoryIndex * 100 + channelIndex}`,
        streamType: 'live',
        directSource: undefined,
        currentProgram: {
          title: PROGRAM_NAMES[(categoryIndex + channelIndex) % PROGRAM_NAMES.length],
          progressPercent: progress,
        },
      };
    });
  }
}
