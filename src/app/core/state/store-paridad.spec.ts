import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { datosDe } from '@testing/datos-de-prueba';
import { AppStore } from './store';
import { Account, accountBalance, Movement } from './view-model';
import { totalDeGastos, totalDeIngresos } from './economia';

const gasto = (id: string, date: string, overrides: Partial<Movement> = {}): Movement => ({
  id,
  date,
  description: `desc-${id}`,
  accountId: 'ah',
  category: 'Mercado',
  kind: 'expense',
  amount: -1000,
  status: 'confirmed',
  ...overrides,
});

const ingreso = (id: string, date: string, overrides: Partial<Movement> = {}): Movement => ({
  id,
  date,
  description: `desc-${id}`,
  accountId: 'ah',
  category: 'Salario',
  kind: 'income',
  amount: 20000,
  status: 'confirmed',
  ...overrides,
});

const cuenta = (id: string, type: Account['type'], openingBalance: number): Account => ({
  id,
  name: id,
  type,
  currency: 'COP',
  openingBalance,
});

const CUENTAS = [cuenta('ah', 'savings', 100000), cuenta('ca', 'cash', 100000), cuenta('tc', 'credit', 0)];
const FECHAS_SEMBRADA = ['2026-09-01', '2026-09-05', '2026-09-05', '2026-09-20', '2026-10-07', '2026-10-12'];

/** Modificación: fixture de paridad (50 movimientos sembrados + 200 sintéticos para la medición). */
function fixtureSembrado(): Movement[] {
  const unosPocosUh = [
    gasto('a1', FECHAS_SEMBRADA[0], { accountId: 'ca' }),
    ingreso('a2', FECHAS_SEMBRADA[1], { accountId: 'ah' }),
    gasto('a3', FECHAS_SEMBRADA[1], { accountId: 'tc', status: 'pending' }),
    gasto('a4', FECHAS_SEMBRADA[1], { person: 'Camilo' }),
    gasto('a5', FECHAS_SEMBRADA[2], { category: 'Transporte', description: 'Gasolina carried' }),
    ingreso('a6', FECHAS_SEMBRADA[3], { accountId: 'ca' }),
    gasto('a7', FECHAS_SEMBRADA[3], { status: 'pending' }),
    ingreso('a8', FECHAS_SEMBRADA[4]),
    gasto('a9', FECHAS_SEMBRADA[4], { accountId: 'tc' }),
    gasto('a10', FECHAS_SEMBRADA[5], { accountId: 'ca', amount: -50000 }),
  ];
  const restante = Array.from({ length: 50 - unosPocosUh.length }, (_, i) =>
    gasto(`sem-${i}`, FECHAS_SEMBRADA[i % FECHAS_SEMBRADA.length], { amount: -(100 + i) }),
  );
  return [...unosPocosUh, ...restante];
}

function sembrar(movements: readonly Movement[]): AppStore {
  window.__FINANZAS_CONFIG__ = { apiBaseUrl: 'https://api.example.test' };
  TestBed.resetTestingModule();
  const store = TestBed.inject(AppStore);
  datosDe({ accounts: CUENTAS, movements: [...movements] }).aplicarEn(store);
  return store;
}

type Filtros = { period: string; accountFilter: string; query: string };

/** Réplica exacta del pipeline público: filtros + orden + totales (oracle de paridad en el spec). */
function proyeccionEsperada(data: { movements: Movement[] }, filtros: Filtros) {
  const consulta = filtros.query.toLocaleLowerCase();
  const filtrados = data.movements.filter(
    (m) =>
      (filtros.period === 'all' || m.date.startsWith(filtros.period)) &&
      (filtros.accountFilter === 'all' || m.accountId === filtros.accountFilter) &&
      `${m.description} ${m.category} ${m.person ?? ''}`.toLocaleLowerCase().includes(consulta),
  );
  const ordenados = [...filtrados].sort(
    (a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id),
  );
  return { ordenados, income: totalDeIngresos(ordenados), expense: totalDeGastos(ordenados) };
}

