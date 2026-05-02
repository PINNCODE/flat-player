# Project Specification - FlatPlayer

## 1. Overview

**FlatPlayer** is an IPTV streaming application for Samsung Tizen TV built with Angular 21. It provides a full-featured TV dashboard where users can log in, browse live TV channels organized by category, watch HLS streams using the remote control, and use QR code login for mobile credential entry.

**Target users**: IPTV subscribers who want a TV-first interface for watching live television on Samsung Smart TV.

---

## 2. Features

### Authentication
- **Manual login**: host URL, username, password with form validation
- **QR login**: TV shows QR code → mobile scans → enters credentials → sent to TV via Firebase Realtime Database
- **Session persistence**: encrypted credentials stored in LocalStorage
- **Auto-login**: disabled by default (configurable in `environment.development.ts`)

### TV Catalog & Navigation
- Fetch categories and channels from IPTV API (`player_api.php`)
- Browse channels by category with remote D-pad focus navigation
- Channel search with real-time results
- Favorites management (double-OK on channel adds to favorites)
- Home panel with personalized recommendations (sports, favorites, live channels, category rows)
- Last played channel recovery on startup

### Video Playback
- **HLS.js-based playback** with automatic fallback chain:
  1. Native HLS (Safari-style) → HLS.js → fallback URL
  2. Support for `.m3u8` and `.ts` formats
- **Live latency synchronization** (20s target behind live edge):
  - `catch-up`: accelerates 1.1x when too far ahead
  - `brake`: slows to 1x when approaching live edge
  - `seek`: forces seek to correct position
  - `resync`: reloads manifest on desync
- Buffer management: max 25s forward, 10s back-buffer, stall recovery at 8s
- Audio/video resync after network stalls
- Playback telemetry logged to LocalStorage

### EPG (Electronic Program Guide)
- Channel program listings fetched per stream ID
- Base64-decoded titles and descriptions
- Current and upcoming programs displayed

### Remote Control (Tizen Samsung)
- Full Samsung Smart View SDK key support (~30 keys mapped)
- D-pad navigation, OK for selection, double-OK for favorites
- `ChannelUp/Down` for quick zapping
- `Info` toggles info bar, `Guide` opens category panel
- `Menu/Tools` opens overlay menu
- Color buttons (red = favorites, green/yellow/blue = placeholders)
- Media keys: play/pause/stop/fast-forward/rewind
- `0` key toggles debug mode (live edge, latency, buffer display)

### Settings & User Preferences
- Country selection (Hispanic America countries list)
- User info display (expiry date, connection status)
- Logout with confirmation dialog

---

## 3. Architecture

### Hexagonal (Ports & Adapters)

```
src/app/
├── core/                          # Pure TypeScript - NO framework imports
│   ├── domain/models/            # Entities & DTOs
│   ├── domain/ports/              # Interface contracts
│   └── application/usecases/     # Business logic orchestration
│
├── infrastructure/               # Implementations (HttpClient, libs, storage)
│   ├── adapters/
│   │   ├── http/                 # HTTP implementations (auth, catalog, EPG)
│   │   ├── local-storage/        # Encrypted credential persistence
│   │   ├── mock/                 # Dev mocks
│   │   └── tizen/                # Samsung remote key adapter
│   ├── services/
│   │   ├── video-playback.facade.ts    # HLS.js orchestration
│   │   ├── live-latency-sync.util.ts   # Latency sync strategies
│   │   ├── qr-login-firebase.service.ts
│   │   ├── tizen-remote-input.service.ts
│   │   ├── playback-telemetry.service.ts
│   │   └── auth-session.service.ts
│   ├── providers/                # Angular DI providers
│   └── interceptors/            # HTTP interceptors
│
└── presentation/                # Angular components - USE CASES ONLY
    ├── pages/
    │   ├── login/                # Login form + QR modal
    │   ├── dashboard/
    │   │   ├── home-panel/
    │   │   ├── settings-panel/
    │   │   ├── logout-dialog/
    │   │   └── stream-tester.component.ts
    │   └── qr-login/             # Mobile credential entry page
    └── guards/                   # AuthGuard, GuestGuard
```

### Architecture Rules

1. **Domain**: Zero framework dependencies. Pure TypeScript only.
2. **Application**: Use cases know Domain and Ports, but NOT Infrastructure or UI.
3. **Infrastructure**: Only layer authorized for `HttpClient`, external APIs, LocalStorage, or third-party libs. Implements Ports defined in Domain.
4. **Presentation**: Components ONLY inject Use Cases. NEVER inject adapters or contain business logic.

