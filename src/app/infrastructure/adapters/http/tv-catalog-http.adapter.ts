import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { LiveCategoryDto, LiveStreamDto } from '@core/domain/models/live-catalog.dto';
import { TvCategory, TvChannel } from '@core/domain/models/tv-catalog.model';
import { AUTH_SESSION_PORT } from '@core/domain/ports/auth-session.port';
import { TvCatalogRepository } from '@core/domain/ports/tv-catalog.repository';
import { firstValueFrom } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class TvCatalogHttpAdapter implements TvCatalogRepository {
  private readonly http = inject(HttpClient);
  private readonly authSession = inject(AUTH_SESSION_PORT);

  async getCatalog(): Promise<readonly TvCategory[]> {
    const credentials = this.authSession.retrieve();

    if (!credentials) {
      throw new Error('No hay sesion activa. Por favor inicia sesion.');
    }

    const baseParams = {
      username: credentials.user,
      password: credentials.password,
    };

    const [streams, categories] = await Promise.all([
      firstValueFrom(
        this.http.get<LiveStreamDto[]>(`${credentials.host}/player_api.php`, {
          params: { ...baseParams, action: 'get_live_streams' },
        }),
      ),
      firstValueFrom(
        this.http.get<LiveCategoryDto[]>(`${credentials.host}/player_api.php`, {
          params: { ...baseParams, action: 'get_live_categories' },
        }),
      ).catch(() => [] as LiveCategoryDto[]),
    ]);

    return this.buildCatalog(streams, categories);
  }

  private buildCatalog(streams: readonly LiveStreamDto[], categories: readonly LiveCategoryDto[]): readonly TvCategory[] {
    const channelsByCategory = new Map<string, TvChannel[]>();

    for (const stream of streams) {
      if (!channelsByCategory.has(stream.category_id)) {
        channelsByCategory.set(stream.category_id, []);
      }

      channelsByCategory.get(stream.category_id)?.push({
        id: String(stream.stream_id),
        name: stream.name,
        logoLabel: this.resolveLogoLabel(stream.name),
        logoUrl: stream.stream_icon ?? undefined,
        streamId: String(stream.stream_id),
        streamType: stream.stream_type,
        directSource: this.resolveDirectSource(stream.direct_source),
        currentProgram: {
          title: '',
          progressPercent: 0,
        },
      });
    }

    const categoriesWithChannels = categories
      .map((category) => ({
        id: category.category_id,
        name: category.category_name,
        iconLabel: this.resolveIconLabel(category.category_name),
        channels: channelsByCategory.get(category.category_id) ?? [],
      }))
      .filter((category) => category.channels.length > 0);

    const uncategorized = Array.from(channelsByCategory.entries())
      .filter(([categoryId]) => !categories.some((category) => category.category_id === categoryId))
      .map(([categoryId, channels]) => ({
        id: categoryId,
        name: `Cat. ${categoryId}`,
        iconLabel: this.resolveIconLabel(categoryId),
        channels,
      }));

    return [...categoriesWithChannels, ...uncategorized];
  }

  private resolveLogoLabel(channelName: string): string {
    const normalized = channelName.trim();

    if (!normalized) {
      return 'CH';
    }

    return normalized.slice(0, 3).toUpperCase();
  }

  private resolveIconLabel(value: string): string {
    const normalized = value.trim();

    if (!normalized) {
      return 'TV';
    }

    return normalized.slice(0, 2).toUpperCase();
  }

  private resolveDirectSource(value: string): string | undefined {
    const normalized = value.trim();
    if (!normalized) {
      return undefined;
    }

    return normalized;
  }
}
