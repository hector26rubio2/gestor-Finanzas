# Atlas de Finanzas

Todo el funcionamiento de la aplicación (web y API) en un solo lugar. Abre **[index.html](index.html)** con doble
clic: es un portal único para cambiar entre diagramas, recorrer el grafo del código y revisar los contratos entre
la web y el API. No necesita servidor.

| Pestaña | Qué tiene | De dónde sale |
|---|---|---|
| **Diagramas** `1` | Los 16 diagramas por área, con su estado, sus vistas guiadas, el código que representan y los módulos del grafo que tocan | Skill [archify](https://github.com/tt-a1i/archify) |
| **Grafo de código** `2` | Módulos de la web y del API, sus llamadas, flujos de ejecución y archivos; clic en un módulo para ver qué diagramas lo explican y qué rutas toca | Índices de [GitNexus](https://github.com/abhigyanpatwari/GitNexus) |
| **Contratos web ↔ API** `3` | Cada endpoint con su permiso, su archivo en el API y quién lo llama en la web; marca endpoints sin uso y llamadas sin endpoint | `API_ROUTES` y `transport.request` contra los `Map*` del API |
| **Salud** `4` | Qué diagramas quedaron viejos y el estado de los índices de GitNexus | `huellas.json` y el registro de GitNexus |

Atajos: `/` busca, `[` y `]` pasan de diagrama, `1`–`4` cambian de pestaña, `Esc` suelta la selección. Cada vista
tiene su propia URL (`#/diagramas/<id>`, `#/grafo/<módulo>`, `#/contratos/<estado>`), así que se puede compartir.

## Diagramas

| Área | Diagrama | Tipo | Qué cuenta |
|---|---|---|---|
| Mapa | [sistema](00-mapa/sistema.html) | architecture | Piezas del sistema: cliente, API, base, Google, CI y GitHub Issues |
| Mapa | [áreas](00-mapa/areas.html) | architecture | Secciones de la aplicación y qué datos comparten |
| Frontend | [armazón](01-frontend/armazon.html) | architecture | Guard, AppStore y arranque remoto del cliente Angular |
| API | [capas](02-api/capas.html) | architecture | Host, Application, Infrastructure y almacenes |
| API | [petición](02-api/peticion.html) | sequence | Una escritura por dentro: puertas, tubería y auditoría |
| Sesión | [entrar con Google](03-sesion/entrar-con-google.html) | sequence | Login, cookie, CSRF, permisos y primera pantalla |
| Sesión | [estados](03-sesion/estados.html) | lifecycle | Estados de la sesión y cuándo decide el guard |
| Sesión | [permisos en vivo](03-sesion/permisos-en-vivo.html) | sequence | Un cambio de rol llega por SSE sin recargar |
| Movimientos | [registro](04-movimientos/registro.html) | dataflow | De la captura al tablero y los reportes |
| Movimientos | [ciclo](04-movimientos/ciclo.html) | lifecycle | Alta, rechazo, reclasificación y reversión |
| Planificación | [recurrencias](05-planificacion/recurrencias.html) | sequence | Calendario proyectado y materialización |
| Personas | [compras compartidas](06-personas/compras-compartidas.html) | dataflow | Reparto, deudas por persona y liquidación |
| Administración | [panel](07-administracion/panel.html) | architecture | Superadmin, permisos por acción, auditoría y avisos |
| Soporte | [errores](08-soporte/errores.html) | workflow | Errores automáticos y reportes hasta GitHub |
| Entrega | [web](09-entrega/web.html) | workflow | CI y publicación del cliente en GitHub Pages |
| Entrega | [API](09-entrega/api.html) | workflow | CI de la API y despliegue en Render |

Qué aprovecha de archify: calidad `showcase` validada y revisada en Chrome a cuatro tamaños, vistas guiadas con
**Play story**, animación `trace`, marcas oficiales (PostgreSQL, GitHub, Render, Angular, Docker) y, en los
diagramas de arquitectura, marcadores `SRC` que enlazan cada nodo con su archivo en GitHub, verificados contra el
commit publicado de `origin/main`.

**Play story** necesita animación: si el sistema operativo la tiene apagada (en Windows, *Configuración →
Accesibilidad → Efectos visuales → Efectos de animación*), el visor respeta esa preferencia y el botón queda
deshabilitado. Las vistas se pueden recorrer igual con clic en cada capítulo.

## Qué aprovecha de GitNexus

- Índices de los dos repos con `--skills`, que genera una skill por área funcional en `.claude/skills/gitnexus-area-*`.
- `--pdg` en la web para el flujo de control del TypeScript.
- Grupo `finanzas` (`~/.gitnexus/groups/finanzas`) con `web` y `api` para análisis entre repos. GitNexus 1.6.11
  todavía no reconoce las Minimal APIs con `MapGroup` ni las rutas del front guardadas en constantes, por eso los
  contratos del portal se sacan del código directamente.
- `pnpm diagramas explorar` levanta `gitnexus serve` y abre la interfaz web de GitNexus con el grafo completo,
  símbolo por símbolo, conectada a los índices locales.

## Mantenerlo vivo

```bash
pnpm diagramas estado --detalle
pnpm diagramas generar --pendientes
pnpm diagramas sellar <id>
pnpm diagramas atlas
pnpm diagramas explorar
```

- `estado` lista los diagramas cuyo código cambió desde su último sello y avisa si los índices de GitNexus o el
  grafo del atlas quedaron atrás.
- `generar` valida, entrega, revisa en Chrome y sella; al terminar regenera el portal.
- `sellar` marca un diagrama como revisado cuando el cambio de código no altera lo que cuenta.
- `atlas` reindexa los dos repos con GitNexus, sincroniza el grupo, exporta `datos/grafo.json` y
  `datos/contratos.json` y regenera `index.html`. Con `--sin-reindexar` usa los índices actuales.

`manifiesto.json` dice qué archivos representa cada diagrama (`front` es este repo y `api` es
`../v2-api-finanzas`, o `FINANZAS_API_DIR`). `huellas.json` guarda el hash de esos archivos al sellar.

Tras cada `git commit`, `merge`, `pull`, `rebase` o `checkout`, un hook de Claude Code corre el mismo chequeo y
avisa qué diagramas quedaron viejos y si el atlas necesita `pnpm diagramas atlas`, igual que GitNexus con su índice.

## Agregar un diagrama

1. Escribe el spec en la carpeta de su área con la skill archify (`meta.quality_profile: "showcase"`,
   `meta.animation: "trace"`, hasta cinco `meta.views` y `brand` en los nodos que nombran un producto real).
2. En un diagrama de arquitectura, agrega `meta.repository` y `sources` por componente y pon `evidencia` en el
   manifiesto; `generar` mueve la revisión al último `origin/main`.
3. Agrégalo a `manifiesto.json` con sus `fuentes` y corre `pnpm diagramas generar <id>`.
