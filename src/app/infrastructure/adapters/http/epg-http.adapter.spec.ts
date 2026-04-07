import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { EpgHttpAdapter } from './epg-http.adapter';
import { AUTH_SESSION_PORT } from '@core/domain/ports/auth-session.port';
import { vi } from 'vitest';

describe('EpgHttpAdapter', () => {
  let adapter: EpgHttpAdapter;
  let httpMock: HttpTestingController;
  let authSessionMock: { retrieve: ReturnType<typeof vi.fn> };

  const mockCredentials = {
    user: 'testuser',
    password: 'testpass',
    host: 'http://test-server.com',
  };

  const mockEpgRaw = {
    id: 'epg_1',
    epg_id: 'epg_1',
    channel_id: '1',
    start: '2024-04-07 10:00:00',
    end: '2024-04-07 11:00:00',
    lang: 'es',
    title: 'UHJvZ3JhbWEgMQ==',
    description: 'RGVzY3JpcGNpb24=',
    start_timestamp: 1712488800,
    stop_timestamp: 1712492400,
    now_playing: 1,
    has_archive: 0,
  };

  beforeEach(async () => {
    authSessionMock = {
      retrieve: vi.fn(),
    };

    await TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        EpgHttpAdapter,
        { provide: AUTH_SESSION_PORT, useValue: authSessionMock },
      ],
    }).compileComponents();

    adapter = TestBed.inject(EpgHttpAdapter);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should create', () => {
    expect(adapter).toBeTruthy();
  });

  it('should fetch EPG listings for a channel', async () => {
    authSessionMock.retrieve.mockReturnValue(mockCredentials);

    const streamId = '12345';
    const promise = adapter.getChannelGuide(streamId);

    const req = httpMock.expectOne(
      (request) => request.url === `${mockCredentials.host}/player_api.php`,
    );

    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('action')).toBe('get_short_epg');
    expect(req.request.params.get('stream_id')).toBe(streamId);
    expect(req.request.params.get('username')).toBe(mockCredentials.user);
    expect(req.request.params.get('password')).toBe(mockCredentials.password);

    req.flush({ epg_listings: [mockEpgRaw] });

    const result = await promise;
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('epg_1');
    expect(result[0].nowPlaying).toBe(true);
  });

  it('should handle empty EPG response', async () => {
    authSessionMock.retrieve.mockReturnValue(mockCredentials);

    const streamId = '12345';
    const promise = adapter.getChannelGuide(streamId);

    const req = httpMock.expectOne(
      (request) => request.url === `${mockCredentials.host}/player_api.php`,
    );
    req.flush({ epg_listings: [] });

    const result = await promise;
    expect(result).toEqual([]);
  });

  it('should handle HTTP errors gracefully', async () => {
    authSessionMock.retrieve.mockReturnValue(mockCredentials);

    const streamId = '12345';
    const promise = adapter.getChannelGuide(streamId);

    const req = httpMock.expectOne(
      (request) => request.url === `${mockCredentials.host}/player_api.php`,
    );
    req.error(new ErrorEvent('Network error'));

    await expect(promise).rejects.toThrow();
  });

  it('should decode base64 title and description in EPG items', async () => {
    authSessionMock.retrieve.mockReturnValue(mockCredentials);

    const streamId = '12345';
    const promise = adapter.getChannelGuide(streamId);

    const req = httpMock.expectOne(
      (request) => request.url === `${mockCredentials.host}/player_api.php`,
    );
    req.flush({ epg_listings: [mockEpgRaw] });

    const result = await promise;
    expect(result[0].title).toBe('Programa 1');
    expect(result[0].description).toBe('Descripcion');
  });

  it('should reject when no active session', async () => {
    authSessionMock.retrieve.mockReturnValue(null);

    await expect(adapter.getChannelGuide('12345')).rejects.toThrow('No active session');
  });

  it('should include stream_id from argument in request', async () => {
    const customCredentials = {
      user: 'customuser',
      password: 'custompass',
      host: 'http://custom-server.com',
    };

    authSessionMock.retrieve.mockReturnValue(customCredentials);

    const streamId = '999';
    adapter.getChannelGuide(streamId);

    const req = httpMock.expectOne(
      (request) => request.url === `${customCredentials.host}/player_api.php`,
    );

    expect(req.request.params.get('stream_id')).toBe(streamId);
    expect(req.request.params.get('username')).toBe(customCredentials.user);
    expect(req.request.params.get('password')).toBe(customCredentials.password);

    req.flush({ epg_listings: [mockEpgRaw] });
  });
});

