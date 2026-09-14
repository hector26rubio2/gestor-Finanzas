import { Component, Input, inject } from '@angular/core';
import { ControlContainer, FormsModule, NgForm } from '@angular/forms';
import { I18nService } from '../../core/i18n';
import { NumericInputDirective } from '../../ui/numeric-input.directive';
import { FieldComponent } from '../../ui/field';

/**
 * Cuotas de una compra con tarjeta. La cuota actual solo es editable al revisar una
 * compra que ya existe — una que se está registrando ahora siempre empieza en 1,
 * porque no se puede comprar hoy algo que ya va por su quinta cuota.
 */
@Component({
  selector: 'demo-movement-installment-fields',
  standalone: true,
  imports: [FormsModule, NumericInputDirective, FieldComponent],
  templateUrl: './movement-installment-fields.html',
  host: { style: 'display: contents' },
  viewProviders: [{ provide: ControlContainer, useExisting: NgForm }],
})
export class MovementInstallmentFieldsComponent {
  @Input({ required: true }) model!: Record<string, any>;
  @Input() currentEditable = false;
  readonly i18n = inject(I18nService);
}
