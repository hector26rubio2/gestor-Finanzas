import { Component, computed, inject, signal } from '@angular/core';
import { FormField, FormRoot, form, type FieldTree } from '@angular/forms/signals';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmInput } from '@spartan-ng/helm/input';
import { INVESTMENT_OPERATION } from '@core/api';
import { I18nService } from '@core/i18n';
import { P } from '@core/session';
import { AppStore, CAPABILITIES, CatalogCommands } from '@core/state';
import { DateFieldComponent } from '@ui/date-field';
import { FieldComponent } from '@ui/field';
import { IconComponent } from '@ui/icon';
import { NumericInputDirective } from '@ui/numeric-input';
import { OverlayComponent } from '@ui/overlay';
import { UiOption, UiSelectComponent } from '@ui/select';
import { type DatosDeOperacion, esquemaDeOperacion } from './investment-operation.schema';

const TIPOS: readonly (readonly [number, string])[] = [
  [INVESTMENT_OPERATION.contribution, 'contribution'],
  [INVESTMENT_OPERATION.withdrawal, 'withdrawal'],
  [INVESTMENT_OPERATION.buy, 'buy'],
  [INVESTMENT_OPERATION.sell, 'sell'],
  [INVESTMENT_OPERATION.dividend, 'dividend'],
  [INVESTMENT_OPERATION.fee, 'fee'],
];

@Component({
  selector: 'fin-investment-operation',
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
  templateUrl: './investment-operation.html',
})
export class InvestmentOperationComponent {
  private readonly capabilities = inject(CAPABILITIES);
  private readonly commands = inject(CatalogCommands);
  readonly store = inject(AppStore);
  readonly i18n = inject(I18nService);
  readonly error = signal('');
  readonly investmentId = this.store.form()?.targetId ?? '';
  readonly investment = computed(() => this.store.data().investments.find((item) => item.id === this.investmentId));
  readonly modelo = signal<DatosDeOperacion>({
    type: String(INVESTMENT_OPERATION.contribution),
    date: this.store.hoy(),
    amount: null,
    account: '',
    quantity: null,
    unitPrice: null,
    description: '',
  });
  readonly formulario = form(
    this.modelo,
    esquemaDeOperacion((clave) => this.i18n.t(clave)),
    { name: 'operacion', submission: { action: async () => this.save() } },
  );
  readonly currency = computed(() => this.investment()?.currency ?? this.store.baseCurrency());
  readonly conCantidad = computed(() => {
    const tipo = Number(this.modelo().type);
    return tipo === INVESTMENT_OPERATION.buy || tipo === INVESTMENT_OPERATION.sell;
  });
  readonly typeOptions = computed<readonly UiOption[]>(() =>
    TIPOS.map(([valor, clave]) => ({
      value: String(valor),
      label: this.i18n.t(`form.investment.operation.type.${clave}`),
    })),
  );
  readonly accountOptions = computed<readonly UiOption[]>(() => [
    { value: '', label: this.i18n.t('form.investment.operation.account.none') },
    ...this.store
      .data()
      .accounts.filter((account) => account.type !== 'credit' && account.currency === this.currency())
      .map((account) => ({ value: account.id, label: account.name })),
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
        throw new Error(this.i18n.t('form.investment.operation.error.forbidden'));
      await this.commands.registerInvestmentOperation(this.investmentId, {
        type: Number(datos.type),
        date: datos.date,
        amount: Number(datos.amount),
        currency: this.currency(),
        account: datos.account || undefined,
        quantity: this.conCantidad() ? Number(datos.quantity) : undefined,
        unitPrice: this.conCantidad() ? Number(datos.unitPrice) : undefined,
        description: datos.description,
      });
    } catch (error) {
      this.error.set(
        error instanceof Error ? error.message : this.i18n.t('form.investment.operation.error.saveFailed'),
      );
    }
  }
}
