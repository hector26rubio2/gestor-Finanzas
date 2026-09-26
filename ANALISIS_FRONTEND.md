# Análisis Completo del Proyecto Gestor FinanzAS (Frontend Angular)

> Análisis realizado el **25-sep-2026** sobre `D:\estudio\finanzas\gestor-FinanzAS`,
> con el mismo método y estructura que [`ANALISIS_PROYECTO.md`](../v2-api-finanzas/ANALISIS_PROYECTO.md)
> del backend: cada hallazgo se verificó **leyendo el código y los tests existentes**
> antes de reportarlo, y se contrastó contra los contratos reales del backend
> (`Finanzas.Contracts`).

---

## 📋 Resumen del Proyecto

| Aspecto | Detalle |
| --- | --- |
| **Tipo** | SPA Angular 22.1 (standalone, signals, `strictTemplates`) frontend de `v2-api-finanzas` |
| **Gestor de paquetes** | pnpm 10.34.5 (`packageManager` fijado), Node `>=20.19 <25` |
| **TypeScript** | 6.0.3 con `strict` + `strictTemplates` (`tsconfig.json`) |
| **Estilos** | Tailwind 4 + Spartan (`@spartan-ng/brain`), componentes propios en `ui/` |
| **Pruebas** | Vitest 4 vía `ng test` (244 tests) + 3 suites E2E propias con Playwright/axe/Lighthouse |
| **Comandos** | `start`, `build`, `test`, `lint`, `format:check`, `test:ui`, `test:permisos`, `test:a11y` |
| **Despliegue** | GitHub Pages (`deploy.yml`) con `config.js` de runtime (`window.__FINANZAS_CONFIG__`) |
| **Modos de ejecución** | `demo` (datos locales) y `api` (backend real), decidido en `runtime.ts` |
| **Idiomas** | es / en / fr / pt, 1373 claves cada uno, cargados como chunks lazy |

**Verificación ejecutada en esta sesión** (todas las salidas reproducibles):

| Comando | Resultado | Duración |
| --- | --- | --- |
| `pnpm test` | ✅ **38 archivos, 244 tests, todos en verde** | 47,5 s (build 9,8 s + ejecución 23,4 s) |
| `pnpm build` | ✅ exit 0 — initial **664,14 kB** (warn 700 kB / error 1 MB) | 9,3 s |
| `pnpm lint` | ✅ exit 0, sin errores | 12,4 s |
| `pnpm format:check` | ✅ «All matched files use Prettier code style!» | 3,3 s |
| `pnpm test:ui` / `test:permisos` / `test:a11y` | ⚠️ **no ejecutadas** (Playwright + Chrome y >2 min) | — |

---

## ✅ FORTALEZAS DEL PROYECTO

### 1. **Arquitectura por capas bien separada**

```
src/app/
├── core/        http, api (un fichero por recurso), session, state, i18n, utils, telemetry
├── features/    pestañas y formularios (movements, accounts, people, reports…)
├── pages/       login, workspace, dashboard, admin, sin-seccion
├── shared/      servicios transversales (movements-book, url-state)
└── ui/          componentes de presentación puros (data-table, kpi, select…)
```

La separación **demo / API** está deliberadamente aislada: la vista (`DemoData`) se alimenta
o de `demo-data.ts` o de `remote-mappers.ts`, y las pantallas no saben de dónde viene el dato.
`api-routes.ts` centraliza las rutas y `api-client.ts` es la fachada que usan las páginas.

### 2. **Reactividad moderna y bien aplicada**

- Signals en el estado global (`store.ts`) y `computed()` para todo lo derivado.
- **64 de 71 componentes de código declaran `OnPush` (90 %)**; los 7 que faltan son
  subcomponentes de `movement-form` (ver B2).
- Solo **7 `.subscribe(` en toda la aplicación**, con `takeUntilDestroyed` en los puntos
  largos (`app.ts`, `remote-bootstrap.ts`).
- El sondeo, el foco y el canal `EventSource` se limpian en `destroyRef.onDestroy`
  (`remote-bootstrap.ts:52-57`): sin fugas de temporizadores.
- Guarda de carreras real en la paginación remota: `movementRequest`
  (`shared/movements/movements-book.service.ts:137-163`) descarta respuestas fuera de orden.

### 3. **Seguridad: el transporte está bien resuelto**

| Comprobación | Resultado |
| --- | --- |
| Token en `localStorage`/`sessionStorage` | ❌ No existe: sesión por **cookie httpOnly** + `withCredentials` |
| CSRF | ✅ Token en memoria, renovado solo ante `security.csrf_invalid` (`api-http-client.ts:82-96`), con `csrfInFlight` para no duplicar peticiones |
| `innerHTML` / `bypassSecurityTrust` / `eval` / `document.write` | ❌ **0 usos** en `.ts` y `.html` de `src/` |
| Guards de ruta | ✅ `canMatch` en `routes.ts:22-62` + `safeReturnPath` anti open-redirect (`return-url.ts`) |
| localStorage | Solo preferencias de UI (grupos del sidebar, tema, layout, reporte de bug), siempre con `try/catch` |
| sessionStorage | Solo el índice del perfil demo; se borra al cerrar sesión (`store.ts:235`, testeado en `cerrar-sesion.spec.ts`) |

### 4. **Contratos con el backend comprobados uno a uno**

- `ApiMoney { amount: string; currency: string }` = `MoneyDto` ✔
- `ApiAccountKind = { cash: 1, checking: 2, savings: 3, wallet: 4, other: 99 }` = `AccountKindDto` **con la serialización numérica correcta** ✔
- `MovementKind` / `EconomicEffect` / `CashFlow` / `MovementLink` declaran el espejo numérico ✔
- Rutas de `api-routes.ts` contrastadas con los endpoints del backend ✔
- `ApiDebtPosition` coincide con `DebtPositionDto` (una fila por persona) ✔

