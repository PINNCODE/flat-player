# flat-player

Angular 21 SPA for Samsung Tizen TV con streaming HLS. Vitest para tests, esbuild para bundling.

## Reglas de Comunicación
- Debes responder, explicar conceptos y razonar SIEMPRE en español.
- Si generas o modificas comentarios en el código, también deben estar en español.

## Comandos de Desarrollo

| Comando | Descripción |
|---------|-------------|
| `npm start` | Servidor dev con proxy (rutas /iptv, /play, /key, /hls → ftvpro.net:8443) |
| `npm test` / `ng test` | Tests unitarios con Vitest |
| `ng test --include="**/foo.spec.ts"` | Un solo archivo de test |
| `npx vitest run src/path/spec.ts` | Vitest directo |
| `npm run build` | Build de producción |
| `npm run build:tizen` | Build + parches CSS/JS para WebKit antiguo |
| `npm run build:gh-pages` | Build para GitHub Pages (copia index.html→404.html) |
| `npm run deploy:gh-pages` | Build + deploy a pinncode.github.io/flat-player/ |

## Arquitectura (Hexagonal)

```
src/app/
├── core/                    # @core/* - Dominio + Aplicación
│   ├── domain/models/       # Entidades, DTOs (TypeScript puro)
│   ├── domain/ports/        # Contratos de interfaces
│   └── application/usecases/
├── infrastructure/          # @infrastructure/* - Adaptadores
│   └── adapters/http/       # Implementaciones HTTP
└── presentation/            # Componentes Angular (inyectan USE CASES solo)
```

- **Dominio**: Cero dependencias del framework
- **Infraestructura**: Unica capa con HttpClient y librerías de terceros
- **Presentación**: Componentes inyectan use cases SOLO, nunca adaptadores

## Reglas

- **Navegación**: El control remoto usa flechas + OK. NO sugieras Tab/Enter.
- **Nombrado**: Nombres expresivos (LoginUseCase, AuthHttpAdapter), sin sufijo "Service"
- **Interfaces**: DTOs, contratos de puertos
- **Clases**: Use cases, servicios, entidades de dominio ricas con validación
- **RxJS**: Preferir async pipe; desuscribirse con takeUntilDestroyed; evitar suscripciones anidadas

## Config

- TypeScript strict mode, noImplicitReturns, noPropertyAccessFromIndexSignature
- Prettier: 100-char line length, single quotes, Angular HTML parser
- Path aliases: `@core/*`, `@infrastructure/*`
- Sin pre-commit hooks o CI workflows
- Override: `@asamuzakjp/css-color: "4.1.2"`
