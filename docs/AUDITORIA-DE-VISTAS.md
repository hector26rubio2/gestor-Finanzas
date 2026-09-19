# Auditoría de vistas, componentes, código y arquitectura — 21 de septiembre de 2026

Cómo se hizo: capturas de las 11 rutas a 1440 px y a 390 px (`pnpm test:ui`), recorrido de las siete pestañas de Administración contra una API local con datos, `axe-core` sobre dashboard y Administración, métricas del código (tamaños, pruebas, claves de idioma, bundle) y las guías de UX, espacio y estilos del repositorio (`ui-ux-pro-max`, `web-design-guidelines`). Cada punto lleva **hallazgo → propuesta**; el esfuerzo es S (horas), M (1–2 días), L (varios días).

## 1. Ya corregido en esta entrega

- Fechas por defecto ancladas a hoy en modo API: el calendario abría el 18-ago-2026, «Nuevo movimiento» proponía el 31-ago-2026 y Planificación una fecha objetivo fija. Antes eran literales en el código.
- Fechas de Administración con el idioma de Preferencias (`Intl`), no `31 Dec` fijo en inglés.
- Encabezados de página de 90–110 px a ~60 px; más filas de tabla a la vista.
- KPI en fila en todas las pantallas (icono + cifra + variación) y sin minigráfica plana cuando no hay serie.
- Filtros de Movimientos en una sola fila a 1440 px.
- Se elimina `scripts/audit-app.mjs` (dependía de `/dev-login`, ya retirado).

## 2. Vista por vista

### Shell (barra lateral, cabecera, botón flotante)

- **Botón flotante de errores** tapa la última columna y la paginación de toda tabla. → Moverlo a la cabecera (icono con menú «Reportar un problema») o reservar su hueco; hoy además no funciona. **S**
- **Selector de organización** en la cabecera es solo texto. Con varias organizaciones (Administración las crea) no hay cómo cambiar de una a otra. → `hlm-select` en la cabecera para quien tenga más de una. **M**
- **Barra lateral** de 238 px sin modo compacto en escritorio (solo en móvil). → colapsar a iconos con `hlm-sidebar` `collapsible="icon"`; gana 170 px para tablas. **S**
- **Búsqueda global** es un icono que abre Movimientos con un foco. → paleta de comandos (`hlm-command`, ya generado): buscar movimientos, cuentas, personas y saltar a pantallas con `⌘K`. **M**
- **Notificaciones**: la insignia cuenta pero no hay vista previa. → popover con las últimas 5 y «Marcar leídas». **S**

### Login

- Panel de portada con título gigante y barras decorativas; en móvil solo queda la tarjeta. → mantener, pero añadir aviso de privacidad y enlace de ayuda; mostrar el estado «Conectando con el servidor…» con esqueleto (las instancias frías de Render tardan segundos). **S**
- Sin modo demostración público desde que la semilla salió del backend. → decidir si el modo `demo` del frontend (con `demo-data.ts`, 700 líneas) sigue siendo un producto (una demo para portafolio) o se retira; hoy es una segunda vía de datos que duplica superficie de pruebas. **M** (decisión de producto)

### Dashboard

- **Demasiados widgets vacíos**: ~25 tarjetas de 360 px con «No hay datos» cuando el periodo no tiene movimientos. → colapsar cada widget vacío a una fila de 64 px y mostrar un único estado vacío arriba con «Cambiar periodo / Añadir movimiento». **M**
- **Página de 10 000 px** sin estructura. → secciones con título y ancla (Flujo, Categorías, Tiempo, Cuentas, Riesgo, Detalle) más un índice lateral (`scroll-spy`) y «ver más» por sección; los widgets pesados con `@defer (on viewport)` ya cargan bajo demanda. **M**
- **Filtros** ya usan `hlm-toggle-group`; falta que persistan por usuario (el periodo viaja en la URL, pero cuenta y categoría no) y una vista «Guardar filtro como…». **M**
- **Comparación de periodos**: la variación solo es contra el periodo anterior. → conmutador «vs. periodo anterior / vs. mismo periodo del año pasado». **M**
- **Objetivos**: la meta de gasto existe como widget; conviene un presupuesto por categoría con barra de avance y alerta al 80 %. **L**
- **Personalizar**: orden por flechas arriba/abajo. → arrastrar y soltar con `cdk-drag-drop` y teclado. **M**

