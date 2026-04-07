import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { EpgListing, EpgListingParser, EpgListingRaw } from '@core/domain/models/epg-listing.model';
import { EpgRepository } from '@core/domain/ports/epg.repository';
import { AUTH_SESSION_PORT, AuthSessionPort } from '@core/domain/ports/auth-session.port';
import { Inject } from '@angular/core';

interface EpgResponse {
  epg_listings: EpgListingRaw[];
}

@Injectable({ providedIn: 'root' })
export class EpgHttpAdapter implements EpgRepository {
  constructor(
    private readonly http: HttpClient,
    @Inject(AUTH_SESSION_PORT)
    private readonly authSession: AuthSessionPort,
  ) {}

  async getChannelGuide(streamId: string): Promise<EpgListing[]> {
    const credentials = this.authSession.retrieve();

    if (!credentials) {
      throw new Error('No active session to retrieve EPG');
    }

    const params = {
      username: credentials.user,
      password: credentials.password,
      action: 'get_short_epg',
      stream_id: streamId,
    };

    const response = await firstValueFrom(
      this.http.get<EpgResponse>(`${credentials.host}/player_api.php`, { params }),
    );

    if (!response.epg_listings || !Array.isArray(response.epg_listings)) {
      return [];
    }

    return response.epg_listings.map((raw) => EpgListingParser.fromRaw(raw));
  }
}
