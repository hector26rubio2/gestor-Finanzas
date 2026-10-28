# Formularios con Signal Forms

Los formularios nuevos y migrados usan `@angular/forms/signals` (experimental en Angular 22.2) en lugar de Reactive o Template Forms, porque encaja con el estado en signals del resto de la app y deja las reglas en un esquema puro que se prueba sin montar el componente. El costo aceptado es depender de una API experimental.

## Reglas del patrón

- El modelo es un `signal` con todos los datos editables; `form(modelo, esquema, { name, submission })` crea el árbol de campos.
- El esquema vive en `*.schema.ts` como función pura que recibe el traductor; los mensajes salen del catálogo i18n con `message: () => t(clave)`.
- Los campos que no aplican se declaran con `hidden(ruta, { when })` y se quitan del DOM con `@if` usando la misma condición: un campo oculto renderizado dispara un aviso.
- `name`, `min`, `max`, `maxlength` y `required` se declaran en el esquema, nunca a mano en un nodo con `[formField]`.
- Los controles propios con `ControlValueAccessor` (`fin-select`, `fin-date-field`) funcionan con `[formField]`; sus inputs `min`/`max` aceptan `string | undefined`.
- Reglas que dependen de varios campos van en `validateTree`.
