import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
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
function movementFields(kind: string, store: DemoStore, caps: CapabilitiesProvider): FormField[] {
  const validAccounts = store
    .data()
    .accounts.filter((a) => kind === 'expense' || a.type !== 'credit')
    .filter((a) => a.type !== 'credit' || caps.allows(P.movimientos.creditos.crear));
  const accounts = validAccounts.map((a) => ({
    value: a.id,
    label: `${a.name} · ${a.type === 'credit' ? 'Crédito' : a.type === 'savings' ? 'Ahorros' : 'Efectivo'}`,
  }));
  const common: FormField[] = [
    { key: 'date', label: 'Fecha', type: 'date', required: true },
    {
      key: 'accountId',
      label: kind === 'transfer' || kind === 'payment' ? 'Cuenta de origen' : 'Cuenta o tarjeta',
      type: 'select',
      options:
        kind === 'transfer' ? accounts.filter((option) => store.account(option.value)?.type !== 'credit') : accounts,
      required: true,
    },
  ];
  if (kind === 'transfer')
    common.push({
      key: 'targetId',
      label: 'Cuenta destino',
      type: 'select',
      options: accounts,
      required: true,
    });
  return [
    ...common,
    { key: 'description', label: 'Descripción', type: 'text', required: true },
    { key: 'amount', label: 'Importe', type: 'number', required: true },
    {
      key: 'category',
      label: 'Categoría',
      type: 'select',
      options: [
        'Alimentación',
        'Vivienda',
        'Transporte',
        'Salario',
        'Transferencias',
        'Pago de tarjeta',
        'Préstamos',
        'Inversiones',
        'Otros',
      ].map((x) => ({ value: x, label: x })),
    },
    {
      key: 'person',
      label: 'Responsabilidad',
      type: 'select',
      options: [
        { value: '', label: 'Propia' },
        ...store.data().people.map((p) => ({ value: p.name, label: 'Prestada · ' + p.name })),
      ],
    },
    ...(kind === 'expense'
      ? [
          {
            key: 'recurring',
            label: '¿Es recurrente?',
            type: 'select' as const,
            options: [
              { value: 'false', label: 'No' },
              { value: 'true', label: 'Sí' },
            ],
          },
          {
            key: 'recurrence',
            label: 'Frecuencia',
            type: 'select' as const,
            options: ['weekly', 'monthly', 'yearly'].map((value) => ({
              value,
              label: value === 'weekly' ? 'Semanal' : value === 'monthly' ? 'Mensual' : 'Anual',
            })),
          },
          { key: 'installmentCurrent', label: 'Cuota actual', type: 'number' as const },
          { key: 'installmentTotal', label: 'Total de cuotas', type: 'number' as const },
          {
            key: 'originalCurrency',
            label: 'Moneda de compra',
            type: 'select' as const,
            options: [
              { value: 'COP', label: 'COP · Peso colombiano' },
              { value: 'USD', label: 'USD · Dólar' },
            ],
          },
          { key: 'originalAmount', label: 'Importe original (USD)', type: 'number' as const },
          { key: 'exchangeRate', label: 'TRM aplicada (COP/USD)', type: 'number' as const },
        ]
      : []),
    ...(kind === 'income' || kind === 'expense'
      ? [
          {
            key: 'loanRole',
            label: 'Relación de préstamo',
            type: 'select' as const,
            options: [
              { value: '', label: 'No es préstamo' },
              ...(caps.allows(P.personas.prestamos.crear) ? [{ value: 'lent', label: 'Dinero que presté' }] : []),
              ...(caps.allows(P.personas.deudas.crear)
                ? [{ value: 'borrowed', label: 'Dinero que me prestaron' }]
                : []),
              { value: 'repayment', label: 'Pago o devolución de préstamo' },
            ],
          },
          {
            key: 'loanProduct',
            label: 'Tipo de préstamo o crédito',
            type: 'select' as const,
            options: [
              { value: 'personal', label: 'Préstamo personal' },
              { value: 'mortgage', label: 'Crédito hipotecario' },
              { value: 'vehicle', label: 'Crédito de vehículo' },
              { value: 'education', label: 'Crédito educativo' },
              { value: 'other', label: 'Otro' },
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
  readonly error = signal('');
  /**
   * Cada figura del ledger se libera por separado: se puede conceder registrar gastos
   * sin conceder transferir. La lista se recorta a lo concedido para que no aparezca un
   * botón que el servidor va a rechazar con un 403.
   */
  readonly types = computed(() =>
    [
      { value: 'expense', label: 'Gasto', permiso: P.movimientos.crear },
      { value: 'income', label: 'Ingreso', permiso: P.movimientos.crear },
      { value: 'transfer', label: 'Transferencia', permiso: P.movimientos.transferencias.crear },
    ].filter((t) => this.capabilities.allows(t.permiso)),
  );
  model: Record<string, any> = {};
  readonly fields = computed(() => movementFields(this.store.form()?.kind ?? 'expense', this.store, this.capabilities));
  selectOptions(field: FormField): readonly UiOption[] {
    return [{ value: '', label: 'Selecciona' }, ...(field.options ?? [])];
  }
  readonly title = computed(() =>
    this.store.form()?.notificationId
      ? 'Revisar compra detectada'
      : this.store.form()?.movement
        ? 'Editar movimiento'
        : 'Nuevo movimiento',
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
      if (!this.capabilities.allows(permiso)) throw new Error('Tu acceso no permite esta operación.');
      if (this.model['loanRole'] && !this.capabilities.allows(P.movimientos.prestamos.crear))
        throw new Error('Tu acceso no permite registrar préstamos.');
      if (this.model['loanProduct'] && !this.capabilities.allows(P.movimientos.creditos.crear))
        throw new Error('Tu acceso no permite registrar créditos.');
      const source = this.store.account(this.model['accountId']);
      // Un gasto cargado a una tarjeta se registra como compra a crédito, no como gasto
      // corriente: es otra clase de movimiento y otra concesión.
      if (source?.type === 'credit' && !this.capabilities.allows(P.movimientos.creditos.crear))
        throw new Error('Tu acceso no permite registrar compras a crédito.');
      const target = this.store.account(this.model['targetId']);
      if (this.model.kind === 'transfer' && (source?.type === 'credit' || target?.type === 'credit'))
        throw new Error(
          'Las transferencias solo están disponibles entre cuentas de efectivo o ahorro. Usa avance o compra para una tarjeta.',
        );
      if (this.model.kind === 'income' && source?.type === 'credit')
        throw new Error('Un ingreso no puede registrarse directamente en una tarjeta de crédito.');
      await this.store.save(this.model as any);
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'No se pudo guardar');
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
  readonly error = signal('');
  name = 'Ahorro principal';

  /** Un tipo de cuenta por permiso: se puede dar el ahorro y retener la tarjeta. */
  readonly accountTypes = computed(() =>
    [
      { value: 'savings' as const, label: 'Ahorros', permiso: P.cuentas.ahorro.crear },
      { value: 'cash' as const, label: 'Efectivo', permiso: P.cuentas.efectivo.crear },
      { value: 'credit' as const, label: 'Crédito', permiso: P.cuentas.tarjetas.crear },
    ].filter((option) => this.capabilities.allows(option.permiso)),
  );
  type: 'savings' | 'cash' | 'credit' = 'savings';
  currency = 'COP';
  readonly currencyOptions: readonly UiOption[] = [
    { value: 'COP', label: 'COP · Peso colombiano' },
    { value: 'USD', label: 'USD · Dólar estadounidense' },
  ];
  readonly paymentOrderOptions: readonly UiOption[] = [
    { value: 'oldest', label: 'Compras más antiguas' },
    { value: 'highest-rate', label: 'Mayor tasa primero' },
    { value: 'smallest', label: 'Menor saldo primero' },
  ];
  readonly paymentPriorityOptions: readonly UiOption[] = [
    { value: 'fees-interest-capital', label: 'Comisiones, intereses y capital' },
    { value: 'interest-capital', label: 'Intereses y capital' },
    { value: 'capital', label: 'Capital' },
  ];
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
      if (!this.capabilities.allows(permiso)) throw new Error('Tu acceso no permite crear cuentas.');
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
      this.error.set(error instanceof Error ? error.message : 'No fue posible crear la cuenta.');
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
  readonly error = signal('');
  readonly kind = computed(() => this.store.form()?.kind ?? 'category');
  readonly title = computed(
    () =>
      ({
        category: 'Nueva categoría',
        person: 'Nueva persona',
        investment: 'Nueva inversión',
        recurrence: 'Nueva recurrencia',
      })[this.kind()] ?? 'Nuevo registro',
  );
  name = '';
  color = '#4f46e5';
  icon = '●';
  email = '';
  relationship: import('./core/demo-data').Person['relationship'] = 'Otro';
  readonly relationshipOptions: readonly UiOption[] = [
    'Familia',
    'Amistad',
    'Trabajo',
    'Cliente',
    'Proveedor',
    'Otro',
  ].map((label) => ({ value: label, label }));
  readonly instrumentOptions: readonly UiOption[] = ['CDT', 'Fondo', 'Acción', 'Criptoactivo'].map((label) => ({
    value: label,
    label,
  }));
  readonly currencyOptions: readonly UiOption[] = [
    { value: 'COP', label: 'COP · Peso colombiano' },
    { value: 'USD', label: 'USD · Dólar estadounidense' },
  ];
  readonly frequencyOptions: readonly UiOption[] = [
    { value: '2', label: 'Semanal' },
    { value: '3', label: 'Mensual' },
    { value: '4', label: 'Anual' },
  ];
  readonly accountOptions = computed<readonly UiOption[]>(() => [
    { value: '', label: 'Selecciona' },
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
      if (permiso && !this.capabilities.allows(permiso)) throw new Error('Tu acceso no permite esta operación.');
      if (!this.name.trim()) throw new Error('El nombre es obligatorio.');
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
      this.error.set(error instanceof Error ? error.message : 'No fue posible guardar.');
    }
  }
}
