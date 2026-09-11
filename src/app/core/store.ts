import { computed, inject, Injectable, InjectionToken, Injector, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Account, accountBalance, createDemoData, createEmptyData, DemoData, demoUsers, Movement } from './demo-data';
import { ApiCategory, FinanceApiClient } from './api-client';
import { BASE_CURRENCY, formatAmount, parseMoney, sumBy } from './money';
import { P } from './permissions';
import { CashFlow, EconomicEffect, EMPTY_KIND_CATALOG, MovementKind, signOf } from './movement-kinds';
import { RUNTIME_CONFIG } from './runtime';

export interface DataProvider {
  load(): DemoData;
}
export const DATA_PROVIDER = new InjectionToken<DataProvider>('DataProvider', {
  providedIn: 'root',
  factory: () => ({ load: inject(RUNTIME_CONFIG).mode === 'demo' ? createDemoData : createEmptyData }),
});
export interface CapabilitiesProvider {
  allows(capability: string): boolean;
}
export const CAPABILITIES = new InjectionToken<CapabilitiesProvider>('Capabilities', {
  providedIn: 'root',
  factory: () => {
    const store = inject(DemoStore);
    return { allows: (capability) => !!store.user()?.capabilities.includes(capability) };
  },
});
export const FEATURES = new InjectionToken<{ enabled(key: string): boolean }>('FeatureFlags', {
  providedIn: 'root',
  factory: () => {
    const store = inject(DemoStore);
    return {
      // Una ruta funcional en modo API debe aparecer expresamente en el catálogo. La
      // única excepción es el plano de control: el superadmin necesita conservar la
      // vía para revertir una bandera mal configurada.
      enabled: (key) => {
        if (store.runtime.mode === 'api' && !store.featureFlagsLoaded()) return false;
        if (key === 'admin') return true;
        return store.runtime.mode === 'api' ? store.featureFlags()[key] === true : (store.featureFlags()[key] ?? true);
      },
    };
  },
});
export interface Preferences {
  /** `system` no estampa data-theme y deja que mande prefers-color-scheme. */
  theme: 'system' | 'light' | 'dark' | 'ocean' | 'sand' | 'berry';
  accent: string;
  font: string;
  locale: string;
  density: 'comfortable' | 'compact';
  radius: number;
  name: string;
  primary: string;
  secondary: string;
  text: string;
  surface: string;
  border: string;
}
export const PREFERENCES = new InjectionToken('Preferences', {
  providedIn: 'root',
  factory: () =>
    signal<Preferences>({
      theme: 'system',
      accent: '#087f68',
      font: 'Inter, system-ui, sans-serif',
      locale: 'es-CO',
      density: 'comfortable',
      radius: 14,
      name: 'Mi tema esmeralda',
      primary: '#087f68',
      secondary: '#d3a34a',
      text: '#122522',
      surface: '#ffffff',
      border: '#dce6e2',
    }),
});

const DEMO_SESSION_KEY = 'finanzas.demo.perfil';

/**
 * Estampa el tema elegido. Con `system` retira el atributo para que la consulta
 * `prefers-color-scheme` de styles.css decida: antes se estampaba siempre
 * `light` y quien tenia el sistema en oscuro recibia la aplicacion en claro.
 */
export function applyTheme(theme: Preferences['theme']): void {
  if (theme === 'system') delete document.documentElement.dataset['theme'];
  else document.documentElement.dataset['theme'] = theme;
}