### 5. **Testing con una filosofía clara**

- **244 tests en verde** en 23 s; pruebas redactadas en español y centradas en *reglas de negocio*
  («la transferencia no es gasto», «el avance no es gasto», «no hay bucle de redirección»).
- Suites E2E propias: visual (`test:ui`), **permisos por sección** (`test:permisos`) y
  **accesibilidad con axe** (`test:a11y`).
- `permisos-vivos.spec.ts` fija en texto qué hace cada permiso; `rutas-sin-bucle.spec.ts`
  y `cerrar-sesion.spec.ts` cubren invariantes de seguridad.

### 6. **DevOps: nada llega a producción sin pasar las puertas**

`deploy.yml` ejecuta en **push a `main`**: `lint` → `format:check` → `test` → `test:ui` →
`test:permisos` → `test:a11y` → `ng build`, y solo entonces sube el artefacto a Pages.
Presupuestos de bundle en `angular.json` (700 kB warn / 1 MB error) y *timeouts* de 10-15 min
por suite E2E para que un cuelgue no consuma la máquina.

### 7. **Internacionalización sincronizada**

1373 claves **idénticas** en `es.ts`, `en.ts`, `fr.ts` y `pt.ts` (0 faltantes, 0 sobrantes,
verificado por script). Los cuatro idiomas se sirven como **chunks lazy** (~75-81 kB cada uno)
y no entran en el bundle inicial. Cero texto hardcodeado en las plantillas `.html` (0 acentos
fuera de `i18n.t(...)`).

### 8. **Documentación de intención**

Los comentarios explican el *porqué*, no el *qué*: la regla financiera de cada transferencia,
por qué un avance no es gasto (`store.ts:332-334`), por qué faltan campos en el mapeo
(`remote-mappers.ts:64-67`: «Un dato que falta se comunica; no se sustituye»), por qué
`returnRate` devuelve `null` en vez de `Infinity` (`money.ts:104-112`).

---

## 🐛 ERRORES Y PROBLEMAS ENCONTRADOS

### **CRÍTICOS**

> **Estado: 1 hallazgo CRÍTICO, abierto.** Es el único que recomiendo arreglar antes de
> cualquier otra cosa: pierde datos del usuario en silencio.

#### 1. 🔴 **La alta de movimiento en modo API descarta `links.category` y `links.counterparty`** — **ABIERTO**

```ts
// store.ts:387-403 (modo API, movimiento suelto)
const created = await firstValueFrom(
  this.injector.get(FinanceApiClient).createMovement({
    date: input.date,
    kind: ..., effect: ..., flow: ...,
    amount: { ... },
    links: isCard ? { card: input.accountId } : { account: input.accountId },  // ← aquí
    rate: ..., description: input.description, idempotencyKey: crypto.randomUUID(),
    purchaseApr: ...,
  }),
);
const movement: Movement = {
  ...
  category: input.category,          // store.ts:411 ← solo en la copia local
  person: input.person,              // store.ts:415 ← solo en la copia local
  ownership: input.person ? 'loaned' : (input.ownership ?? 'own'),
  recurring: input.recurring === true || input.recurring === 'true',
  loanRole: input.loanRole,
  loanProduct: input.loanProduct,
};
```

**Lo que ocurre**: el formulario sí recoge categoría y persona, y la copia optimista que se
inserta en la lista **sí las muestra** (`store.ts:411,415`). Pero el cuerpo del `POST` solo
envía `account` o `card`. El backend sí acepta esos enlaces:

```csharp
// v2-api-finanzas/src/Finanzas.Contracts/Ledger/MovementRequests.cs:33-44
public sealed record CreateMovementRequest(
    DateOnly Date, MovementKindDto Kind, EconomicEffectDto Effect, CashFlowDto Flow,
    MoneyDto Amount, MovementLinksDto Links, ...);   // Links acepta Category y Counterparty

// MovementDto.cs:18,20
public Guid? Category { get; init; }
public Guid? Counterparty { get; init; }
```

Al recargar, el mapper vuelve a leer la categoría y la persona **desde la respuesta del
servidor**:

```ts
// remote-mappers.ts:118,122-123
category: source.linkNames['category']?.name ?? i18n.t('movements.fallback.noCategory'),
person: source.linkNames['counterparty']?.name,
ownership: source.links['counterparty'] ? 'loaned' : 'own',
```

⇒ **el movimiento reaparece «Sin categoría» y sin persona.**

**Por qué es crítico y no solo alto**: no se puede recuperar desde la UI. La rama de edición
en modo API solo reclasifica categoría y descripción:

```ts
// store.ts:306-314
if (input.id) {
  const updated = await firstValueFrom(client.reclassifyMovement(input.id, {
    category: category?.id ?? null,
    description: input.description || null,
  }));
```

`ReclassifyMovementRequest` solo admite `(Guid? Category, string? Description)`
(`MovementRequests.cs:102`): la contraparte, la recurrencia y los datos de préstamo
(`recurring`, `loanRole`, `loanProduct`, `ownership`) se pierden **sin forma de volver a
asignarlos** por la interfaz. Además, `people-tab` y los informes de categoría dejan de
contar ese movimiento.

**Cobertura de tests**: ninguna. `store.spec.ts` tiene 14 tests, todos en **modo demo**
(«creates both balanced legs for a transfer», «keeps the chosen loan product…»), y ninguno
inspecciona el payload enviado a la API. `remote-bootstrap.spec.ts` solo usa
`links: { card: 'c1' }` como entrada de un mapper. **Este hueco no está cubierto.**

**Riesgo**: **CRÍTICO** — pérdida silenciosa de datos clasificables en producción, en la
operación más frecuente de la aplicación (registrar un gasto con categoría).

**Solución** (ver también §Sugerencias):

