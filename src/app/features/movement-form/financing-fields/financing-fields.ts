import { ChangeDetectionStrategy, Component, Input, inject } from '@angular/core';
import { ControlContainer, FormsModule, NgForm } from '@angular/forms';
import { HlmInput } from '@spartan-ng/helm/input';
import { I18nService } from '@core/i18n';
import { AppStore } from '@core/state/store';
import { FieldComponent } from '@ui/field/field';
import { UiOption, UiSelectComponent } from '@ui/select/select';
import { cuotaFija } from '@core/utils/tasas';
import { NumericInputDirective } from '@ui/numeric-input';

@Component({
  selector: 'fin-movement-financing-fields',
  imports: [NumericInputDirective, FormsModule, HlmInput, UiSelectComponent, FieldComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './financing-fields.html',
  host: { style: 'display: contents' },
  viewProviders: [{ provide: ControlContainer, useExisting: NgForm }],
})
export class MovementFinancingFieldsComponent {
  @Input({ required: true }) model!: Record<string, any>;
  @Input() showProduct = false;
  @Input() showCardMode = false;

  private readonly store = inject(AppStore);
  readonly i18n = inject(I18nService);

  productOptions(): readonly UiOption[] {
    return ['personal', 'mortgage', 'vehicle', 'education', 'other'].map((valor) => ({
      value: valor,
      label: this.i18n.t(`form.movement.loanProduct.${valor}`),
    }));
  }

  cardModeOptions(): readonly UiOption[] {
    return [
      { value: 'purchase', label: this.i18n.t('form.movement.cardMode.purchase') },
      { value: 'cashAdvance', label: this.i18n.t('form.movement.cardMode.cashAdvance') },
    ];
  }

  cuota(): string {
    const capital = Number(this.model['amount']);
    const meses = Number(this.model['termMonths']);
    const tasa = Number(this.model['monthlyRate'] ?? 0);
    if (!(capital > 0) || !(meses > 0) || !Number.isFinite(tasa)) return '';
    const cuota = cuotaFija(capital, tasa, meses);
    return this.i18n.t('form.movement.financing.estimate', {
      payment: this.store.money(cuota),
      interest: this.store.money(cuota * meses - capital),
    });
  }
}
