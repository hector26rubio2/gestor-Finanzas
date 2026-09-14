import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Envoltorio de una etiqueta con su control. `.field`/`.field-full` ya existían en
 * `styles.css` como clases "reutilizables entre formularios", pero cada formulario
 * repetía a mano `<label class="field">{{ i18n.t(...) }}<input/></label>` — este
 * componente es ese mismo envoltorio, una sola vez. Sigue siendo un `<label>` de
 * verdad (no un `<div>`): al hacer click en el texto, el navegador enfoca el
 * control proyectado igual que antes, sin nada adicional que declarar.
 */
@Component({
  selector: 'demo-field',
  standalone: true,
  templateUrl: './field.html',
  host: { style: 'display: contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FieldComponent {
  readonly label = input.required<string>();
  /** Ocupa las dos columnas de un `.form-grid` de dos columnas. */
  readonly full = input(false);
}