```ts
const category = this.categories().find((c) => c.name === input.category);
const person = this.data().people.find((p) => p.name === input.person);
links: {
  ...(isCard ? { card: input.accountId } : { account: input.accountId }),
  ...(category ? { category: category.id } : {}),
  ...(person ? { counterparty: person.id } : {}),
},
```

…y reconstruir la copia optimista desde `created.linkNames` en vez de desde `input`.

---

### **ALTOS**

#### 2. 🟠 **La moneda base está hardcodeada a COP y `GET /api/v1/currencies` nadie lo consume** — **ABIERTO**

```ts
// core/utils/money.ts:13,16
export const BASE_CURRENCY = 'COP';
const DECIMALS_BY_CURRENCY: Readonly<Record<string, number>> = { COP: 0, USD: 2, EUR: 2 };
```

```ts
// core/state/store.ts:180-182 — toda etiqueta monetaria de la UI
money(value: number, currency = BASE_CURRENCY) {
  return formatAmount(value, currency, this.preferences().locale);
}
```

Cadena completa del problema, verificada punto por punto:

| Pieza | Situación |
| --- | --- |
| `money.ts:13` | `BASE_CURRENCY = 'COP'` constante de compilación |
| `money.ts:16` | Tabla de decimales de 3 monedas; `decimalsFor()` devuelve **2** para cualquier otra (`money.ts:27`): JPY, KRW, CLP se pintan con centavos que no existen |
| `store.ts:180` | `money()` etiqueta **siempre** con `BASE_CURRENCY`, aunque la cuenta u organización estén en otra moneda |
| `store.ts:271` | `persistPreferences` envía `baseCurrency: 'COP'` fijo |
| `remote-bootstrap.ts:239` | `const organization = { id, name }` — **descarta `session.organization.baseCurrency`** que el backend sí envía |
| `permissions.ts:21` | Existe el permiso `sesion.monedas.listar` y **no hay una sola llamada** a `/api/v1/currencies` en `src/` |
| `organizations-tab.ts:173,199` | El admin crea organizaciones con un `<input maxlength="3">` libre (default `COP`), sin catálogo ni validación |

El backend sí usa `organization.BaseCurrency` (`LedgerReadStore.cs:36` y `PeopleReadStore.cs`,
corregidos en el análisis del backend), así que **la organización puede no ser COP**.

**Efecto observable**: organización con base `USD` → el backend devuelve importes en USD,
y la UI los etiqueta **«COP»** con 0 decimales (`store.money()`), o redondea centavos a
enteros porque `sumBy` usa la moneda por defecto:

```ts
// money.ts:98-102 — currency por defecto = BASE_CURRENCY = COP (0 decimales)
export function sumBy<T>(items, selector, currency = BASE_CURRENCY) {
  for (const item of items) total += minorOf(selector(item), currency);  // money.ts:63: Math.round(v * 10**0)
}
```

Sumar importes USD con esa ruta descarta los centavos de cada ítem. Hoy las llamadas
existentes pasan importes de moneda base, así que **el fallo es latente, no activo**, pero la
trampa está servida: cualquier `sumBy` sobre un importe en moneda ajena redondea en silencio.

**Cobertura de tests**: `money.spec.ts` cubre solo COP/USD/EUR (12 tests). No hay ningún test
que fije «la moneda base viene del servidor».

**Riesgo**: **ALTO** — etiquetas de moneda incorrectas y escala decimal incorrecta en
cualquier organización que no sea COP; incoherencia garantizada con el backend.

**Solución**: consumir `GET /api/v1/currencies` + `organization.baseCurrency` en una señal
`baseCurrency()` del store, y que `money()`, `sumBy()` y `decimalsFor()` cuelguen de ella
(ver §Sugerencias).

---

#### 3. 🟠 **Un 401 durante el refresco de sesión no cierra la sesión: la UI queda «logueada» con datos obsoletos** — **ABIERTO**

```ts
// core/session/remote-bootstrap.ts:259-287  (refresco cada 60 s y al recuperar el foco)
private async cargarSesion(): Promise<void> {
  ...
  try {
    const [session, flags] = await firstValueFrom(forkJoin([this.api.session(), this.api.featureFlags()]));
    ...
  } catch {
    /* los errores transitorios se ignoran; el próximo ciclo reintenta */   // ← línea 283-284
  }
}
```

El único sitio que trata el 401 es la carga inicial:

```ts
// remote-bootstrap.ts:114-120
if (error instanceof ApiRequestError && error.status === 401) {
  this.store.remoteError.set(authError ?? '');
  this.store.user.set(null);
  this.store.remoteState.set(authError ? 'error' : 'anonymous');   // el guard manda al login
  return;
}
```

**Lo que ocurre**: el backend exige sesión autenticada (`Security.cs:225`, *fallback policy*
`RequireAuthenticatedUser` → 401). Expirada la cookie:

1. `pollSession()` (cada 60 s, `remote-bootstrap.ts:49`) y el evento `permisos` del
   `EventSource` (`:324-326`) llaman a `cargarSesion()`;
2. el 401 cae en el `catch` vacío de la línea 283;
3. `remoteState` sigue en `'ready'`, `user()` sigue poblado ⇒ **el guard deja pasar y la
   pantalla sigue mostrando datos de hace una hora**;
4. cualquier escritura posterior devuelve 401 y se muestra como un error genérico de la
   acción, sin volver al login.

No hay interceptor global de 401 en `api-http-client.ts` (verificado: los únicos `=== 401`
del proyecto están en `remote-bootstrap.ts` y en specs).

**Cobertura de tests**: `remote-bootstrap.spec.ts:414,437` y `permissions.spec.ts:131`
cubren el 401 **solo en `initialize()`**. Ninguna prueba cubre un 401 dentro del refresco.

**Riesgo**: **ALTO** — sesión caducada no detectada, datos financieros obsoletos presentados
como vigentes y escrituras fallidas sin explicación.

