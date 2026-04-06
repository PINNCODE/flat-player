import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { AuthRepository } from '@core/domain/ports/auth.repository';
import { ICredentials } from '@core/domain/models/credentials.model';
import { IAuthResponse } from '@core/domain/models/auth-response.model';

@Injectable({ providedIn: 'root' })
export class AuthHttpAdapter implements AuthRepository {
  constructor(private http: HttpClient) {}

  login(credentials: ICredentials) {
    const params: { username: string; password: string } = {
      username: credentials.user,
      password: credentials.password,
    }
    console.log('Sending login request with params:', params);
    return this.http.post<IAuthResponse>(`${credentials.host}/player_api.php`, null, { params });
  }
}