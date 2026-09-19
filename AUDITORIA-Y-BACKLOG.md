# Auditoría y backlog — 17 de septiembre de 2026

## Alcance y límites

Revisión de integración visual, navegación, carga inicial y ciclos del menú, sobre el frontend de producción y la API PostgreSQL local existente. No se han creado ni borrado movimientos financieros en esta auditoría. No equivale a una auditoría completa de seguridad, contabilidad ni fugas de memoria de toda la aplicación.

## Implementado

- Sidebar oficial de Spartan Helm generado con CLI 1.4.1, usando Brain 1.4.1 y Angular CDK 22.1.7. Código fuente agrupado en `src/app/ui/helm`, con barrels y alias `@spartan-ng/helm/*`.
- Panel móvil con Sheet, cierre con Escape, navegación activa y tooltips para el menú contraído. Se conserva el catálogo de rutas y permisos de la aplicación.
- Tailwind sin preflight para conservar los estilos existentes. Variantes explícitas para atributos `data-active` y `data-state`; sin ellas todos los enlaces parecían seleccionados.
- Transición del panel móvil de 180 ms, respetando reducir movimiento. Sin interpolación del ancho del escritorio para no redimensionar todas las gráficas en cada frame.
- Formulario global de movimientos y reporte de errores con carga diferida.
- Registro de Dataset y Transform de ECharts. Respeto de reducir movimiento al actualizar gráficas.
- Limpieza de intervalo, listener de foco y canal de eventos al destruir RemoteBootstrap; protección contra un doble inicio.
- Restaurados los selectores CSS del `table` nativo tras la reorganización anterior.
- Descripción de página, `noindex` y `robots.txt` válido para un espacio financiero privado. Esto NO sustituye autenticación ni autorización.

## Evidencia reproducible

1. API local en `http://localhost:5198` con PostgreSQL existente y acceso de desarrollo para el usuario de pruebas.
2. `pnpm build`.
3. `node scripts/audit-app.mjs` (Chrome instalado; puertos 4400 y 9223 libres).
4. Informes y capturas en `artifacts/audit/`, excluidos de Git por contener datos locales.

El script sirve el build sin compresión HTTP y usa un proxy del mismo origen. Autentica una identidad local de pruebas, no una cuenta Google. Cierra SSE en el proxy: los resultados no validan el comportamiento ni las reconexiones del canal de eventos. Lighthouse mide el login anónimo con simulación móvil, no el dashboard autenticado. Los tiempos de navegación incluyen una espera fija de 400 ms y no son Core Web Vitals.

Resultados de verificación:

- Frontend: 158 tests en 24 archivos; lint sin errores.
- Backend: 228 tests de dominio y 65 de aplicación. No se ejecutó toda la batería Host/Infrastructure.
- Compilación: 767,81 kB iniciales; 187,38 kB de transferencia estimada. Supera el presupuesto de 700 kB en 67,81 kB. Sigue la advertencia CommonJS de html2canvas.
- Recorrido de once rutas a 1440 y 390 px: sin errores de JavaScript ni desbordamiento horizontal en la ejecución medida.
- Diez ciclos del sidebar: 1915 nodos y 240 listeners antes y después de GC en la última ejecución. Pasan las regresiones de selección visual, Escape, retorno del foco y reducción de movimiento. Indicio favorable limitado al menú, no prueba de ausencia global de fugas.
- Lighthouse inicial: rendimiento 66, accesibilidad 100, buenas prácticas 96. El SEO subió de 54 a 63 al corregir robots.txt; sigue penalizado intencionadamente por noindex. Son medidas locales, variables y no comparables directamente con producción comprimida.

## Backlog priorizado

### P0 — Identidad y aislamiento

- [x] Backend (corregido el 18-sep-2026: `GetSessionAsync` recibe el userId autenticado y resuelve por usuario+organización, con prueba de dos miembros de privilegios distintos; `SessionFromPrincipal` ya no combina `IsSuperAdmin`): `IdentityReadStore.GetSessionAsync` selecciona la primera membresía activa de la organización, no la del principal. `SessionFromPrincipal` sustituye usuario y permisos pero conserva organizaciones y combina `IsSuperAdmin` con el valor almacenado. Resolver la sesión completa por usuario autenticado y organización; añadir pruebas con dos miembros de privilegios distintos. No se ha demostrado explotación ni se ha corregido en esta tanda.
- [x] Frontend (corregido el 18-sep-2026: la firma incluye usuario y organización, con prueba): la firma de sesión de `RemoteBootstrap` incluye permisos pero no usuario/organización. Añadir pruebas de cambio de identidad con permisos iguales y evitar respuestas antiguas sobre el nuevo espacio.
- [x] Verificado el 18-sep-2026: ya estaban separados (esquemas independientes; `AllowDevelopmentAuth` solo en Development/Testing y falla al arrancar en otro entorno; Google solo se registra si tiene credenciales). Pendiente solo una prueba automática de 401 sin cookie. Separar el acceso de desarrollo por defecto de las pruebas Google. Confirmar 401 sin cookie y aislamiento entre organizaciones. No considerar el proxy de auditoría una solución de autenticación.

