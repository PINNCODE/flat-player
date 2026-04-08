import { Credentials } from '@core/domain/models/credentials.model';

import { AuthSessionService } from './auth-session.service';

describe('AuthSessionService', () => {
  let service: AuthSessionService;

  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    service = new AuthSessionService();
  });

  it('stores credentials in sessionStorage instead of localStorage', () => {
    const credentials = new Credentials('demo-user', 'demo-pass', 'https://example.com');

    service.store(credentials);

    expect(sessionStorage.getItem('flat-player-auth-session')).toContain('demo-user');
    expect(localStorage.getItem('flat-player-auth-session')).toBeNull();
  });

  it('stores and retrieves UserInfo', () => {
    const credentials = new Credentials('demo-user', 'demo-pass', 'https://example.com');
    const userInfo = {
      username: 'test', password: '', message: '', auth: 1, status: 'Active',
      exp_date: '0', is_trial: '0', active_cons: '0', created_at: '0', max_connections: '1', allowed_output_formats: []
    };

    service.store(credentials, userInfo as any);

    expect(service.retrieveUserInfo()?.username).toBe('test');
    expect(sessionStorage.getItem('flat-player-auth-session')).toContain('userInfo');
  });


  it('restores a legacy localStorage session and migrates it to sessionStorage', () => {
    localStorage.setItem(
      'flat-player-auth-session',
      JSON.stringify({
        host: 'https://example.com',
        user: 'legacy-user',
        password: 'legacy-pass',
      }),
    );

    const restored = service.retrieve();

    expect(restored?.user).toBe('legacy-user');
    expect(sessionStorage.getItem('flat-player-auth-session')).toContain('legacy-user');
    expect(localStorage.getItem('flat-player-auth-session')).toBeNull();
  });

  it('clears session data from both storages', () => {
    const credentials = new Credentials('demo-user', 'demo-pass', 'https://example.com');

    service.store(credentials);
    localStorage.setItem('flat-player-auth-session', 'legacy');

    service.clear();

    expect(service.retrieve()).toBeNull();
    expect(sessionStorage.getItem('flat-player-auth-session')).toBeNull();
    expect(localStorage.getItem('flat-player-auth-session')).toBeNull();
  });
});