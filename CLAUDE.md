# gestor-Finanzas

Angular 22 + Spartan (front, este repo) · .NET 10 Clean Architecture/DDD (API en `../v2-api-finanzas`). pnpm.
Prioridad: correctness > architecture safety > task completion > token efficiency.

## Nivel de la tarea (decídelo antes de explorar)

- **N0** texto, i18n, estilos, docs, formato, generados → sin GitNexus ni diagramas.
- **N1** cambio local (componente aislado, DTO nuevo, test puntual) → `context` del símbolo que tocas, una vez.
- **N2** comportamiento existente, servicio, query, API, componente reutilizado → `impact` upstream por símbolo modificado (una vez; reusa el resultado).
- **N3** refactor, dominio, cross-module, contrato web↔API, infraestructura, o riesgo HIGH/CRITICAL/UNKNOWN → skill `gitnexus-impact-analysis` (y `gitnexus-refactoring` si renombras o mueves).

Siempre, en cualquier nivel:
- HIGH/CRITICAL → avisar antes de editar y cubrir con tests.
- UNKNOWN no es seguro: confirmar con búsqueda de texto.
- `detect_changes` (MCP o `node .gitnexus/run.cjs detect-changes --scope all --repo .`) antes de cada commit.
- Renombrar símbolos con `rename` de GitNexus, nunca buscar y reemplazar.

## Contexto mínimo

- Skills de área: carga solo `gitnexus-area-<área>` del código que modificas; no las de otras áreas.
- Archivo conocido → Read/Grep directo. GitNexus es para relaciones, callers y flujos.
- Salidas de build y tests siempre filtradas (`tail`, `grep`). UI: `read_page`/texto primero; captura solo para validar lo visual, reducida.
- Agrupa comprobaciones independientes en una llamada. No releas lo que ya está en contexto.
- Subagentes solo para barridos amplios cuyo detalle no necesitas; nunca para cambios de 1–2 archivos.

## Cambios

Skill `minimal-change`. Sin refactors, dependencias ni archivos no pedidos.

## Diagramas

Skill `diagramas` (cuándo `estado`, `sellar`, `generar`, `atlas`). El hook avisa tras cada mutación de git.

## Respuesta final

`Changed` / `Tests` / `Notes`, ≤ 15 líneas, salvo que se pida detalle. Sin repetir el pedido, sin volcar código ni narrar herramientas.