**Solución**: distinguir el 401 en ese `catch` y pasar a `anonymous` (código en
§Sugerencias). `ApiRequestError` ya transporta el `status`, así que el cambio es de 5 líneas
y un test nuevo.

---

### **MEDIOS**

#### 4. 🟡 **KPIs de la pestaña Movimientos calculados sobre la página cargada (25 filas)**

```html
<!-- features/movements/movements-tab.html:84,91,97 -->
[value]="store.money(store.income())"    <!-- store.ts:148-153 -->
[value]="store.money(store.expense())"   <!-- store.ts:154-159 -->
[value]="store.movements().length.toString()"
```

`store.income()`/`expense()` suman `store.movements()`, que en modo API es **la página
actual** (`remoteMovementSize = signal(25)`, `store.ts:82`; sustituida en cada
`loadMovementPage`). El KPI de registros lleva la pista «Confirmados y pendientes»
(`es.ts:398`), que sugiere el total completo y no «la página cargada».

El dashboard sí lo hace bien: usa la API de reporting salvo que haya filtros locales, y lo
documenta explícitamente (`dashboard.ts:524-544` y el comentario de `:546-556`).

**Riesgo**: **MEDIO** — infracuenta ingresos/gastos en la pestaña más usada.
**Solución**: pedir totales al reporting con los mismos filtros (como el dashboard) o etiquetar
«de la página cargada».

#### 5. 🟡 **La regla de «suma exacta» de `money.ts` se incumple en 15 sitios**

`money.ts:97-98` documenta: *«Suma exacta: acumula en unidades menores… **Reemplaza a `reduce`
sobre importes**»*. Aun así hay `reduce` sobre dinero en:

| Fichero:línea | Qué suma |
| --- | --- |
| `features/people/people-tab.ts:53,54` | Totales de deuda por persona |
| `features/portfolio/portfolio-tab.ts:44,45,49,50` | Valor y coste de la cartera |
| `features/planning/planning-tab.ts:68` | Valor de inversiones |
| `features/reports/reports-tab.ts:61,67,103,132` | Totales de ingreso/gasto y por categoría |
| `pages/dashboard/dashboard-kpis.ts:120,128,134,138` | Disponible, deuda, cupos, gastos |
| `pages/workspace/inspector/inspector.ts:62,99,102` | Compras de tarjeta y cuotas |
| `core/state/demo-data.ts:290` | `accountBalance()` (los saldos de todas las cuentas) |

Además, en `people-tab.ts:55-60` `slowestPayer` elige la persona con más días de pago **entre
las cargadas**, no entre todas: en modo API el orden del backend decide quién aparece como
«paga más lento».

**Riesgo**: **MEDIO** — pérdida de precisión potencial (derrumbe de centavos en monedas de
2 decimales) y vulneración de un invariante documentado del propio módulo. Con COP (0
decimales) hoy no se manifiesta.
**Solución**: `sumBy(...)` en todos ellos + un test que fije la regla.

#### 6. 🟡 **5 tipos de cuenta del backend se colapsan en 3 tipos de vista**

```ts
// core/session/remote-mappers.ts:42
type: account.kind === ApiAccountKind.cash ? ('cash' as const) : ('savings' as const),
```

`AccountKindDto` tiene `Cash=1, Checking=2, Savings=3, Wallet=4, Other=99`, pero la vista solo
conoce `cash | savings | credit`: una cuenta **corriente**, **billetera** u **otra** se
muestra, se etiqueta («Cuenta de ahorro») y se filtra como «Ahorros», y decide qué KPI la
agrupa (`dashboard-kpis.ts:119`). En el sentido inverso, la creación solo sabe escribir dos
valores:

```ts
// core/state/store.ts:541
const accountRequest = { name, kind: type === 'cash' ? 1 : 3, currency, lastFour: '0000' };
```

**Riesgo**: **MEDIO** — clasificación y etiquetado incorrectos de cuentas legítimas del backend.
**Solución**: ampliar el tipo de vista a los 5 valores (o mapear `checking/wallet/other` a un
tipo explícito «otro») y propagar el `kind` en la creación.

#### 7. 🟡 **Los requests salen tipados como `unknown`: un cambio de contrato no compila**

```ts
// core/api/ledger.api.ts:71,91,95
createMovement(request: unknown) { ... }
createTransfer(request: unknown) { ... }
createCardPayment(request: unknown) { ... }
// core/api/api-client.ts:164-166
createMovement(request: unknown) { return this.ledgerApi.createMovement(request); }
```

Es exactamente el punto por el que habría pasado el problema del hallazgo 1 sin que
TypeScript dijera nada: `links` se construye a mano y nadie verifica que coincida con
`CreateMovementRequest`. El resto de endpoints sí tipa su respuesta (`ApiPage<ApiMovement>`).

**Riesgo**: **MEDIO** — los errores de contrato se descubren en producción, no en build.

#### 8. 🟡 **El transporte HTTP no tiene timeout ni reintento general**

`api-http-client.ts` reintenta **solo** el token CSRF (líneas 82-96) y no pone límite de
tiempo a ninguna petición. Una llamada que no responde deja la acción bloqueada en el estado
«cargando» de `AsyncActionService` (`async-action.service.ts:26-43`) de forma indefinida.
Tampoco hay manejo global de 409 (conflicto de concurrencia) ni de 401 (hallazgo 3).

**Riesgo**: **MEDIO** — UX de fallo silencioso en redes inestables.
**Nota de honestidad**: ya existe reintento y renovación del CSRF, y el 403 sin código se
traduce a `errors.forbidden`; **esos comportamientos están testeados** (`api-client.spec.ts`)
y no se reportan como problema.

#### 9. 🟡 **`store.ts` (747 líneas) y `admin.store.ts` (666) concentran demasiado**

- Mezcla deliberada de datos demo y llamadas API en la misma clase (10 `injector.get(FinanceApiClient)`
  perezosos repartidos por el fichero: `store.ts:266,310,337,345,388,499,634,662,683,731`).
