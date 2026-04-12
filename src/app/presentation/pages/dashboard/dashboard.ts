import { CommonModule } from '@angular/common';
import { AfterViewInit, ChangeDetectionStrategy, Component, DestroyRef, ElementRef, QueryList, ViewChild, ViewChildren, computed, inject, signal, viewChild } from '@angular/core';
import { ChangeChannelUseCase, ChannelSelection } from '@core/application/usecases/change-channel.usecase';
import { GetTvCatalogUseCase } from '@core/application/usecases/get-tv-catalog.usecase';
import { LogoutUseCase } from '@core/application/usecases/logout.usecase';
import { ResolveStreamUrlUseCase } from '@core/application/usecases/resolve-stream-url.usecase';
import { SearchChannelsUseCase } from '@core/application/usecases/search-channels.usecase';
import { TrackPlaybackErrorUseCase } from '@core/application/usecases/track-playback-error.usecase';
import { GetChannelEpgUseCase } from '@core/application/usecases/get-channel-epg.usecase';
import { TvCategory, TvChannel } from '@core/domain/models/tv-catalog.model';
import { EpgListing } from '@core/domain/models/epg-listing.model';
import { Router } from '@angular/router';
import { UserInfo } from '@core/domain/models/auth-response.model';
import { GetUserInfoUseCase } from '@core/application/usecases/get-user-info.usecase';
import { HISPANIC_AMERICA_COUNTRIES } from '@core/domain/models/user-settings.model';
import { GetUserSettingsUseCase } from '@core/application/usecases/get-user-settings.usecase';
import { SaveUserCountryUseCase } from '@core/application/usecases/save-user-country.usecase';
import { GetHomeRecommendationsUseCase } from '@core/application/usecases/get-home-recommendations.usecase';
import { HomeRecommendations } from '@core/domain/models/home-recommendations.model';
import { VideoPlaybackFacade } from '../../services/video-playback.facade';
import { environment } from '../../../../environments/environment';
import { DashboardLogoutDialog } from './logout-dialog/dashboard-logout-dialog';
import { DashboardSettingsPanel } from './settings-panel/dashboard-settings-panel';

type OverlayPanel = 'home' | 'menu' | 'categories' | 'channels' | 'search' | 'settings';
type OverlayTrigger = 'dpad' | 'ok';

interface MenuItem {
  readonly id: 'home' | 'guide' | 'search' | 'settings';
  readonly label: string;
}

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule, DashboardSettingsPanel, DashboardLogoutDialog],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
  host: {
    '(window:keydown)': 'onRemoteKeydown($event)',
  },
})
export class Dashboard implements AfterViewInit {
  protected readonly menuItems: readonly MenuItem[] = [
    { id: 'home', label: 'Inicio' },
    { id: 'guide', label: 'Guia' },
    { id: 'search', label: 'Buscar' },
    { id: 'settings', label: 'Ajustes' },
  ];

  protected readonly overlayVisible = signal(false);
  protected readonly activePanel = signal<OverlayPanel>('home');
  protected readonly focusedMenuIndex = signal(0);

  protected readonly categories = signal<readonly TvCategory[]>([]);
  protected readonly focusedCategoryIndex = signal(0);
  protected readonly focusedChannelIndex = signal(0);

  protected readonly selectedCategoryIndex = signal(0);
  protected readonly selectedChannelIndex = signal(0);
  protected readonly currentChannel = signal<TvChannel | null>(null);
  protected readonly currentChannelGuide = signal<readonly EpgListing[]>([]);
  protected readonly focusedChannelGuide = signal<readonly EpgListing[]>([]);

  protected readonly searchQuery = signal('');
  protected readonly searchResults = signal<readonly ChannelSelection[]>([]);
  protected readonly isSearchInputFocused = signal(true);
  protected readonly focusedSearchResultIndex = signal(0);

  protected readonly userInfo = signal<UserInfo | null>(null);
  protected readonly showLogoutDialog = signal(false);
  protected readonly logoutDialogActionIndex = signal(1); // 0: Continuar, 1: Cancelar

  protected readonly settingsFocusedIndex = signal(0); // 0: Country Selector, 1: Logout
  protected readonly userCountry = signal<string | null>(null);
  protected readonly availableCountries = HISPANIC_AMERICA_COUNTRIES;

