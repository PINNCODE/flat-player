import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Router } from '@angular/router';
import { LogoutUseCase } from '@core/application/usecases/logout.usecase';
import { ResolveStreamUrlUseCase } from '@core/application/usecases/resolve-stream-url.usecase';
import { TrackPlaybackErrorUseCase } from '@core/application/usecases/track-playback-error.usecase';
import { TV_CATALOG_REPOSITORY } from '@core/domain/ports/tv-catalog.repository';
import { TvCatalogMockAdapter } from '@infrastructure/adapters/mock/tv-catalog-mock.adapter';
import { Dashboard } from './dashboard';
import { VideoPlaybackFacade } from '../../services/video-playback.facade';
import { vi } from 'vitest';

interface LogoutUseCaseMock {
  execute: ReturnType<typeof vi.fn>;
}

interface ResolveStreamUrlUseCaseMock {
  execute: ReturnType<typeof vi.fn>;
}

interface VideoPlaybackFacadeMock {
  start: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
}

interface TrackPlaybackErrorUseCaseMock {
  execute: ReturnType<typeof vi.fn>;
}

describe('Dashboard', () => {
  let component: Dashboard;
  let fixture: ComponentFixture<Dashboard>;
  let logoutUseCaseMock: LogoutUseCaseMock;
  let resolveStreamUrlUseCaseMock: ResolveStreamUrlUseCaseMock;
  let videoPlaybackFacadeMock: VideoPlaybackFacadeMock;
  let trackPlaybackErrorUseCaseMock: TrackPlaybackErrorUseCaseMock;
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

    videoPlaybackFacadeMock = {
      start: vi.fn(),
      destroy: vi.fn(),
    };

    trackPlaybackErrorUseCaseMock = {
      execute: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [Dashboard],
      providers: [
        provideRouter([]),
        { provide: TV_CATALOG_REPOSITORY, useClass: TvCatalogMockAdapter },
        { provide: LogoutUseCase, useValue: logoutUseCaseMock },
        { provide: ResolveStreamUrlUseCase, useValue: resolveStreamUrlUseCaseMock },
        { provide: TrackPlaybackErrorUseCase, useValue: trackPlaybackErrorUseCaseMock },
        { provide: VideoPlaybackFacade, useValue: videoPlaybackFacadeMock },
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

  it('logs out and navigates to login when selecting Ajustes from menu', async () => {
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    await fixture.whenStable();

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    fixture.detectChanges();

    expect(logoutUseCaseMock.execute).toHaveBeenCalledTimes(1);
    expect(navigateSpy).toHaveBeenCalledWith(['/login']);
  });
});
