# Signal Forms

API experimental de `@angular/forms/signals` (Angular 22.2). Verificada contra `node_modules/@angular/forms/types/signals.d.ts` y `_structure-chunk.d.ts`.

## Migrados

| Formulario                            | Modelo               | Esquema                     |
| ------------------------------------- | -------------------- | --------------------------- |
| `features/account-form`               | `DatosDeCuenta`      | `account-form.schema.ts`    |
| `features/budgets` (editor de límite) | `{ limite: string }` | `validate` en el componente |
| `features/management-form`            | `DatosDeGestion`     | `management-form.schema.ts` |

## Patrón

- Un `signal` con todos los datos editables es el modelo; `form(modelo, esquema, { name, submission })` crea el árbol de campos.
- El esquema vive en un archivo `*.schema.ts` como función pura que recibe un traductor, así se prueba sin montar el componente (`form()` dentro de `runInInjectionContext`).
- Los mensajes salen del catálogo i18n con `message: () => t(clave)`, reactivos al cambio de idioma.
- Campos que no aplican se declaran con `hidden(ruta, { when })` y se quitan del DOM con `@if` usando la misma condición. Un campo oculto no cuenta para la validez del formulario ni se renderiza.
- `<form [formRoot]="formulario">` pone `novalidate`, marca todo como tocado y llama a `submission.action` solo si el formulario es válido.
- Cada campo usa `[formField]="formulario.campo"`. El error se muestra con `mensaje(campo)`: primer error si el campo fue tocado.
- Con `name` en `form()` los inputs nativos reciben `name="<form>.<campo>"`. No se puede escribir `name`, `min`, `max`, `maxlength` ni `required` a mano en un nodo con `[formField]`: se declaran en el esquema.
- Los controles propios con `ControlValueAccessor` (`fin-select`, `fin-date-field`) funcionan con `[formField]`. Sus inputs `min`/`max` deben aceptar `string | undefined`.

## Pendiente: `features/movement-form`

No se tocó. Plan sugerido, en este orden:

1. Reemplazar `MovementFormModel` (objeto mutable con índice `[clave: string]: unknown`) por un tipo cerrado sin índice. Hoy los subformularios reciben `model: Record<string, any>` y escriben por clave, lo que impide tipar los campos.
2. Crear `movement-form.schema.ts` con `esquemaDeMovimiento(reglas)`. La visibilidad que calcula `MovementVisibilityBuilder` (cuenta destino, categoría, atribución, contraparte, recurrencia, cuotas, moneda, plazos del préstamo, modo de tarjeta) pasa a `hidden(..., { when })`. El builder se conserva como fuente de verdad y el esquema lo consulta con `valueOf`.
3. Mover las reglas de `save()` al esquema: monto positivo, cuenta válida, cuenta destino distinta, contraparte obligatoria, tasa mensual de 0 a 100, permisos de crédito, cuotas y plazo. Las que dependen de varios campos usan `validateTree`.
4. Pasar los efectos de `setOperationType`, `setKind` y limpieza de campos a funciones que actualizan el signal del modelo (`modelo.update`), no a mutaciones directas.
5. Migrar subformulario por subformulario recibiendo `FieldTree` en vez de `model`: `core-fields`, `category-field`, `counterparty-field`, `currency-fields`, `financing-fields`, `installment-fields`, `recurrence-fields`, `attribution-field`. Cada uno con un input `campo = input.required<FieldTree<...>>()`.
6. Quitar `FormsModule` de los `imports` de cada subformulario al terminar y mantener las pruebas de `movement-form.spec.ts` y `movement-visibility-builder.spec.ts`, ajustando solo la forma de escribir los valores.
7. Cubrir con pruebas de esquema (una por regla y por tipo de operación) antes de cambiar la plantilla.

Riesgos: el formulario también se usa para editar y para registrar desde notificaciones (`notificationId`); el campo `amount` convive con `originalAmount` y `exchangeRate`, por lo que conviene un `validateTree` que mantenga el monto base coherente; los `hidden` deben coincidir exactamente con los `@if` de la plantilla para evitar el aviso de campo oculto renderizado.