  protected readonly homeRecommendations = signal<HomeRecommendations | null>(null);
  protected readonly homeFocusedRowIndex = signal(0);
  protected readonly homeFocusedItemIndex = signal(0);

  protected readonly focusedChannel = computed(() => {
    if (this.activePanel() === 'search') {
      return this.searchResults()[this.focusedSearchResultIndex()]?.channel ?? null;
    }
    return this.focusedChannels()[this.focusedChannelIndex()] ?? null;
  });

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

  protected readonly searchResultWindowStart = computed(() =>
    this.resolveWindowStart(this.focusedSearchResultIndex(), this.searchResults().length, 9),
  );

  protected readonly visibleSearchResults = computed(() =>
    this.searchResults().slice(this.searchResultWindowStart(), this.searchResultWindowStart() + 9),
  );

  private readonly videoPlayerRef = viewChild<ElementRef<HTMLVideoElement>>('videoPlayer');
  @ViewChild('channelsList') channelsList?: ElementRef<HTMLUListElement>;
  @ViewChild('searchInput') searchInput?: ElementRef<HTMLInputElement>;
  @ViewChild('homeRowsContainer') homeRowsContainer?: ElementRef<HTMLDivElement>;
  @ViewChildren('homeRowItem') homeRowItems?: QueryList<ElementRef<HTMLDivElement>>;

  private readonly getTvCatalogUseCase = inject(GetTvCatalogUseCase);
  private readonly changeChannelUseCase = inject(ChangeChannelUseCase);
  private readonly searchChannelsUseCase = inject(SearchChannelsUseCase);
  private readonly logoutUseCase = inject(LogoutUseCase);
  private readonly resolveStreamUrlUseCase = inject(ResolveStreamUrlUseCase);
  private readonly trackPlaybackErrorUseCase = inject(TrackPlaybackErrorUseCase);
  private readonly getChannelEpgUseCase = inject(GetChannelEpgUseCase);
  private readonly getUserInfoUseCase = inject(GetUserInfoUseCase);
  private readonly getUserSettingsUseCase = inject(GetUserSettingsUseCase);
  private readonly saveUserCountryUseCase = inject(SaveUserCountryUseCase);
  private readonly getHomeRecommendationsUseCase = inject(GetHomeRecommendationsUseCase);
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

    if (action === 'back') {
      this.handleBackAction();
      return;
    }

    if (!this.overlayVisible()) {
      this.handleVideoOnlyAction(action);
      return;
    }

