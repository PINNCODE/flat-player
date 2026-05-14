import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Router } from '@angular/router';
import { LogoutUseCase } from '@core/application/usecases/logout.usecase';
import { ResolveStreamUrlUseCase } from '@core/application/usecases/resolve-stream-url.usecase';
import { TrackPlaybackErrorUseCase } from '@core/application/usecases/track-playback-error.usecase';
import { GetChannelEpgUseCase } from '@core/application/usecases/get-channel-epg.usecase';
import { GetUserInfoUseCase } from '@core/application/usecases/get-user-info.usecase';
import { GetUserSettingsUseCase } from '@core/application/usecases/get-user-settings.usecase';
import { TV_CATALOG_REPOSITORY } from '@core/domain/ports/tv-catalog.repository';
import { EPG_REPOSITORY } from '@core/domain/ports/epg.repository';
import { TvCatalogMockAdapter } from '@infrastructure/adapters/mock/tv-catalog-mock.adapter';
import { Dashboard } from './dashboard';
import { VIDEO_PLAYBACK_PORT } from '@core/domain/ports/video-playback.port';
import { vi } from 'vitest';

interface LogoutUseCaseMock {
  execute: ReturnType<typeof vi.fn>;
}

interface ResolveStreamUrlUseCaseMock {
  execute: ReturnType<typeof vi.fn>;
}

interface VideoPlaybackPortMock {
  start: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
  liveEdgeSeconds: { (): number };
  currentTimeSeconds: { (): number };
  latencySeconds: { (): number };
  bufferAheadSeconds: { (): number };
}

interface TrackPlaybackErrorUseCaseMock {
  execute: ReturnType<typeof vi.fn>;
}

interface GetChannelEpgUseCaseMock {
  execute: ReturnType<typeof vi.fn>;
}

describe('Dashboard', () => {
  let component: Dashboard;
  let fixture: ComponentFixture<Dashboard>;
  let logoutUseCaseMock: LogoutUseCaseMock;
  let resolveStreamUrlUseCaseMock: ResolveStreamUrlUseCaseMock;
  let videoPlaybackPortMock: VideoPlaybackPortMock;
  let trackPlaybackErrorUseCaseMock: TrackPlaybackErrorUseCaseMock;
  let getChannelEpgUseCaseMock: GetChannelEpgUseCaseMock;
  let getUserInfoUseCaseMock: { execute: ReturnType<typeof vi.fn> };
  let getUserSettingsUseCaseMock: { execute: ReturnType<typeof vi.fn> };
  let router: Router;

  beforeEach(async () => {
    logoutUseCaseMock = {
      execute: vi.fn(),
    };

    resolveStreamUrlUseCaseMock = {
      execute: vi.fn(() => ({
        primaryUrl: 'https://example.com/live/test/test/1.m3u8',
        fallbackUrl: null,
      })),
    };

    videoPlaybackPortMock = {
      start: vi.fn(),
      destroy: vi.fn(),
      liveEdgeSeconds: vi.fn(() => 30),
      currentTimeSeconds: vi.fn(() => 25),
      latencySeconds: vi.fn(() => 5),
      bufferAheadSeconds: vi.fn(() => 20),
    };

    trackPlaybackErrorUseCaseMock = {
      execute: vi.fn(),
    };

    getChannelEpgUseCaseMock = {
      execute: vi.fn(() => Promise.resolve([])),
    };

    getUserInfoUseCaseMock = {
      execute: vi.fn(() => ({
        username: 'test', password: '', message: '', auth: 1, status: 'Active',
        exp_date: '0', is_trial: '0', active_cons: '0', created_at: '0', max_connections: '1', allowed_output_formats: []
      })),
    };

    getUserSettingsUseCaseMock = {
      execute: vi.fn(() => ({})),
    };

    await TestBed.configureTestingModule({
      imports: [Dashboard],
      providers: [
        provideRouter([]),
        { provide: TV_CATALOG_REPOSITORY, useClass: TvCatalogMockAdapter },
        { provide: LogoutUseCase, useValue: logoutUseCaseMock },
        { provide: ResolveStreamUrlUseCase, useValue: resolveStreamUrlUseCaseMock },
        { provide: TrackPlaybackErrorUseCase, useValue: trackPlaybackErrorUseCaseMock },
        { provide: GetChannelEpgUseCase, useValue: getChannelEpgUseCaseMock },
        { provide: GetUserInfoUseCase, useValue: getUserInfoUseCaseMock },
        { provide: GetUserSettingsUseCase, useValue: getUserSettingsUseCaseMock },
        { provide: VIDEO_PLAYBACK_PORT, useValue: videoPlaybackPortMock },
        { provide: EPG_REPOSITORY, useValue: { getChannelGuide: vi.fn(() => Promise.resolve([])) } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Dashboard);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('shows overlay when pressing a lateral arrow from video-only mode', async () => {
    await fixture.whenStable();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    fixture.detectChanges();

    const overlay = fixture.nativeElement.querySelector('.tv-dashboard__overlay');
    expect(overlay).toBeTruthy();
  });

  it('shows info bar when zapping with arrow down from video-only mode', async () => {
    await fixture.whenStable();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    fixture.detectChanges();

    const infoBar = fixture.nativeElement.querySelector('.tv-dashboard__info-bar');
    expect(infoBar).toBeTruthy();
  });

  it('opens settings panel when selecting Ajustes from menu', async () => {
    await fixture.whenStable();

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    fixture.detectChanges();

    const panel = fixture.nativeElement.querySelector('.tv-dashboard__panel--settings');
    expect(panel).toBeTruthy();
    expect(getUserInfoUseCaseMock.execute).toHaveBeenCalledTimes(1);
  });
});
