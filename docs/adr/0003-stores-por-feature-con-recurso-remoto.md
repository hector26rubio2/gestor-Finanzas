# Stores por feature con recurso remoto perezoso

`AppStore` guarda solo lo que trae el arranque (`/bootstrap`): sesión, organización, banderas, catálogos, cuentas, preferencias y el contador de avisos. Lo que una pantalla pide solo al abrirse vive en un store de su feature (`features/<area>/<area>.store.ts`, `providedIn: 'root'`) creado con `crearRecursoRemoto` sobre `rxResource`. Se decidió así para que el arranque no cargue datos de pantallas cerradas y para que ninguna escritura tenga que parchear el `AppStore` a mano.

## Contrato del recurso

- Perezoso: no pide nada hasta que un consumidor llama `solicitar()`; quien no es componente de vida corta pasa su `DestroyRef` y usa `soltar()`.
- Estados `inactivo`, `cargando`, `listo`, `error`; con error, `valor()` es `undefined`.
- Caché por clave `usuario|organización`; se descarta al cambiar la clave, cerrar sesión o perder el permiso.
- Tras una escritura, `ApiWritesBus` recarga si hay consumidores activos; si no, marca obsoleto y recarga en el próximo `solicitar()`. Nada se pide en segundo plano.
- `actualizar(fn)` para cambios optimistas y `recargar()` para reintentar tras un error.
