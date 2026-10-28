# Tipos de la API generados desde OpenAPI

Los tipos del contrato con la API se generan desde `openapi/v1.json` con `openapi-typescript` en `src/app/core/api/generado/esquema.d.ts`, que nunca se edita a mano; CI corre `pnpm api:tipos` y falla si lo generado difiere. Cada cliente expone alias `Api*` sobre `EsquemaApi<'XDto'>` para no tocar a los consumidores, y conserva una interfaz manual solo donde el esquema no sirve tal cual (enteros que salen como `number | string`, nulos `null | string`, enums numéricos). Se eligió generar en lugar de mantener interfaces a mano porque el contrato cambiaba más rápido que las copias.

## Actualizar el contrato

1. En la API, volcar `GET /openapi/v1.json` (expuesto en Development y Testing; en `Finanzas.Host.Tests` sirve `ApiDePrueba` con base en memoria).
2. Copiarlo a `openapi/v1.json` con sangría de 2 espacios y correr `pnpm api:tipos`.
3. Confirmar ambos archivos juntos.

`trm.api.ts` queda fuera: consume datos.gov.co, no la API propia.
