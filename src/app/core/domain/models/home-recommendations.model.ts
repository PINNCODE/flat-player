import { TvChannel } from './tv-catalog.model';

export interface HomeEventItem {
  readonly id: string;
  readonly channel: TvChannel;
  readonly title: string;
  readonly subtitle: string;
  readonly timeLabel: string;
  readonly typeLabel: 'PPV' | 'SPORT';
  readonly isLiveNow: boolean;
}

export interface HomeRow {
  readonly id: string;
  readonly title: string;
  readonly channels: readonly TvChannel[];
  readonly events?: readonly HomeEventItem[];
}

export interface HomeRecommendations {
  readonly rows: readonly HomeRow[];
}