describe('AppStore: paridad de recalculos (ticket 21)', () => {
  const CASOS: Filtros[] = [
    { period: 'all', accountFilter: 'all', query: '' },
    { period: '2026-09', accountFilter: 'all', query: '' },
    { period: '2026-10', accountFilter: 'ca', query: '' },
    { period: 'all', accountFilter: 'ah', query: '' },
    { period: 'all', accountFilter: 'all', query: 'gasolina' },
    { period: '2026-09', accountFilter: 'all', query: 'DESC-SEM-1' },
    { period: 'all', accountFilter: 'tc', query: 'no existe' },
  ];

  it('movements / income / expense / debt / available coinciden con la réplica para cada combinación de filtros', () => {
    for (const filtros of CASOS) {
      const store = sembrar(fixtureSembrado());
      store.period.set(filtros.period);
      store.accountFilter.set(filtros.accountFilter);
      store.query.set(filtros.query);

      const esperado = proyeccionEsperada(store.data(), filtros);
      expect([...store.movements()], JSON.stringify(filtros)).toEqual(esperado.ordenados);
      expect(store.income()).toBe(esperado.income);
      expect(store.expense()).toBe(esperado.expense);

      const deudaEsperada = CUENTAS.filter((a) => a.type === 'credit').reduce(
        (total, a) => total + Math.max(0, -accountBalance(a, store.data().movements)),
        0,
      );
      const disponibleEsperado = CUENTAS.filter((a) => a.type !== 'credit').reduce(
        (total, a) => total + accountBalance(a, store.data().movements),
        0,
      );
      expect(store.debt()).toBe(deudaEsperada);
      expect(store.available()).toBe(disponibleEsperado);
      for (const cuentaDeFixture of CUENTAS) {
        expect(store.balance(cuentaDeFixture)).toBe(accountBalance(cuentaDeFixture, store.data().movements));
      }
    }
  });

  it('dayMoves devuelve la lista completa por día (vacío → [])', () => {
    const store = sembrar(fixtureSembrado());
    const movimientos = fixtureSembrado();
    const idsDe = (iso: string) => movimientos.filter((m) => m.date === iso).map((m) => m.id);
    expect(store.dayMoves('2026-09-01').map((m) => m.id)).toEqual(idsDe('2026-09-01'));
    expect(store.dayMoves('2026-09-05').map((m) => m.id)).toEqual(idsDe('2026-09-05'));
    expect(store.dayMoves('2026-10-07').map((m) => m.id)).toEqual(idsDe('2026-10-07'));
    expect(store.dayMoves('2025-01-01')).toEqual([]);
    expect(store.dayMoves(5).map((m) => m.id)).toEqual(idsDe('2026-10-05'));
  });

  it('movimientosConocidos une lo recordado con la página y la página manda', () => {
    const movimientos = fixtureSembrado();
    const store = sembrar(movimientos);
    store.recordarMovimientos([gasto('rec-1', '2026-08-03', { accountId: 'ca' }), { ...movimientos[0], description: 'vieja' }]);

    const conocidos: Movement[] = store.movimientosConocidos();
    const mapa = new Map(store.movimientosCargados());
    for (const m of store.data().movements) mapa.set(m.id, m);
    expect(conocidos).toEqual([...mapa.values()]);
  });

  it('la medición no se dispara sola: cambios de filtros repiten el mismo resultado', () => {
    const store = sembrar(fixtureSembrado());
    const base = [...store.movements()];
    store.query.set('sem');
    expect([...store.movements()]).toEqual(proyeccionEsperada(store.data(), { period: 'all', accountFilter: 'all', query: 'sem' }).ordenados);
    store.query.set('');
    expect([...store.movements()]).toEqual(base);
  });
});

