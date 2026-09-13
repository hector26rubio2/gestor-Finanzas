import { Component, Input, computed, inject } from '@angular/core';
import { ControlContainer, FormsModule, NgForm } from '@angular/forms';
import { I18nService } from '../../core/i18n';
import { P } from '../../core/permissions';
import { CAPABILITIES, DemoStore } from '../../core/store';
import { UiOption, UiSelectComponent } from '../../ui/select';

/**
 * A quién pertenece el movimiento (siempre visible) y, aparte, si es un préstamo
 * formal — que el llamador ya decidió ocultar cuando la cuenta es una tarjeta de
 * crédito, porque esa deuda es con el banco, no con una persona.
 */
@Component({
  selector: 'demo-movement-loan-fields',
  standalone: true,
  imports: [FormsModule, UiSelectComponent],
  templateUrl: './movement-loan-fields.html',
  host: { style: 'display: contents' },
  viewProviders: [{ provide: ControlContainer, useExisting: NgForm }],
})
export class MovementLoanFieldsComponent {
  @Input({ required: true }) model!: Record<string, any>;
  @Input() showLoan = false;

  private readonly store = inject(DemoStore);
  private readonly caps = inject(CAPABILITIES);
  readonly i18n = inject(I18nService);

  readonly personOptions = computed<readonly UiOption[]>(() => [
    { value: '', label: this.i18n.t('form.movement.person.own') },
    ...this.store
      .data()
      .people.map((p) => ({ value: p.name, label: this.i18n.t('form.movement.person.borrowed', { name: p.name }) })),
  ]);

  // No es un `computed()`: `showLoan` es un `@Input()` normal, y `model['loanRole']`
  // (en `showLoanProduct`) es una propiedad mutable de un objeto que se sigue siendo
  // el mismo por referencia. Ninguna de las dos la rastrearia un `computed()` — la
  // primera lectura quedaria en cache para siempre y ocultar el prestamo al elegir
  // una tarjeta de credito nunca se reflejaria.
  showLoanRole(): boolean {
    return this.showLoan && this.caps.allows(P.movimientos.prestamos.crear);
  }

  readonly loanRoleOptions = computed<readonly UiOption[]>(() => [
    { value: '', label: this.i18n.t('form.movement.loanRole.none') },
    ...(this.caps.allows(P.personas.prestamos.crear)
      ? [{ value: 'lent', label: this.i18n.t('form.movement.loanRole.lent') }]
      : []),
    ...(this.caps.allows(P.personas.deudas.crear)
      ? [{ value: 'borrowed', label: this.i18n.t('form.movement.loanRole.borrowed') }]
      : []),
    { value: 'repayment', label: this.i18n.t('form.movement.loanRole.repayment') },
  ]);

  showLoanProduct(): boolean {
    return this.showLoanRole() && !!this.model['loanRole'] && this.caps.allows(P.movimientos.creditos.crear);
  }

  readonly loanProductOptions = computed<readonly UiOption[]>(() => [
    { value: 'personal', label: this.i18n.t('form.movement.loanProduct.personal') },
    { value: 'mortgage', label: this.i18n.t('form.movement.loanProduct.mortgage') },
    { value: 'vehicle', label: this.i18n.t('form.movement.loanProduct.vehicle') },
    { value: 'education', label: this.i18n.t('form.movement.loanProduct.education') },
    { value: 'other', label: this.i18n.t('form.movement.loanProduct.other') },
  ]);
}
