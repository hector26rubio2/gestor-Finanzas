import { todayIso } from '@core/utils/dates';
import { computed, inject, Injectable, InjectionToken, Injector, signal } from '@angular/core';
import { notifier } from '@core/notifications/notifier';
import { Account, accountBalance, createEmptyData, ViewData, SessionUser, Movement, PersonKind } from './view-model';
import { ApiCategory, ApiNotification } from '@core/api/api-client';
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
  applyPaymentPriority?: boolean;
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
  readonly movimientosListos = signal(false);
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
  readonly movements = computed(() => {
    // Simplificación (ticket 21): el literal de búsqueda se calcula una vez por
    // recálculo (antes se recalculaba toLocaleLowerCase() por movimiento) y los
    // filtros activos se leen una sola vez. Sigue siendo un computed() puro.
    const periodo = this.period();
    const filtroDeCuenta = this.accountFilter();
    const consulta = this.query().toLocaleLowerCase();
    const sinConsulta = consulta === '';
    const filtrados = this.data().movements.filter(
      (m) =>
        (periodo === 'all' || m.date.startsWith(periodo)) &&
        (filtroDeCuenta === 'all' || m.accountId === filtroDeCuenta) &&
        (sinConsulta || `${m.description} ${m.category} ${m.person ?? ''}`.toLocaleLowerCase().includes(consulta)),
    );
    return filtrados.sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  });
  readonly income = computed(() => totalDeIngresos(this.movements()));
  readonly expense = computed(() => totalDeGastos(this.movements()));
  readonly avisosRecientes = signal<readonly ApiNotification[]>([]);
  readonly sinLeerDelArranque = signal(0);
  readonly sinLeerCargados = signal<number | null>(null);
  readonly unread = computed(() => this.sinLeerCargados() ?? this.sinLeerDelArranque());
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
  /**
   * Simplificación (ticket 21): saldo por cuenta en UNA sola pasada sobre los
   * movimientos y una sobre las cuentas (O(N + K)); antes cada `balance()`
   * recorre N movimientos (K×N por recálculo) alimentando deuda y disponible.
   * Sigue siendo un computed() puro: sin cachés ni invalidación manual.
   */
  private readonly saldosPorCuenta = computed(() => {
    const datos = this.data();
    const sumas = new Map<string, number>();
    for (const movimiento of datos.movements) {
      if (movimiento.status !== 'confirmed') continue;
      sumas.set(movimiento.accountId, (sumas.get(movimiento.accountId) ?? 0) + movimiento.amount);
    }
    const saldos = new Map<string, number>();
    for (const cuenta of datos.accounts) {
      saldos.set(cuenta.id, cuenta.openingBalance + (sumas.get(cuenta.id) ?? 0));
    }
    return saldos;
  });
  balance(account: Account) {
    // Paridad con el modo anterior: saldo del servidor si existe; si la cuenta no
    // está en data().accounts (cuenta hipotética de un formulario), el cálculo clásico.
    return (
      this.saldosDelServidor()?.get(account.id) ??
      this.saldosPorCuenta().get(account.id) ??
      accountBalance(account, this.data().movements)
    );
  }
  readonly movimientosCargados = signal<ReadonlyMap<string, Movement>>(new Map());
  /**
   * Simplificación (ticket 21): unión de lo recordado con la página sin clonar el
   * Map de recordados: la página manda sobre un id recordado y el orden sigue
   * siendo el de recordados + los nuevos de la página. Computed puro.
   *
   * Invariante de fusión: la página manda sobre un id recordado, los recordados
   * van primero y un id repetido dentro de la página colapsa a su primera
   * posición con el último valor. Público sólo lectura: los consumidores no
   * deben mutar el array devuelto (es compartido entre lecturas).
   */
  readonly movimientosConocidos = computed(() => {
    const recordados = this.movimientosCargados();
    const deLaPagina = this.data().movements;
    if (recordados.size === 0) return [...deLaPagina];
    const deLaPaginaPorId = new Map(deLaPagina.map((movimiento) => [movimiento.id, movimiento]));
    const conocidos: Movement[] = [];
    for (const [id, recordado] of recordados) {
      conocidos.push(deLaPaginaPorId.get(id) ?? recordado);
    }
    // El Map de la página colapsa ids repetidos (primera posición, último valor),
    // igual que hacía el Map del algoritmo anterior.
    for (const [id, movimiento] of deLaPaginaPorId) {
      if (!recordados.has(id)) conocidos.push(movimiento);
    }
    return conocidos;
  });
  /**
   * Simplificación (ticket 21): índice día → movimientos derivado con un computed()
   * puro (sin cachés imperativas). Cada clic de calendario pasa de filtrar todo el
   * histórico (O(n)) a una búsqueda O(1). El array por día es compartido: los
   * consumidores (calendario, inspector) sólo lo leen (length, slice, @for).
   */
  private readonly porDia = computed(() => {
    const indice = new Map<string, Movement[]>();
    for (const movimiento of this.movimientosConocidos()) {
      const lista = indice.get(movimiento.date);
      if (lista) lista.push(movimiento);
      else indice.set(movimiento.date, [movimiento]);
    }
    return indice;
  });
  invalidarListadoDeMovimientos(): void {
    this.movimientosListos.set(false);
    this.remoteMovementPage.set(1);
    this.remoteMovementCursor.set(null);
    this.remoteMovementTotals.set(null);
    this.remoteMovementTotal.set(0);
  }

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
    return this.porDia().get(iso) ?? [];
  }
  open(kind = '', accountId?: string, movement?: Movement, notificationId?: string, targetId?: string) {
    this.form.set({ kind, accountId, targetId, movement, notificationId });
  }
  inspect(type: string, id: string) {
    const old = this.inspector();
    this.inspector.set({ type, id, previous: old ? { type: old.type, id: old.id } : undefined });
  }
}