describe('AppStore: medición de trabajo por recálculo (ticket 21)', () => {
  const CUENTAS_MEDICION = [
    cuenta('ah', 'savings', 100000),
    cuenta('ca', 'cash', 100000),
    cuenta('b1', 'checking', 300000),
    cuenta('b2', 'wallet', 50000),
    cuenta('b3', 'other', 10000),
    cuenta('tc1', 'credit', 0),
    cuenta('tc2', 'credit', 0),
  ];

  /** %d fechas distintas de enero a abril; alternando cuenta y estado. */
  function datasetStress(sinteticosDe: number): Movement[] {
    const fijos = fixtureSembrado();
    const sinteticos = Array.from({ length: sinteticosDe }, (_, i) => {
      const mes = String((i % 4) + 1).padStart(2, '0');
      const dia = String((i % 28) + 1).padStart(2, '0');
      return gasto(`st-${i}`, `2026-${mes}-${dia}`, {
        accountId: CUENTAS_MEDICION[i % CUENTAS_MEDICION.length].id,
        amount: i % 5 === 0 ? 3000 : -(1000 + i),
        status: i % 7 === 0 ? 'pending' : 'confirmed',
      });
    });
    return [...fijos, ...sinteticos];
  }

  const DIAS_CLIC = Array.from({ length: 56 }, (_, i) => {
    const mes = String((i % 4) + 1).padStart(2, '0');
    const dia = String(Math.floor(i / 4) + 1).padStart(2, '0');
    return `2026-${mes}-${dia}`;
  });

  /** Reproducción fiel del algoritmo previo (antes del ticket 21): Map de conocidos
   *  reconstruido desde cero por recálculo, filtrado O(n) por día y K recorridos
   *  de N para el saldo de cada cuenta. Oracle deliberadamente independiente: no
   *  importa internals del store, o la paridad pasaría por definición (tautología). */
  function recalcularAlModoAntiguo(
    data: { movements: Movement[]; accounts: Account[] },
    cargados: ReadonlyMap<string, Movement>,
    consultaBase: string,
  ) {
    const conocidos = new Map(cargados);
    for (const m of data.movements) conocidos.set(m.id, m);
    const listaConocida = [...conocidos.values()];

    const porDia = DIAS_CLIC.map((dia) => listaConocida.filter((m) => m.date === dia));

    const consulta = consultaBase.toLocaleLowerCase();
    const filtrados = data.movements.filter((m) =>
      `${m.description} ${m.category} ${m.person ?? ''}`.toLocaleLowerCase().includes(consulta),
    );
    const ordenados = filtrados.sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));

    const saldos = new Map<string, number>();
    for (const cuentaDeFixture of data.accounts) {
      saldos.set(cuentaDeFixture.id, accountBalance(cuentaDeFixture, data.movements));
    }
    return { porDia, ordenados, saldos };
  }

  const medir = (fn: () => unknown, veces: number): number => {
    let minimo = Number.POSITIVE_INFINITY;
    for (let i = 0; i < veces; i++) {
      const inicio = performance.now();
      fn();
      minimo = Math.min(minimo, performance.now() - inicio);
    }
    return minimo;
  };

  it('un recálculo con data + N clics de calendario cuesta menos que la réplica del modo antiguo (presupuesto holgado)', () => {
    const movimientos = datasetStress(5000);
    const store = sembrar(movimientos);
    const cargados = new Map(store.movimientosCargados());
    const veces = 5;

    // Franqueza de la medición: sólo el ciclo 1 invalida saldosPorCuenta y porDia
    // (y el par de valores de period se acierta en memo desde el ciclo 3); los
    // siguientes ciclos son en su mayoría aciertos de memo del computed.
    const medirStore = () => {
      store.period.set(store.period() === 'all' ? '2026-01' : 'all');
      void store.movements();
      void store.income();
      void store.expense();
      void store.debt();
      void store.available();
      for (const cuentaDeFixture of CUENTAS_MEDICION) void store.balance(cuentaDeFixture);
      for (const dia of DIAS_CLIC) void store.dayMoves(dia).length;
      return store;
    };

    const primerCiclo = performance.now();
    medirStore();
    const costoPrimerCiclo = performance.now() - primerCiclo;
    const modoNuevo = medir(medirStore, veces);
    const modoAntiguo = medir(
      () => recalcularAlModoAntiguo(store.data(), cargados, 'mercado'),
      veces,
    );

    /* impresión informal (la uses/CI no hacen estricta la medición, el presupuesto es holgado) */
    console.log(
      `[ticket 21] primer ciclo ${costoPrimerCiclo.toFixed(2)} ms · ciclo típico (mayoría aciertos de memo) ` +
        `${modoNuevo.toFixed(2)} ms · ciclo réplica del modo antiguo ${modoAntiguo.toFixed(2)} ms`,
    );
    expect(modoNuevo).toBeLessThan(300);
    expect(modoNuevo).toBeLessThan(modoAntiguo * 2 + 10);
    expect(costoPrimerCiclo).toBeLessThan(300);
  });
});

