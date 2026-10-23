import type { ApiCategory } from '@core/api/api-client';
import type { ViewData, Account, Movement, Person } from '@core/state';
import { AppStore, createEmptyData } from '@core/state';

const CUENTA_POR_DEFECTO: Account = {
  id: 'cuenta-1',
  name: 'Ahorros',
  type: 'savings',
  currency: 'COP',
  openingBalance: 500000,
};

const EFECTIVO_POR_DEFECTO: Account = {
  id: 'cuenta-2',
  name: 'Efectivo',
  type: 'cash',
  currency: 'COP',
  openingBalance: 100000,
};

const GASTO_POR_DEFECTO: Movement = {
  id: 'mov-1',
  date: '2026-09-25',
  description: 'Mercado del sábado',
  accountId: 'cuenta-1',
  category: 'Mercado',
  kind: 'expense',
  amount: -45900,
  status: 'confirmed',
};

const PERSONA_POR_DEFECTO: Person = { id: 'persona-1', name: 'Camilo', owed: 0, owing: 0 };

const CATEGORIA_POR_DEFECTO: ApiCategory = {
  id: 'categoria-1',
  name: 'Mercado',
  type: 1,
  color: '#0f766e',
  icon: '●',
  parent: null,
  isActive: true,
  createdAt: '2026-09-01',
};

export interface OverridesDeDatos {
  movements?: Movement[];
  accounts?: Account[];
  people?: Person[];
  investments?: ViewData['investments'];
  auditEvents?: ViewData['auditEvents'];
  featureFlags?: Record<string, boolean>;
  /** Categorías remotas: viven en store.categories, no en store.data. */
  categories?: ApiCategory[];
}

export interface ModeloDeDatos {
  data: ViewData;
  categories: readonly ApiCategory[];
  dataOverrides: OverridesDeDatos;
  /** @deprecated usa aplicarEn */
  seed: OverridesDeDatos;
  /** Siembra data + categories (+ movimientos cargados) en el store. */
  aplicarEn(store: AppStore): void;
}

/**
 * Fábrica de slices `data()` del store con valores por defecto sensatos.
 * Cada test puede sobreescribir solo lo que le interesa:
 *
 * ```ts
 * const datos = datosDe({ accounts: [{ id: 'a1', name: 'Banco', type: 'checking', currency: 'COP', openingBalance: 0 }] });
 * datos.aplicarEn(store);
 * ```
 */
export function datosDe(overrides: OverridesDeDatos = {}): ModeloDeDatos {
  const base = createEmptyData();
  const data: ViewData = {
    ...base,
    movements: overrides.movements ?? [GASTO_POR_DEFECTO],
    accounts: overrides.accounts ?? [CUENTA_POR_DEFECTO, EFECTIVO_POR_DEFECTO],
    people: overrides.people ?? [PERSONA_POR_DEFECTO],
    investments: overrides.investments ?? base.investments,
    auditEvents: overrides.auditEvents ?? base.auditEvents,
    featureFlags: overrides.featureFlags ?? base.featureFlags,
  };
  const categories = overrides.categories ?? [CATEGORIA_POR_DEFECTO];
  // Conviene que cada movimiento cite una cuenta existente: si el test pasa cuentas
  // propias, los movimientos por defecto se descartan para no crear referencias rotas.
  if (overrides.accounts && overrides.movements === undefined) data.movements = [];
  return {
    data,
    categories,
    dataOverrides: overrides,
    get seed() {
      return overrides;
    },
    aplicarEn(store: AppStore) {
      store.data.set(structuredClone(data));
      store.remoteState.set('ready');
      store.movimientosListos.set(true);
      store.categories.set([...categories]);
      store.recordarMovimientos(data.movements);
    },
  };
}