---

## 4. Technology Stack

| Category | Technology |
|----------|------------|
| Framework | Angular 21.2.0 |
| Build | esbuild (via @angular/build 21.2.6) |
| Language | TypeScript 5.9.2 (strict mode) |
| Testing | Vitest 4.0.8 |
| Streaming | hls.js 1.6.3 |
| Auth | Firebase 12.12.0 (Realtime DB for QR login) |
| QR Code | qrcode 1.5.4 |
| Reactive | RxJS 7.8.0 |
| TV Control | @pinncode/samsung-tv-control |
| Styling | SCSS |

### Path Aliases

- `@core/*` → `src/app/core/`
- `@infrastructure/*` → `src/app/infrastructure/`
- `@app/*` → `src/app/*`

---

## 5. Domain Models

### TvChannel
```typescript
interface TvChannel {
  id: string;
  name: string;
  logoLabel: string;
  logoUrl?: string;
  streamId: string;
  streamType: string;
  directSource?: string;
  currentProgram: TvProgram;
}
```

### TvCategory
```typescript
interface TvCategory {
  id: string;
  name: string;
  iconLabel: string;
  channels: readonly TvChannel[];
}
```

### Credentials
```typescript
class Credentials {
  constructor(
    readonly username: string,
    readonly password: string,
    readonly host: string
  )
}
```

### HomeRecommendations
```typescript
interface HomeRecommendations {
  rows: readonly HomeRow[];
}

interface HomeRow {
  title: string;
  iconLabel: string;
  channels: readonly TvChannel[];
}
```

### EpgListing
```typescript
interface EpgListing {
  title: string;
  description: string;
  startTimestamp: number;
  endTimestamp: number;
}
```

---

## 6. Ports (Interfaces)

| Port | Purpose |
|------|---------|
| `VIDEO_PLAYBACK_PORT` | Video playback control (HLS.js) |
| `AUTH_REPOSITORY` | Authentication operations |
| `TV_CATALOG_REPOSITORY` | TV channel catalog fetching |
| `EPG_REPOSITORY` | EPG data fetching |
| `CREDENTIALS_PERSISTENCE_PORT` | Encrypted credential storage |
| `USER_SETTINGS_PORT` | User preferences |
| `AUTH_SESSION_PORT` | Session storage |
| `PLAYBACK_TELEMETRY_PORT` | Playback telemetry |

---

## 7. Use Cases

| Use Case | Description |
|----------|-------------|
| `LoginUseCase` | Execute login with credentials |
| `LogoutUseCase` | Clear session and redirect to login |
| `AutoLoginUseCase` | Restore session from encrypted storage |
| `GetTvCatalogUseCase` | Fetch categories and channels |
| `SearchChannelsUseCase` | Search channels by name |
| `ChangeChannelUseCase` | Navigate channels (next/prev/up/down) |
| `ResolveStreamUrlUseCase` | Resolve stream URL with proxy support |
| `GetChannelEpgUseCase` | Fetch EPG for a channel |
| `GetHomeRecommendationsUseCase` | Generate personalized home rows |
| `TrackPlaybackErrorUseCase` | Log playback errors to LocalStorage |
| `GetUserInfoUseCase` | Get user account info |
| `GetUserSettingsUseCase` | Get user preferences |

---

## 8. Key Services

### VideoPlaybackFacade (670 lines)

Orchestrates HLS.js playback with:
- **Fallback chain**: native HLS → HLS.js → fallback URL
- **Buffer config**: maxBufferLength 25s, backBufferLength 10s
- **Live sync**: liveSyncDuration 20, maxLiveSyncPlaybackRate 1.08
- **Stall recovery**: threshold at 8s buffer, audio/video resync
- **Latency signals**: liveEdgeSeconds, currentTimeSeconds, latencySeconds, bufferAheadSeconds (throttled to 0.5s changes for TV performance)

### LiveLatencySyncUtil

Decision engine for latency management:
- `catch-up`: applyPlaybackRate(1.1) when ahead of live edge
- `brake`: applyPlaybackRate(1) when too close to live edge
- `seek`: forceSeek to targetTime when desync > 0.5s
- `resync`: hls.stopLoad() + startLoad(-1, true)

### QrLoginFirebaseService

Firebase Realtime Database operations:
- `createSession()`: creates session node, returns session ID
- `listenForCredentials(sessionId, callback)`: real-time listener
- `listenForExpiration(sessionId, callback)`: handles 5-min expiry
- `cleanupSession(sessionId)`: removes session data

### TizenRemoteInputService