/** La capacidad de cada entrada es el permiso `<recurso>.ver` de la matriz. */
export const navigation = [
  { path: 'dashboard', label: 'Dashboard', icon: 'dashboard', group: 'PANORAMA', capability: P.dashboard.ver },
  { path: 'movements', label: 'Movimientos', icon: 'movements', group: 'MI DINERO', capability: P.movimientos.ver },
  { path: 'calendar', label: 'Calendario', icon: 'calendar', group: 'MI DINERO', capability: P.calendario.ver },
  { path: 'accounts', label: 'Cuentas y tarjetas', icon: 'accounts', group: 'MI DINERO', capability: P.cuentas.ver },
  { path: 'people', label: 'Personas y deudas', icon: 'people', group: 'MI DINERO', capability: P.personas.ver },
  { path: 'portfolio', label: 'Patrimonio', icon: 'portfolio', group: 'MI DINERO', capability: P.patrimonio.ver },
  { path: 'planning', label: 'Planificación', icon: 'planning', group: 'ANÁLISIS', capability: P.planificacion.ver },
  { path: 'reports', label: 'Reportes', icon: 'reports', group: 'ANÁLISIS', capability: P.reportes.ver },
  {
    path: 'notifications',
    label: 'Notificaciones',
    icon: 'notifications',
    group: 'ESPACIO',
    capability: P.notificaciones.ver,
  },
  { path: 'admin', label: 'Administración', icon: 'admin', group: 'ESPACIO', capability: P.administracion.ver },
  { path: 'settings', label: 'Preferencias', icon: 'settings', group: 'ESPACIO', capability: P.preferencias.ver },
];

