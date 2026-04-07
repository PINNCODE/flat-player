export interface EpgListing {
  readonly id: string;
  readonly epgId: string;
  readonly channelId: string;
  readonly start: string;
  readonly end: string;
  readonly lang: string;
  readonly title: string;
  readonly description: string;
  readonly startTimestamp: number;
  readonly stopTimestamp: number;
  readonly nowPlaying: boolean;
  readonly hasArchive: boolean;
}

export interface EpgListingRaw {
  id: string;
  epg_id: string;
  channel_id: string;
  start: string;
  end: string;
  lang: string;
  title: string;
  description: string;
  start_timestamp: number;
  stop_timestamp: number;
  now_playing: 0 | 1;
  has_archive: 0 | 1;
}

export class EpgListingParser {
  static fromRaw(raw: EpgListingRaw): EpgListing {
    return {
      id: raw.id,
      epgId: raw.epg_id,
      channelId: raw.channel_id,
      start: raw.start,
      end: raw.end,
      lang: raw.lang,
      title: this.decodeBase64(raw.title),
      description: this.decodeBase64(raw.description),
      startTimestamp: raw.start_timestamp,
      stopTimestamp: raw.stop_timestamp,
      nowPlaying: raw.now_playing === 1,
      hasArchive: raw.has_archive === 1,
    };
  }

  private static decodeBase64(encoded: string): string {
    try {
      const decoded = atob(encoded);
      return decodeURIComponent(
        decoded
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
    } catch {
      return encoded;
    }
  }
}