- El toast se simula **parcheando `signal.set`**:

```ts
// core/state/store.ts:100-108
readonly toast = (() => {
  const message = signal('');
  const write = message.set.bind(message);
  message.set = (value: string) => {          // ← monkey-patch sobre la API del signal
    if (value) void notifier().then((sonner) => sonner(value));
    write(value);
  };
  return message;
})();
```

Funciona y está comentado, pero cualquier cambio futuro de Angular sobre `WritableSignal`
lo rompe en tiempo de ejecución, sin error de tipos.

**Riesgo**: **MEDIO** — deuda de mantenimiento en el fichero más editado del proyecto.

#### 10. 🟡 **Mensajes de validación hardcodeados en español, fuera del i18n**

12 `throw new Error('…')` con texto en español en el código propio, de los cuales **7 son
validaciones de usuario** en `store.ts`. Esos mensajes sí llegan a la pantalla tal cual:
`movement-form.ts:227` hace `error: (error) => error instanceof Error ? error.message : …`
y `:230` pinta `e.message` en el error del formulario:

```
store.ts:299  'Introduce un importe positivo.'
store.ts:300  'Selecciona una cuenta válida.'
store.ts:305  'Selecciona una cuenta destino diferente.'
store.ts:328  'Selecciona una cuenta válida.'
store.ts:498  'El saldo inicial remoto debe ser cero o positivo.'
store.ts:501  'Introduce un cupo válido para la tarjeta.'
store.ts:729  'Selecciona una cuenta válida.'
remote-bootstrap.ts:83  'La sesión no trae permisos. Pide a quien administre…'
```

(Los otros 5 `throw` — `runtime.ts:16,18,22` y `shared-api-types.ts:59,62` — son mensajes de
configuración/desarrollo y sí pueden quedarse en español.)

Lo llamativo es que **el propio formulario ya lo hace bien**: `movement-form.ts:205-223`
lanza sus validaciones con `this.i18n.t('form.movement.error.*')`. Solo `store.ts` no sigue
el patrón, y en en/fr/pt el usuario ve español.

**Riesgo**: **MEDIO** (i18n) — incoherencia visible en 3 de los 4 idiomas.

---

### **BAJOS**

| # | Hallazgo | Evidencia |
| --- | --- | --- |
| **B1** | El CI solo corre en `pull_request` (`ci.yml`) y en `push` a `main` (`deploy.yml`): **un push a una rama que no abre PR no se verifica** (lint, tests, build) | `.github/workflows/ci.yml`, `deploy.yml:3-6` |
| **B2** | **7 componentes sin `OnPush`**, todos subcomponentes de `movement-form` (`category-field`, `core-fields`, `currency-fields`, `installment-fields`, `kind-selector`, `loan-fields`, `recurrence-fields`): detección de cambios por defecto en el árbol del formulario, el componente más pesado | verificados uno a uno |
| **B3** | Fechas de datos demo hardcodeadas en código de producción: `'2026-08-18'`, `'2026-08-31'` y `dayMoves()` construye `2026-08-…` | `store.ts:133,162,191,612` |
| **B4** | Chunk perezoso de **717,42 kB** (202 kB transferidos), por encima del presupuesto de 700 kB; no dispara el *budget* porque `angular.json` solo mide los iniciales (664 kB) | salida de `pnpm build` |
| **B5** | `ApiMovementSummary`, `MovementRepository` y `MOVEMENT_REPOSITORY` están **declarados y exportados pero sin usar**, y su contrato no coincide con el real (`occurredOn`/`money`/`kind: string` frente a `date`/`amount`/enum numérico): código muerto que engaña a quien lo lea | `shared-api-types.ts:27-55`; solo re-exportado en `api-client.ts:27,32,35` |
| **B6** | 125 de 153 ficheros de código no tienen spec propio (28 sí). La cobertura *por comportamiento* es buena (244 tests), pero los specs se concentran en `core/` | conteo propio |
| **B7** | Un único `as any` y está en el punto que salva el formulario: `{ ...this.model, kind } as any` anula `strictTemplates` ahí justo | `features/movement-form/movement-form.ts:224` |
| **B8** | El formulario de organización no valida la moneda (solo `maxlength="3"` ni siquiera letras) | `organizations-tab.ts:173` |

---

## 📊 MÉTRICAS DE CALIDAD

### Código

| Métrica | Valor |
| --- | --- |
| Ficheros `.ts` propios (sin `ui/helm/` vendorizado) | **191** (153 código + 38 specs) |
| Líneas TypeScript propias | **22.661** de código + **3.490** de specs |
| Ficheros vendorizados `ui/helm/` (Spartan) | 268 |
| Plantillas `.html` propias | 37 |
| Componentes `@Component` en código | **71** (64 con `OnPush` = 90 %); +6 componentes de prueba en specs |
| `as any` | **1** |
| `eslint-disable` | 0 en código propio (1 en `ui/helm/utils/.../hlm.ts`, vendorizado) |
| `.subscribe(` en aplicación | **7** |
| `innerHTML` / `bypassSecurityTrust` / `eval` / `document.write` | **0** |
| `TODO`/`FIXME` reales | 0 (los 50 cruces del grep son la palabra «Todos» en español) |
| `localStorage` / `sessionStorage` | 14 / 7 (solo UI y perfil demo) |

### Pruebas

| Métrica | Valor |
| --- | --- |
| Archivos spec | **38** |
| Tests | **244** — ✅ todos en verde |
| Duración completa `pnpm test` | 47,5 s |
| Suites E2E (no ejecutadas aquí) | `test:ui` (visual), `test:permisos` (1 permiso por sección), `test:a11y` (axe) |
| Specs en `core/` (dónde está la lógica) | 20 de 38 |

### Bundle (`pnpm build`, exit 0)

