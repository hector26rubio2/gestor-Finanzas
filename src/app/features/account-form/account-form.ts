import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { I18nService } from '../../core/i18n';
import { P } from '../../core/permissions';
import { CAPABILITIES, DemoStore } from '../../core/store';
import { OverlayComponent } from '../../ui/ui';
import { UiOption, UiSelectComponent } from '../../ui/select';
import { NumericInputDirective } from '../../ui/numeric-input.directive';
import { FieldComponent } from '../../ui/field';

@Component({
  selector: 'demo-account-form',
  standalone: true,
  imports: [FormsModule, OverlayComponent, UiSelectComponent, NumericInputDirective, FieldComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './account-form.html',
  styleUrl: './account-form.css',
})
export class AccountFormComponent {
  private readonly capabilities = inject(CAPABILITIES);
  readonly i18n = inject(I18nService);
  readonly error = signal('');
  name = 'Ahorro principal';

  /** Un tipo de cuenta por permiso: se puede dar el ahorro y retener la tarjeta. */
  readonly accountTypes = computed(() =>
    [
      { value: 'savings' as const, label: this.i18n.t('form.account.type.savings'), permiso: P.cuentas.ahorro.crear },
      { value: 'cash' as const, label: this.i18n.t('form.account.type.cash'), permiso: P.cuentas.efectivo.crear },
      { value: 'credit' as const, label: this.i18n.t('form.account.type.credit'), permiso: P.cuentas.tarjetas.crear },
    ].filter((option) => this.capabilities.allows(option.permiso)),
  );
  type: 'savings' | 'cash' | 'credit' = 'savings';
  currency = 'COP';
  readonly currencyOptions = computed<readonly UiOption[]>(() => [
    { value: 'COP', label: this.i18n.t('form.currency.cop') },
    { value: 'USD', label: this.i18n.t('form.currency.usd') },
  ]);
  readonly paymentOrderOptions = computed<readonly UiOption[]>(() => [
    { value: 'oldest', label: this.i18n.t('form.account.paymentOrder.oldest') },
    { value: 'highest-rate', label: this.i18n.t('form.account.paymentOrder.highestRate') },
    { value: 'smallest', label: this.i18n.t('form.account.paymentOrder.smallest') },
  ]);
  readonly paymentPriorityOptions = computed<readonly UiOption[]>(() => [
    { value: 'fees-interest-capital', label: this.i18n.t('form.account.paymentPriority.feesInterestCapital') },
    { value: 'interest-capital', label: this.i18n.t('form.account.paymentPriority.interestCapital') },
    { value: 'capital', label: this.i18n.t('form.account.paymentPriority.capital') },
  ]);
  exchangeRate = 4168.35;
  opening = 0;
  limit = 5000000;
  cutDay = 20;
  dueDay = 5;
  annualRate = 28.5;
  paymentOrder = 'oldest';
  paymentPriority = 'fees-interest-capital';
  minimumPayment = 50000;
  private store = inject(DemoStore);
  closed = () => this.store.form.set(null);
  async save() {
    try {
      this.error.set('');
      // Una tarjeta la crea quien administra tarjetas; una cuenta, quien administra cuentas.
      const permiso =
        this.type === 'credit'
          ? P.cuentas.tarjetas.crear
          : this.type === 'cash'
            ? P.cuentas.efectivo.crear
            : P.cuentas.ahorro.crear;
      if (!this.capabilities.allows(permiso)) throw new Error(this.i18n.t('form.account.error.forbidden'));
      await this.store.createAccount(
        this.name,
        this.type,
        Number(this.opening),
        this.currency,
        Number(this.exchangeRate),
        {
          limit: Number(this.limit),
          cutDay: Number(this.cutDay),
          dueDay: Number(this.dueDay),
        },
      );
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : this.i18n.t('form.account.error.saveFailed'));
    }
  }
}