### Movimientos

- Tabla con 10 columnas y la última recortada («Cuotas /…») sin indicio de desplazamiento. → columnas «esenciales» + «detalle» ya existen en `fin-table` (`essential: false`): marcar Moneda/tasa y Cuotas como detalle y mostrarlas en la fila expandible. **S**
- **Acciones masivas** ausentes. → selección múltiple con barra flotante (categorizar, confirmar, eliminar, exportar la selección). **L**
- **Edición en línea** de descripción y categoría. **M**
- **Importar** extractos (CSV/OFX) con vista previa y conciliación contra pendientes. **L**
- **Filtros guardados** y chips de filtros activos con «×» (hoy hay contador). **S**
- Totales del pie: además de ingresos y gastos, mostrar el neto y el promedio del conjunto filtrado. **S**

### Calendario

- Cuadrícula de mes sólida; la agenda lateral trae siete movimientos fijos (`slice(0, 7)`) sin relación con el mes visible. → mostrar los del día seleccionado y los próximos compromisos con su fecha. **S**
- Vista de semana/día son la misma cuadrícula más alta. → línea de tiempo por horas para el día y lista por día para la semana. **M**
- Arrastrar un compromiso a otro día (reprogramar) y crear un movimiento desde una celda vacía (`clic` abre el formulario con la fecha). **M**

### Cuentas y tarjetas

- **Las cuentas son chips**, sin saldo, y debajo aparece la tabla de _todos_ los movimientos. Falta lo esencial de la pantalla. → tarjetas por cuenta (componente `bank-card` ya existe) con saldo, variación del mes y, en tarjetas de crédito, cupo usado con barra, fecha de corte y de pago; la tabla se filtra al seleccionar. **M**
- Vista de **conciliación**: saldo del banco vs. saldo calculado y diferencia. **L**
- **Archivar** cuentas cerradas sin borrar su historial. **S**

### Personas y deudas

- Tabla sobre un contenedor de altura completa: 3 filas y 300 px de vacío. → altura al contenido (`fin-table-zone` sin `flex-1` cuando hay pocas filas). **S**
- Sin recordatorios ni historial por persona. → ficha de persona (drawer) con línea de tiempo de préstamos y abonos, botón «Registrar abono» y «Enviar recordatorio» (mensaje copiable). **M**
- «Comportamiento de pago» es texto («8 días prom. · 1 tardíos»). → insignia de riesgo y minigráfica de puntualidad. **S**

### Patrimonio e inversiones

- Solo una tabla de dos filas. → distribución por tipo (anillo), evolución del patrimonio (línea de 12 meses) y activos vs. pasivos (barras apiladas). El dato existe en Reportes. **M**
- Rendimiento y ganancia no realizada son cifras sueltas. → cotizaciones manuales con fecha de actualización y aviso de antigüedad. **M**

### Planificación

- Pestañas Deudas, Compra, Vacaciones, Inversión con el mismo patrón (parámetros a la izquierda, resultado a la derecha): bien. → guardar escenarios con nombre y compararlos lado a lado. **M**
- Formatos monetarios mezclados (`COP 1.200.000`, `$650 mil/mes`, `$4,5 M`). → una sola función de formato con notación compacta solo en ejes. **S**

### Reportes

- Buena densidad. Falta **exportar a PDF** con la vista actual y **programar** un resumen mensual por correo. **L**
- «Hallazgos del periodo» son tres frases fijas: convertirlos en observaciones calculadas (mayor variación, categoría que más creció, cargos sin clasificar) con enlace al filtro correspondiente. **M**

### Notificaciones