| Métrica | Valor |
| --- | --- |
| Initial total | **664,14 kB** (155,45 kB transferidos) |
| Presupuesto | warn 700 kB / error 1 MB (`angular.json:28-30`) |
| Mayor chunk perezoso | 717,42 kB (202,25 kB transfer) |
| Chunks de idioma | es 78,38 / en 75,63 / fr 81,20 / pt 78,85 kB — **lazy** |
| Chunks con nombre (rutas e idiomas) | dashboard, admin, workspace, bug-report, es, en, fr, pt (+44 chunks lazy más) |

### i18n

| Métrica | Valor |
| --- | --- |
| Claves por idioma | **1373 / 1373 / 1373 / 1373** |
| Faltantes o sobrantes frente a `es` | **0 / 0 / 0** |
| Placeholders `{}` consistentes | 1189 de 1373 claves parseadas por mi script (184 no parseables por comillas dobles o multilinea en el fuente — ver limitaciones) |
| Texto hardcodeado en `.html` | 0 |
| Mensajes de `throw new Error` fuera del i18n | 12 en total, **7 de usuario** en `store.ts` (hallazgo 10) |

---

## 🔧 SUGERENCIAS DE MEJORA PRIORITARIAS

### **Prioridad Crítica** — antes de la próxima release

**1. Enviar `category` y `counterparty` en el alta de movimiento (hallazgo 1)**

```ts
// store.ts, rama de creación en modo API
const account = this.account(input.accountId);
if (!account) throw new Error('Selecciona una cuenta válida.');
const isCard = account.type === 'credit';
const categoria = this.categories().find((c) => c.name === input.category);
const persona = this.data().people.find((p) => p.name === input.person);

const created = await firstValueFrom(client.createMovement({
  ...,
  links: {
    ...(isCard ? { card: input.accountId } : { account: input.accountId }),
    ...(categoria ? { category: categoria.id } : {}),
    ...(persona ? { counterparty: persona.id } : {}),
  },
}));

// y la copia optimista nace de la respuesta, no del formulario:
const movement: Movement = {
  id: created.id,
  date: created.date,
  description: created.description ?? input.description,
  accountId: input.accountId,
  category: created.linkNames['category']?.name ?? input.category,
  person: created.linkNames['counterparty']?.name ?? input.person,
  ownership: created.links['counterparty'] ? 'loaned' : 'own',
  ...
};
```

**Test nuevo mínimo** (vitest, modo API): guardar un gasto con categoría y persona, y afirmar
que el objeto pasado a `createMovement` lleva `links.category` y `links.counterparty`.

**2. Detectar el 401 en el refresco de sesión (hallazgo 3)**

```ts
// remote-bootstrap.ts:283
} catch (error) {
  if (error instanceof ApiRequestError && error.status === 401) {
    this.store.user.set(null);
    this.store.remoteState.set('anonymous');   // el guard existente manda al login
    return;
  }
  /* los errores transitorios se ignoran; el próximo ciclo reintenta */
}
```

Con test: `api.session()` devuelve 401 tras una sesión cargada ⇒ `remoteState === 'anonymous'`.

### **Prioridad Alta**

**3. Moneda base vía servidor (hallazgo 2)**

```ts
// core/state/store.ts
readonly baseCurrency = signal(BASE_CURRENCY);            // fallback mientras no hay sesión
readonly decimalsByCurrency = signal<Record<string, number>>({});

// remote-bootstrap.ts, dentro de aplicarSesion():
const base = session.organization.baseCurrency;
if (base) this.store.baseCurrency.set(base);

// y al cargar el catálogo:
this.api.currencies().subscribe((list) =>
  this.store.decimalsByCurrency.set(Object.fromEntries(list.map((c) => [c.code, c.decimals]))),
);

money(value: number, currency = this.baseCurrency()) { ... }
```

Con `decimalsFor()` leyendo esa señal (o recibiéndola por parámetro) en lugar de la tabla
fija de `money.ts:16`, y validando el input de moneda del formulario de organización contra
el catálogo (`organizations-tab.ts:173`).

**4. Tipo explícito para los requests del ledger (hallazgo 7)**

```ts
// core/api/ledger.api.ts
export interface CreateMovementBody {
  date: string;
  kind: MovementKind;
  effect: EconomicEffect;
  flow: CashFlow;
  amount: ApiMoney;
  links: { account?: string; card?: string; category?: string; counterparty?: string };
  rate?: string;
  rateAsOf?: string;
  description?: string;
  idempotencyKey: string;
  purchaseApr?: number;
}
createMovement(request: CreateMovementBody) { ... }
```

Con esto, el hallazgo 1 **no habría podido llegar a producción**: `links` deja de ser libre.

### **Prioridad Media**

**5. Totales de la pestaña Movimientos desde la API de reporting (hallazgo 4)** — mismo
patrón que `dashboard.ts:524-544` (`remoteAplicable()` → servidor; con filtros locales →
cálculo local, documentado).

**6. Reemplazar los `reduce` sobre importes por `sumBy` (hallazgo 5)** y corregir
`slowestPayer` para que, en modo API, use el endpoint de posiciones de deuda completo.

**7. Extracción de `store.ts`**: separar `demo-store` / `api-store` y sustituir el
monkey-patch del toast por un `linkedSignal` o un `effect` (`store.ts:100-108`).

**8. Timeouts en el transporte (hallazgo 8)**:

```ts
// core/http/api-http-client.ts — en cada request
this.http.request(method, url, { ..., timeout: 30_000 })
```

**9. Pasar los 7 mensajes de validación de `store.ts` por i18n (hallazgo 10)**, siguiendo el
patrón que `movement-form.ts:205-223` ya usa (`this.i18n.t('form.movement.error.*')`).

**10. OnPush en los 7 subcomponentes de `movement-form` (hallazgo B2)**.

---

## 📝 NOTAS ADICIONALES

### Hallazgos descartados tras leer los tests (no son problemas)