    this.handleOverlayAction(action);
  }

  private handleBackAction(): void {
    if (!this.overlayVisible()) return;
    this.overlayVisible.set(false);
    this.activePanel.set('menu');
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

  protected isSearchResultFocused(index: number): boolean {
    return this.activePanel() === 'search' && !this.isSearchInputFocused() && this.focusedSearchResultIndex() === index;
  }

  onSearchQueryChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const query = input.value;
    this.searchQuery.set(query);
    
    if (query.trim().length === 0) {
      this.searchResults.set([]);
      this.focusedSearchResultIndex.set(0);
      this.focusedChannelGuide.set([]);
      return;
    }

    const results = this.searchChannelsUseCase.execute({
      categories: this.categories(),
      query
    });
    this.searchResults.set(results);
    this.focusedSearchResultIndex.set(0);
    
    if (results.length > 0 && !this.isSearchInputFocused()) {
       this.loadFocusedChannelEpg();
    }
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

      const settings = this.getUserSettingsUseCase.execute();
      this.userCountry.set(settings.country);
      this.refreshHomeRecommendations();

      if (!initialSelection) {
        this.showToast('No hay canales disponibles en este momento.');
        return;
      }

      this.applyChannelSelection(initialSelection.categoryIndex, initialSelection.channelIndex, initialSelection.channel);
    } catch {
      this.showToast('No se pudo cargar la guia de canales.');
    }
  }

  private resolveRemoteAction(key: string): 'up' | 'down' | 'left' | 'right' | 'ok' | 'back' | null {
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
      case 'XF86Back':
      case 'Escape':
        return 'back';
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
    if (this.activePanel() === 'home') {
      this.handleHomeNavigation(action);
      return;
    }
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
      case 'search':
        this.handleSearchNavigation(action);
        return;
      case 'settings':
        this.handleSettingsNavigation(action);
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

    const item = this.menuItems[this.focusedMenuIndex()];

    if (action === 'right') {
      if (item.id === 'settings') {
        this.activePanel.set('settings');
        this.settingsFocusedIndex.set(0);
        this.userInfo.set(this.getUserInfoUseCase.execute());
      } else if (item.id === 'home') {
        this.activePanel.set('home');
        this.refreshHomeRecommendations();
      } else {
        this.activePanel.set('categories');
      }
      return;
    }

    if (action === 'left') {
      this.overlayVisible.set(false);
      return;
    }

    switch (item.id) {
      case 'home':
        this.activePanel.set('home');
        this.refreshHomeRecommendations();
        return;
      case 'guide':
        this.activePanel.set('categories');
        return;
      case 'search':
        this.activePanel.set('search');
        this.isSearchInputFocused.set(true);
        setTimeout(() => this.searchInput?.nativeElement.focus(), 0);
        return;
      case 'settings':
        this.activePanel.set('settings');
        this.settingsFocusedIndex.set(0);
        this.userInfo.set(this.getUserInfoUseCase.execute());
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

  private handleSearchNavigation(action: 'up' | 'down' | 'left' | 'right' | 'ok'): void {
    if (action === 'left') {
      this.activePanel.set('menu');
      return;
    }

    if (this.isSearchInputFocused()) {
      if (action === 'down' && this.searchResults().length > 0) {
        this.isSearchInputFocused.set(false);
        this.searchInput?.nativeElement.blur();
        this.focusedSearchResultIndex.set(0);
        this.loadFocusedChannelEpg();
      }
      return;
    }

    if (action === 'up') {
      if (this.focusedSearchResultIndex() === 0) {
        this.isSearchInputFocused.set(true);
        this.searchInput?.nativeElement.focus();
        this.focusedChannelGuide.set([]);
      } else {
        this.moveSearchResultFocus(-1);
      }
      return;
    }

    if (action === 'down') {
      this.moveSearchResultFocus(1);
      return;
    }

    if (action === 'ok') {
      const selection = this.searchResults()[this.focusedSearchResultIndex()];
      if (selection) {
        this.applyChannelSelection(selection.categoryIndex, selection.channelIndex, selection.channel);
        this.overlayVisible.set(false);
        this.showInfoBar();
      }
      return;
    }
  }

  private handleSettingsNavigation(action: 'up' | 'down' | 'left' | 'right' | 'ok'): void {
    if (this.showLogoutDialog()) {
      if (action === 'left' || action === 'right') {
        this.logoutDialogActionIndex.update((i) => i === 0 ? 1 : 0);
        return;
      }
      if (action === 'ok') {
        if (this.logoutDialogActionIndex() === 0) {
          this.logout();
        } else {
          this.showLogoutDialog.set(false);
        }
        return;
      }
      // Bloquear navegación up/down mientras esté en el diálogo.
      return;
    }

    if (action === 'left') {
      if (this.settingsFocusedIndex() === 0) {
        // Change country left
        this.cycleCountry(-1);
      } else {
        this.activePanel.set('menu');
      }
      return;
    }

    if (action === 'right') {
       if (this.settingsFocusedIndex() === 0) {
          // Change country right
          this.cycleCountry(1);
       }
       return;
    }

    if (action === 'up') {
       this.settingsFocusedIndex.set(0);
       return;
    }

    if (action === 'down') {
       this.settingsFocusedIndex.set(1);
       return;
    }

    if (action === 'ok') {
      if (this.settingsFocusedIndex() === 1) {
        this.showLogoutDialog.set(true);
        this.logoutDialogActionIndex.set(1);
      }
      return;
    }
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

  private moveSearchResultFocus(delta: number): void {
    const resultsCount = this.searchResults().length;

    if (resultsCount === 0) {
      return;
    }

    this.focusedSearchResultIndex.update(
      (current) => ((current + delta) % resultsCount + resultsCount) % resultsCount,
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

  formatUserInfoDate(timestamp: string | undefined | null): string {
    if (!timestamp || timestamp === 'null') return 'N/A';
    const unix = parseInt(timestamp, 10);
    if (isNaN(unix)) return timestamp;
    const date = new Date(unix * 1000);
    return date.toLocaleDateString('es-ES', { year: 'numeric', month: 'short', day: 'numeric' });
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

  private cycleCountry(delta: number): void {
    const current = this.userCountry();
    let index = current ? this.availableCountries.indexOf(current) : -1;
    if (index === -1) {
      index = 0;
    } else {
      index = (index + delta + this.availableCountries.length) % this.availableCountries.length;
    }
    const selected = this.availableCountries[index];
    this.userCountry.set(selected);
    this.saveUserCountryUseCase.execute(selected);
    this.refreshHomeRecommendations();
  }

  private refreshHomeRecommendations(): void {
    const recommendations = this.getHomeRecommendationsUseCase.execute(this.categories(), this.userCountry());
    this.homeRecommendations.set(recommendations);
    this.homeFocusedRowIndex.set(0);
    this.homeFocusedItemIndex.set(0);
    this.scrollHomeRowsToTop();
  }

  private handleHomeNavigation(action: 'up' | 'down' | 'left' | 'right' | 'ok'): void {
    const recs = this.homeRecommendations();
    if (!recs) return;

    if (action === 'left') {
      if (this.homeFocusedItemIndex() > 0) {
        this.homeFocusedItemIndex.update(i => i - 1);
      } else {
        this.activePanel.set('menu');
      }
      return;
    }

    if (action === 'right') {
      const row = recs.rows[this.homeFocusedRowIndex()];
      if (row && this.homeFocusedItemIndex() < row.channels.length - 1) {
         this.homeFocusedItemIndex.update(i => i + 1);
      }
      return;
    }

    if (action === 'up') {
      if (this.homeFocusedRowIndex() > 0) {
         this.homeFocusedRowIndex.update(i => i - 1);
         this.homeFocusedItemIndex.set(0);
         this.scrollHomeRowIntoView();
      }
      return;
    }

    if (action === 'down') {
      if (this.homeFocusedRowIndex() < recs.rows.length - 1) {
         this.homeFocusedRowIndex.update(i => i + 1);
         this.homeFocusedItemIndex.set(0);
         this.scrollHomeRowIntoView();
      }
      return;
    }

    if (action === 'ok') {
       let targetChannel: TvChannel | null = null;

       const row = recs.rows[this.homeFocusedRowIndex()];
       if (row) {
         targetChannel = row.channels[this.homeFocusedItemIndex()];
       }

       if (targetChannel) {
          // A bit hacky but we scan all categories to find indices
          let found = false;
          for (let catIdx = 0; catIdx < this.categories().length; catIdx++) {
            const cat = this.categories()[catIdx];
            for (let chIdx = 0; chIdx < cat.channels.length; chIdx++) {
              if (cat.channels[chIdx].id === targetChannel.id) {
                 this.applyChannelSelection(catIdx, chIdx, targetChannel);
                 this.overlayVisible.set(false);
                 this.showInfoBar();
                 found = true;
                 break;
              }
            }
            if (found) break;
          }
       }
    }
  }

  private scrollHomeRowsToTop(): void {
    const container = this.homeRowsContainer?.nativeElement;
    if (!container) {
      return;
    }

    container.scrollTo({ top: 0, behavior: 'smooth' });
  }

  private scrollHomeRowIntoView(): void {
    const container = this.homeRowsContainer?.nativeElement;
    const rowIndex = this.homeFocusedRowIndex();

    if (!container || rowIndex < 0) {
      return;
    }

    const rowElement = this.homeRowItems?.get(rowIndex)?.nativeElement;
    if (!rowElement) {
      return;
    }

    const rowTop = rowElement.offsetTop;
    const rowBottom = rowTop + rowElement.offsetHeight;
    const viewportTop = container.scrollTop;
    const viewportBottom = viewportTop + container.clientHeight;
    const padding = 12;

    if (rowTop - padding < viewportTop) {
      container.scrollTo({ top: Math.max(0, rowTop - padding), behavior: 'smooth' });
      return;
    }

    if (rowBottom + padding > viewportBottom) {
      container.scrollTo({ top: rowBottom - container.clientHeight + padding, behavior: 'smooth' });
    }
  }
}
