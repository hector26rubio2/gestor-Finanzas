import { Component, computed, inject, signal } from '@angular/core';
import { FormField, FormRoot, form, type FieldTree } from '@angular/forms/signals';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmInput } from '@spartan-ng/helm/input';
import { VALUATION_SOURCE } from '@core/api';
import { I18nService } from '@core/i18n';
import { P } from '@core/session';
import { AppStore, CAPABILITIES, CatalogCommands } from '@core/state';
import { DateFieldComponent } from '@ui/date-field';
import { FieldComponent } from '@ui/field';
import { IconComponent } from '@ui/icon';
import { NumericInputDirective } from '@ui/numeric-input';
import { OverlayComponent } from '@ui/overlay';
import { UiOption, UiSelectComponent } from '@ui/select';
import { type DatosDeValorizacion, esquemaDeValorizacion } from './investment-valuation.schema';

@Component({
  selector: 'fin-investment-valuation',
  imports: [
    DateFieldComponent,
    FieldComponent,
    FormField,
    FormRoot,
    HlmButton,
    HlmInput,
    IconComponent,
    NumericInputDirective,
    OverlayComponent,
    UiSelectComponent,
  ],
  templateUrl: './investment-valuation.html',
})
export class InvestmentValuationComponent {
  private readonly capabilities = inject(CAPABILITIES);
  private readonly commands = inject(CatalogCommands);
  readonly store = inject(AppStore);
  readonly i18n = inject(I18nService);
  readonly error = signal('');
  readonly investmentId = this.store.form()?.targetId ?? '';
  readonly investment = computed(() => this.store.data().investments.find((item) => item.id === this.investmentId));
  readonly currency = computed(() => this.investment()?.currency ?? this.store.baseCurrency());
  readonly modelo = signal<DatosDeValorizacion>({
    date: this.store.hoy(),
    value: null,
    source: String(VALUATION_SOURCE.manual),
    reference: '',
  });
  readonly formulario = form(
    this.modelo,
    esquemaDeValorizacion((clave) => this.i18n.t(clave)),
    { name: 'valorizacion', submission: { action: async () => this.save() } },
  );
  readonly sourceOptions = computed<readonly UiOption[]>(() => [
    { value: String(VALUATION_SOURCE.marketPrice), label: this.i18n.t('form.investment.valuation.source.marketPrice') },
    { value: String(VALUATION_SOURCE.statement), label: this.i18n.t('form.investment.valuation.source.statement') },
    { value: String(VALUATION_SOURCE.manual), label: this.i18n.t('form.investment.valuation.source.manual') },
  ]);

  mensaje(campo: FieldTree<unknown>): string {
    const estado = campo();
    return estado.touched() ? (estado.errors()[0]?.message ?? '') : '';
  }

  async save(): Promise<void> {
    const datos = this.modelo();
    try {
      this.error.set('');
      if (!this.capabilities.allows(P.patrimonio.inversiones.editar))
        throw new Error(this.i18n.t('form.investment.valuation.error.forbidden'));
      await this.commands.addInvestmentValuation(this.investmentId, {
        date: datos.date,
        value: Number(datos.value),
        currency: this.currency(),
        source: Number(datos.source),
        reference: datos.reference,
      });
    } catch (error) {
      this.error.set(
        error instanceof Error ? error.message : this.i18n.t('form.investment.valuation.error.saveFailed'),
      );
    }
  }
}
