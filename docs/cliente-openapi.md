# Cliente tipado desde OpenAPI

Los tipos de la API se generan desde `openapi/v1.json` con `openapi-typescript` y quedan en `src/app/core/api/generado/esquema.d.ts` (no se edita a mano).

## Actualizar el contrato

1. En el repo de la API, volcar el documento `/openapi/v1.json` (se expone en Development y Testing; en el proyecto de pruebas `Finanzas.Host.Tests` se puede levantar `ApiDePrueba` con base en memoria y guardar la respuesta de `GET /openapi/v1.json`).
2. Copiarlo a `openapi/v1.json` con sangría de 2 espacios.
3. Ejecutar `pnpm api:tipos`.
4. Confirmar ambos archivos juntos. CI corre `pnpm api:tipos` y falla si `generado/` difiere.

## Migrar un cliente

1. Buscar el DTO en `components['schemas']` (nombre del DTO de C#, por ejemplo `BudgetDto`).
2. Reemplazar la interfaz manual por un alias:

```ts
import type { EsquemaApi } from './generado/esquemas';

export type ApiBudget = EsquemaApi<'BudgetDto'>;
```

3. Mantener el nombre exportado `Api*` para no tocar a los consumidores.
4. Diferencias frecuentes a revisar:
   - Enteros salen como `number | string` con patrón; si el consumidor espera `number`, mantener la interfaz manual o normalizar al leer.
   - Nulos salen como `null | string`.
   - Enums numéricos salen como `number`.
5. Correr `pnpm lint`, `pnpm test` y `pnpm build`.

## Migrados

`budgets.api.ts`, `notifications.api.ts`, `preferences.api.ts`. `trm.api.ts` consume datos.gov.co, no la API propia, por eso no aplica.

Pendientes: el resto de `*.api.ts` y `shared-api-types.ts`.
