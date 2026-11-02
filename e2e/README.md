# Pruebas E2E reales

Playwright (`@playwright/test`) contra el API .NET y PostgreSQL reales, con Chrome del sistema. No hay datos simulados: la cuenta de prueba entra por el login por contraseña del API (solo en Development/Testing) y el `global-setup` le asigna el rol Propietario y siembra cuentas, tarjeta, categorías, personas y movimientos por API.

## Ejecutar

- `pnpm e2e:local`: recrea la base `finanzas_e2e_ci` en el contenedor `finanzas-postgres` (docker compose del API, puerto 5433), levanta el API con `dotnet run` y corre la suite con credenciales generadas al azar. El API se busca en `FINANZAS_API_DIR` (por defecto `../v2-api-finanzas`).
- `pnpm e2e`: solo la suite. Variables:
  - `API_BASE_URL` (por defecto `http://localhost:5198`) y `E2E_BASE_URL` (`http://localhost:4300`; Playwright levanta `pnpm start` si no responde, o define `E2E_SIN_SERVIDOR_WEB=1`).
  - `E2E_USER` y `E2E_PASSWORD`: cuenta con login por contraseña que además es `SuperAdmin:Email` del API.
  - `E2E_VIEWER_USER` y `E2E_VIEWER_PASSWORD` (opcionales): cuenta que queda con el rol Beta de solo lectura; sin ellas se omiten las pruebas de permisos.
  - `PLAYWRIGHT_CHROMIUM_EXECUTABLE`: ruta de Chrome; si falta se usa `channel: chrome`.

Los argumentos extra pasan a Playwright: `pnpm e2e -g "MOV-01"`.

## Carriles paralelos

Varias corridas locales a la vez sin chocar: cada una usa su propio web, API, base y carpetas. `E2E_CARRIL=<n>` (1 a 9) lo deriva todo; sin la variable todo queda como antes.

| Valor                        | Carril `n`                                        | Sin carril                         |
| ---------------------------- | ------------------------------------------------- | ---------------------------------- |
| Web (`ng serve`)             | `4300+n`                                          | 4300                               |
| API                          | `5199+n`                                          | 5198                               |
| Base                         | `finanzas_e2e_c<n>`                               | `finanzas_e2e_ci`                  |
| Estado, resultados e informe | `.estado-c<n>`, `resultados-c<n>`, `informe-c<n>` | `.estado`, `resultados`, `informe` |

Dos carriles a la vez, en dos terminales (o procesos de fondo):

```
E2E_CARRIL=1 pnpm e2e:local e2e/tests/01-sesion.spec.ts
E2E_CARRIL=2 pnpm e2e:local e2e/tests/02-navegacion.spec.ts
```

- Se pueden fijar sueltas y mandan sobre el carril: `E2E_WEB_PORT`, `API_BASE_URL`, `E2E_DB_NAME` (debe empezar por `finanzas_e2e`). `E2E_WEB_PORT` sin carril también aísla el web.
- Con carril, Playwright levanta `ng serve --port <web>` con `reuseExistingServer: false`: nunca reutiliza el servidor de otro worktree.
- El front lee la URL del API de un `config.js` que las pruebas interceptan, así que cada carril apunta a su API. `e2e:local` autoriza el origen web del carril en el CORS del API (`Security__AllowedReturnOrigins__0`).
- Si el puerto web o el del API ya está en uso, `e2e:local` falla con un mensaje claro antes de tocar nada.
- Dos carriles que comparten el mismo checkout del API compilan el mismo proyecto: arranca el segundo cuando el primero ya está respondiendo si ves errores de compilación por archivos bloqueados.
- La derivación está probada con `pnpm test:e2e-carril`.

## Qué cubre

- `01-sesion`: login, credenciales inválidas, ruta protegida, cierre de sesión.
- `02-navegacion`: atajos `g x`, paleta `Ctrl+K` y `/`, botón «Nuevo movimiento».
- `03-movimientos`: gasto, compra con tarjeta, ingreso, transferencia, recibida, avance, préstamos, crédito, pago de tarjeta, búsqueda, paginación, CSV, reclasificar y reversar.
- `04-catalogos`: cuenta, categoría, persona, inversión, recurrente, confirmar ocurrencia y presupuesto (solo API: el front aún no tiene pantalla).
- `05-secciones`: notificaciones, idioma, reportes, calendario, tablero, plan de planificación, reporte de error.
- `06-admin`: banderas, organizaciones y roles.
- `07-permisos`: cuenta Beta de solo lectura.
- `09-recorrido-visual`: 18 rutas en 390, 820 y 1440 px con axe (falla en serious/critical), sin desborde horizontal, sin errores de consola ni peticiones fallidas y sin objetivos táctiles menores de 24 px.

Toda prueba falla si aparece un error JS, un error de consola o una petición fallida (4xx/5xx) que ella no declare esperada con `vigilancia.aceptarErroresEsperados()`. Los avisos de consola y los hallazgos axe menores quedan como anotaciones en el informe HTML (`e2e/informe`).

## CI

`.github/workflows/e2e.yml` corre en cada PR y a mano. El repositorio del API es privado: el flujo lo descarga con el secreto `E2E_API_REPO_TOKEN` (token de acceso con permiso de lectura de contenido sobre `hector26rubio2/v2-api-finanzas`). Sin ese secreto el paso de checkout del API falla; los PR desde forks omiten el trabajo.