| Sospecha inicial | Por qué se descarta |
| --- | --- |
| CSRF: renovación y reintentos | `api-client.spec.ts` cubre reuso, renovación, «no reintentar en 403», 401 y 403 → comportamiento correcto y fijado. (El **timeout general** del transporte sí se reporta aparte, hallazgo 8) |
| Sin manejo de 401/403 | El transporte los convierte en `ApiRequestError` con `status` y hay tests; el 403 sin código muestra `errors.forbidden`. **Solo** el 401 del refresco queda sin cubrir (hallazgo 3) |
| Posible open redirect en `returnUrl` | `return-url.spec.ts` + `rutas-sin-bucle.spec.ts` (9 tests) lo cubren |
| Token en `localStorage` | No hay token: cookie httpOnly + CSRF en memoria |
| XSS por `innerHTML` | **0 usos** en `.ts` y `.html` |
| i18n desincronizado es/en/fr/pt | 1373 claves idénticas, 0 faltantes |
| Enums como cadenas vs. números | Los tipos espejo (`ApiAccountKind`, `MovementKind`, `EconomicEffect`, `CashFlow`) declaran **números**; `ApiMovementSummary` declara `string` pero está sin usar (degradado a hallazgo B5 por ser código muerto, no bug activo) |
| `ApiDebtPosition` vs `DebtPositionDto` | Coinciden, incluida la convención de una fila por persona |
| Rutas de `api-routes.ts` desalineadas | Verificadas una a una contra los endpoints del backend |
| `== null` como error tipado | Idiomático (`?? null` / comprobación de ausencia), 3 usos, correcto |
| Carreras en la paginación remota | `movements-book.service.ts:137-163` tiene guarda explícita `movementRequest` |
| Fugas de `setInterval`/`EventSource` | Limpiados en `destroyRef.onDestroy` (`remote-bootstrap.ts:52-57`) |
| Presupuesto de bundle desbordado | 664 kB < 700 kB de warn |

### Aspectos a monitorear

- **Cobertura por fichero**: 125/153 ficheros sin spec propio. Va bien por *regla de
  negocio*, pero los puntos de integración (payloads a la API) son justo donde falló el
  hallazgo 1.
- **Duplicación demo/API**: mientras `store.ts` siga contando las dos historias, cada campo
  nuevo tiene que escribirse dos veces — así nació el bug de la categoría.
- **Modo demo con datos congelados en 2026-08**: cualquier test o captura que dependa de
  «hoy» se romperá con el tiempo (hallazgo B3).
- **`ui/helm/` vendorizado** (268 ficheros): está fuera del alcance de lint/prettier propios
  y no debe tocarse a mano.

### Aspectos muy bien hechos

- Comentarios que documentan **reglas financieras**, no código: «mover dinero propio nunca es
  ingreso ni gasto», «el avance usa el mismo endpoint que la transferencia».
- `returnRate` devolviendo `null` en vez de `NaN`/`Infinity` con la razón escrita.
- `remote-mappers.ts:64-67`: deja **ausentes** los campos que la API no expone en vez de
  inventar valores plausibles («Un dato que falta se comunica; no se sustituye») — exactamente
  el criterio correcto para datos financieros.
- `permisos-por-seccion.mjs`: un test E2E que fija que **un permiso por sección basta para
  entrar y ver algo**, para que un permiso fino no cierre la puerta por accidente.
- Presupuestos de bundle y *timeouts* por suite E2E en CI.

---

## 🏗️ DIAGRAMA DE ARQUITECTURA

```
┌──────────────────────────────────────────────────────────────────────────┐
│                                 routes.ts                                │
│        canMatch [authGuard] + safeReturnPath  →  login / workspace       │
└──────────────────────────────────────────────────────────────────────────┘
                 │
   ┌─────────────┴──────────────┐
   │        AppStore            │  store.ts (747 líneas, signals)
   │  data · user · session ·   │◄──────────────┬────────────────────────┐
   │  permissions · prefs · KPI │               │                        │
   └─────────────┬──────────────┘        demo-data.ts            remote-mappers.ts
                 │                       (datos locales)        (API → vista)
   ┌─────────────┴──────────────────────────────────────────────────────┐
   │                    features/  ·  pages/  ·  shared/                │
   │  movements  accounts  people  reports  calendar  dashboard  admin  │
   └─────────────┬──────────────────────────────────────────────────────┘
                 │  (solo a través de FinanceApiClient)
   ┌─────────────┴──────────────┐      ┌────────────────────────────────┐
   │   core/api/*  (1 recurso   │      │  core/session/remote-bootstrap │
   │   por fichero + rutas)     │◄────►│  initialize · poll 60 s ·      │
   └─────────────┬──────────────┘      │  EventSource «permisos» ·      │
                 │                     │  guards de 401 (solo init)     │
   ┌─────────────┴──────────────┐      └────────────────────────────────┘
   │  core/http/api-http-client │
   │  cookie httpOnly + CSRF    │────►  GET/POST /api/v1/**  (v2-api-finanzas)
   │  en memoria, sin timeout   │
   └────────────────────────────┘

   core/i18n (es·en·fr·pt, 1373 claves, chunks lazy)   core/state/url-state
   core/utils/money (exacto, unidades menores)          core/telemetry/error-reporter
```

---

## 📌 CONCLUSIÓN

**El frontend es sólido**: arquitectura clara, reactivo y con OnPush mayoritario, seguridad
del transporte bien resuelta (cookie + CSRF en memoria, cero `innerHTML`, guards con
anti-open-redirect), i18n sincronizada al 100 % en 4 idiomas, 244 tests en verde en 47 s,
lint y formato limpios, y un CI que no deja desplegar nada sin pasar 6 suites.

**Los 10 hallazgos principales (más el bloque de 8 hallazgos bajos):**

