# Stores por feature

`AppStore` solo guarda lo que necesita el arranque (`/bootstrap`): sesión, organización, banderas, catálogos, cuentas, preferencias y el contador de avisos. Lo que una pantalla pide solo cuando se abre vive en un store de su feature.

## Patrón

Un store de feature es un servicio `providedIn: 'root'` que crea su recurso con `crearRecursoRemoto` (`@core/state`), construido sobre `rxResource`:

```ts
@Injectable({ providedIn: 'root' })
export class PeopleStore {
  private readonly api = inject(PeopleApi);

  private readonly deudas = crearRecursoRemoto({
    permiso: P.personas.deudas.listar,
    cargar: () => this.api.debts(),
  });

  readonly estado = this.deudas.estado;
  readonly personas = computed(() => conPosicionesDeDeuda(this.store.data().people, this.deudas.valor() ?? []));
}
```

Opciones: `cargar` (obligatoria), `permiso` (no pide sin él) y `dependencia` (un valor que, al cambiar, vuelve a pedir; ej. el contador de avisos del servidor).

## Contrato del recurso

- **Perezoso**: no pide nada hasta que un consumidor llama `solicitar()`. Los componentes lo llaman en su constructor; quien no es un componente de vida corta pasa su `DestroyRef` y usa `soltar()` cuando deja de necesitarlo (el inspector lo hace al cambiar de tipo).
- **Estados**: `inactivo`, `cargando`, `listo`, `error`. Con error, `valor()` es `undefined`; el store decide qué mostrar (los avisos caen a los recientes del arranque).
- **Caché por organización y usuario**: el valor se conserva mientras la clave `usuario|organización` no cambie, aunque nadie lo use. Si cambia la clave, la sesión se cierra o se retira el permiso, se descarta y no vuelve a pedir hasta que alguien lo solicite.
- **Recarga tras escrituras**: el interceptor de escrituras notifica a `ApiWritesBus`. Con consumidores activos, el recurso recarga; sin ellos solo se marca obsoleto y recarga en el siguiente `solicitar()`. Mismas o menos llamadas que antes: nada se pide en segundo plano si la pantalla no está abierta.
- **Actualización optimista**: `actualizar(fn)` cambia el valor cargado sin pedir; la recarga posterior lo confirma.
- `recargar()` fuerza un reintento (por ejemplo desde un botón tras un error).

## Qué vive dónde

| Dato                        | Dónde                                               | Cuándo se pide                                                 |
| --------------------------- | --------------------------------------------------- | -------------------------------------------------------------- |
| Avisos recientes y contador | `AppStore` (`avisosRecientes`, `unread`)            | en el arranque                                                 |
| Lista completa de avisos    | `NotificationsStore`                                | al abrir Notificaciones                                        |
| Personas (catálogo)         | `AppStore.data().people`                            | en el arranque                                                 |
| Deudas por persona          | `PeopleStore` (`personas` ya trae `owed`/`owing`)   | al abrir Personas, Planificación o el inspector de una persona |
| Inversiones                 | `AppStore.data().investments` (pendiente de migrar) | al abrir Patrimonio, Planificación o Reportes                  |

## Cómo pasar otra área

1. Crear `features/<area>/<area>.store.ts` con `crearRecursoRemoto`.
2. Sacar el dato de `RemoteBootstrap` (`Carga`, `RawData`, `traer`) y de `ViewData`.
3. Cambiar los lectores a `store.valor()`/computeds del store y llamar `solicitar()` en el constructor de la pantalla.
4. Quitar las actualizaciones manuales del `AppStore` en los comandos: la recarga por `ApiWritesBus` las cubre.
5. Probar con `TestBed`: carga, error, recarga tras escritura, permiso y caché (ver `recurso-remoto.spec.ts`).
