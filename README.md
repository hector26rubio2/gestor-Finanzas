# Finanzas Web — prototipo visual

Frontend Angular independiente de la aplicación legacy. El modo de ejecución se selecciona explícitamente en `public/config.js`:

```js
window.__FINANZAS_CONFIG__ = { mode: 'demo' };
// o
window.__FINANZAS_CONFIG__ = { mode: 'api', apiBaseUrl: 'https://su-api.onrender.com' };
```

El modo `demo` usa únicamente datos ficticios en memoria. El modo `api` consume la superficie `/api/v1`, envía la cookie de sesión, obtiene CSRF antes de cada escritura y nunca sustituye un fallo remoto por datos demo. El backend debe permitir mediante CORS el origen exacto del frontend y credenciales.

```powershell
pnpm install
pnpm start
pnpm build
pnpm test
pnpm lint
```

Perfiles demo: Valentina tiene todas las capacidades; Daniel permite comprobar navegación restringida. El conjunto de datos cubre septiembre de 2025 a agosto de 2026 y puede restaurarse desde Preferencias.

La sesión remota define las capacidades efectivas; el cliente carga solo los módulos autorizados. Los endpoints que todavía no existen siguen presentándose como prototipo sin escritura remota. Los componentes no consumen IPC o HTTP directamente.
