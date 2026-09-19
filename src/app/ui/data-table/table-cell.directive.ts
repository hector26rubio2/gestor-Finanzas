import { Directive, Input, TemplateRef } from '@angular/core';

/**
 * Celda a medida para una columna de `table`, cuando el dato no es un texto
 * plano: un avatar con nombre y correo, una insignia de estado, un botón de
 * acción. Sin esto, cada pantalla con una fila así de rica volvía a escribir su
 * propio `<fin-table>` entero en vez de usar la tabla genérica — la tabla seguía
 * siendo "una sola" solo mientras la celda fuera un texto.
 *
 * Uso: `<ng-template finCell="status" let-row>...</ng-template>` como hijo de
 * `<fin-table>`, junto a las demás columnas que sí se muestran como texto.
 */
@Directive({
  selector: 'ng-template[finCell]',
})
export class FinTableCellDirective {
  @Input('finCell') column = '';
  constructor(readonly template: TemplateRef<{ $implicit: Record<string, any> }>) {}
}
