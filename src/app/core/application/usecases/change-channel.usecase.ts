import { Injectable } from '@angular/core';
import { TvCategory, TvChannel } from '@core/domain/models/tv-catalog.model';

export type ChannelChangeDirection = 'next' | 'previous';

export interface ChangeChannelCommand {
  readonly categories: readonly TvCategory[];
  readonly currentCategoryIndex: number;
  readonly currentChannelIndex: number;
  readonly direction?: ChannelChangeDirection;
  readonly targetCategoryIndex?: number;
  readonly targetChannelIndex?: number;
}

export interface ChannelSelection {
  readonly categoryIndex: number;
  readonly channelIndex: number;
  readonly channel: TvChannel;
}

@Injectable({
  providedIn: 'root',
})
export class ChangeChannelUseCase {
  execute(command: ChangeChannelCommand): ChannelSelection | null {
    if (command.categories.length === 0) {
      return null;
    }

    if (command.direction) {
      return this.resolveDirectionalSelection(command);
    }

    return this.resolveDirectSelection(command);
  }

  private resolveDirectionalSelection(command: ChangeChannelCommand): ChannelSelection | null {
    const categoryIndex = this.normalizeIndex(
      command.currentCategoryIndex,
      command.categories.length,
    );
    const category = command.categories[categoryIndex];

    if (category.channels.length === 0) {
      return null;
    }

    const delta = command.direction === 'next' ? 1 : -1;
    const channelIndex = this.normalizeIndex(
      command.currentChannelIndex + delta,
      category.channels.length,
    );

    return {
      categoryIndex,
      channelIndex,
      channel: category.channels[channelIndex],
    };
  }

  private resolveDirectSelection(command: ChangeChannelCommand): ChannelSelection | null {
    const rawCategoryIndex = command.targetCategoryIndex ?? command.currentCategoryIndex;
    const categoryIndex = this.normalizeIndex(rawCategoryIndex, command.categories.length);
    const category = command.categories[categoryIndex];

    if (category.channels.length === 0) {
      return null;
    }

    const rawChannelIndex = command.targetChannelIndex ?? command.currentChannelIndex;
    const channelIndex = this.normalizeIndex(rawChannelIndex, category.channels.length);

    return {
      categoryIndex,
      channelIndex,
      channel: category.channels[channelIndex],
    };
  }

  private normalizeIndex(index: number, length: number): number {
    if (length <= 0) {
      return 0;
    }

    return ((index % length) + length) % length;
  }
}
