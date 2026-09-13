import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { I18nService } from './core/i18n';
import { P } from './core/permissions';
import { CAPABILITIES, CapabilitiesProvider, DemoStore } from './core/store';
import { OverlayComponent } from './ui/ui';
import { UiOption, UiSelectComponent } from './ui/select';

type FormField = {
  key: string;
  label: string;
  type: 'text' | 'date' | 'number' | 'select';
  options?: { value: string; label: string }[];
  required?: boolean;
};
function movementFields(kind: string, store: DemoStore, caps: CapabilitiesProvider, i18n: I18nService): FormField[] {
  const accountTypeLabel = (type: string) =>
    type === 'credit'
      ? i18n.t('form.account.type.credit')
      : type === 'savings'
        ? i18n.t('form.account.type.savings')
        : i18n.t('form.account.type.cash');
  const validAccounts = store
    .data()
    .accounts.filter((a) => kind === 'expense' || a.type !== 'credit')
    .filter((a) => a.type !== 'credit' || caps.allows(P.movimientos.creditos.crear));
  const accounts = validAccounts.map((a) => ({
    value: a.id,
    label: `${a.name} · ${accountTypeLabel(a.type)}`,
  }));
  const common: FormField[] = [
    { key: 'date', label: i18n.t('form.movement.field.date'), type: 'date', required: true },
    {
      key: 'accountId',
      label:
        kind === 'transfer' || kind === 'payment'
          ? i18n.t('form.movement.field.sourceAccount')
          : i18n.t('form.movement.field.account'),
      type: 'select',
      options:
        kind === 'transfer' ? accounts.filter((option) => store.account(option.value)?.type !== 'credit') : accounts,
      required: true,
    },
  ];
  if (kind === 'transfer')
    common.push({
      key: 'targetId',
      label: i18n.t('form.movement.field.targetAccount'),
      type: 'select',
      options: accounts,
      required: true,
    });
  return [
    ...common,
    { key: 'description', label: i18n.t('form.movement.field.description'), type: 'text', required: true },
    { key: 'amount', label: i18n.t('form.field.amount'), type: 'number', required: true },
    {
      key: 'category',
      label: i18n.t('form.movement.field.category'),
      type: 'select',
      options: [
        { value: 'Alimentación', key: 'form.movement.category.food' },
        { value: 'Vivienda', key: 'form.movement.category.housing' },
        { value: 'Transporte', key: 'form.movement.category.transport' },
        { value: 'Salario', key: 'form.movement.category.salary' },
        { value: 'Transferencias', key: 'form.movement.category.transfers' },
        { value: 'Pago de tarjeta', key: 'form.movement.category.cardPayment' },
        { value: 'Préstamos', key: 'form.movement.category.loans' },
        { value: 'Inversiones', key: 'form.movement.category.investments' },
        { value: 'Otros', key: 'form.movement.category.other' },
      ].map((x) => ({ value: x.value, label: i18n.t(x.key) })),
    },
    {
      key: 'person',
      label: i18n.t('form.movement.field.person'),
      type: 'select',
      options: [
        { value: '', label: i18n.t('form.movement.person.own') },
        ...store.data().people.map((p) => ({ value: p.name, label: i18n.t('form.movement.person.borrowed', { name: p.name }) })),
      ],
    },
    ...(kind === 'expense'
      ? [
          {
            key: 'recurring',
            label: i18n.t('form.movement.field.recurring'),
            type: 'select' as const,
            options: [
              { value: 'false', label: i18n.t('form.movement.recurring.no') },
              { value: 'true', label: i18n.t('form.movement.recurring.yes') },
            ],
          },
          {
            key: 'recurrence',
            label: i18n.t('form.frequency.label'),
            type: 'select' as const,
            options: ['weekly', 'monthly', 'yearly'].map((value) => ({
              value,
              label:
                value === 'weekly'
                  ? i18n.t('form.frequency.weekly')
                  : value === 'monthly'
                    ? i18n.t('form.frequency.monthly')
                    : i18n.t('form.frequency.yearly'),
            })),
          },
          { key: 'installmentCurrent', label: i18n.t('form.movement.field.installmentCurrent'), type: 'number' as const },
          { key: 'installmentTotal', label: i18n.t('form.movement.field.installmentTotal'), type: 'number' as const },
          {
            key: 'originalCurrency',
            label: i18n.t('form.movement.field.originalCurrency'),
            type: 'select' as const,
            options: [
              { value: 'COP', label: i18n.t('form.currency.cop') },
              { value: 'USD', label: i18n.t('form.movement.currency.usdShort') },
            ],
          },
          { key: 'originalAmount', label: i18n.t('form.movement.field.originalAmount'), type: 'number' as const },
          { key: 'exchangeRate', label: i18n.t('form.movement.field.exchangeRate'), type: 'number' as const },
        ]
      : []),
    ...(kind === 'income' || kind === 'expense'
      ? [
          {
            key: 'loanRole',
            label: i18n.t('form.movement.field.loanRole'),
            type: 'select' as const,
            options: [
              { value: '', label: i18n.t('form.movement.loanRole.none') },
              ...(caps.allows(P.personas.prestamos.crear)
                ? [{ value: 'lent', label: i18n.t('form.movement.loanRole.lent') }]
                : []),
              ...(caps.allows(P.personas.deudas.crear)
                ? [{ value: 'borrowed', label: i18n.t('form.movement.loanRole.borrowed') }]
                : []),
              { value: 'repayment', label: i18n.t('form.movement.loanRole.repayment') },
            ],
          },
          {
            key: 'loanProduct',
            label: i18n.t('form.movement.field.loanProduct'),
            type: 'select' as const,
            options: [
              { value: 'personal', label: i18n.t('form.movement.loanProduct.personal') },
              { value: 'mortgage', label: i18n.t('form.movement.loanProduct.mortgage') },
              { value: 'vehicle', label: i18n.t('form.movement.loanProduct.vehicle') },
              { value: 'education', label: i18n.t('form.movement.loanProduct.education') },
              { value: 'other', label: i18n.t('form.movement.loanProduct.other') },
            ],
          },
        ]
      : []),
  ];
}
@Component({
  selector: 'demo-movement-form',
  standalone: true,
  imports: [FormsModule, OverlayComponent, UiSelectComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './movement-form.html',
  styleUrl: './movement-form.css',
})
export class MovementFormComponent {
  readonly store = inject(DemoStore);
  private readonly capabilities = inject(CAPABILITIES);
  readonly i18n = inject(I18nService);
  readonly error = signal('');
  /**
   * Cada figura del ledger se libera por separado: se puede conceder registrar gastos
   * sin conceder transferir. La lista se recorta a lo concedido para que no aparezca un
   * botón que el servidor va a rechazar con un 403.
   */
  readonly types = computed(() =>
    [
      { value: 'expense', label: this.i18n.t('form.movement.type.expense'), permiso: P.movimientos.crear },
      { value: 'income', label: this.i18n.t('form.movement.type.income'), permiso: P.movimientos.crear },
      {
        value: 'transfer',
        label: this.i18n.t('form.movement.type.transfer'),
        permiso: P.movimientos.transferencias.crear,
      },
    ].filter((t) => this.capabilities.allows(t.permiso)),
  );
  model: Record<string, any> = {};
  readonly fields = computed(() =>
    movementFields(this.store.form()?.kind ?? 'expense', this.store, this.capabilities, this.i18n),
  );
  selectOptions(field: FormField): readonly UiOption[] {
    return [{ value: '', label: this.i18n.t('form.actions.select') }, ...(field.options ?? [])];
  }
  readonly title = computed(() =>
    this.store.form()?.notificationId
      ? this.i18n.t('form.movement.title.review')
      : this.store.form()?.movement
        ? this.i18n.t('form.movement.title.edit')
        : this.i18n.t('form.movement.title.create'),
  );
  constructor() {
    const context = this.store.form()!;
    const m = context.movement;
    this.model = {
      kind: context.kind,
      date: m?.date ?? '2026-08-31',
      accountId: context.accountId ?? m?.accountId ?? '',
      targetId: context.targetId ?? '',
      description: m?.description ?? '',
      amount: Math.abs(m?.amount ?? 0),
      category: m?.category ?? 'Otros',
      person: m?.person ?? '',
      id: m?.id,
      notificationId: context.notificationId,
      ownership: m?.ownership ?? 'own',
      recurring: String(m?.recurring ?? false),
      recurrence: m?.recurrence ?? 'monthly',
      installmentCurrent: m?.installmentCurrent ?? 1,
      installmentTotal: m?.installmentTotal ?? 1,
      loanRole: m?.loanRole ?? '',
      loanProduct: '',
      originalCurrency: m?.originalCurrency ?? 'COP',
      originalAmount: m?.originalAmount ?? 0,
      exchangeRate: m?.exchangeRate ?? 4168.35,
    };
  }
  setKind(kind: string) {
    this.model.kind = kind;
    this.store.form.update((v) => (v ? { ...v, kind } : v));
  }
  fieldVisible(key: string): boolean {
    if (key === 'recurrence') return this.model['recurring'] === 'true';
    if (key === 'installmentCurrent' || key === 'installmentTotal')
      return this.store.account(this.model['accountId'])?.type === 'credit';
    if (key === 'originalAmount' || key === 'exchangeRate') return this.model['originalCurrency'] === 'USD';
    if (key === 'loanRole') return this.capabilities.allows(P.movimientos.prestamos.crear);
    if (key === 'loanProduct')
      return !!this.model['loanRole'] && this.capabilities.allows(P.movimientos.creditos.crear);
    return true;
  }
  async submit() {
    try {
      this.error.set('');
      // Ultima linea antes de escribir. El servidor tiene la palabra final, pero
      // avisar aqui evita mandar una peticion que va a volver con 403.
      const permiso =
        this.model.kind === 'transfer'
          ? P.movimientos.transferencias.crear
          : this.model.kind === 'payment'
            ? P.movimientos.pagos.crear
            : this.model.id
              ? P.movimientos.editar
              : P.movimientos.crear;
      if (!this.capabilities.allows(permiso)) throw new Error(this.i18n.t('form.error.forbidden'));
      if (this.model['loanRole'] && !this.capabilities.allows(P.movimientos.prestamos.crear))
        throw new Error(this.i18n.t('form.movement.error.loanForbidden'));
      if (this.model['loanProduct'] && !this.capabilities.allows(P.movimientos.creditos.crear))
        throw new Error(this.i18n.t('form.movement.error.creditForbidden'));
      const source = this.store.account(this.model['accountId']);
      // Un gasto cargado a una tarjeta se registra como compra a crédito, no como gasto
      // corriente: es otra clase de movimiento y otra concesión.
      if (source?.type === 'credit' && !this.capabilities.allows(P.movimientos.creditos.crear))
        throw new Error(this.i18n.t('form.movement.error.creditPurchaseForbidden'));
      const target = this.store.account(this.model['targetId']);
      if (this.model.kind === 'transfer' && (source?.type === 'credit' || target?.type === 'credit'))
        throw new Error(this.i18n.t('form.movement.error.transferCreditForbidden'));
      if (this.model.kind === 'income' && source?.type === 'credit')
        throw new Error(this.i18n.t('form.movement.error.incomeCreditForbidden'));
      await this.store.save(this.model as any);
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : this.i18n.t('form.movement.error.saveFailed'));
    }
  }
}
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
      if (this.kind() === 'category') await this.store.createCategory(this.name, this.color, this.icon);
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