| # | Hallazgo | Severidad | Estado |
| --- | --- | --- | --- |
| 1 | El alta de movimiento no envía `links.category` / `counterparty` (pérdida silenciosa) | 🔴 CRÍTICO | Abierto |
| 2 | Moneda base hardcodeada a COP; `/currencies` sin consumir | 🟠 ALTO | Abierto |
| 3 | 401 en el refresco no cierra la sesión (UI obsoleta) | 🟠 ALTO | Abierto |
| 4 | KPIs de Movimientos sobre la página cargada (25) | 🟡 MEDIO | Abierto |
| 5 | 15 `reduce` sobre importes donde `money.ts` exige `sumBy`; `slowestPayer` arbitrario | 🟡 MEDIO | Abierto |
| 6 | 5 `AccountKindDto` → 3 tipos de vista; creación solo escribe 1 ó 3 | 🟡 MEDIO | Abierto |
| 7 | Requests del ledger tipados como `unknown` | 🟡 MEDIO | Abierto |
| 8 | Transporte sin timeout ni reintento general | 🟡 MEDIO | Abierto |
| 9 | `store.ts` (747) + `admin.store.ts` (666); toast por monkey-patch | 🟡 MEDIO | Abierto |
| 10 | 7 mensajes de validación de usuario fuera del i18n (12 `throw` en total) | 🟡 MEDIO | Abierto |
| B1-B8 | CI por rama, OnPush, fechas demo, chunk de 717 kB, tipos muertos, cobertura por fichero, `as any`, validación de moneda | 🔵 BAJO | Abierto |

**Orden de ataque recomendado**: 1 → 3 → 2 → 7 (el 7 evita que el 1 vuelva a ocurrir) →
4/5/6 → 8/9/10 → B*.

Ninguno de ellos está cubierto hoy por los tests existentes: todos requieren pruebas nuevas,
y en los casos 1 y 3 son pruebas que habrían fallado con el código actual.

---

## 📁 MÉTODO, FICHEROS LEÍDOS Y LIMITACIONES

### Comandos ejecutados

`pnpm test` (47,5 s, ✅ 244/244) · `pnpm build` (9,3 s, ✅ exit 0) · `pnpm lint` (12,4 s, ✅) ·
`pnpm format:check` (3,3 s, ✅) · contadores propios de PowerShell/Node para líneas,
componentes, `OnPush`, claves i18n y patrones de seguridad.

### Ficheros del frontend leídos (más relevantes)

**Núcleo**: `core/state/store.ts` (747), `core/state/store.spec.ts`, `core/state/demo-data.ts`,
`core/utils/money.ts` (+ `money.spec.ts`), `core/http/api-http-client.ts`,
`core/session/remote-bootstrap.ts` (351, completo) + `remote-bootstrap.spec.ts`,
`core/session/remote-mappers.ts`, `core/session/remote-slices.ts`, `core/session/permissions.ts`
(+ specs), `core/session/return-url.ts` (+ spec), `core/session/runtime.ts`,
`core/state/url-state.ts`, `core/state/rendimiento.spec.ts`, `core/utils/async-action.service.ts`,
`core/telemetry/error-reporter.ts`, `core/i18n/{es,en,fr,pt}.ts` + `i18n.service.ts`.

**API**: `core/api/{api-routes,api-client,ledger,accounts,session,preferences,reporting,people,
administration,cards,categories,shared-api-types}.api.ts` + `api-client.spec.ts`.

**UI/Funciones**: `app.ts`, `routes.ts`, `features/movements/{movements-tab.ts,.html}`,
`features/movement-form/movement-form.ts`, `features/people/people-tab.ts`,
`shared/movements/movements-book.service.ts`, `pages/dashboard/dashboard.ts`,
`pages/dashboard/dashboard-kpis.ts`, `ui/data-table/data-table.ts`,
`pages/admin/admin.store.ts` (revisado por zonas de riesgo + `admin.store.spec.ts`),
`pages/admin/tabs/organizations/organizations-tab.ts`.

**Configuración/CI**: `package.json`, `tsconfig.json`, `angular.json`, `eslint.config.cjs`,
`.github/workflows/ci.yml`, `.github/workflows/deploy.yml`, `README.md`,
`AUDITORIA-Y-BACKLOG.md`, `docs/ESTRUCTURA-Y-AUDITORIA.md`.

**Backend (contraste)**: `src/Finanzas.Contracts/Ledger/{MovementDto,MovementRequests}.cs`,
`src/Finanzas.Contracts/Accounts/AccountDtos.cs`, `CatalogEndpoints.cs`,
`LedgerReadStore.cs`, `Security.cs`, `ANALISIS_PROYECTO.md`.

### Limitaciones del análisis

1. **No ejecuté `test:ui`, `test:permisos` ni `test:a11y`**: requieren Playwright +
   Chrome/Lighthouse y superan los 2 min por condición de este análisis. Se ejecutaron en su
   lugar las 4 suites rápidas (`test`, `build`, `lint`, `format:check`), todas en verde.
2. **No se probó contra un backend real**: todo el análisis de modo API es por lectura de
   código y de los contratos C#; no hay una ejecución end-to-end con sesión viva.
3. **Placeholders i18n**: mi comprobador parseó 1189 de 1373 claves; las 184 restantes tienen
   comillas dobles o valores multilinea en el fuente y no las comparé.
4. **`ui/helm/` (268 ficheros vendorizados de Spartan) quedó fuera del alcance**: solo se
   contabilizó, no se revisó línea a línea.
5. **No se ejecutó `pnpm audit`** ni se revisó dependencias con CVE conocidos.
6. **No se valoró accesibilidad ni rendimiento en navegador** (los cubre `test:a11y` /
   `test:ui`, no ejecutados aquí); las métricas de rendimiento son estáticas (OnPush,
   signals, tamaño de bundle).
7. **Precisión de las métricas**: los conteos se han hecho sobre el árbol `src/` en el estado
   actual del repositorio (25-sep-2026); «líneas» incluye comentarios y líneas en blanco.
