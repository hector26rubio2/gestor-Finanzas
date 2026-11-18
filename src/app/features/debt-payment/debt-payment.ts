import { Component, computed, inject, signal } from '@angular/core';
import { FormField, FormRoot, form, type FieldTree } from '@angular/forms/signals';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmInput } from '@spartan-ng/helm/input';
import { I18nService } from '@core/i18n';
import { AppStore, PeopleCommands } from '@core/state';
import { formatNumber } from '@core/utils';
import { PeopleStore } from '@features/people';
import { DateFieldComponent } from '@ui/date-field';
import { FieldComponent } from '@ui/field';
import { IconComponent } from '@ui/icon';
import { MontoInputDirective } from '@ui/monto-input';
import { FinAcciones, OverlayComponent } from '@ui/overlay';
import { UiOption, UiSelectComponent } from '@ui/select';
import { type DatosDeAbono, esquemaDeAbono } from './debt-payment.schema';

@Component({
  selector: 'fin-debt-payment',
  imports: [
    DateFieldComponent,
    FieldComponent,
    FormField,
    FormRoot,
    HlmButton,
    HlmInput,
    IconComponent,
    MontoInputDirective,
    OverlayComponent,
    FinAcciones,
    UiSelectComponent,
  ],
  templateUrl: './debt-payment.html',
})
export class DebtPaymentComponent {
  private readonly commands = inject(PeopleCommands);
  private readonly people = inject(PeopleStore);
  readonly store = inject(AppStore);
  readonly i18n = inject(I18nService);
  readonly error = signal('');
  readonly debtId = this.store.form()?.targetId ?? '';
  readonly debt = computed(() => this.people.deudas().find((deuda) => deuda.id === this.debtId));
  readonly currency = computed(() => this.debt()?.moneda ?? this.store.baseCurrency());
  readonly pending = computed(() => this.debt()?.pendiente ?? 0);
  readonly accounts = computed(() =>
    this.store.data().accounts.filter((cuenta) => cuenta.type !== 'credit' && cuenta.currency === this.currency()),
  );
  readonly accountOptions = computed<readonly UiOption[]>(() =>
    this.accounts().map((cuenta) => ({ value: cuenta.id, label: cuenta.name })),
  );
  readonly pendingText = computed(() =>
    this.i18n.t('form.debtPayment.hint.pending', {
      amount: formatNumber(this.pending(), this.currency(), this.store.preferences().locale),
    }),
  );
  readonly modelo = signal<DatosDeAbono>({
    date: this.store.hoy(),
    amount: this.montoInicial(),
    account: this.cuentaInicial(),
    note: '',
  });
  readonly formulario = form(
    this.modelo,
    esquemaDeAbono(
      () => this.pending(),
      (clave) => this.i18n.t(clave),
    ),
    { name: 'abono-de-deuda', submission: { action: async () => this.save() } },
  );

  mensaje(campo: FieldTree<unknown>): string {
    const estado = campo();
    return estado.touched() ? (estado.errors()[0]?.message ?? '') : '';
  }

  async save(): Promise<void> {
    const datos = this.modelo();
    const deuda = this.debt();
    try {
      this.error.set('');
      if (!deuda) throw new Error(this.i18n.t('form.error.notFound'));
      await this.commands.abonarDeuda({
        obligationId: deuda.id,
        date: datos.date,
        amount: Number(datos.amount),
        currency: deuda.moneda,
        accountId: datos.account,
        note: datos.note,
      });
      this.people.recargar();
      this.store.form.set(null);
      this.store.toast.set(this.i18n.t('toast.debtPayment.created'));
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : this.i18n.t('form.debtPayment.error.saveFailed'));
    }
  }

  private montoInicial(): number | null {
    const deuda = this.debt();
    if (!deuda) return null;
    return Math.min(deuda.cuota ?? deuda.pendiente, deuda.pendiente) || null;
  }

  private cuentaInicial(): string {
    const cuentas = this.accounts();
    return (cuentas.find((cuenta) => cuenta.isDefault) ?? cuentas[0])?.id ?? '';
  }
}