@Injectable({ providedIn: 'root' })
export class DemoStore {
  readonly runtime = inject(RUNTIME_CONFIG);
  private provider = inject(DATA_PROVIDER);
  private injector = inject(Injector);
  readonly data = signal(this.provider.load());
  readonly users = demoUsers;
  readonly user = signal<(typeof demoUsers)[number] | null>(null);
  readonly remoteState = signal<'demo' | 'loading' | 'ready' | 'anonymous' | 'error'>(
    this.runtime.mode === 'demo' ? 'demo' : 'loading',
  );
  readonly remoteError = signal('');
  readonly remoteMovementPage = signal(1);
  readonly remoteMovementSize = signal(25);
  readonly remoteMovementTotal = signal(0);
  readonly featureFlags = signal<Record<string, boolean>>(this.data().featureFlags);
  /** Distingue «catalogo cargado y sin esta clave» de «catalogo nunca cargado». */
  readonly featureFlagsLoaded = signal(this.runtime.mode !== 'api');
  /** Tabla de invariantes publicada por la API. Vacía en modo demo, donde los datos ya traen su familia. */
  readonly kindCatalog = signal(EMPTY_KIND_CATALOG);
  readonly categories = signal<readonly ApiCategory[]>([]);
  readonly preferences = inject(PREFERENCES);
  readonly query = signal('');
  readonly period = signal('all');
  readonly accountFilter = signal('all');
  readonly toast = signal('');
  readonly form = signal<{
    kind: string;
    accountId?: string;
    targetId?: string;
    movement?: Movement;
    notificationId?: string;
    ownership?: Movement['ownership'];
    recurring?: boolean | string;
    recurrence?: Movement['recurrence'];
    installmentCurrent?: number;
    installmentTotal?: number;
    loanRole?: Movement['loanRole'];
    originalCurrency?: Movement['originalCurrency'];
    originalAmount?: number;
    exchangeRate?: number;
  } | null>(null);
  readonly inspector = signal<{ type: string; id: string; previous?: { type: string; id: string } } | null>(null);
  readonly movements = computed(() =>
    this.data()
      .movements.filter(
        (m) =>
          (this.period() === 'all' || m.date.startsWith(this.period())) &&
          (this.accountFilter() === 'all' || m.accountId === this.accountFilter()) &&
          `${m.description} ${m.category} ${m.person ?? ''}`
            .toLocaleLowerCase()
            .includes(this.query().toLocaleLowerCase()),
      )
      .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)),
  );
  readonly income = computed(() =>
    sumBy(
      this.movements().filter((m) => m.kind === 'income'),
      (m) => m.amount,
    ),
  );
  readonly expense = computed(() =>
    sumBy(
      this.movements().filter((m) => m.kind === 'expense'),
      (m) => -m.amount,
    ),
  );
  readonly unread = computed(() => this.data().notifications.filter((n) => !n.read).length);
  readonly history = signal<{ date: string; action: string }[]>([
    { date: '2026-08-31', action: 'Información financiera inicial cargada' },
  ]);
  readonly debt = computed(() =>
    sumBy(
      this.data().accounts.filter((a) => a.type === 'credit'),
      (a) => Math.max(0, -this.balance(a)),
    ),
  );
  readonly available = computed(() =>
    sumBy(
      this.data().accounts.filter((a) => a.type !== 'credit'),
      (a) => this.balance(a),
    ),
  );
  /**
   * Formato con código de moneda explícito: `$` a secas es ambiguo en Colombia y
   * esta aplicación muestra COP, USD y EUR en la misma pantalla.
   */
  money(value: number, currency = BASE_CURRENCY) {
    return formatAmount(value, currency, this.preferences().locale);
  }
  account(id: string) {
    return this.data().accounts.find((a) => a.id === id);
  }
  balance(account: Account) {
    return accountBalance(account, this.data().movements);
  }
  open(kind = 'expense', accountId?: string, movement?: Movement, notificationId?: string, targetId?: string) {
    this.form.set({ kind, accountId, targetId, movement, notificationId });
  }
  inspect(type: string, id: string) {
    const old = this.inspector();
    this.inspector.set({ type, id, previous: old ? { type: old.type, id: old.id } : undefined });
  }
  /**
   * Solo en modo demo: el perfil elegido vivia en memoria y un F5 devolvia a la
   * pantalla de bienvenida. En modo API manda la cookie de sesion.
   */
  rememberDemoSession(index: number): void {
    try {
      sessionStorage.setItem(DEMO_SESSION_KEY, String(index));
    } catch {
      /* almacenamiento no disponible: la sesion sigue viviendo en memoria */
    }
  }
  restoreDemoSession(): void {
    if (this.runtime.mode !== 'demo' || this.user()) return;
    try {
      // Number(null) es 0, y 0 es un indice valido: sin esta guarda, no haber
      // iniciado sesion entraba como el primer perfil.
      const stored = sessionStorage.getItem(DEMO_SESSION_KEY);
      if (stored === null) return;
      const index = Number.parseInt(stored, 10);
      if (Number.isInteger(index) && index >= 0 && index < this.users.length) {
        this.user.set(this.users[index]);
      }
    } catch {
      /* almacenamiento no disponible: se muestra la bienvenida */
    }
  }
  forgetDemoSession(): void {
    try {
      sessionStorage.removeItem(DEMO_SESSION_KEY);
    } catch {
      /* nada que limpiar */
    }
  }
  reset() {
    this.data.set(this.provider.load());
    this.query.set('');
    this.period.set('all');
    this.accountFilter.set('all');
    this.toast.set('Información inicial restaurada.');
  }
  log(action: string) {
    this.history.update((h) => [{ date: new Date().toISOString().slice(0, 10), action }, ...h]);
    this.toast.set(action);
  }
  async persistPreferences() {
    if (this.runtime.mode !== 'api') return;
    const value = this.preferences();
    await firstValueFrom(
      this.injector.get(FinanceApiClient).updatePreferences({
        language: value.locale,
        theme: value.theme,
        font: value.font,
        density: value.density,
        baseCurrency: 'COP',
        customThemeJson: JSON.stringify({
          name: value.name,
          accent: value.accent,
          primary: value.primary,
          secondary: value.secondary,
          text: value.text,
          surface: value.surface,
          border: value.border,
          radius: value.radius,
        }),
      }),
    );
  }
  async save(input: {
    kind: string;
    date: string;
    description: string;
    accountId: string;
    targetId?: string;
    amount: number;
    category: string;
    person?: string;
    id?: string;
    notificationId?: string;
    ownership?: Movement['ownership'];
    recurring?: boolean | string;
    recurrence?: Movement['recurrence'];
    installmentCurrent?: number;
    installmentTotal?: number;
    loanRole?: Movement['loanRole'];
    originalCurrency?: Movement['originalCurrency'];
    originalAmount?: number;
    exchangeRate?: number;
  }) {
    if (!Number.isFinite(input.amount) || input.amount <= 0) throw new Error('Introduce un importe positivo.');
    if (!this.account(input.accountId)) throw new Error('Selecciona una cuenta válida.');
    if (
      (input.kind === 'payment' || input.kind === 'transfer') &&
      (!input.targetId || input.targetId === input.accountId || !this.account(input.targetId))
    )
      throw new Error('Selecciona una cuenta destino diferente.');
    if (this.runtime.mode === 'api') {
      if (input.id) {
        const category = this.categories().find((item) => item.name === input.category);
        const updated = await firstValueFrom(
          this.injector.get(FinanceApiClient).reclassifyMovement(input.id, {
            category: category?.id ?? null,
            description: input.description || null,
          }),
        );
        this.data.update((data) => ({
          ...data,
          movements: data.movements.map((item) =>
            item.id === input.id
              ? { ...item, description: updated.description ?? input.description, category: input.category }
              : item,
          ),
        }));
        this.form.set(null);
        this.log('Movimiento reclasificado en la API');
        return;
      }
      const account = this.account(input.accountId);
      if (!account) throw new Error('Selecciona una cuenta válida.');
      if (input.kind === 'transfer' || input.kind === 'payment') {
        const amount = { amount: String(input.amount), currency: account.currency };
        const idempotencyKey = crypto.randomUUID();
        const operation = await firstValueFrom(
          input.kind === 'transfer'
            ? this.injector.get(FinanceApiClient).createTransfer({
                date: input.date,
                amount,
                sourceAccount: input.accountId,
                destinationAccount: input.targetId,
                description: input.description,
                idempotencyKey,
              })
            : this.injector.get(FinanceApiClient).createCardPayment({
                date: input.date,
                amount,
                account: input.accountId,
                card: input.targetId,
                description: input.description,
                idempotencyKey,
              }),
        );
        const created = operation.legs.map<Movement>((leg) => ({
          id: leg.id,
          date: leg.date,
          description: leg.description ?? input.description,
          accountId: leg.links['account'] ?? leg.links['card'] ?? '',
          category: 'Transferencias',
          kind: input.kind as Movement['kind'],
          amount: parseMoney(leg.amount.base) * signOf(leg.flow, leg.effect),
          status: 'confirmed',
        }));
        this.data.update((data) => ({ ...data, movements: [...created, ...data.movements] }));
        this.form.set(null);
        this.log(input.kind === 'transfer' ? 'Transferencia registrada en la API' : 'Abono registrado en la API');
        return;
      }
      const isIncome = input.kind === 'income';
      const isCard = account.type === 'credit';
      const created = await firstValueFrom(
        this.injector.get(FinanceApiClient).createMovement({
          date: input.date,
          kind: isIncome ? MovementKind.income : isCard ? MovementKind.cardPurchase : MovementKind.expense,
          effect: isIncome ? EconomicEffect.income : EconomicEffect.expense,
          flow: isIncome ? CashFlow.inflow : CashFlow.outflow,
          amount: {
            amount: String(input.originalCurrency === 'USD' ? input.originalAmount : input.amount),
            currency: input.originalCurrency ?? account.currency,
          },
          links: isCard ? { card: input.accountId } : { account: input.accountId },
          rate: input.originalCurrency === 'USD' ? String(input.exchangeRate) : undefined,
          rateAsOf: input.originalCurrency === 'USD' ? input.date : undefined,
          description: input.description,
          idempotencyKey: crypto.randomUUID(),
        }),
      );
      const sign = signOf(created.flow, created.effect);
      const movement: Movement = {
        id: created.id,
        date: created.date,
        description: created.description ?? input.description,
        accountId: input.accountId,
        category: input.category,
        kind: input.kind as Movement['kind'],
        amount: parseMoney(created.amount.base) * sign,
        status: 'confirmed',
        person: input.person,
        ownership: input.person ? 'loaned' : (input.ownership ?? 'own'),
        recurring: input.recurring === true || input.recurring === 'true',
      };
      this.data.update((data) => ({ ...data, movements: [movement, ...data.movements] }));
      this.form.set(null);
      this.log('Movimiento registrado en la API');
      return;
    }
    const id = input.id ?? crypto.randomUUID();
    const kind = input.kind as Movement['kind'];
    const movement: Movement = {
      id,
      date: input.date,
      description: input.description,
      accountId: input.accountId,
      category: input.category,
      kind,
      amount: kind === 'income' ? input.amount : -input.amount,
      status: 'confirmed',
      person: input.person,
      ownership: input.person ? 'loaned' : (input.ownership ?? 'own'),
      recurring: input.recurring === true || input.recurring === 'true',
      recurrence: input.recurring === true || input.recurring === 'true' ? input.recurrence : undefined,
      installmentCurrent:
        input.installmentTotal && input.installmentTotal > 1 ? Number(input.installmentCurrent || 1) : undefined,
      installmentTotal:
        input.installmentTotal && input.installmentTotal > 1 ? Number(input.installmentTotal) : undefined,
      loanRole: input.loanRole,
      originalCurrency: input.originalCurrency,
      originalAmount: input.originalCurrency === 'USD' ? Number(input.originalAmount) : undefined,
      exchangeRate: input.originalCurrency === 'USD' ? Number(input.exchangeRate) : undefined,
    };
    this.data.update((d) => ({
      ...d,
      movements: [
        ...d.movements.filter((m) => m.id !== id),
        movement,
        ...(kind === 'payment' || kind === 'transfer'
          ? [{ ...movement, id: id + '-to', accountId: input.targetId!, amount: input.amount }]
          : []),
      ],
      notifications: d.notifications.map((n) => (n.id === input.notificationId ? { ...n, read: true } : n)),
    }));
    this.form.set(null);
    this.log(input.id ? 'Movimiento corregido; acción registrada' : 'Movimiento registrado');
  }
  async createAccount(
    name: string,
    type: Account['type'],
    opening: number,
    currency = 'COP',
    exchangeRate?: number,
    credit?: { limit: number; cutDay: number; dueDay: number },
  ) {
    if (this.runtime.mode === 'api') {
      if (opening < 0) throw new Error('El saldo inicial remoto debe ser cero o positivo.');
      const client = this.injector.get(FinanceApiClient);
      if (type === 'credit') {
        if (!credit || credit.limit <= 0) throw new Error('Introduce un cupo válido para la tarjeta.');
        const created = await firstValueFrom(
          client.createCard({
            name,
            currency,
            creditLimit: { amount: String(credit.limit), currency },
            cycle: { statementDay: credit.cutDay, paymentDueDay: credit.dueDay },
            terms: {
              purchaseApr: { rate: '0' },
              cashAdvanceApr: { rate: '0' },
              internationalPurchaseApr: { rate: '0' },
              deferredDefaultApr: { rate: '0' },
              minimumPaymentRate: { rate: '0' },
              minimumPaymentFloor: null,
              gracePeriodDays: 0,
            },
            lastFour: '0000',
          }),
        );
        this.data.update((data) => ({
          ...data,
          accounts: [
            ...data.accounts,
            {
              id: created.id,
              name: created.name,
              type: 'credit',
              currency: created.currency,
              openingBalance: 0,
              limit: parseMoney(created.creditLimit),
              lastFour: created.lastFour ?? undefined,
              cutDay: created.cycle.statementDay,
              dueDay: created.cycle.paymentDueDay,
            },
          ],
        }));
        this.form.set(null);
        this.log('Tarjeta creada en la API');
        return;
      }
      const accountRequest = { name, kind: type === 'cash' ? 1 : 3, currency, lastFour: '0000' };
      const openingResult =
        opening === 0
          ? null
          : await firstValueFrom(
              client.createAccountWithOpening({
                account: accountRequest,
                openingBalance: { amount: String(Math.abs(opening)), currency },
                date: new Date().toISOString().slice(0, 10),
                rate: currency === 'USD' ? String(exchangeRate) : null,
                rateAsOf: currency === 'USD' ? new Date().toISOString().slice(0, 10) : null,
                idempotencyKey: crypto.randomUUID(),
              }),
            );
      const created = openingResult?.account ?? (await firstValueFrom(client.createAccount(accountRequest)));
      const account: Account = {
        id: created.id,
        name: created.name,
        type,
        currency: created.currency,
        openingBalance: 0,
        lastFour: created.lastFour ?? undefined,
      };
      this.data.update((data) => ({ ...data, accounts: [...data.accounts, account] }));
      if (openingResult) {
        const movement = openingResult.openingMovement;
        this.data.update((data) => ({
          ...data,
          movements: [
            {
              id: movement.id,
              date: movement.date,
              description: movement.description ?? `Saldo de apertura · ${name}`,
              accountId: created.id,
              category: 'Apertura',
              kind: 'income',
              amount: parseMoney(movement.amount.base),
              status: 'confirmed',
            },
            ...data.movements,
          ],
        }));
      }
      this.form.set(null);
      this.log('Cuenta creada en la API');
      return;
    }
    const id = crypto.randomUUID();
    const account: Account = {
      id,
      name,
      type,
      currency,
      ...(currency === 'USD' ? { exchangeRate } : {}),
      openingBalance: 0,
      lastFour: '0000',
      color: '#087f68',
      ...(type === 'credit'
        ? { limit: credit?.limit ?? 5000000, cutDay: credit?.cutDay ?? 20, dueDay: credit?.dueDay ?? 5 }
        : {}),
    };
    this.data.update((d) => ({
      ...d,
      accounts: [...d.accounts, account],
      movements:
        opening === 0
          ? d.movements
          : [
              ...d.movements,
              {
                id: crypto.randomUUID(),
                date: '2026-08-31',
                description: 'Saldo de apertura · ' + name,
                accountId: id,
                category: 'Apertura',
                kind: opening > 0 ? 'income' : 'expense',
                amount: opening,
                status: 'confirmed',
              },
            ],
    }));
    this.form.set(null);
    this.log('Cuenta creada');
  }
  async createCategory(name: string, color: string, icon: string) {
    if (this.runtime.mode === 'api') {
      const created = await firstValueFrom(
        this.injector.get(FinanceApiClient).createCategory({ name, type: 2, color, icon }),
      );
      this.categories.update((items) => [...items, created]);
    }
    this.form.set(null);
    this.log(`Categoría ${name} creada`);
  }
  async createPerson(
    name: string,
    email?: string,
    relationship: import('./demo-data').Person['relationship'] = 'Otro',
  ) {
    if (this.runtime.mode === 'api') {
      const created = await firstValueFrom(
        this.injector.get(FinanceApiClient).createPerson({ displayName: name, email: email || null }),
      );
      this.data.update((data) => ({
        ...data,
        people: [
          ...data.people,
          { id: created.id, name: created.displayName, owed: 0, owing: 0, relationship, email: email || undefined },
        ],
      }));
    } else {
      this.data.update((data) => ({
        ...data,
        people: [...data.people, { id: crypto.randomUUID(), name, owed: 0, owing: 0, relationship, email }],
      }));
    }
    this.form.set(null);
    this.log(`Persona ${name} creada`);
  }
  async createInvestment(name: string, instrumentType: string, currency: string) {
    if (this.runtime.mode === 'api') {
      const created = await firstValueFrom(
        this.injector.get(FinanceApiClient).createInvestment({ name, instrumentType, currency, risk: 2 }),
      );
      this.data.update((data) => ({
        ...data,
        investments: [
          ...data.investments,
          {
            id: created.id,
            name: created.name,
            type: created.instrumentType,
            cost: parseMoney(created.costBasis),
            value: parseMoney(created.marketValue ?? created.costBasis),
            institution: 'Sin especificar',
            currency,
            units: 0,
            risk: 'Medio',
            liquidity: 'Programada',
          },
        ],
      }));
    } else {
      this.data.update((data) => ({
        ...data,
        investments: [
          ...data.investments,
          {
            id: crypto.randomUUID(),
            name,
            type: instrumentType,
            cost: 0,
            value: 0,
            institution: 'Sin especificar',
            currency,
            units: 0,
            risk: 'Medio',
            liquidity: 'Programada',
          },
        ],
      }));
    }
    this.form.set(null);
    this.log(`Inversión ${name} creada`);
  }
  async createRecurrence(name: string, amount: number, accountId: string, frequency: number, start: string) {
    if (this.runtime.mode === 'api') {
      const account = this.account(accountId);
      if (!account) throw new Error('Selecciona una cuenta válida.');
      await firstValueFrom(
        this.injector.get(FinanceApiClient).createRecurrence({
          name,
          movementTemplate: account.type === 'credit' ? 20 : 2,
          amount: { amount: String(amount), currency: account.currency },
          target: account.type === 'credit' ? { card: accountId } : { account: accountId },
          schedule: {
            frequency,
            interval: 1,
            start,
            end: null,
            dayOfMonth: frequency === 3 ? Number(start.slice(-2)) : null,
            dayOfWeek: null,
          },
        }),
      );
    }
    this.form.set(null);
    this.log(`Recurrencia ${name} creada`);
  }
}
