import { Inject, Injectable } from '@angular/core';
import { EpgListing } from '@core/domain/models/epg-listing.model';
import { EPG_REPOSITORY, EpgRepository } from '@core/domain/ports/epg.repository';

@Injectable({
  providedIn: 'root',
})
export class GetChannelEpgUseCase {
  constructor(
    @Inject(EPG_REPOSITORY)
    private readonly epgRepository: EpgRepository,
  ) {}

  async execute(streamId: string): Promise<EpgListing[]> {
    if (!streamId?.trim()) {
      throw new Error('streamId es requerido');
    }

    const epgListings = await this.epgRepository.getChannelGuide(streamId);

    return [...epgListings].sort((a, b) => a.startTimestamp - b.startTimestamp);
  }
}
