# Estructura del código y auditoría — 19 de septiembre de 2026

Estado de `gestor-Finanzas` tras las fases A–E (sesión, administración por lotes, sistema de UI en Tailwind + Spartan y reorganización de carpetas). Sirve de mapa para quien llega y de lista honesta de lo que falta.

## Reglas de estructura (guía de estilo de Angular)

1. **Un componente por carpeta**, con el `.ts`, su plantilla y su `.spec.ts` al lado. Los componentes pequeños llevan la plantilla en línea.
2. **Sin archivos sueltos en una carpeta de área**: `core/` se agrupa en `api/`, `http/`, `i18n/`, `session/`, `state/` y `utils/`; `ui/` en una carpeta por pieza.
3. **Sin `standalone: true`**: es el valor por defecto desde Angular 19.
4. **Sin CSS de componente**: solo existen `src/spartan.css` (tokens, variantes `data-*`, capas) y `src/styles.css` (variables de tema y una base mínima en `@layer base`).
5. **Los componentes de Helm** (`ui/helm/*`) se generan con `npx ng g @spartan-ng/cli:ui <nombre> --no-interactive` y no se editan salvo que se anote aquí.
6. **Nada de comentarios en el código nuevo**: los nombres y las funciones pequeñas explican; las directivas que exige la herramienta son la única excepción.

## Mapa de carpetas