- Lista simple. → agrupar por día, filtros (Todas/No leídas/Propuestas), acciones por tipo (confirmar compra detectada en un clic) y preferencias de canal. **M**

### Preferencias

- Una página larga de personalización (temas, seis selectores de color, densidad, radio, vista previa) sin navegación interna. → columna izquierda con secciones (Apariencia, Idioma y región, Cuenta, Seguridad, Datos) y la vista previa fija a la derecha. **M**
- Selectores de color como barras de ancho completo. → `swatch` de 40 px con valor hexadecimal y comprobación de contraste AA en vivo. **S**
- Falta **exportar mis datos** y **eliminar mi cuenta**. **L**

### Administración

- Ya en tablas de ancho completo. Siguiente: **acciones masivas** (activar/desactivar varias personas), **invitar por correo** con vista de invitaciones pendientes, **auditoría con diff** (`{before, after}` del backend ya existe) y **filtros por actor/entidad/fechas** en la vista. **M**
- Errores: agrupar por huella, mostrar el `traceId` con botón «Copiar» y enlace al evento de auditoría relacionado. **S**
- Usuarios: la lista trae 100 y filtra por organización en el cliente; cuando crezca, el servidor debe aceptar `organizationId`, `status` y ordenar. **M** (backend)

## 3. Componentes y sistema de diseño

- **Botones** (`hlmBtn`): ya no queda ningún `<button>` sin Helm. Falta una regla de uso: **una** acción primaria por pantalla (relleno), secundarias en `outline`, terciarias `ghost`, destructivas solo `destructive` con confirmación. Hoy «Nueva categoría» y «Exportar CSV» compiten con «Nuevo movimiento» del shell. Tamaño táctil mínimo 44 px en móvil: `sm` (32 px) e `icon-sm` (32 px) quedan por debajo. → `@media (pointer: coarse)` sube a `default`. **S**
- **KPI** (`fin-kpi`): un solo diseño en fila; falta el estado «cargando» (esqueleto) y variante con objetivo (barra). **S**
- **Tabla** (`fin-table`): API propia sobre `hlm-table`. Falta **orden por columna con `aria-sort`**, columnas configurables (mostrar/ocultar, guardadas por usuario), densidad compacta y cabecera fija. **M**
- **Estados vacíos** (`fin-empty`): existe, pero cada pantalla escribe su texto. → catálogo con ilustración, causa y acción principal. **S**
- **Estados** («Activo», «Inactivo», origen del valor): texto gris pequeño. → `hlmBadge` con variantes semánticas (éxito, aviso, peligro, neutro). **S**
- **Formularios**: `movement-form` es un `Record<string, any>` mutable con `model[...]` (única fuga de `any` del proyecto). → formulario tipado con `signal forms`/`FormGroup` tipado y validación visible por campo. **M**
- **Iconos**: trazos propios en `icon.ts`; `@ng-icons/lucide` ya es dependencia. → migrar por tandas y borrar el mapa propio. **M**
- **Movimiento y diseño responsivo**: en 390 px la barra de filtros de Movimientos ocupa media pantalla; usar un `hlm-sheet` de filtros con «Aplicar». **S**

## 4. Código