### P1 — Rendimiento y robustez

- [ ] Separar el shell autenticado del login para no descargar componentes del sidebar antes de entrar. Volver a medir el presupuesto sin subirlo artificialmente.
- [ ] Medir dashboard autenticado con throttling y caché fría/caliente. Montar gráficas fuera de pantalla con defer/viewport y placeholders de altura estable; mantener sus filtros y exportación.
- [ ] Auditar idempotencia de creación de cuenta/tarjeta/movimiento en servidor con solicitudes concurrentes. Deshabilitar un botón o compartir una promesa no prueba idempotencia entre pestañas.
- [ ] Medir creación de tarjetas por tramo: petición, transacción, consultas y refresco posterior. Evitar recargar todo el workspace tras cada escritura cuando se pueda actualizar el resultado concreto.
- [ ] Repetir perfiles de memoria tras múltiples navegaciones y filtros, incluyendo ECharts, SSE y overlays. Obtener heap snapshots, no solo contadores DOM.
- [ ] Matriz de guards y permisos con usuario limitado y permisos revocados. Verificar también autorización del endpoint; el menú oculto no protege datos.

### P1 — Accesibilidad e idiomas

- [x] Select reutilizable (corregido el 18-sep-2026: el nombre es «etiqueta: valor», con prueba; falta probar con lector de pantalla): Lighthouse detecta que el nombre accesible del trigger excluye la opción visible. Incluir etiqueta y valor sin duplicación y probar navegación por teclado/lector.
- [ ] Revisar nombres accesibles de Sheet/Dialog, foco, contraste, zoom al 200 % y límite responsive de 768 px.
- [x] Fallbacks «Sin descripción»/«Sin categoría» de remote-bootstrap ya usan i18n (18-sep-2026); no se encontraron «Cambio» ni «Cuota única» en el código del cliente, así que si aparecen vienen del API. Revisar fallbacks literales como «Sin descripción», «Cambio» y «Cuota única», observados en pantalla con idioma portugués. No traducir nombres/descripciones escritos por usuarios.
- [x] Corregido el 18-sep-2026 (un icono, aria-label localizado). Sustituir el doble símbolo «+» del botón móvil por un único icono con nombre accesible localizado.

### P2 — Migración visual selectiva a Spartan

- [ ] Dropdown Menu: hecho el de perfil (18-sep-2026); faltan las acciones de filas. Dropdown Menu para perfil y acciones de filas, con foco y navegación por teclado.
- [ ] Popover/Combobox para filtros con búsqueda; Sheet para filtros móviles; chips de filtros activos y acción de limpiar. Conservar valores, permisos, fechas, moneda y estado de consulta.
- [ ] Alert Dialog: hecho para reversar movimiento y desactivar cuenta (`ConfirmDialogComponent`, 18-sep-2026); faltan otras acciones destructivas (p. ej. eliminar rol en Administración). Alert Dialog para acciones destructivas, con estados pendientes y error recuperable.
- [ ] Table estilizada sobre el modelo actual: conservar ordenación, paginación remota, selección y celdas personalizadas. No sustituir la tabla con una maqueta que pierda estas funciones.
- [ ] Skeletons: `fin-skeleton` ya usa `hlm-skeleton` y se muestra al paginar Movimientos (18-sep-2026); faltan cuentas y tarjetas y estados vacíos. Skeletons con dimensiones estables y estados vacíos coherentes en cuentas y tarjetas.
- [ ] Notificaciones: `store.toast.set()` ya se muestra con ngx-sonner y el banner propio desapareció (18-sep-2026); falta migrar los sitios a `AsyncActionService` para tener estado pendiente. Unificar notificaciones pendientes/éxito/error sobre AsyncAction/ngx-sonner; probar rechazo, doble clic, cancelación y navegación durante la petición.

### P2 — Organización del código

- [ ] Una carpeta por componente propio: `.ts`, `.html`, `.css`, `.spec.ts`, `index.ts`. Comenzar por select, chart, field, icon y subcampos del formulario de movimientos.
- [ ] Barrels por área y alias de dominio, evitando ciclos o reexportaciones de módulos pesados en puntos de entrada iniciales.
- [ ] Mantener el código generado de Helm reconocible respecto al upstream; registrar personalizaciones. No reorganizarlo mecánicamente como los componentes propios sin revisar imports.
- [ ] `DemoStore` ya es `AppStore` (18-sep-2026); quedan `DemoData`, `DemoAuditEvent`, `DemoNotification`. Renombrar símbolos internos pendientes que aún llevan `Demo` con refactor semántico y análisis de impacto. No hacer reemplazos globales que alcancen etiquetas HTML nativas o datos almacenados.
- [ ] Ejecutar infraestructura/Host con base aislada, revisar errores de seeder y ejecutar auditoría de cambios de GitNexus antes de cualquier commit.

## Criterio de cierre

Cada tarea debe conservar funcionalidad, incluir regresión verificable, pasar lint/tests/build y aportar captura o medición cuando cambie UI o rendimiento. Esta lista registra trabajo pendiente: no afirma que toda la aplicación ya esté auditada o refactorizada.
