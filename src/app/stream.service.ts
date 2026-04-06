import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class StreamService {
  private readonly baseUrl = 'https://ftvpro.net:8443/live';

  buildStreamUrl(username: string, password: string, streamId: string): string {
    const safeUser = encodeURIComponent(username.trim());
    const safePass = encodeURIComponent(password.trim());
    const safeStreamId = encodeURIComponent(streamId.trim());

    return `${this.baseUrl}/${safeUser}/${safePass}/${safeStreamId}.ts`;
  }
}