- **Comentarios**: el código existente tiene ~1 140 líneas de comentarios (bloques `/** */` largos) frente a la regla de no escribirlos. → eliminar por carpetas al tocarlas; los porqués valiosos pasan a `docs/` o a nombres. **M** (mecánico)
- **Archivos grandes**: `dashboard-visuals.ts` (962 líneas), `dashboard.ts` (766), `store.ts` (759), `demo-data.ts` (704), `admin.store.ts` (706), `inspector.ts` (453). → dividir `dashboard-visuals` por familia de gráfica (`flujo`, `categorías`, `tiempo`, `riesgo`); `AppStore` en `SessionStore`, `LedgerStore`, `UiStore`; `admin.store` en lecturas y borradores (`AdminDraft`). **L**
- **Cadena de clases abstractas** del dashboard: no deja probar un tramo aislado. → composición con servicios por ámbito (`DashboardFilters`, `DashboardKpis`, `DashboardWidgets`) provistos en el componente. **L**
- **Tipos**: un `any` real (`movement-form`), pero muchos `Record<string, any>` en tablas (`rows`). → genéricos `fin-table<T>` con `columns: TableColumn<T>[]`. **M**
- **Estado en URL**: `sincronizarConLaUrl` mezcla lectura y escritura con efectos. → mover a un servicio con `Router` como única fuente y pruebas para las tres carreras conocidas (recarga, atrás, salida de ruta). **M**
- **i18n**: 1 236 claves por idioma, paridad total; el español es respaldo. Sin comprobación automática. → prueba que compare las claves de los cuatro catálogos y otra que detecte claves sin uso. **S**
- **Errores**: `catch {}` vacíos en `AdminStore` (`cargarRolesDe`); ninguna telemetría de errores del cliente salvo el botón que hoy no funciona. → capturar con `ErrorHandler` propio, agrupar y enviar al endpoint de errores que Administración ya lista. **M**

## 5. Arquitectura

- **Dos orígenes de datos** (`demo` en memoria y `api`) con ramas `runtime.mode === 'demo'` repartidas por el código (fechas, flags, sesión). → un único puerto `FinanceGateway` con dos adaptadores; el resto del código no conoce el modo. Si la demo se retira, borrar el adaptador y ~1 500 líneas. **L**
- **Refresco de sesión** ya es granular; falta **caché con invalidación por recurso** (movimientos, cuentas…) en lugar de recargas completas al cambiar permisos. Evaluar `resource()` de Angular con claves. **M**
- **Paginación local** en tablas que en API deberían ser remotas (`totalRows` existe, se usa solo en Administración). Movimientos trae 424 filas en el arranque. → paginación y filtros en servidor con cursor. **L** (backend + frontend)
- **Bundle**: inicial 727 kB (aviso a 700, error a 1 MB) y un chunk diferido de ~717 kB con ECharts. → importar solo los módulos usados (`echarts/core` + gráficas concretas), `@defer` del shell de Administración y análisis con `source-map-explorer`. **M**
- **Backend**: `DemoFinanceStore` sigue como almacén en memoria para pruebas de Application y Host; ver si `Testcontainers` (Postgres real) lo reemplaza y así la API se prueba contra el motor real. **L**

## 6. Seguridad y privacidad

- Sin **Content-Security-Policy**: GitHub Pages no permite cabeceras, pero sí `<meta http-equiv="Content-Security-Policy">` con `default-src 'self'`, `connect-src` a la API y `img-src` para la foto de Google. Probar primero en modo solo informe. **S**
- Cookies `SameSite=None; Secure` por dominios distintos (Pages y Render): es lo previsto, pero depende de cookies de terceros; los navegadores las restringen cada vez más. → servir la API bajo un subdominio del mismo sitio o usar un proxy en el dominio de la web. **M**
- `pnpm audit --prod`: sin vulnerabilidades conocidas hoy. → añadirlo al CI (aviso, no bloqueo) y `dependabot`. **S**
- **Datos sensibles**: el navegador solo guarda el índice del perfil demo en `sessionStorage`; cuentas, saldos y preferencias viven en el servidor. Mantenerlo así y documentarlo. Añadir «cerrar sesión en todos los dispositivos». **S**
- Acceso a la base de desarrollo compartido por chat: rotar la clave y usar un usuario de solo lectura para inspección. **S**

## 7. Accesibilidad y rendimiento percibido

- `axe`: sin violaciones en dashboard y Administración (claro, oscuro, móvil) y en las 11 rutas tras la entrega anterior. Pendiente medir temas «océano» y «ciruela», lector de pantalla (NVDA/VoiceOver) y navegación solo por teclado en tablas con filas seleccionables.
- `prefers-reduced-motion` ya se respeta en overlays; falta en gráficas (`animation: false`). **S**
- Esqueletos: `fin-skeleton` existe y casi no se usa; aplicar en KPI, tablas y gráficas mientras `remoteState` es `loading`. **S**
- Toques: objetivos de 32 px en móvil (ver botones).

