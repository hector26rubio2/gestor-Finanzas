import { HlmInput } from '@spartan-ng/helm/input';
import { Component, Input, OnInit, effect, inject, untracked } from '@angular/core';
import { ControlContainer, FormsModule, NgForm } from '@angular/forms';
import { I18nService } from '@core/i18n';
import { TasaDeCambio } from '@core/state/tasa-de-cambio';
import { NumericInputDirective } from '@ui/numeric-input/numeric-input.directive';
import { FieldComponent } from '@ui/field/field';

@Component({
  selector: 'fin-movement-currency-fields',
  imports: [HlmInput, FormsModule, NumericInputDirective, FieldComponent],
  templateUrl: './currency-fields.html',
  host: { style: 'display: contents' },
  viewProviders: [{ provide: ControlContainer, useExisting: NgForm }],
})
export class MovementCurrencyFieldsComponent implements OnInit {
  @Input({ required: true }) model!: Record<string, any>;
  readonly i18n = inject(I18nService);
  private readonly tasa = inject(TasaDeCambio);
  readonly officialTrm = this.tasa.vigente;
  readonly officialTrmLoading = this.tasa.cargando;

  ngOnInit() {
    this.model['originalCurrency'] = 'USD';
    this.tasa.solicitar();
  }

  private readonly rellenarConTasaVigente = effect(() => {
    const vigente = this.tasa.vigente();
    untracked(() => {
      if (vigente !== null && !this.model['exchangeRate']) this.model['exchangeRate'] = vigente;
    });
  });
}
