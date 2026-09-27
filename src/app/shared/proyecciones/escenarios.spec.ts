import { describe, expect, it } from 'vitest';
import type { Account, Movement, Person } from '@core/state';
import { proyectar } from './amortizacion';
import {
  CUOTAS_SUPUESTAS,
  TASA_MENSUAL_SUPUESTA_CREDITO,
  cuotaParaTerminarEn,
  deudasActuales,
  deudasDeObligaciones,
  deudasDeTarjeta,
  ordenarParaAbono,
  flujoPorMes,
  lineasPorCategoria,
  recurrentesDeFlujo,
  saldoTrasCuotas,
  flujoPromedio,
  mesesHasta,
  planDeAbonos,
  proyectarInversion,
  tasaPromedioDeInversiones,
} from './escenarios';

const movimiento = (parcial: Partial<Movement>): Movement => ({
  id: parcial.id ?? crypto.randomUUID(),
  date: '2026-08-10',
  description: 'x',
  accountId: 'a',
  category: 'c',
  kind: 'expense',
  amount: -100,
  status: 'confirmed',
  ...parcial,
});

const flujo = { ingresoMensual: 5_000_000, gastoMensual: 3_000_000, recorteDeGasto: 0, metaDeAhorro: 0 };

describe('escenarios de planificación', () => {
  it('promedia ingreso y gasto de los meses cerrados sin contar transferencias ni préstamos', () => {
    const movimientos = [
      movimiento({ date: '2026-08-05', kind: 'income', amount: 4_000_000 }),
      movimiento({ date: '2026-07-05', kind: 'income', amount: 2_000_000 }),
      movimiento({ date: '2026-08-06', kind: 'expense', amount: -1_000_000 }),
      movimiento({ date: '2026-08-07', kind: 'expense', amount: -500_000, movementSubtype: 'transfer' }),
      movimiento({ date: '2026-08-08', kind: 'income', amount: 9_000_000, loanRole: 'borrowed' }),
      movimiento({ date: '2026-09-02', kind: 'income', amount: 7_000_000 }),
    ];
    const resultado = flujoPromedio(movimientos, '2026-09-15');
    expect(resultado.mesesMedidos).toBe(2);
    expect(resultado.ingresoMensual).toBe(3_000_000);
    expect(resultado.gastoMensual).toBe(500_000);
  });

  it('toma las tarjetas con saldo y a quien se le debe como deudas actuales', () => {
    const tarjeta: Account = {
      id: 't',
      name: 'Visa',
      type: 'credit',
      currency: 'COP',
      openingBalance: 0,
      annualRate: 26.82,
    };
    const personas: Person[] = [
      { id: 'b', name: 'Banco', kind: 'institution', owed: 0, owing: 8_000_000 },
      { id: 'p', name: 'Ana', owed: 0, owing: 0 },
    ];
    const deudas = deudasActuales([tarjeta], personas, [], () => -2_000_000);
    expect(deudas.map((d) => d.nombre)).toEqual(['Visa', 'Banco']);
    expect(deudas[0].tasaMensual).toBeCloseTo(2, 1);
    expect(deudas[0].tasaConocida).toBe(true);
    expect(deudas[1]).toMatchObject({
      tipo: 'credito',
      tasaMensual: TASA_MENSUAL_SUPUESTA_CREDITO,
      cuotas: CUOTAS_SUPUESTAS,
      tasaConocida: false,
    });
  });

  it('el abono mensual va primero a la deuda más cara y luego a la siguiente', () => {
    const deudas = [
      { id: 'barata', nombre: 'Barata', tipo: 'credito' as const, saldo: 1_000_000, tasaMensual: 1, cuotas: 12 },
      { id: 'cara', nombre: 'Cara', tipo: 'tarjeta' as const, saldo: 600_000, tasaMensual: 3, cuotas: 12 },
    ];
    const palancas = planDeAbonos(deudas, flujo, 24, 300_000, 'tasa');
    expect(palancas[0]).toMatchObject({ deudaId: 'cara', mes: 0 });
    expect(palancas.some((p) => p.tipo === 'abono' && p.deudaId === 'barata')).toBe(true);
    const base = proyectar(deudas, [], flujo, 24);
    const escenario = proyectar(deudas, palancas, flujo, 24);
    expect(escenario.interesTotal).toBeLessThan(base.interesTotal);
    expect(escenario.mesSinDeudas!).toBeLessThan(base.mesSinDeudas!);
  });

  it('calcula la cuota que hace falta para terminar en un plazo', () => {
    const deudas = [{ id: 'c', nombre: 'C', tipo: 'credito' as const, saldo: 1_200_000, tasaMensual: 0, cuotas: 24 }];
    expect(cuotaParaTerminarEn(deudas, 12)).toBe(100_000);
    expect(mesesHasta('2026-09-15', '2027-03-01')).toBe(6);
  });

  it('proyecta una inversión con aporte mensual y rendimiento compuesto', () => {
    const sinRendimiento = proyectarInversion(1_000_000, 100_000, 0, 12);
    expect(sinRendimiento.valorFinal).toBe(2_200_000);
    expect(sinRendimiento.rendimiento).toBe(0);
    const conRendimiento = proyectarInversion(1_000_000, 0, 12, 12);
    expect(conRendimiento.valorFinal).toBeCloseTo(1_120_000, -1);
    expect(
      tasaPromedioDeInversiones([{ value: 100, annualRate: 10 }, { value: 300, annualRate: 2 }, { value: 50 }], 8),
    ).toBe(4);
    expect(tasaPromedioDeInversiones([], 8)).toBe(8);
  });

  it('convierte los créditos del API en deudas con el saldo amortizado a hoy', () => {
    const credito = {
      id: 'o1',
      counterparty: { id: 'banco', name: 'Banco Uno' },
      direction: 2 as const,
      currency: 'COP',
      openedOn: '2026-03-15',
      dueOn: '2027-03-15',
      description: 'Crédito libre inversión',
      status: 1,
      totalOutstanding: { amount: '12000000', currency: 'COP' },
      interestPolicies: [{ effectiveFrom: '2026-03-15', policy: { kind: 1, rate: { rate: '0.015' }, period: 2 } }],
    };
    const cobrada = { ...credito, id: 'o2', direction: 1 as const };
    const [deuda, ...resto] = deudasDeObligaciones([credito, cobrada], '2026-09-20');
    expect(resto).toHaveLength(0);
    expect(deuda).toMatchObject({
      nombre: 'Crédito libre inversión',
      tipo: 'credito',
      tasaMensual: 1.5,
      cuotas: 6,
      tasaConocida: true,
    });
    expect(deuda.saldo).toBeCloseTo(saldoTrasCuotas(12_000_000, 1.5, 12, 6), 2);
    expect(deuda.saldo).toBeLessThan(12_000_000);
    const personas = [{ id: 'banco', name: 'Banco Uno', kind: 'institution' as const, owed: 0, owing: 12_000_000 }];
    const todas = deudasActuales([], personas, [], () => 0, [credito], '2026-09-20');
    expect(todas.map((d) => d.id)).toEqual(['obligacion:o1']);
  });

  it('el saldo tras cuotas llega a cero al final del plazo', () => {
    expect(saldoTrasCuotas(1_200_000, 0, 12, 6)).toBe(600_000);
    expect(saldoTrasCuotas(1_200_000, 2, 12, 12)).toBe(0);
    expect(saldoTrasCuotas(1_200_000, 2, 12, 0)).toBe(1_200_000);
  });

  it('agrupa ingresos y gastos por categoría con su promedio mensual', () => {
    const movimientos = [
      movimiento({ date: '2026-08-02', kind: 'expense', amount: -300, category: 'Mercado' }),
      movimiento({ date: '2026-07-02', kind: 'expense', amount: -100, category: 'Mercado' }),
      movimiento({ date: '2026-08-03', kind: 'income', amount: 1000, category: 'Salario' }),
      movimiento({ date: '2026-07-03', kind: 'income', amount: 1000, category: 'Salario' }),
    ];
    expect(lineasPorCategoria(movimientos, '2026-09-10')).toEqual([
      { id: 'categoria:expense|Mercado', nombre: 'Mercado', tipo: 'gasto', monto: 200 },
      { id: 'categoria:income|Salario', nombre: 'Salario', tipo: 'ingreso', monto: 1000 },
    ]);
  });

  it('proyecta el flujo mes a mes con ajustes, recurrentes quitados y cambios con fecha', () => {
    const categorias = [
      { id: 'g1', nombre: 'Mercado', tipo: 'gasto' as const, monto: 200 },
      { id: 'g2', nombre: 'Ocio', tipo: 'gasto' as const, monto: 100 },
      { id: 'i1', nombre: 'Salario', tipo: 'ingreso' as const, monto: 1000 },
    ];
    const quitados = [{ id: 'r1', nombre: 'Gimnasio', tipo: 'gasto' as const, monto: 50, desde: 1 }];
    const cambios = [{ id: 'c1', nombre: 'Aumento', tipo: 'ingreso' as const, monto: 300, desde: 2, hasta: null }];
    const flujo = flujoPorMes(categorias, { g2: { incluida: false, monto: 100 } }, quitados, cambios, 4);
    expect(flujo.gasto).toEqual([200, 150, 150, 150]);
    expect(flujo.ingreso).toEqual([1000, 1000, 1300, 1300]);
    expect(flujo.gastoPorLinea.map((l) => l.nombre)).toEqual(['Mercado', 'Gimnasio']);
  });

  it('lleva los recurrentes a su equivalente mensual', () => {
    const base = {
      target: {},
      sourceAccount: null,
      destinationAccount: null,
      isActive: true,
      kind: 1,
      amount: { amount: '100', currency: 'COP' },
    };
    const recurrentes = recurrentesDeFlujo(
      [
        {
          ...base,
          id: 'a',
          name: 'Semanal',
          movementTemplate: 2,
          schedule: { frequency: 2, interval: 1, start: '2026-09-01', end: null, dayOfMonth: null, dayOfWeek: 1 },
        },
        {
          ...base,
          id: 'b',
          name: 'Sueldo',
          movementTemplate: 1,
          schedule: { frequency: 3, interval: 1, start: '2026-11-01', end: null, dayOfMonth: 1, dayOfWeek: null },
        },
      ] as never,
      '2026-09-10',
    );
    expect(recurrentes[0]).toMatchObject({ tipo: 'gasto', monto: 433.33, desde: 0 });
    expect(recurrentes[1]).toMatchObject({ tipo: 'ingreso', monto: 100, desde: 2 });
  });

  it('parte una tarjeta en sus conceptos con la tasa y el orden de prioridad de la tarjeta', () => {
    const visa: Account = {
      id: 'visa',
      name: 'Visa',
      type: 'credit',
      currency: 'COP',
      openingBalance: 0,
      annualRate: 26.82,
    };
    const movimientos = [
      movimiento({ id: 'avance', accountId: 'visa', amount: -500_000, movementSubtype: 'advance' }),
      movimiento({ id: 'tv', accountId: 'visa', amount: -1_200_000, installmentTotal: 12, installmentCurrent: 3 }),
      movimiento({ id: 'cero', accountId: 'visa', amount: -300_000, installmentTotal: 3, cardBucket: 17 }),
    ];
    const deudas = deudasDeTarjeta(visa, 1_800_000, movimientos, (c) => `c${c}`);
    expect(deudas.map((d) => d.nombre)).toEqual(['Visa · c8', 'Visa · c13', 'Visa · c17']);
    expect(deudas[0]).toMatchObject({ saldo: 1_000_000, cuotas: 10, grupo: 'tarjeta:visa' });
    expect(deudas[0].tasaMensual).toBeCloseTo(2, 1);
    expect(deudas[2].tasaMensual).toBe(0);
  });

  it('el abono respeta la prioridad dentro de una tarjeta y la estrategia entre deudas', () => {
    const deudas = [
      { id: 'credito', nombre: 'Crédito', tipo: 'credito' as const, saldo: 5_000_000, tasaMensual: 1.2, cuotas: 24 },
      {
        id: 'v13',
        nombre: 'Visa avances',
        tipo: 'tarjeta' as const,
        saldo: 500_000,
        tasaMensual: 2,
        cuotas: 12,
        grupo: 'visa',
        prioridad: 12,
      },
      {
        id: 'v5',
        nombre: 'Visa una cuota',
        tipo: 'tarjeta' as const,
        saldo: 200_000,
        tasaMensual: 0,
        cuotas: 1,
        grupo: 'visa',
        prioridad: 4,
      },
    ];
    expect(ordenarParaAbono(deudas, 'tasa').map((d) => d.id)).toEqual(['v5', 'v13', 'credito']);
  });
});
