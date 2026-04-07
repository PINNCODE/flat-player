import { CommonModule } from '@angular/common';
import { AfterViewInit, ChangeDetectionStrategy, Component, DestroyRef, ElementRef, ViewChild, computed, inject, signal, viewChild } from '@angular/core';
import { ChangeChannelUseCase } from '@core/application/usecases/change-channel.usecase';
import { GetTvCatalogUseCase } from '@core/application/usecases/get-tv-catalog.usecase';
import { LogoutUseCase } from '@core/application/usecases/logout.usecase';
import { ResolveStreamUrlUseCase } from '@core/application/usecases/resolve-stream-url.usecase';
import { TrackPlaybackErrorUseCase } from '@core/application/usecases/track-playback-error.usecase';
import { GetChannelEpgUseCase } from '@core/application/usecases/get-channel-epg.usecase';
import { TvCategory, TvChannel } from '@core/domain/models/tv-catalog.model';
import { EpgListing } from '@core/domain/models/epg-listing.model';
import { Router } from '@angular/router';
import { VideoPlaybackFacade } from '../../services/video-playback.facade';
import { environment } from '../../../../environments/environment';

type OverlayPanel = 'menu' | 'categories' | 'channels';
type OverlayTrigger = 'dpad' | 'ok';

interface MenuItem {
  readonly id: 'home' | 'guide' | 'search' | 'settings';
  readonly label: string;
  readonly shortLabel: string;
}

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
  host: {
    '(window:keydown)': 'onRemoteKeydown($event)',
  },
})
export class Dashboard implements AfterViewInit {
  protected readonly menuItems: readonly MenuItem[] = [
    { id: 'home', label: 'Inicio', shortLabel: 'IN' },
    { id: 'guide', label: 'Guia', shortLabel: 'GU' },
    { id: 'search', label: 'Buscar', shortLabel: 'BU' },
    { id: 'settings', label: 'Ajustes', shortLabel: 'AJ' },
  ];

  protected readonly overlayVisible = signal(false);
  protected readonly activePanel = signal<OverlayPanel>('menu');
  protected readonly focusedMenuIndex = signal(0);

  protected readonly categories = signal<readonly TvCategory[]>([]);
  protected readonly focusedCategoryIndex = signal(0);
  protected readonly focusedChannelIndex = signal(0);

  protected readonly selectedCategoryIndex = signal(0);
  protected readonly selectedChannelIndex = signal(0);
  protected readonly currentChannel = signal<TvChannel | null>(null);
  protected readonly currentChannelGuide = signal<readonly EpgListing[]>([]);
  protected readonly focusedChannelGuide = signal<readonly EpgListing[]>([]);

  protected readonly focusedChannel = computed(
    () => this.focusedChannels()[this.focusedChannelIndex()] ?? null,
  );

  protected readonly infoBarVisible = signal(false);
  protected readonly videoMetaVisible = signal(false);
  protected readonly toastMessage = signal('');
  protected readonly streamPlaybackError = signal('');

  protected readonly focusedCategory = computed(
    () => this.categories()[this.focusedCategoryIndex()] ?? null,
  );

  protected readonly focusedChannels = computed(
    () => this.focusedCategory()?.channels ?? [],
  );

  protected readonly currentCategory = computed(
    () => this.categories()[this.selectedCategoryIndex()] ?? null,
  );

  protected readonly channelLabel = computed(
    () => this.currentChannel()?.name ?? 'Cargando canal...',
  );

  protected readonly hasCategoryOverflowUp = computed(() => this.focusedCategoryIndex() > 0);
  protected readonly hasCategoryOverflowDown = computed(
    () => this.focusedCategoryIndex() < this.categories().length - 1,
  );

  protected readonly hasChannelOverflowUp = computed(() => this.focusedChannelIndex() > 0);
  protected readonly hasChannelOverflowDown = computed(
    () => this.focusedChannelIndex() < this.focusedChannels().length - 1,
  );

  protected readonly categoryWindowStart = computed(() =>
    this.resolveWindowStart(this.focusedCategoryIndex(), this.categories().length, 8),
  );

  protected readonly channelWindowStart = computed(() =>
    this.resolveWindowStart(this.focusedChannelIndex(), this.focusedChannels().length, 9),
  );

  protected readonly visibleCategories = computed(() =>
    this.categories().slice(this.categoryWindowStart(), this.categoryWindowStart() + 8),
  );

  protected readonly visibleChannels = computed(() =>
    this.focusedChannels().slice(this.channelWindowStart(), this.channelWindowStart() + 9),
  );

