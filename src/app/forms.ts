import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DemoStore } from './core/store';
import { OverlayComponent } from './ui/ui';

type FormField = {
  key: string;
  label: string;
  type: 'text' | 'date' | 'number' | 'select';
  options?: { value: string; label: string }[];
  required?: boolean;
};
function movementFields(kind: string, store: DemoStore): FormField[] {
  const validAccounts = store.data().accounts.filter((a) => kind === 'expense' || a.type !== 'credit');
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
              { value: 'lent', label: 'Dinero que presté' },
              { value: 'borrowed', label: 'Dinero que me prestaron' },
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
  imports: [FormsModule, OverlayComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: ` <demo-overlay [title]="title()" mode="modal" (closed)="store.form.set(null)"
    ><form (ngSubmit)="submit()">
      <div class="types" role="group" aria-label="Tipo de movimiento">
        @for (t of types; track t.value) {
          <button
            type="button"
            [attr.aria-pressed]="model.kind === t.value"
            [class.selected]="model.kind === t.value"
            (click)="setKind(t.value)"
          >
            {{ t.label }}
          </button>
        }
      </div>
      <div class="form-grid">
        @for (field of fields(); track field.key) {
          @if (fieldVisible(field.key)) {
            <label [class.full]="field.key === 'description'"
              >{{ field.label }}
              @if (field.type === 'select') {
                <select [name]="field.key" [(ngModel)]="model[field.key]" [required]="!!field.required">
                  <option value="">Selecciona</option>
                  @for (o of field.options; track o.value) {
                    <option [value]="o.value">{{ o.label }}</option>
                  }
                </select>
              } @else {
                <input
                  [type]="field.type"
                  [name]="field.key"
                  [(ngModel)]="model[field.key]"
                  [required]="!!field.required"
                  [min]="field.type === 'number' ? 1 : null"
                />
              }
            </label>
          }
        }
      </div>
      @if (error()) {
        <p class="error" role="alert">{{ error() }}</p>
      }
      <footer>
        <button type="button" (click)="store.form.set(null)">Cancelar</button
        ><button class="primary" type="submit">Guardar movimiento</button>
      </footer>
    </form></demo-overlay
  >`,
  styles: [
    `
      form {
        display: flex;
        flex-direction: column;
        gap: 22px;
      }
      .types {
        display: flex;
        gap: 8px;
        overflow: auto;
        padding-bottom: 3px;
      }
      .types button {
        white-space: nowrap;
      }
      .selected {
        background: var(--accent) !important;
        color: var(--accent-contrast) !important;
        border-color: var(--accent) !important;
      }
      .form-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 16px;
      }
      .full {
        grid-column: 1/-1;
      }
      label {
        display: flex;
        flex-direction: column;
        gap: 7px;
        color: var(--muted);
        font-size: 0.75rem;
        font-weight: 600;
      }
      input,
      select,
      button {
        min-height: 41px;
        border: 1px solid var(--line);
        border-radius: 9px;
        background: var(--surface);
        color: var(--text);
        padding: 8px 11px;
        font: inherit;
      }
      footer {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
        padding-top: 18px;
        border-top: 1px solid var(--line);
      }
      .primary {
        background: var(--accent);
        color: var(--accent-contrast);
        border-color: var(--accent);
      }
      .simulation {
        border: 1px solid var(--line);
        border-radius: 12px;
        padding: 14px;
      }
      .simulation > div {
        display: flex;
        justify-content: space-between;
        gap: 12px;
      }
      .simulation small {
        color: var(--muted);
      }
      table {
        width: 100%;
        font-size: 0.78rem;
        margin-top: 12px;
        border-collapse: collapse;
      }
      th,
      td {
        text-align: right;
        padding: 9px;
        border-top: 1px solid var(--line);
      }
      th:first-child,
      td:first-child {
        text-align: left;
      }
      .error {
        color: var(--danger);
        margin: 0;
      }
      @media (max-width: 560px) {
        .form-grid {
          grid-template-columns: 1fr;
        }
        .full {
          grid-column: auto;
        }
        .simulation {
          overflow: auto;
        }
      }
    `,
  ],
})
export class MovementFormComponent {
  readonly store = inject(DemoStore);
  readonly error = signal('');
  readonly types = [
    { value: 'expense', label: 'Gasto' },
    { value: 'income', label: 'Ingreso' },
    { value: 'transfer', label: 'Transferencia' },
  ];
  model: Record<string, any> = {};
  readonly fields = computed(() => movementFields(this.store.form()?.kind ?? 'expense', this.store));
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
    if (key === 'loanProduct') return !!this.model['loanRole'];
    return true;
  }
  async submit() {
    try {
      this.error.set('');
      const source = this.store.account(this.model['accountId']);
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
  imports: [FormsModule, OverlayComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<demo-overlay title="Nueva cuenta" mode="modal" (closed)="closed()"
    ><form (ngSubmit)="save()">
      <label
        >Tipo<select name="type" [(ngModel)]="type">
          <option value="savings">Ahorros</option>
          <option value="cash">Efectivo</option>
          <option value="credit">Crédito</option>
        </select></label
      ><label>Nombre<input name="name" [(ngModel)]="name" required /></label
      ><label
        >Moneda<select name="currency" [(ngModel)]="currency">
          <option value="COP">COP</option>
          <option value="USD">USD</option>
        </select></label
      ><label>Saldo inicial<input name="opening" [(ngModel)]="opening" type="number" /></label>
      @if (currency === 'USD') {
        <label>TRM de referencia<input name="exchangeRate" [(ngModel)]="exchangeRate" type="number" min="1" /></label>
      }
      @if (type === 'credit') {
        <label>Cupo<input name="limit" [(ngModel)]="limit" type="number" min="1" required /></label>
        <label>Día de corte<input name="cutDay" [(ngModel)]="cutDay" type="number" min="1" max="31" required /></label>
        <label>Día de pago<input name="dueDay" [(ngModel)]="dueDay" type="number" min="1" max="31" required /></label>
        <label
          >Tasa E.A. (%)<input name="annualRate" [(ngModel)]="annualRate" type="number" min="0" step="0.01"
        /></label>
        <label
          >Orden del abono<select name="paymentOrder" [(ngModel)]="paymentOrder">
            <option value="oldest">Compras más antiguas</option>
            <option value="highest-rate">Mayor tasa primero</option>
            <option value="smallest">Menor saldo primero</option>
          </select></label
        >
        <label
          >Aplicar primero a<select name="paymentPriority" [(ngModel)]="paymentPriority">
            <option value="fees-interest-capital">Comisiones, intereses y capital</option>
            <option value="interest-capital">Intereses y capital</option>
            <option value="capital">Capital</option>
          </select></label
        >
        <label>Abono mínimo<input name="minimumPayment" [(ngModel)]="minimumPayment" type="number" min="0" /></label>
      }
      <p>Un saldo inicial distinto de cero crea un movimiento de apertura.</p>
      @if (error()) {
        <p class="error" role="alert">{{ error() }}</p>
      }
      <footer>
        <button type="button" (click)="closed()">Cancelar</button
        ><button class="primary" type="submit">Crear cuenta</button>
      </footer>
    </form></demo-overlay
  >`,
  styles: [
    `
      form {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 18px;
      }
      label {
        display: flex;
        flex-direction: column;
        gap: 7px;
        color: var(--muted);
        font-size: 0.76rem;
      }
      input,
      select,
      button {
        min-height: 42px;
        border: 1px solid var(--line);
        border-radius: 9px;
        background: var(--surface);
        color: var(--text);
        padding: 8px 11px;
      }
      p,
      footer {
        grid-column: 1/-1;
      }
      p {
        background: var(--accent-soft);
        padding: 12px;
        border-radius: 10px;
        font-size: 0.78rem;
      }
      footer {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
      }
      .primary {
        background: var(--accent);
        color: var(--accent-contrast);
      }
      @media (max-width: 500px) {
        form {
          grid-template-columns: 1fr;
        }
        p,
        footer {
          grid-column: auto;
        }
      }
    `,
  ],
})
export class AccountFormComponent {
  readonly error = signal('');
  name = 'Ahorro principal';
  type: 'savings' | 'cash' | 'credit' = 'savings';
  currency = 'COP';
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
  imports: [FormsModule, OverlayComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<demo-overlay [title]="title()" mode="modal" (closed)="store.form.set(null)">
    <form class="management-form" (ngSubmit)="save()">
      <label>Nombre<input name="name" [(ngModel)]="name" required /></label>
      @if (kind() === 'category') {
        <label>Color<input name="color" type="color" [(ngModel)]="color" /></label
        ><label>Icono<input name="icon" [(ngModel)]="icon" required /></label>
      }
      @if (kind() === 'person') {
        <label>Correo<input name="email" type="email" [(ngModel)]="email" /></label>
        <label
          >Relación<select name="relationship" [(ngModel)]="relationship">
            <option>Familia</option>
            <option>Amistad</option>
            <option>Trabajo</option>
            <option>Cliente</option>
            <option>Proveedor</option>
            <option>Otro</option>
          </select></label
        >
      }
      @if (kind() === 'investment') {
        <label
          >Instrumento<select name="instrument" [(ngModel)]="instrument">
            <option>CDT</option>
            <option>Fondo</option>
            <option>Acción</option>
            <option>Criptoactivo</option>
          </select></label
        ><label
          >Moneda<select name="currency" [(ngModel)]="currency">
            <option>COP</option>
            <option>USD</option>
          </select></label
        >
      }
      @if (kind() === 'recurrence') {
        <label>Importe<input name="amount" type="number" min="1" [(ngModel)]="amount" required /></label
        ><label
          >Cuenta<select name="account" [(ngModel)]="accountId" required>
            <option value="">Selecciona</option>
            @for (a of store.data().accounts; track a.id) {
              <option [value]="a.id">{{ a.name }}</option>
            }
          </select></label
        ><label
          >Frecuencia<select name="frequency" [(ngModel)]="frequency">
            <option [ngValue]="2">Semanal</option>
            <option [ngValue]="3">Mensual</option>
            <option [ngValue]="4">Anual</option>
          </select></label
        ><label>Inicio<input name="start" type="date" [(ngModel)]="start" required /></label>
      }
      @if (error()) {
        <p class="error" role="alert">{{ error() }}</p>
      }
      <footer>
        <button type="button" (click)="store.form.set(null)">Cancelar</button
        ><button class="primary" type="submit">Guardar</button>
      </footer>
    </form>
  </demo-overlay>`,
  styles: [
    `
      .management-form {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 16px;
      }
      .management-form label {
        display: flex;
        flex-direction: column;
        gap: 7px;
        color: var(--muted);
        font-size: 0.76rem;
      }
      .management-form input,
      .management-form select,
      .management-form button {
        min-height: 42px;
        border: 1px solid var(--line);
        border-radius: 9px;
        background: var(--surface);
        color: var(--text);
        padding: 8px 11px;
      }
      .management-form footer,
      .management-form .error {
        grid-column: 1/-1;
      }
      .management-form footer {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
      }
      .primary {
        background: var(--accent) !important;
        color: var(--accent-contrast) !important;
      }
      @media (max-width: 500px) {
        .management-form {
          grid-template-columns: 1fr;
        }
        .management-form footer,
        .management-form .error {
          grid-column: auto;
        }
      }
    `,
  ],
})
export class ManagementFormComponent {
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
  color = '#087f68';
  icon = '●';
  email = '';
  relationship: import('./core/demo-data').Person['relationship'] = 'Otro';
  instrument = 'CDT';
  currency = 'COP';
  amount = 0;
  accountId = '';
  frequency = 3;
  start = new Date().toISOString().slice(0, 10);
  async save() {
    try {
      this.error.set('');
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
