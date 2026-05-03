# FlatPlayer Constitution

<!--
Sync Impact Report
==================
Version change: 0.0.0 → 1.0.0
Modified principles: N/A (initial creation)
Added sections:
  - I. Remote-First Navigation
  - II. Streaming Stability Over Features
  - III. Hexagonal Architecture
  - IV. Credential Security
  - V. Tizen Compatibility Awareness
  - Additional Constraints (3 subsections)
  - Development Workflow (technology stack, path aliases, naming conventions, formatting)
  - Governance (amendment procedure, versioning, compliance, sensitive files)
Removed sections: N/A
Templates updated: ✅ plan-template.md (Constitution Check section present), ✅ spec-template.md (no constitution references to update), ✅ tasks-template.md (no constitution references to update)
Follow-up TODOs: None
-->
## Core Principles

### I. Remote-First Navigation

The application MUST operate exclusively via D-pad directional controls and the OK/Select button on Samsung Tizen TV remotes. Keyboard input and mouse interactions are explicitly unsupported and MUST NOT be relied upon for any user-facing functionality. All interactive components MUST be navigable and operable using only remote control semantics (focus, select, back, directional arrows).

**Rationale**: FlatPlayer is targeting Samsung Tizen TVs where the primary input is the bundled remote control. The user experience must be optimized for this reality.

### II. Streaming Stability Over Features

Stability of IPTV stream playback takes precedence over secondary features, UI polish, or feature additions. The `LiveLatencySync` component and HLS.js integration are considered critical path. Changes to streaming infrastructure require rigorous testing against real streams before commit.

**Rationale**: A broken or unstable stream directly breaks the core value proposition of the application. Users tolerate UI imperfections far less than playback failures.

### III. Hexagonal Architecture

The codebase follows a strict layered architecture:

- **`src/app/core/`**: Pure TypeScript domain with zero framework imports. Contains models, ports (interfaces), and use cases only.
- **`src/app/infrastructure/`**: Implementation layer for HTTP clients, third-party libraries, storage adapters, and providers.
- **`src/app/presentation/`**: Angular components, pages, guards. These LAYERS MAY ONLY import use cases from core, never infrastructure directly.

**Rationale**: Enforced separation allows core business logic to be tested independently of Angular, framework upgrades to be isolated, and different presentation layers to consume the same domain logic.

### IV. Credential Security

The `encrypted-credentials.adapter.ts` file handles encryption of user credentials before LocalStorage persistence. This file MUST NOT be modified without security review. If compromised, user credentials are exposed in plaintext.

**Rationale**: Credentials stored insecurely directly harm users. The encryption adapter is the single point of trust for credential safety.

### V. Tizen Compatibility Awareness

The `npm run build:tizen` target includes WebKit compatibility patches specific to older Samsung TV firmware. These patches are fragile and MUST NOT be modified unless a Tizen-specific bug requires resolution. Production builds for web use different output and do not require these patches.

**Rationale**: Tizen TVs have varying WebKit versions across firmware generations. The patches bridge gaps in older WebKit implementations but can introduce regressions on newer TVs if changed carelessly.

## Additional Constraints

### No CI / No Pre-commit Hooks

There are no automated CI pipelines or pre-commit hooks enforced in this repository. Each developer is responsible for running `npm test` manually before committing. PRs rely on manual verification.

**Rationale**: Project simplicity and developer autonomy. Trust over process.

### Dev Proxy Configuration

The development proxy (`npm start`) routes `/iptv`, `/play`, `/key`, and `/hls` paths to `ftvpro.net:8443`. This configuration exists only in the dev environment. Production builds use direct URLs from stored credentials.

**Rationale**: Proxy enables local development against remote API without CORS issues. Not needed in production where direct connections are allowed.

### GitHub Pages SPA Routing

Production builds for GitHub Pages (`npm run build:gh-pages`) copy `index.html` to `404.html` to support SPA client-side routing. This is not a bug—it is intentional.

**Rationale**: GitHub Pages does not support history API routing natively. The 404.html fallback enables Angular's router to handle all routes correctly.

## Development Workflow

### Technology Stack

| Category | Value |
|----------|-------|
| Framework | Angular 21.2.0 |
| Build | esbuild (via @angular/build 21.2.6) |
| TypeScript | 5.9.2 (strict mode) |
| Testing | Vitest 4.0.8 |
| Streaming | hls.js 1.6.3 |
| Firebase | 12.12.0 (Realtime DB for QR login) |
| QR | qrcode 1.5.4 |
| RxJS | 7.8.0 |
| TV Control | @pinncode/samsung-tv-control |
| Styles | SCSS |

### Path Aliases

Build aliases allow clean imports without relative paths:
- `@core/*` → `src/app/core/`
- `@infrastructure/*` → `src/app/infrastructure/`
- `@app/*` → `src/app/*`

### File Naming Conventions

- **Port interfaces**: `*.port.ts` (e.g., `auth-session.port.ts`)
- **DTOs**: `*.dto.ts` (e.g., `live-catalog.dto.ts`)
- **Models**: `*.model.ts`
- **Use Cases**: `*.usecase.ts`
- **Adapters**: `*.adapter.ts`
- **Services**: `*.service.ts`

### Formatting Standards

- 100 characters per line maximum
- Single quotes for strings
- Angular HTML parser active in Prettier

## Governance

### Amendment Procedure

Constitution amendments require:
1. A PR with the proposed changes
2. Description of what principle is affected and why
3. If a principle is removed or redefined in a backward-incompatible way, a migration plan for existing artifacts must be included

### Versioning Policy

- **MAJOR**: Backward-incompatible governance removals or redefinitions of principles
- **MINOR**: New principles added or materially expanded guidance
- **PATCH**: Clarifications, wording, typo fixes, non-semantic refinements

### Compliance Review

All PRs and commits should verify alignment with the constitution. The constitution supersedes other practices when conflicts arise. Use `CLAUDE.md` for runtime development guidance.

### Sensitive Files

Do not modify without explicit approval or security review:
- `src/app/core/application/usecases/live-latency-sync.usecase.ts`
- `src/app/infrastructure/adapters/encrypted-credentials.adapter.ts`
- `src/app/infrastructure/adapters/tizen-remote-keys.adapter.ts`
- Build patches in `build:tizen` target

**Version**: 1.0.0 | **Ratified**: 2026-05-02 | **Last Amended**: 2026-05-02