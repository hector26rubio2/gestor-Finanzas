import { Component, Input, computed, inject } from '@angular/core';
import { ControlContainer, FormsModule, NgForm } from '@angular/forms';
import { I18nService } from '../../core/i18n';
import { P } from '../../core/permissions';
import { CAPABILITIES, DemoStore } from '../../core/store';
import { UiOption, UiSelectComponent } from '../../ui/select';
import { FieldComponent } from '../../ui/field';

/**
 * A quién pertenece el movimiento (siempre visible) y, aparte, si es un préstamo
 * formal — que el llamador ya decidió ocultar cuando la cuenta es una tarjeta de
 * crédito, porque esa deuda es con el banco, no con una persona.
 */
@Component({
  selector: 'fin-movement-loan-fields',
  standalone: true,
  imports: [FormsModule, UiSelectComponent, FieldComponent],
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

  /** Al volver a "propia" se limpia `loanRole`: el campo se oculta y no debe quedar
   * un valor viejo listo para mandarse a guardar sin que nadie lo vea. */
  onPersonChange(value: string): void {
    this.model['person'] = value;
    if (!value) this.model['loanRole'] = '';
  }

  // No es un `computed()`: `showLoan` es un `@Input()` normal, y `model['operationType']`
  // es una propiedad mutable de un objeto que se sigue siendo el mismo por referencia.
  // Ninguna de las dos la rastrearia un `computed()` — la primera lectura quedaria en
  // cache para siempre y ocultar el prestamo al elegir una tarjeta de credito, o al
  // cambiar el selector de Tipo, nunca se reflejaria.
  /**
   * Con responsabilidad propia no hay relación con nadie: un préstamo a uno mismo no
   * es préstamo. `person` vacío es "propia" (ver `personOptions`).
   */
  showLoanRole(): boolean {
    return (
      this.showLoan &&
      this.model['operationType'] === 'loan' &&
      !!this.model['person'] &&
      this.caps.allows(P.movimientos.prestamos.crear)
    );
  }

  /**
   * No es un `computed()`: depende de `model['kind']`, la misma propiedad mutable que
   * ya rompe el rastreo en `showLoanRole`/`showLoanProduct` de más abajo.
   *
   * "Me prestaron" es un ingreso (entra dinero) y "presté" es un gasto (sale dinero) —
   * mostrar ambos sin importar el tipo dejaba elegir "dinero que me prestaron" en un
   * gasto con cuenta propia, que no tiene sentido: nadie te presta algo que tú mismo
   * estás gastando. El pago o devolución sí aplica a los dos lados (pagas tu deuda, o
   * te devuelven la tuya), así que no se filtra por tipo.
   */
  loanRoleOptions(): readonly UiOption[] {
    const kind = this.model['kind'];
    return [
      { value: '', label: this.i18n.t('form.movement.loanRole.none') },
      ...(kind === 'expense' && this.caps.allows(P.personas.prestamos.crear)
        ? [{ value: 'lent', label: this.i18n.t('form.movement.loanRole.lent') }]
        : []),
      ...(kind === 'income' && this.caps.allows(P.personas.deudas.crear)
        ? [{ value: 'borrowed', label: this.i18n.t('form.movement.loanRole.borrowed') }]
        : []),
      { value: 'repayment', label: this.i18n.t('form.movement.loanRole.repayment') },
    ];
  }

  /**
   * Independiente de `loanRole`: un crédito hipotecario o de libre inversión es deuda
   * con el banco, no con una persona. Se muestra cuando el selector de Tipo está en
   * "Crédito", no junto a "Préstamo" — son dos opciones del mismo selector.
   */
  showLoanProduct(): boolean {
    return this.showLoan && this.model['operationType'] === 'credit' && this.caps.allows(P.movimientos.creditos.crear);
  }

  readonly loanProductOptions = computed<readonly UiOption[]>(() => [
    { value: 'personal', label: this.i18n.t('form.movement.loanProduct.personal') },
    { value: 'mortgage', label: this.i18n.t('form.movement.loanProduct.mortgage') },
    { value: 'vehicle', label: this.i18n.t('form.movement.loanProduct.vehicle') },
    { value: 'education', label: this.i18n.t('form.movement.loanProduct.education') },
    { value: 'other', label: this.i18n.t('form.movement.loanProduct.other') },
  ]);
}