## 8. Pruebas y operación

- **Cobertura**: 180 pruebas unitarias, casi todas de `core/` y del dashboard. **Ninguna** de las nueve pestañas del workspace ni de las pestañas de Administración (solo `admin.store`). → una prueba de componente por pestaña (render con datos, estado vacío, permiso denegado) con `@testing-library/angular`. **M**
- **E2E**: Playwright recorre rutas y permisos, pero no flujos: crear cuenta → crear movimiento → verlo en dashboard; cerrar sesión; guardar cambios de Administración. → 6 flujos contra la API real con base descartable en CI. **L**
- **Regresión visual**: las 55 capturas se generan pero no se comparan. → `toHaveScreenshot` con tolerancia para las rutas principales. **M**
- **Observabilidad**: sin versión visible salvo `version.ts`; mostrar commit y fecha en Preferencias → Acerca de para depurar despliegues. **S**

## 9. Hoja de ruta sugerida

| Orden | Trabajo                                                         | Esfuerzo | Valor                                    |
| ----- | --------------------------------------------------------------- | -------- | ---------------------------------------- |
| 1     | Cuentas como tarjetas con saldo y cupo; Patrimonio con gráficas | M        | Alto: las dos pantallas más pobres       |
| 2     | Dashboard por secciones y widgets vacíos colapsados             | M        | Alto: es la primera pantalla             |
| 3     | Botón flotante fuera del contenido + selector de organización   | S–M      | Alto: bloquea uso real                   |
| 4     | Tabla: orden con `aria-sort`, columnas de detalle, densidad     | M        | Alto: se usa en 8 pantallas              |
| 5     | Pruebas de componente por pestaña + 6 flujos E2E                | M–L      | Alto: red de seguridad para refactorizar |
| 6     | Reducir bundle (ECharts modular)                                | M        | Medio                                    |
| 7     | Dividir `AppStore` y `dashboard-visuals`; retirar comentarios   | L        | Medio: velocidad futura                  |
| 8     | `FinanceGateway` y decisión sobre el modo demo                  | L        | Medio: menos superficie                  |
| 9     | Paginación remota y filtros en servidor                         | L        | Medio: escala                            |
| 10    | Importar extractos, acciones masivas, presupuestos              | L        | Producto                                 |

## 10. Estado tras el rediseño con Spartan (19-sep-2026)

Entregado desde esta auditoría:

- **Dashboard**: cuadrícula libre de 12 columnas (arrastrar y redimensionar ancho y alto, los de abajo suben), diseño guardado por usuario en el servidor con caché local, tema completo restaurado al iniciar sesión.
- **Tabla**: `fin-table` sobre TanStack Table con orden, búsqueda por campo, facetas, visibilidad de columnas y selección múltiple opcional.
- **Componentes Spartan**: Tabs (tipo de movimiento), Badge con icono Lucide (categorías), Combobox multiselección (permisos, por sección con interruptor), Questionnaire de Brain (reporte de problemas), Sidebar con grupos colapsables, ScrollArea (menú, listas del dashboard, modales y paneles), Select y botones `hlmBtn` en toda la aplicación.
- **Administración**: auditoría traducida y filtrable por traza y persona afectada, banderas en cascada global ∧ organización ∧ persona, permisos solo por rol, consolidación en la organización general.
- **Botón de reportes**: movible y con posición recordada.

Pendiente y deliberado:

- `input type="color"` y `type="range"` siguen nativos: Spartan no ofrece selector de color y el `slider` de Brain no está generado en Helm todavía.
- Las tablas embebidas (widget de tabla, inspector) usan el desplazamiento nativo para conservar el encabezado fijo y la región enfocable.
- Puntos 5 y 6 de la hoja de ruta (pruebas de componente por pestaña de administración, flujos E2E) y la reducción del bundle (835 kB frente al presupuesto de 700 kB) siguen abiertos.