Translates Samsung remote keys to dashboard actions:
- Arrow keys → navigation
- OK → selection / double-OK → favorite
- ChannelUp/Down → zapping
- Media keys → playback control

---

## 9. Routes

| Route | Component | Guard | Description |
|-------|-----------|-------|-------------|
| `/login` | Login | GuestGuard | Login form + QR modal |
| `/dashboard` | Dashboard | AuthGuard | Main TV interface (protected) |
| `/qr-login` | QrLogin | None | Mobile page for QR scan |
| `/` | → redirect to `/login` | | |
| `/**` | → redirect to `/login` | | |

---

## 10. QR Login Flow

```
1. User presses QR button on Login page
2. TV: createSession() → Firebase creates /sessions/{id}
3. TV: Generate QR with URL: pinncode.github.io/flat-player/#/qr-login?session={id}
4. Mobile: Scans QR, opens /qr-login?session={id}
5. Mobile: User enters credentials, submits to Firebase /sessions/{id}
6. TV: listenForCredentials() fires → credentials received
7. TV: Form auto-fills, onSubmit called after 300ms
8. TV: Navigate to /dashboard
```

Session expires after 5 minutes. TV shows countdown timer.

---

## 11. Playback Flow

```
start(channel, format, proxyConfig)
  └─ resolveStreamUrlUseCase.execute(channel, format, proxyConfig)
      ├─ primaryUrl: channel.directSource || getStreamUrl(channel)
      └─ fallbackUrl: proxyConfig.useProxy ? proxyUrl : null

attachSource(videoElement, primaryUrl, fallbackUrl, onError, isFallback)
  ├─ .ts source → attachNativeSource()
  ├─ .m3u8 + canPlayNativeHLS → attachNativeHlsFirst() → fallback to HLS.js on error
  ├─ .m3u8 + Hls.isSupported() → attachHlsSource()
  └─ no support + fallbackUrl → retry with fallback
```

HLS.js config:
```javascript
{
  lowLatencyMode: false,
  liveSyncDuration: 20,        // 2 segments behind live edge
  liveMaxLatencyDuration: 30,
  liveDurationInfinity: true,
  maxLiveSyncPlaybackRate: 1.08,
  maxBufferLength: 25,
  maxMaxBufferLength: 35,
  backBufferLength: 10,
  maxBufferHole: 0.5
}
```

---

## 12. Build Commands

| Command | Description |
|---------|-------------|
| `npm start` | Dev server with proxy (`/iptv`, `/play`, `/key`, `/hls` → `ftvpro.net:8443`) |
| `npm test` | Unit tests with Vitest |
| `ng test -- --include="**/foo.spec.ts"` | Single test file |
| `npm run build` | Production build |
| `npm run build:tizen` | Production build + CSS/JS patches for legacy WebKit |
| `npm run build:gh-pages` | Build + copy `index.html` → `404.html` for SPA routing |
| `npm run deploy:gh-pages` | Build + deploy to `pinncode.github.io/flat-player/` |
| `npm run sdb:deploy` | Build + install + launch on Samsung TV via SDB |

---

## 13. Environment Configuration

| File | Proxy | Auto-login |
|------|-------|------------|
| `environment.ts` | Disabled | Disabled |
| `environment.development.ts` | Enabled | Configurable |

---

## 14. Telemetry & Debug

- **Stall telemetry**: stored in `localStorage['iptv_stall_telemetry']` (max 50 entries)
- **Channel scores**: stored in `localStorage['iptv_channel_scores']` for favorites ranking
- **Last played channel**: stored in `localStorage['iptv_last_played_channel']`
- **Debug mode**: press `0` key to toggle overlay showing liveEdge, currentTime, latency, bufferAhead

---

## 15. Project Structure Summary

```
flat-player/
├── src/
│   ├── app/
│   │   ├── core/
│   │   │   ├── domain/models/      # 7 model files
│   │   │   ├── domain/ports/       # 8 port interfaces
│   │   │   └── application/usecases/ # 12 use case files
│   │   ├── infrastructure/
│   │   │   ├── adapters/          # HTTP, local-storage, mock, tizen
│   │   │   ├── services/           # Facades, utilities
│   │   │   ├── providers/          # Angular DI
│   │   │   └── interceptors/
│   │   └── presentation/
│   │       ├── pages/             # login, dashboard (with sub-components), qr-login
│   │       └── guards/
│   ├── environments/
│   └── styles.scss
├── package.json
├── angular.json
├── tsconfig.json
├── vitest.config.ts
└── CLAUDE.md
```

**Version**: 0.1.3