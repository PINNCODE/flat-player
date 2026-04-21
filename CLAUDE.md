# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Proyecto

Angular 21 SPA para Samsung Tizen TV con streaming HLS. Vitest para tests, esbuild para bundling.

## Comandos

| Comando | Descripción |
|---------|-------------|
| `npm start` | Servidor dev con proxy (rutas /iptv, /play, /key, /hls → ftvpro.net:8443) |
| `npm test` | Tests unitarios con Vitest |
| `ng test -- --include="**/foo.spec.ts"` | Un solo archivo de test |
| `npm run build` | Build de producción |
| `npm run build:tizen` | Build + parches CSS/JS para WebKit antiguo |
| `npm run build:gh-pages` | Build para GitHub Pages (copia index.html→404.html) |
| `npm run deploy:gh-pages` | Build + deploy a pinncode.github.io/flat-player/ |

## Arquitectura Hexagonal

```
src/app/
├── core/                          # @core/* - Dominio + Aplicación
│   ├── domain/models/             # Entidades, DTOs (TypeScript puro)
│   ├── domain/ports/              # Contratos de interfaces
│   └── application/usecases/      # Casos de uso
├── infrastructure/               # @infrastructure/* - Adaptadores
│   ├── adapters/http/             # Implementaciones HTTP
│   ├── adapters/local-storage/    # Persistencia local
│   ├── adapters/mock/             # Mocks para desarrollo
│   ├── adapters/tizen/            # Adaptador específico Tizen
│   ├── services/                  # Servicios concretos
│   └── providers/                 # Providers de Angular
└── presentation/                  # Componentes Angular (inyectan USE CASES solo)
    ├── pages/                     # Páginas (login, dashboard, qr-login)
    ├── guards/                    # Guards de rutas
    └── components/                # Componentes reutilizables
```

## Reglas de Arquitectura

1. **Dominio**: Cero dependencias del framework. Solo TypeScript puro.
2. **Aplicación**: Los use cases conocen el Dominio y los Puertos, pero no la Infraestructura ni la UI.
3. **Infraestructura**: Única capa autorizada para `HttpClient`, APIs externas, LocalStorage o librerías de terceros. Implementa los Puertos definidos en el Dominio.
4. **Presentación**: Componentes solo inyectan Casos de Uso. NUNCA inyectan adaptadores ni contienen lógica de negocio.

## Interacciones con Tizen TV

La navegación es **exclusivamente con control remoto**: flechas + OK. No uses Tab/Enter.

- El control remoto usa Samsung Smart View SDK (`@pinncode/samsung-tv-control`)
- Manejo de teclas en `tizen-remote-input.service.ts` y `tizen-remote-keys.adapter.ts`
- `TizenRemoteInputProvider` actúa como InputObservable para detectar teclas

## Path Aliases

- `@core/*` → `src/app/core/`
- `@infrastructure/*` → `src/app/infrastructure/`

## Configuración

- TypeScript strict mode
- Prettier: 100-char line length, single quotes, Angular HTML parser
- Dependencias: Angular 21, hls.js, firebase, qrcode, rxjs
- No pre-commit hooks ni CI workflows
