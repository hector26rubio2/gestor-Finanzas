import { Directive, Input, TemplateRef } from '@angular/core';

/**
 * Celda a medida para una columna de `demo-table`, cuando el dato no es un texto
 * plano: un avatar con nombre y correo, una insignia de estado, un botón de
 * acción. Sin esto, cada pantalla con una fila así de rica volvía a escribir su
 * propio `<table>` entero en vez de usar la tabla genérica — la tabla seguía
 * siendo "una sola" solo mientras la celda fuera un texto.
 *
 * Uso: `<ng-template demoCell="status" let-row>...</ng-template>` como hijo de
 * `<demo-table>`, junto a las demás columnas que sí se muestran como texto.
 */
@Directive({
  selector: 'ng-template[demoCell]',
  standalone: true,
})
export class DemoTableCellDirective {
  @Input('demoCell') column = '';
  constructor(readonly template: TemplateRef<{ $implicit: Record<string, any> }>) {}
}
