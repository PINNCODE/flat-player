import { ResolveStreamUrlUseCase } from './resolve-stream-url.usecase';
import type { AuthSessionPort } from '@core/domain/ports/auth-session.port';
import { Credentials } from '@core/domain/models/credentials.model';
import type { TvChannel } from '@core/domain/models/tv-catalog.model';

class AuthSessionPortStub implements AuthSessionPort {
  private credentials: Credentials | null = null;

  store(credentials: Credentials): void {
    this.credentials = credentials;
  }

  retrieve(): Credentials | null {
    return this.credentials;
  }

  clear(): void {
    this.credentials = null;
  }
}

describe('ResolveStreamUrlUseCase', () => {
  const createChannel = (overrides: Partial<TvChannel> = {}): TvChannel => ({
    id: '1',
    name: 'Canal Test',
    logoLabel: 'CAN',
    streamId: '1001',
    streamType: 'live',
    directSource: undefined,
    currentProgram: {
      title: 'Programa',
      progressPercent: 0,
    },
    ...overrides,
  });

  it('uses session m3u8 as primary and directSource as fallback when available', () => {
    const session = new AuthSessionPortStub();
    session.store(new Credentials('user', 'pass', 'https://example.com'));
    const useCase = new ResolveStreamUrlUseCase(session);

    const result = useCase.execute(
      createChannel({ directSource: 'https://cdn.provider.test/live/direct.m3u8' }),
    );

    expect(result?.primaryUrl).toBe('https://example.com/live/user/pass/1001.m3u8');
    expect(result?.fallbackUrl).toBe('https://example.com/user/pass/1001.ts');
  });

  it('honors preferred ts format from session before directSource m3u8', () => {
    const session = new AuthSessionPortStub();
    session.store(new Credentials('user', 'pass', 'https://example.com'));
    const useCase = new ResolveStreamUrlUseCase(session);

    const result = useCase.execute(
      createChannel({ directSource: 'https://cdn.provider.test/live/direct.m3u8' }),
      'ts',
    );

    expect(result?.primaryUrl).toBe('https://example.com/user/pass/1001.ts');
    expect(result?.fallbackUrl).toBe('https://example.com/live/user/pass/1001.m3u8');
  });

  it('builds m3u8 url from session when directSource is absent', () => {
    const session = new AuthSessionPortStub();
    session.store(new Credentials('alpha', 'beta', 'https://host.test/'));
    const useCase = new ResolveStreamUrlUseCase(session);

    const result = useCase.execute(createChannel({ streamId: '877295' }));

    expect(result?.primaryUrl).toBe('https://host.test/live/alpha/beta/877295.m3u8');
    expect(result?.fallbackUrl).toBe('https://host.test/alpha/beta/877295.ts');
  });

  it('returns null when there is no active session and no directSource', () => {
    const session = new AuthSessionPortStub();
    const useCase = new ResolveStreamUrlUseCase(session);

    const result = useCase.execute(createChannel());

    expect(result).toBeNull();
  });

  it('builds proxied stream urls when proxy mode is enabled', () => {
    const session = new AuthSessionPortStub();
    session.store(new Credentials('alpha', 'beta', 'https://host.test'));
    const useCase = new ResolveStreamUrlUseCase(session);

    const result = useCase.execute(createChannel({ streamId: '877296' }), 'ts', {
      useProxy: true,
      proxyBasePath: '/iptv',
    });

    expect(result?.primaryUrl).toBe('/iptv/alpha/beta/877296.ts');
    expect(result?.fallbackUrl).toBe('/iptv/live/alpha/beta/877296.m3u8');
  });
});
