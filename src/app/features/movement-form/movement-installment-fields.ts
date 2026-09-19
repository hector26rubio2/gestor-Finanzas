import { Component, Input, inject } from '@angular/core';
import { ControlContainer, FormsModule, NgForm } from '@angular/forms';
import { I18nService } from '../../core/i18n';
import { NumericInputDirective } from '../../ui/numeric-input.directive';
import { FieldComponent } from '../../ui/field';
import { AppStore } from '../../core/store';

/**
 * Cuotas de una compra con tarjeta. La cuota actual solo es editable al revisar una
 * compra que ya existe — una que se está registrando ahora siempre empieza en 1,
 * porque no se puede comprar hoy algo que ya va por su quinta cuota.
 */
@Component({
  selector: 'fin-movement-installment-fields',
  standalone: true,
  imports: [FormsModule, NumericInputDirective, FieldComponent],
  templateUrl: './movement-installment-fields.html',
  styles: [
    'button.text-reset { border: 0; background: none; color: var(--accent); padding: 0; font: inherit; cursor: pointer; }',
  ],
  host: { style: 'display: contents' },
  viewProviders: [{ provide: ControlContainer, useExisting: NgForm }],
})
export class MovementInstallmentFieldsComponent {
  @Input({ required: true }) model!: Record<string, any>;
  @Input() currentEditable = false;
  readonly i18n = inject(I18nService);
  private readonly store = inject(AppStore);

  /** La tasa con la que nace la tarjeta, para precargar el campo sin obligar a escribirla. */
  cardApr(): number | undefined {
    return this.store.account(this.model['accountId'])?.annualRate;
  }

  /**
   * No es un `computed()`: depende de `model['purchaseApr']`, la misma propiedad mutable
   * que ya rompe el rastreo en los demás campos del formulario (ver `movement-loan-fields.ts`).
   *
   * Vacío usa la tasa de la tarjeta ese mes; con un valor, esta compra la reemplaza porque
   * la tasa cambió y el default de la tarjeta ya no aplica.
   */
  purchaseApr(): number | null {
    return this.model['purchaseApr'] ?? this.cardApr() ?? null;
  }

  onPurchaseAprChange(value: number | null): void {
    this.model['purchaseApr'] = value;
  }

  /** Para volver al default de la tarjeta sin adivinar qué escribir. */
  useCardApr(): void {
    this.model['purchaseApr'] = undefined;
  }

  isOverridden(): boolean {
    return this.model['purchaseApr'] !== undefined && this.model['purchaseApr'] !== null;
  }
}
