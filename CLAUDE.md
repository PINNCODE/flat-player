# CLAUDE.md

## Visión

FlatPlayer es un reproductor IPTV para Samsung Tizen TV. Prioriza la estabilidad de streaming y la experiencia de control remoto (D-pad + OK) sobre features secundarios. No hay soporte para teclado/ratón.

## Stack Tecnológico

| Categoría | Value |
|-----------|-------|
| Framework | Angular 21.2.0 |
| Build | esbuild (via @angular/build 21.2.6) |
| TypeScript | 5.9.2 (strict mode) |
| Testing | Vitest 4.0.8 |
| Streaming | hls.js 1.6.3 |
| Firebase | 12.12.0 (Realtime DB para QR login) |
| QR | qrcode 1.5.4 |
| RxJS | 7.8.0 |
| TV Control | @pinncode/samsung-tv-control |
| Estilos | SCSS |

**Proxy dev**: rutas `/iptv`, `/play`, `/key`, `/hls` → `ftvpro.net:8443`

---

## Convenciones de Código

### Nomenclatura de archivos
- **Interfaces de Puerto**: `*.port.ts` (ej: `auth-session.port.ts`)
- **DTOs**: `*.dto.ts` (ej: `live-catalog.dto.ts`)
- **Modelos**: `*.model.ts`
- **Use Cases**: `*.usecase.ts`
- **Adaptadores**: `*.adapter.ts`
- **Servicios**: `*.service.ts`

### Arquitectura Hexagonal

```
src/app/
├── core/                    # TypeScript puro - NUNCA importar frameworks aquí
│   ├── domain/models/
│   ├── domain/ports/
│   └── application/usecases/
├── infrastructure/          # Implementaciones (HttpClient, libs, storage)
│   ├── adapters/
│   ├── services/
│   ├── providers/
│   └── interceptors/
└── presentation/           # Componentes Angular - SOLO inyectan use cases
    ├── pages/
    ├── guards/
    └── components/
```

### Patrones
- **Facade**: `VideoPlaybackFacade` orquesta HLS.js
- **Repository**: Puertos con sufijo `*.repository.ts`
- **Use Cases**: Un archivo por operación de negocio

### Prettier
- 100 caracteres/línea
- Comillas simples
- Angular HTML parser activo

---

## Qué NO tocar y por qué

### `src/app/core/`
Dominio puro TypeScript. Sin imports de Angular, RxJS, ni libs de infraestructura. Si necesitas un contrato, define una interfaz nomás.

### `LiveLatencySync`
Sincroniza latencia de streams live (catch-up, brake, seek, resync). Cambios aquí pueden romper streams en producción. Requiere tests con streams reales.

### `encrypted-credentials.adapter.ts`
Cifra credenciales antes de guardarlas en LocalStorage. Si se rompe, expone credenciales de usuarios.

### `tizen-remote-keys.adapter.ts`
Mapping de teclas Samsung. Si el control no responde bien en una TV específica, probablemente está aquí.

### `npm run build:tizen`
Patches para WebKit antiguo de Tizen. Si no hay problemas en la TV, no tocar.

---

## Restricciones

### Navegación: Solo control remoto
La app está diseñada para **D-pad + OK exclusivamente**. No hay soporte para tab/enter de teclado. Los componentes responden a focus y key events del `TizenRemoteInputService`.

### No CI / No hooks
No hay pre-commit hooks ni workflows. Cada dev corre tests manualmente antes de commitear.

### Proxy en dev
El proxy a `ftvpro.net:8443` solo existe en dev (`npm start`). Prod usa URLs directas desde credenciales.

### GitHub Pages
El build `gh-pages` copia `index.html` → `404.html` para SPA routing.

---

## Comandos

| Comando | Descripción |
|---------|-------------|
| `npm start` | Dev server con proxy |
| `npm test` | Tests con Vitest |
| `ng test -- --include="**/foo.spec.ts"` | Test único archivo |
| `npm run build` | Production build |
| `npm run build:tizen` | Build para Tizen TV |
| `npm run build:gh-pages` | Build para GitHub Pages |
| `npm run deploy:gh-pages` | Build + deploy |

---

## Path Aliases

- `@core/*` → `src/app/core/`
- `@infrastructure/*` → `src/app/infrastructure/`
- `@app/*` → `src/app/*`