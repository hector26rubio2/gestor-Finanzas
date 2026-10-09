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
