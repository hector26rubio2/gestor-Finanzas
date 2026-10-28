# Helpers de testing (`src/app/testing/`)

Herramientas para escribir specs sin armar fixtures a mano. Ver `harness-ejemplo.spec.ts`
para el patrón completo de referencia.

## `sesionDe()` — builder fluido de sesión/permisos

Parte de `USUARIO_DE_PRUEBA` y devuleve un builder encadenable:

```ts
store.user.set(sesionDe().conCapacidad('mov.editar', 'admin.fondos').sinCapacidades().construir());
// o directo en el harness: pruebaRender(MiComponente, { session: sesionDe().conCapacidad('x') })
```

Otros métodos: `.conId(id)`, `.conNombre(nombre)`, `.conEmail(email)`, `.aplicarEn(store)`.

## `datosDe()` — fábrica de slices `data()` del store

Devuelve movimientos/cuentas/personas/categorías con valores por defecto sensatos
(y fecha de ejemplo `2026-09-25`), con overrides por test:

```ts
const datos = datosDe({
  movements: [
    {
      id: 'm1',
      date: '2026-10-01',
      description: 'X',
      accountId: 'cuenta-1',
      category: 'Mercado',
      kind: 'expense',
      amount: -1000,
      status: 'confirmed',
    },
  ],
  accounts: [{ id: 'cuenta-1', name: 'Banco', type: 'checking', currency: 'COP', openingBalance: 0 }],
}); // categorías remotas van en overrides.categories (store.categories)
datos.aplicarEn(store);
```

## `TransportFalso` — transport de API en memoria

Implementa el contrato `API_TRANSPORT` (ver `@core/http/api-http-client`): graba las
peticiones y devuelve respuestas configurables, errores (`ApiRequestError`) y latencia opcional:

```ts
const transport = new TransportFalso()
  .responder('POST /api/v1/accounts', { body: { id: 'a1', name: 'Banco', currency: 'COP' } })
  .responder(/^GET \/api\/v1\/movements/, { error: { status: 403, code: 'authorization.denied' } })
  .responder('POST /api/v1/reports', { latenciaMs: 50, body: [] });
// admiten función: .responder('POST /api/v1/accounts', ({ body }) => ({ body: {...} }))
// peticiones recibidas: transport.peticiones | limpiar entre tests: transport.limpiar()
```

Una petición sin respuesta configurada hace fallar el spec con un error explícito:
así se detectan rutas no previstas. Nunca toca HttpClient real.

## `pruebaRender()` — harness fino sobre TestBed

```ts
const { fixture, component, store, transport } = pruebaRender(MiComponente, {
  session: sesionDe().conCapacidad('x'), // aplica user + remoteState en el store
  data: datosDe(), // siembra data()/categories() en el store
  providers: [provideRouter([])], // extra opcional
});
fixture.detectChanges(); // o usar los helpers `cambios()` del retorno
```

Devuelve `{ fixture, component, store, transport, cambios(), estable() }`.
Prioriza proveedores por defecto de `pruebaRender` y sobreescribe lo que el test pase en `providers`.
