import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { I18nService } from './core/i18n';
import { P } from './core/permissions';
import { CAPABILITIES, DemoStore } from './core/store';
import { OverlayComponent } from './ui/ui';
import { UiOption, UiSelectComponent } from './ui/select';

@Component({
  selector: 'demo-account-form',
  standalone: true,
  imports: [FormsModule, OverlayComponent, UiSelectComponent],
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

@Component({
  selector: 'demo-management-form',
  standalone: true,
  imports: [FormsModule, OverlayComponent, UiSelectComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './management-form.html',
  styleUrl: './management-form.css',
})
export class ManagementFormComponent {
  private readonly capabilities = inject(CAPABILITIES);
  readonly store = inject(DemoStore);
  readonly i18n = inject(I18nService);
  readonly error = signal('');
  readonly kind = computed(() => this.store.form()?.kind ?? 'category');
  readonly title = computed(
    () =>
      ({
        category: this.i18n.t('form.management.title.category'),
        person: this.i18n.t('form.management.title.person'),
        investment: this.i18n.t('form.management.title.investment'),
        recurrence: this.i18n.t('form.management.title.recurrence'),
      })[this.kind()] ?? this.i18n.t('form.management.title.default'),
  );
  name = '';
  color = '#4f46e5';
  icon = '●';
  categoryType: 'income' | 'expense' = 'expense';
  readonly categoryTypeOptions = computed<readonly UiOption[]>(() => [
    { value: 'expense', label: this.i18n.t('form.management.categoryType.expense') },
    { value: 'income', label: this.i18n.t('form.management.categoryType.income') },
  ]);
  email = '';
  relationship: import('./core/demo-data').Person['relationship'] = 'Otro';
  readonly relationshipOptions = computed<readonly UiOption[]>(() => [
    { value: 'Familia', label: this.i18n.t('form.management.relationship.family') },
    { value: 'Amistad', label: this.i18n.t('form.management.relationship.friendship') },
    { value: 'Trabajo', label: this.i18n.t('form.management.relationship.work') },
    { value: 'Cliente', label: this.i18n.t('form.management.relationship.client') },
    { value: 'Proveedor', label: this.i18n.t('form.management.relationship.supplier') },
    { value: 'Otro', label: this.i18n.t('form.management.relationship.other') },
  ]);
  readonly instrumentOptions = computed<readonly UiOption[]>(() => [
    { value: 'CDT', label: this.i18n.t('form.management.instrument.cdt') },
    { value: 'Fondo', label: this.i18n.t('form.management.instrument.fund') },
    { value: 'Acción', label: this.i18n.t('form.management.instrument.stock') },
    { value: 'Criptoactivo', label: this.i18n.t('form.management.instrument.crypto') },
  ]);
  readonly currencyOptions = computed<readonly UiOption[]>(() => [
    { value: 'COP', label: this.i18n.t('form.currency.cop') },
    { value: 'USD', label: this.i18n.t('form.currency.usd') },
  ]);
  readonly frequencyOptions = computed<readonly UiOption[]>(() => [
    { value: '2', label: this.i18n.t('form.frequency.weekly') },
    { value: '3', label: this.i18n.t('form.frequency.monthly') },
    { value: '4', label: this.i18n.t('form.frequency.yearly') },
  ]);
  readonly accountOptions = computed<readonly UiOption[]>(() => [
    { value: '', label: this.i18n.t('form.actions.select') },
    ...this.store.data().accounts.map((account) => ({ value: account.id, label: account.name })),
  ]);
  instrument = 'CDT';
  currency = 'COP';
  amount = 0;
  accountId = '';
  frequency = '3';
  start = new Date().toISOString().slice(0, 10);
  async save() {
    try {
      this.error.set('');
      const permisos: Record<string, string> = {
        category: P.cuentas.categorias.crear,
        person: P.personas.crear,
        investment: P.patrimonio.inversiones.crear,
        recurrence: P.calendario.recurrencias.crear,
      };
      const permiso = permisos[this.kind()];
      if (permiso && !this.capabilities.allows(permiso)) throw new Error(this.i18n.t('form.error.forbidden'));
      if (!this.name.trim()) throw new Error(this.i18n.t('form.management.error.nameRequired'));
      if (this.kind() === 'category')
        await this.store.createCategory(this.name, this.color, this.icon, this.categoryType);
      if (this.kind() === 'person') await this.store.createPerson(this.name, this.email, this.relationship);
      if (this.kind() === 'investment') await this.store.createInvestment(this.name, this.instrument, this.currency);
      if (this.kind() === 'recurrence')
        await this.store.createRecurrence(
          this.name,
          Number(this.amount),
          this.accountId,
          Number(this.frequency),
          this.start,
        );
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : this.i18n.t('form.management.error.saveFailed'));
    }
  }
}