  private readonly videoPlayerRef = viewChild<ElementRef<HTMLVideoElement>>('videoPlayer');
  @ViewChild('channelsList') channelsList?: ElementRef<HTMLUListElement>;

  private readonly getTvCatalogUseCase = inject(GetTvCatalogUseCase);
  private readonly changeChannelUseCase = inject(ChangeChannelUseCase);
  private readonly logoutUseCase = inject(LogoutUseCase);
  private readonly resolveStreamUrlUseCase = inject(ResolveStreamUrlUseCase);
  private readonly trackPlaybackErrorUseCase = inject(TrackPlaybackErrorUseCase);
  private readonly getChannelEpgUseCase = inject(GetChannelEpgUseCase);
  private readonly videoPlaybackFacade = inject(VideoPlaybackFacade);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  private infoBarTimeoutId: ReturnType<typeof setTimeout> | undefined;
  private toastTimeoutId: ReturnType<typeof setTimeout> | undefined;
  private videoMetaTimeoutId: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.clearInfoBarTimeout();
      this.clearToastTimeout();
      this.clearVideoMetaTimeout();
      this.videoPlaybackFacade.destroy();
    });
    void this.loadCatalog();
  }

  ngAfterViewInit(): void {
    const channel = this.currentChannel();

    if (!channel) {
      return;
    }

    this.startPlayback(channel);
  }

  onRemoteKeydown(event: KeyboardEvent): void {
    const action = this.resolveRemoteAction(event.key);

    if (!action) {
      return;
    }

    event.preventDefault();

    if (!this.overlayVisible()) {
      this.handleVideoOnlyAction(action);
      return;
    }

    this.handleOverlayAction(action);
  }

  protected isMenuFocused(index: number): boolean {
    return this.activePanel() === 'menu' && this.focusedMenuIndex() === index;
  }

  protected isCategoryFocused(index: number): boolean {
    return this.activePanel() === 'categories' && this.focusedCategoryIndex() === index;
  }

  protected isChannelFocused(index: number): boolean {
    return this.activePanel() === 'channels' && this.focusedChannelIndex() === index;
  }

  protected categoryTrackBy(_: number, category: TvCategory): string {
    return category.id;
  }

  protected channelTrackBy(_: number, channel: TvChannel): string {
    return channel.id;
  }

  private async loadCatalog(): Promise<void> {
    try {
      const catalog = await this.getTvCatalogUseCase.execute();

      this.categories.set(catalog);

      const initialSelection = this.changeChannelUseCase.execute({
        categories: catalog,
        currentCategoryIndex: 0,
        currentChannelIndex: 0,
        targetCategoryIndex: 0,
        targetChannelIndex: 0,
      });

      if (!initialSelection) {
        this.showToast('No hay canales disponibles en este momento.');
        return;
      }

      this.applyChannelSelection(initialSelection.categoryIndex, initialSelection.channelIndex, initialSelection.channel);
    } catch {
      this.showToast('No se pudo cargar la guia de canales.');
    }
  }

  private resolveRemoteAction(key: string): 'up' | 'down' | 'left' | 'right' | 'ok' | null {
    switch (key) {
      case 'ArrowUp':
        return 'up';
      case 'ArrowDown':
        return 'down';
      case 'ArrowLeft':
        return 'left';
      case 'ArrowRight':
        return 'right';
      case 'Enter':
      case 'NumpadEnter':
      case 'OK':
        return 'ok';
      default:
        return null;
    }
  }

  private handleVideoOnlyAction(action: 'up' | 'down' | 'left' | 'right' | 'ok'): void {
    if (action === 'up' || action === 'down') {
      this.zap(action === 'up' ? 'previous' : 'next');
      return;
    }

    if (action === 'ok') {
      this.toggleInfoBar();
      return;
    }

    this.openOverlay('dpad');
  }

  private handleOverlayAction(action: 'up' | 'down' | 'left' | 'right' | 'ok'): void {
    switch (this.activePanel()) {
      case 'menu':
        this.handleMenuNavigation(action);
        return;
      case 'categories':
        this.handleCategoryNavigation(action);
        return;
      case 'channels':
        this.handleChannelNavigation(action);
        return;
    }
  }

  private handleMenuNavigation(action: 'up' | 'down' | 'left' | 'right' | 'ok'): void {
    if (action === 'up') {
      this.moveMenuFocus(-1);
      return;
    }

    if (action === 'down') {
      this.moveMenuFocus(1);
      return;
    }

    if (action === 'right') {
      this.activePanel.set('categories');
      return;
    }

    if (action === 'left') {
      this.overlayVisible.set(false);
      return;
    }

    const item = this.menuItems[this.focusedMenuIndex()];

    switch (item.id) {
      case 'home':
        this.overlayVisible.set(false);
        return;
      case 'guide':
        this.activePanel.set('categories');
        return;
      case 'search':
        this.showToast('Busqueda en desarrollo.');
        return;
      case 'settings':
        this.logout();
        return;
    }
  }

  private handleCategoryNavigation(action: 'up' | 'down' | 'left' | 'right' | 'ok'): void {
    if (action === 'up') {
      this.moveCategoryFocus(-1);
      return;
    }

    if (action === 'down') {
      this.moveCategoryFocus(1);
      return;
    }

    if (action === 'left') {
      this.activePanel.set('menu');
      return;
    }

    if (action === 'right' || action === 'ok') {
      this.activePanel.set('channels');
      this.focusedChannelIndex.set(0);
      this.loadFocusedChannelEpg();
    }
  }

  private handleChannelNavigation(action: 'up' | 'down' | 'left' | 'right' | 'ok'): void {
    if (action === 'up') {
      this.moveChannelFocus(-1);
      this.scrollChannelIntoView();
      return;
    }

    if (action === 'down') {
      this.moveChannelFocus(1);
      this.scrollChannelIntoView();
      return;
    }

    if (action === 'left') {
      this.activePanel.set('categories');
      return;
    }

    if (action === 'right') {
      return;
    }

    const selection = this.changeChannelUseCase.execute({
      categories: this.categories(),
      currentCategoryIndex: this.selectedCategoryIndex(),
      currentChannelIndex: this.selectedChannelIndex(),
      targetCategoryIndex: this.focusedCategoryIndex(),
      targetChannelIndex: this.focusedChannelIndex(),
    });

    if (!selection) {
      this.showToast('No se pudo cambiar de canal.');
      return;
    }

    this.applyChannelSelection(selection.categoryIndex, selection.channelIndex, selection.channel);
    this.overlayVisible.set(false);
    this.showInfoBar();
  }

  private moveMenuFocus(delta: number): void {
    const length = this.menuItems.length;

    this.focusedMenuIndex.update((current) => ((current + delta) % length + length) % length);
  }

  private moveCategoryFocus(delta: number): void {
    const categoryCount = this.categories().length;

    if (categoryCount === 0) {
      return;
    }

    this.focusedCategoryIndex.update(
      (current) => ((current + delta) % categoryCount + categoryCount) % categoryCount,
    );
    this.focusedChannelIndex.set(0);
  }

  private moveChannelFocus(delta: number): void {
    const channelCount = this.focusedChannels().length;

    if (channelCount === 0) {
      return;
    }

    this.focusedChannelIndex.update(
      (current) => ((current + delta) % channelCount + channelCount) % channelCount,
    );
    this.loadFocusedChannelEpg();
  }

  private scrollChannelIntoView(): void {
    if (!this.channelsList?.nativeElement) {
      return;
    }

    const listElement = this.channelsList.nativeElement;
    const visibleIndex = this.focusedChannelIndex() - this.channelWindowStart();

    if (visibleIndex >= 0 && visibleIndex < listElement.children.length) {
      const activeItem = listElement.children[visibleIndex] as HTMLElement | undefined;

      if (activeItem) {
        activeItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }

  private openOverlay(trigger: OverlayTrigger): void {
    this.overlayVisible.set(true);
    this.activePanel.set('menu');
    this.focusedMenuIndex.set(trigger === 'dpad' ? 1 : 0);
  }

  private zap(direction: 'next' | 'previous'): void {
    const selection = this.changeChannelUseCase.execute({
      categories: this.categories(),
      currentCategoryIndex: this.selectedCategoryIndex(),
      currentChannelIndex: this.selectedChannelIndex(),
      direction,
    });

    if (!selection) {
      return;
    }

    this.applyChannelSelection(selection.categoryIndex, selection.channelIndex, selection.channel);
    this.showInfoBar();
  }

  private applyChannelSelection(categoryIndex: number, channelIndex: number, channel: TvChannel): void {
    this.selectedCategoryIndex.set(categoryIndex);
    this.selectedChannelIndex.set(channelIndex);

    this.focusedCategoryIndex.set(categoryIndex);
    this.focusedChannelIndex.set(channelIndex);

    this.currentChannel.set(channel);
    this.showVideoMeta();
    this.startPlayback(channel);
    void this.loadChannelEpg(channel);
  }

  private loadFocusedChannelEpg(): void {
    const channel = this.focusedChannel();

    if (!channel) {
      return;
    }

    this.focusedChannelGuide.set([]);
    void this.getChannelEpgUseCase.execute(channel.streamId)
      .then((listings) => this.focusedChannelGuide.set(listings))
      .catch(() => this.focusedChannelGuide.set([]));
  }

  private async loadChannelEpg(channel: TvChannel): Promise<void> {
    try {
      const epgListings = await this.getChannelEpgUseCase.execute(channel.streamId);
      this.currentChannelGuide.set(epgListings);
    } catch {
      this.currentChannelGuide.set([]);
    }
  }

  formatEpgTime(timestamp: number | string): string {
    const unix = typeof timestamp === 'string' ? parseInt(timestamp, 10) : timestamp;
    if (isNaN(unix)) return '00:00';
    const date = new Date(unix * 1000);
    return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  }

  protected onVideoLayerClick(): void {
    if (this.overlayVisible()) {
      return;
    }

    this.toggleInfoBar();
  }

  private toggleInfoBar(): void {
    if (this.infoBarVisible()) {
      this.clearInfoBarTimeout();
      this.infoBarVisible.set(false);
    } else {
      this.showInfoBar();
    }
  }

  private showInfoBar(): void {
    this.clearInfoBarTimeout();
    this.infoBarVisible.set(true);
    this.infoBarTimeoutId = setTimeout(() => {
      this.infoBarVisible.set(false);
    }, 2800);
  }

  private showToast(message: string): void {
    this.clearToastTimeout();
    this.toastMessage.set(message);
    this.toastTimeoutId = setTimeout(() => {
      this.toastMessage.set('');
    }, 2200);
  }

  private clearInfoBarTimeout(): void {
    if (this.infoBarTimeoutId === undefined) {
      return;
    }

    clearTimeout(this.infoBarTimeoutId);
    this.infoBarTimeoutId = undefined;
  }

  private clearToastTimeout(): void {
    if (this.toastTimeoutId === undefined) {
      return;
    }

    clearTimeout(this.toastTimeoutId);
    this.toastTimeoutId = undefined;
  }

  private showVideoMeta(): void {
    this.clearVideoMetaTimeout();
    this.videoMetaVisible.set(true);
    this.videoMetaTimeoutId = setTimeout(() => {
      this.videoMetaVisible.set(false);
    }, 3000);
  }

  private clearVideoMetaTimeout(): void {
    if (this.videoMetaTimeoutId === undefined) {
      return;
    }

    clearTimeout(this.videoMetaTimeoutId);
    this.videoMetaTimeoutId = undefined;
  }

  private logout(): void {
    this.videoPlaybackFacade.destroy();
    this.logoutUseCase.execute();
    this.overlayVisible.set(false);
    this.infoBarVisible.set(false);
    this.videoMetaVisible.set(false);
    this.streamPlaybackError.set('');
    this.clearInfoBarTimeout();
    this.clearToastTimeout();
    this.clearVideoMetaTimeout();
    void this.router.navigate(['/login']);
  }

  private startPlayback(channel: TvChannel): void {
    const videoElement = this.videoPlayerRef()?.nativeElement;
    if (!videoElement) {
      return;
    }

    const resolved = this.resolveStreamUrlUseCase.execute(
      channel,
      environment.preferredStreamFormat,
      {
        useProxy: environment.streamProxy.enabled,
        proxyBasePath: environment.streamProxy.basePath,
      },
    );
    if (!resolved) {
      const message = 'No se pudo resolver la URL del stream.';
      this.streamPlaybackError.set(message);
      this.trackPlaybackError(channel, message, false);
      return;
    }

    this.streamPlaybackError.set('');

    this.videoPlaybackFacade.start(
      videoElement,
      resolved.primaryUrl,
      resolved.fallbackUrl,
      (message, usedFallback) => {
        this.streamPlaybackError.set(message);
        this.trackPlaybackError(channel, message, usedFallback);
      },
    );
  }

  private trackPlaybackError(channel: TvChannel, message: string, usedFallback: boolean): void {
    this.trackPlaybackErrorUseCase.execute({
      channelId: channel.id,
      channelName: channel.name,
      streamType: channel.streamType,
      message,
      hasDirectSource: Boolean(channel.directSource),
      usedFallback,
      timestamp: new Date().toISOString(),
    });
  }

  private resolveWindowStart(focusIndex: number, length: number, windowSize: number): number {
    if (length <= windowSize) {
      return 0;
    }

    const centered = focusIndex - Math.floor(windowSize / 2);
    const maxStart = length - windowSize;

    if (centered < 0) {
      return 0;
    }

    if (centered > maxStart) {
      return maxStart;
    }

    return centered;
  }
}
