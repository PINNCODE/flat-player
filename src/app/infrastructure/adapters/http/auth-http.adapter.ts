import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { AuthRepository } from '@core/domain/ports/auth.repository';
import { Credentials } from '@core/domain/models/credentials.model';
import { AuthResponse } from '@core/domain/models/auth-response.model';

@Injectable({ providedIn: 'root' })
export class AuthHttpAdapter implements AuthRepository {
  constructor(private http: HttpClient) {}

  async login(credentials: Credentials): Promise<AuthResponse> {
    const params: { username: string; password: string } = {
      username: credentials.user,
      password: credentials.password,
    };

    return firstValueFrom(this.http.post<AuthResponse>(`${credentials.host}/player_api.php`, null, { params }));
  }
}