| Carpeta                | Contenido                                                                                                                                                                                                                                                                              |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/app/core/api`     | Contratos y llamadas al API por área (`*.api.ts`), rutas y la fachada `api-client.ts`.                                                                                                                                                                                                 |
| `src/app/core/http`    | Transporte HTTP con CSRF y traducción de errores (el 403 de permisos sale con texto claro).                                                                                                                                                                                            |
| `src/app/core/i18n`    | Servicio de traducción y los catálogos es/en/fr/pt. Se importa como `core/i18n`.                                                                                                                                                                                                       |
| `src/app/core/session` | Arranque y refresco granular de la sesión (`remote-bootstrap`), permisos, `returnUrl`, configuración de ejecución.                                                                                                                                                                     |
| `src/app/core/state`   | `AppStore`, datos de demostración y estado en la URL.                                                                                                                                                                                                                                  |
| `src/app/core/utils`   | Dinero, CSV, tipos de movimiento, consola, versión y `AsyncActionService`.                                                                                                                                                                                                             |
| `src/app/ui`           | Piezas de interfaz propias: `overlay` (modal e inspector sobre Helm dialog/sheet), `select` (Helm select), `data-table` (Helm table), `date-field`, `search-field`, `sheet-panel`, `kpi`, `kpi-grid`, `table-zone`, `bank-card`, `chart`, `icon`, `field`, `pager`, `option-row`, etc. |
| `src/app/ui/helm`      | Código generado por Spartan.                                                                                                                                                                                                                                                           |
| `src/app/pages`        | Pantallas con ruta propia: `admin` (una pestaña por componente y un `AdminStore`), `dashboard`, `login`, `workspace`, `sin-seccion`.                                                                                                                                                   |
| `src/app/features`     | Pestañas del workspace (`movements`, `accounts`, `calendar`, `people`, `portfolio`, `planning`, `reports`, `notifications`, `preferences`) y formularios (`account-form`, `management-form`, `movement-form` con un subcomponente por grupo de campos, `bug-report`).                  |
| `src/app/shared`       | Servicios compartidos entre pestañas y utilidades.                                                                                                                                                                                                                                     |

## Sistema de UI

- **Tokens**: `@theme inline` apunta a las variables que el tema activo escribe en runtime (`--bg`, `--surface`, `--accent`, `--radius`, `--font`…); cambiar tema, acento o radio desde Preferencias repinta todo sin regenerar CSS. `chart-theme.ts` observa esas mismas variables: no se renombran.
- **Capas**: `theme`, `base`, `utilities`. La base propia (reinicio de márgenes, `border: 0 solid`, botones y campos transparentes) queda por debajo de las utilidades y de las variantes de Helm.
- **Desfase Helm/Brain**: Helm usa variantes `data-checked`, `data-active`, `data-pressed`…, y Brain 1.4.1 emite `data-state="checked|active|on"`. `spartan.css` define esas variantes para que coincidan con ambos.
- **Overlays**: modales, inspector, selectores, popovers y menús son overlays de CDK, así que el listado de un selector flota sobre el modal en vez de hacer scroll dentro. No hay `<dialog>` nativo.
- **Fechas**: `fin-date-field` (Helm date-picker) guarda `yyyy-MM-dd`, construye las fechas a las 12:00 locales para evitar el desfase horario y localiza el calendario según el idioma de Preferencias (`CalendarLocale`).

## Administración

- `AdminStore` guarda lo leído del servidor y los cambios pendientes; la vista es la base más los borradores. Guardar los aplica juntos por olas (activar organización → predeterminada y mudanzas → desactivar → resto) con `Promise.allSettled`, quita del borrador lo aceptado, deja lo fallido con su motivo, relee la lista de personas una vez y refresca la sesión una vez.
- Aviso al salir con cambios sin guardar (`canDeactivate` y `beforeunload`).
- Formularios con envío propio (crear o editar rol, crear organización, renombrar, estado de un error) se aplican al momento.
- Ancho completo y paneles (`app-admin-panel`): cabecera con título, acciones y filtros, tabla de Helm a todo lo ancho y pie con paginación. Resumen, Usuarios, Roles, Organizaciones y Feature Flags son tablas.
- Usuarios: filtro por organización, estado y texto; columna de organización (con marca de mudanza sin guardar). La lista trae hasta 100 personas y el filtro por organización se aplica en el cliente; si crece, el servidor debería aceptar `organizationId`.
- Feature Flags: solo nivel global y de organización, en dos columnas de interruptores (Global y la organización elegida, con el origen del valor). El nivel de usuario se quitó de la interfaz; el servidor conserva la precedencia usuario > organización > global para lo que ya exista.

## Dashboard

- Filtros: `hlm-toggle-group` para Día, Semana, Mes y Año; navegación de periodo con botones Helm unidos y popover; tres selectores con etiqueta visible. Una sola línea de resumen con `aria-live`.
- KPI en fila (`fin-kpi [row]`): icono, cifra, pista y, a la derecha, variación y minigráfica; rejilla `auto-fill` de 250 px. El diseño apilado sigue en el resto de pantallas.
- Tabla del periodo a la altura de la ventana (mínimo 600 px, 15 filas) y widgets de tabla a todo el ancho; tres columnas de widgets desde 1700 px.

## Auditoría de interfaz (19-sep-2026)

Hallazgos con las guías de UX, espacio y estilos del repositorio, ordenados por impacto:

1. **Encabezados de página** ocupan 90–110 px (`clamp` hasta 3,2 rem): bajarlos a ~2 rem devuelve una fila de tabla en cada pantalla.
2. **Fechas con formato de Angular en `en-US`** (`31 Dec, 19:00` en Administración): deben salir del idioma de Preferencias con `Intl.DateTimeFormat`.
3. **Widgets vacíos** del dashboard ocupan 360 px cada uno con «No hay datos»: colapsar los vacíos a una línea o agruparlos por secciones (Flujo, Categorías, Tiempo, Riesgo).
4. **Minigráficas planas** cuando no hay serie: no dibujarlas.
5. **Botón flotante de errores** tapa la última columna y la paginación en la esquina inferior derecha; reservar `padding-bottom` o moverlo a la barra superior.
6. **Calendario** abre en julio de 2026 aunque hoy sea septiembre: anclar a hoy como el dashboard.
7. **Densidad de tablas**: filas de 61 px; ofrecer densidad compacta (48 px) en Preferencias.
8. **Colores de estado** (Activo/Inactivo, origen del valor) son texto pequeño gris: usar `hlmBadge` con variante para que se lean de un vistazo.
9. **Botones**: no queda ningún `<button>` sin `hlmBtn` en `src/app` (calendario, agenda y filas de errores pasaron a Helm).
10. **Pendientes de medición**: temas océano y baya con axe, lector de pantalla, y contraste de gráficas.

## Archivos grandes: estado y siguiente paso

| Archivo                            | Líneas | Hecho                                                                                                                                                                                                                                                                                                                                                                                     | Siguiente corte                                                                                                                                                            |
| ---------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pages/dashboard/dashboard.ts`     | ~765   | De ~2.285 a ~765. Cadena de capas que conserva la API pública del componente: `DashboardVisuals` (opciones de gráfica, agregación y formato; declara como abstractas las señales que necesita) → `DashboardKpis` (fórmulas de KPI y creador) → `DashboardComponent` (periodo, filtros, widgets). Además `dashboard.model.ts`, `dashboard-chart-style.ts` y `dashboard-widget-catalog.ts`. | Pasar la cadena a composición (`DashboardStore` + servicios) cuando se pueda tocar la plantilla y las pruebas; `dashboard-visuals.ts` (~960) admite separar la agregación. |
| `core/state/store.ts`              | ~760   | Tema y preferencias (`theme.ts`), navegación (`navigation.ts`) y categorías de demostración (`demo-categories.ts`) fuera; `store.ts` los reexporta.                                                                                                                                                                                                                                       | Separar la semilla de demostración y el registro de acciones de `AppStore`.                                                                                                |
| `pages/workspace/workspace.ts`     | ~120   | El inspector (overlay, plantilla, estado de cuenta, pago de tarjeta y confirmaciones) es su propio componente en `workspace/inspector/`.                                                                                                                                                                                                                                                  | —                                                                                                                                                                          |
| `core/session/remote-bootstrap.ts` | ~370   | Rebanadas y tipos en `remote-slices.ts`; mapeo de la API a los datos de la vista en `remote-mappers.ts` (funciones puras).                                                                                                                                                                                                                                                                | Separar el flujo SSE/sondeo del cargador de rebanadas si vuelve a crecer.                                                                                                  |

Para cualquiera de estos cortes: `impact` de GitNexus antes de tocar el símbolo, `detect_changes` antes de confirmar, y una prueba por rebanada.

## Deuda conocida

- Presupuesto inicial: 735 kB (aviso a 700 kB, error a 1 MB). El CSS de utilidades crece con el uso de Helm; los componentes se cargan en el paquete inicial por el shell.
- El calendario de Helm usa formatos de `Intl`; en idiomas con primer día de semana distinto se ajusta solo para `en` (domingo).
- La tabla de datos (`fin-table`) conserva su API; una migración a `hlm-table` puro con columnas declarativas queda pendiente.
- `axe-core` (19-sep-2026) sobre login, dashboard, movimientos, calendario, cuentas, personas, patrimonio, planificación, reportes, notificaciones y preferencias en claro 1280, oscuro 1280 y claro 390: sin violaciones tras subir contraste de `--muted`, `--danger`, `--success` y del acento oscuro, y corregir landmarks, listas de definición, encabezados y regiones desplazables. Sin medir aún: temas océano y baya, ni lector de pantalla.
- Índice único de banderas globales con `NULLS NOT DISTINCT` (backend).
