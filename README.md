# Finanzas Web

Front Angular 22 (standalone, zoneless, signals, Spartan UI) de la app de finanzas personales. Siempre trabaja contra la API real ([v2-api-finanzas](../v2-api-finanzas)) y su base PostgreSQL: no hay modo demo ni datos quemados.

## Requisitos

- Node 24 y pnpm 10.
- La API corriendo (local en `http://localhost:5198`, ver su README).

## Configuración

`public/config.js` solo dice dónde está la API:

```js
window.__FINANZAS_CONFIG__ = { apiBaseUrl: 'http://localhost:5198' };
```

En GitHub Pages el workflow `deploy.yml` escribe ese archivo con la variable de repositorio `API_BASE_URL`; si falta, el despliegue falla. La API debe permitir por CORS el origen exacto del front con credenciales.

## Comandos

| Comando | Qué hace |
|---|---|
| `pnpm install` | Instala dependencias |
| `pnpm start` | Servidor de desarrollo en `http://localhost:4300` |
| `pnpm build` | Build de producción (`dist/`) |
| `pnpm test` | Pruebas unitarias (Vitest vía `ng test`) |
| `pnpm lint` · `pnpm format:check` | ESLint y Prettier |
| `pnpm test:ui` | Capturas de las 11 rutas en 9 tamaños de pantalla contra una API simulada |
| `pnpm test:a11y` | Accesibilidad con axe (claro, oscuro, móvil) |
| `pnpm test:permisos` | Cada sección abre solo con su permiso |
| `pnpm diagramas estado` | Qué diagramas de `docs/diagramas` quedaron viejos |
| `pnpm diagramas atlas` | Reindexa GitNexus y regenera el portal `docs/diagramas/index.html` |

Las suites `test:ui`, `test:a11y` y `test:permisos` levantan `pnpm start` y una API simulada (`scripts/api-simulada.mjs` + `scripts/fixtures/`); no tocan la base real.

## Estructura

```
src/app/
  core/       sesión, API, estado global, i18n, routing, utilidades
  shared/     piezas reutilizadas por varias páginas (tablero, historia, gráficas, proyecciones…)
  features/   formularios y pestañas de dominio (cuentas, movimientos, planificación…)
  pages/      pantallas enrutadas (dashboard, admin, workspace…)
  ui/         componentes de interfaz sin lógica de negocio (Spartan helm + propios)
  testing/    utilidades de pruebas
```

- Imports con alias: `@core`, `@shared`, `@features`, `@pages`, `@ui`, `@testing`, `@app`. Nada de `../`.
- Cada carpeta tiene un barril `index.ts`. Se importa por barril solo desde una capa superior (`ui` < `core` < `shared` < `features` < `pages`); los archivos del arranque usan la ruta completa para no inflar el bundle inicial.
- Estado con signals: `AppStore` + comandos por dominio (`MovementCommands`, `CatalogCommands`, `PreferencesActions`); stores por pestaña en administración.

## Documentación

- Diagramas de arquitectura: `docs/diagramas/index.html` (portal) y `docs/diagramas/README.md`.
- Reglas para agentes (GitNexus, niveles de cambio, diagramas): `CLAUDE.md`.
