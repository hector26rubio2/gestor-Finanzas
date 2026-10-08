import { todayIso } from '@core/utils/dates';
import { computed, inject, Injectable, InjectionToken, Injector, signal } from '@angular/core';
import { notifier } from '@core/notifications/notifier';
import { Account, accountBalance, createEmptyData, ViewData, SessionUser, Movement, PersonKind } from './view-model';
import { ApiCategory } from '@core/api/api-client';
import {
  baseCurrency as monedaBase,
  currencyCatalog as catalogoDeMonedas,
  formatAmount,
  sumBy,
} from '@core/utils/money';
import { I18nService } from '@core/i18n';
import { EMPTY_KIND_CATALOG } from '@core/utils/movement-kinds';
import { RUNTIME_CONFIG } from '@core/session/runtime';
import { PREFERENCES } from './theme';
import { totalDeGastos, totalDeIngresos } from './economia';

export { applyTheme, PREFERENCES } from './theme';
export type { Preferences } from './theme';
export { navigation } from './navigation';

export interface CapabilitiesProvider {
  allows(capability: string): boolean;
}
export const CAPABILITIES = new InjectionToken<CapabilitiesProvider>('Capabilities', {
  providedIn: 'root',
  factory: () => {
    const store = inject(AppStore);
    return { allows: (capability) => !!store.user()?.capabilities.includes(capability) };
  },
});
export const FEATURES = new InjectionToken<{ enabled(key: string): boolean }>('FeatureFlags', {
  providedIn: 'root',
  factory: () => {
    const store = inject(AppStore);
    return {
      enabled: (key) => {
        if (!store.featureFlagsLoaded()) return false;
        if (key === 'admin') return true;
        return store.featureFlags()[key] === true;
      },
    };
  },
});

class CanalDeAvisos {
  readonly texto = signal('');
  readonly revision = signal(0);

  set(value: string): void {
    if (value) void notifier().then((sonner) => sonner(value));
    this.texto.set(value);
    this.revision.update((contador) => contador + 1);
  }

  update(fn: (value: string) => string): void {
    this.set(fn(this.texto()));
  }
}

export interface CondicionesDeTarjeta {
  limit: number;
  cutDay: number;
  dueDay: number;
  monthlyRate?: number;
  issuerId?: string;
  paymentPriority?: readonly number[];
  foreignPaymentPriority?: readonly number[];
  monthlyFee?: number;
  dualCurrency?: boolean;
}

@Injectable({ providedIn: 'root' })
export class AppStore {
  readonly runtime = inject(RUNTIME_CONFIG);
  private injector = inject(Injector);
  private readonly i18n = inject(I18nService);
  readonly data = signal<ViewData>(createEmptyData());
  readonly user = signal<SessionUser | null>(null);
  readonly remoteState = signal<'loading' | 'ready' | 'anonymous' | 'error'>('loading');
  readonly remoteError = signal('');
  readonly disenoDelServidor = signal<{ readonly json: string | null } | null>(null);
  readonly organization = signal<{ id: string; name: string } | null>(null);
  readonly organizations = signal<readonly { id: string; name: string }[]>([]);
  readonly remoteMovementPage = signal(1);
  readonly remoteMovementSize = signal(25);
  readonly remoteMovementTotal = signal(0);
  readonly remoteMovementCursor = signal<string | null>(null);
  readonly remoteMovementTotals = signal<{ readonly income: number; readonly expense: number } | null>(null);
  readonly featureFlags = signal<Record<string, boolean>>(this.data().featureFlags);
  readonly featureFlagsLoaded = signal(false);
  readonly kindCatalog = signal(EMPTY_KIND_CATALOG);
  readonly categories = signal<readonly ApiCategory[]>([]);
  readonly preferences = inject(PREFERENCES);
  readonly query = signal('');
  readonly period = signal('all');
  readonly accountFilter = signal('all');
  readonly toast = new CanalDeAvisos();
  readonly form = signal<{
    kind: string;
    accountId?: string;
    targetId?: string;
    movement?: Movement;
    account?: Account;
    personKind?: PersonKind;
    operationType?: string;
    accountType?: Account['type'];
    notificationId?: string;
    ownership?: Movement['ownership'];
    recurring?: boolean | string;
    recurrence?: Movement['recurrence'];
    installmentCurrent?: number;
    installmentTotal?: number;
    purchaseApr?: number;
    cardBucket?: number;
    loanRole?: Movement['loanRole'];
    loanProduct?: Movement['loanProduct'];
    originalCurrency?: Movement['originalCurrency'];
    originalAmount?: number;
    exchangeRate?: number;
  } | null>(null);
  readonly inspector = signal<{ type: string; id: string; previous?: { type: string; id: string } } | null>(null);
  readonly calendarReturnDate = signal<string | null>(null);
  readonly selectedCalendarDate = signal(todayIso());
  readonly cardPaymentMode = signal(false);
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
  readonly income = computed(() => totalDeIngresos(this.movements()));
  readonly expense = computed(() => totalDeGastos(this.movements()));
  readonly unread = computed(() => this.data().notifications.filter((n) => !n.read).length);
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
  readonly baseCurrency = monedaBase;
  readonly currencyCatalog = catalogoDeMonedas;
  money(value: number, currency = this.baseCurrency()) {
    return formatAmount(value, currency, this.preferences().locale);
  }
  account(id: string) {
    return this.data().accounts.find((a) => a.id === id);
  }
  readonly saldosDelServidor = signal<ReadonlyMap<string, number> | null>(null);
  hoy(): string {
    return todayIso();
  }
  balance(account: Account) {
    return this.saldosDelServidor()?.get(account.id) ?? accountBalance(account, this.data().movements);
  }
  readonly movimientosCargados = signal<ReadonlyMap<string, Movement>>(new Map());
  private readonly movimientosConocidos = computed(() => {
    const todos = new Map(this.movimientosCargados());
    for (const movimiento of this.data().movements) todos.set(movimiento.id, movimiento);
    return [...todos.values()];
  });
  recordarMovimientos(movimientos: readonly Movement[]): void {
    if (!movimientos.length) return;
    this.movimientosCargados.update((actuales) => {
      const siguiente = new Map(actuales);
      for (const movimiento of movimientos) siguiente.set(movimiento.id, movimiento);
      return siguiente;
    });
  }
  movimiento(id: string | undefined): Movement | undefined {
    if (!id) return undefined;
    return this.data().movements.find((m) => m.id === id) ?? this.movimientosCargados().get(id);
  }
  dayMoves(date: string | number) {
    const iso = typeof date === 'number' ? `${todayIso().slice(0, 7)}-${String(date).padStart(2, '0')}` : date;
    return this.movimientosConocidos().filter((movement) => movement.date === iso);
  }
  open(kind = '', accountId?: string, movement?: Movement, notificationId?: string, targetId?: string) {
    this.form.set({ kind, accountId, targetId, movement, notificationId });
  }
  inspect(type: string, id: string) {
    const old = this.inspector();
    this.inspector.set({ type, id, previous: old ? { type: old.type, id: old.id } : undefined });
  }
}
