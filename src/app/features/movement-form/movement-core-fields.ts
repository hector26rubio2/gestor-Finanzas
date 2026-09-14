import { Component, Input, inject } from '@angular/core';
import { ControlContainer, FormsModule, NgForm } from '@angular/forms';
import { I18nService } from '../../core/i18n';
import { P } from '../../core/permissions';
import { CAPABILITIES, DemoStore } from '../../core/store';
import { UiOption, UiSelectComponent } from '../../ui/select';
import { NumericInputDirective } from '../../ui/numeric-input.directive';
import { FieldComponent } from '../../ui/field';

/** Fecha, cuenta origen, cuenta destino (solo transferencia), descripción e importe. */
@Component({
  selector: 'demo-movement-core-fields',
  standalone: true,
  imports: [FormsModule, UiSelectComponent, NumericInputDirective, FieldComponent],
  templateUrl: './movement-core-fields.html',
  host: { style: 'display: contents' },
  viewProviders: [{ provide: ControlContainer, useExisting: NgForm }],
})
export class MovementCoreFieldsComponent {
  @Input({ required: true }) model!: Record<string, any>;
  @Input({ required: true }) kind!: string;
  @Input() showTargetAccount = false;

  private readonly store = inject(DemoStore);
  private readonly caps = inject(CAPABILITIES);
  readonly i18n = inject(I18nService);

  private accountTypeLabel(type: string): string {
    return type === 'credit'
      ? this.i18n.t('form.account.type.credit')
      : type === 'savings'
        ? this.i18n.t('form.account.type.savings')
        : this.i18n.t('form.account.type.cash');
  }

  /**
   * Ninguno es un `computed()` a propósito: todos dependen de `kind`, un `@Input()`
   * normal que cambia sin recrear el componente cuando se alterna Gasto/Ingreso/
   * Transferencia. Un `computed()` no rastrea una propiedad simple — la primera
   * lectura quedaría en caché para siempre, y cambiar de tipo dejaría la lista de
   * cuentas de la selección anterior.
   */

  /**
   * Un gasto puede cargarse a cualquier cuenta; un avance sale de la tarjeta. El resto
   * de tipos no toca crédito.
   */
  private eligibleAccounts() {
    return this.store
      .data()
      .accounts.filter((a) => this.kind === 'expense' || this.kind === 'advance' || a.type !== 'credit')
      .filter(
        (a) =>
          a.type !== 'credit' ||
          this.caps.allows(this.kind === 'advance' ? P.movimientos.avances.crear : P.movimientos.creditos.crear),
      );
  }

  /**
   * Ninguna pata de una transferencia puede ser una tarjeta de crédito; en un avance,
   * la cuenta origen es siempre la tarjeta.
   */
  accountOptions(): readonly UiOption[] {
    return [
      { value: '', label: this.i18n.t('form.actions.select') },
      ...this.eligibleAccounts()
        .filter((a) => this.kind !== 'transfer' || a.type !== 'credit')
        .filter((a) => this.kind !== 'advance' || a.type === 'credit')
        .map((a) => ({ value: a.id, label: `${a.name} · ${this.accountTypeLabel(a.type)}` })),
    ];
  }

  targetAccountOptions(): readonly UiOption[] {
    return [
      { value: '', label: this.i18n.t('form.actions.select') },
      ...this.eligibleAccounts()
        .filter((a) => a.type !== 'credit')
        .map((a) => ({ value: a.id, label: `${a.name} · ${this.accountTypeLabel(a.type)}` })),
    ];
  }

  sourceAccountLabel(): string {
    return this.kind === 'transfer' || this.kind === 'payment' || this.kind === 'advance'
      ? this.i18n.t('form.movement.field.sourceAccount')
      : this.i18n.t('form.movement.field.account');
  }
}
