# FlatPlayer

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 21.2.6.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Vitest](https://vitest.dev/) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.

## MVP 1

This repository has reached its first MVP milestone.

- MVP version: `v0.1.0-mvp`
- Date: `2026-04-06`
- Scope:
  - Video-First dashboard experience for Samsung TV (Tizen)
  - Remote-first navigation with arrows and OK interactions
  - Real IPTV catalog integration based on login session
  - Channel playback with stream URL resolution and fallback strategy
  - Playback telemetry and development proxy support for IPTV paths

## Deploy to GitHub Pages

This project is configured to deploy to GitHub Pages for the repository `flat-player`.

1. Ensure the remote repository is `https://github.com/PINNCODE/flat-player.git`.
2. Run the deployment command:

```bash
npm run deploy:gh-pages
```

3. In GitHub repository settings, set Pages source to `Deploy from a branch` and select `gh-pages` branch.

The expected public URL is:

- `https://pinncode.github.io/flat-player/`

Notes:

- `build:gh-pages` uses `--base-href /flat-player/`.
- A `404.html` copy of `index.html` is generated to support SPA route refreshes.
- `.nojekyll` is generated to avoid GitHub Pages processing issues.
