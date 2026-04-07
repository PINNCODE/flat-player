import { InjectionToken } from '@angular/core';
import { EpgListing } from '@core/domain/models/epg-listing.model';

export interface EpgRepository {
  getChannelGuide(streamId: string): Promise<EpgListing[]>;
}

export const EPG_REPOSITORY = new InjectionToken<EpgRepository>('EPG_REPOSITORY');
