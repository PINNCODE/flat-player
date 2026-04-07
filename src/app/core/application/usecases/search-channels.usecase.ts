import { Injectable } from '@angular/core';
import { TvCategory, TvChannel } from '@core/domain/models/tv-catalog.model';
import { ChannelSelection } from './change-channel.usecase';

export interface SearchChannelsCommand {
  readonly categories: readonly TvCategory[];
  readonly query: string;
}

@Injectable({
  providedIn: 'root',
})
export class SearchChannelsUseCase {
  execute(command: SearchChannelsCommand): readonly ChannelSelection[] {
    const results: ChannelSelection[] = [];
    const queryLower = this.normalizeString(command.query);

    if (!queryLower) {
      return results;
    }

    command.categories.forEach((category, categoryIndex) => {
      category.channels.forEach((channel, channelIndex) => {
        if (this.normalizeString(channel.name).includes(queryLower)) {
          results.push({
            categoryIndex,
            channelIndex,
            channel,
          });
        }
      });
    });

    return results;
  }

  private normalizeString(text: string): string {
    return text.trim()
      .toLowerCase()
      .normalize('NFD') // Quitar acentos
      .replace(/[\u0300-\u036f]/g, '');
  }
}
