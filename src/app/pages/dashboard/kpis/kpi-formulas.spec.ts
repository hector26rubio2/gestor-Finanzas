import { describe, expect, it } from 'vitest';
import type { Movement } from '@core/state';
import { totalDeGastos } from '@core/state/economia';
import type { PuntoDeFlujo } from '@shared/historia';
import {
  diasDelRango,
  enPorcentaje,
  subirEsBueno,
  tonoDeKpi,
  valorDeKpiEnPunto,
  valorDeKpiSobre,
} from './kpi-formulas';

const base = (id: string, parcial: Partial<Movement>): Movement =>
  ({
    id,
    date: '2026-08-10',
    description: id,
    accountId: 'banco',
    category: 'Mercado',
    kind: 'expense',
    effect: 'expense',
    amount: -1,
    status: 'confirmed',
    ...parcial,
  }) as Movement;

const MOVIMIENTOS: Movement[] = [
  base('salario', { kind: 'income', effect: 'income', category: 'Salario', amount: 5_000_000 }),
  base('mercado', { amount: -1_000_000 }),
  base('gimnasio', { amount: -500_000, category: 'Ocio', recurring: true }),
  base('televisor', { amount: -500_000, installmentTotal: 3 }),
  base('traslado', { amount: -700_000, effect: 'neutral', movementSubtype: 'transfer' }),
];

const medir = (movs: readonly Movement[], medida: 'amount' | 'count' | 'average' | 'expense') => {
  if (medida === 'count') return movs.length;
  if (medida === 'expense') return totalDeGastos(movs);
  const suma = movs.reduce((total, m) => total + m.amount, 0);
  return medida === 'average' ? (movs.length ? suma / movs.length : 0) : suma;
};

const punto = (parcial: Partial<PuntoDeFlujo> = {}): PuntoDeFlujo =>
  ({
    rango: { start: '2026-08-01', end: '2026-08-10' },
    income: 5_000_000,
    expense: 2_000_000,
    net: 3_000_000,
    movs: MOVIMIENTOS,
    ...parcial,
  }) as PuntoDeFlujo;

describe('KPI sobre los movimientos del periodo, calculados a mano (ingreso 5 M, gasto 2 M, 10 días)', () => {
  const valor = (formula: Parameters<typeof valorDeKpiSobre>[0]) => valorDeKpiSobre(formula, MOVIMIENTOS, 10, medir);

  it('ingreso: solo el salario, sin la transferencia', () => {
    expect(valor('income')).toBe(5_000_000);
  });

  it('gasto: 1 M + 0,5 M + 0,5 M, sin la transferencia', () => {
    expect(valor('expense')).toBe(2_000_000);
  });

  it('tasa de ahorro: (5 − 2) / 5 = 60 %', () => {
    expect(valor('savingsRate')).toBeCloseTo(60, 5);
  });

  it('gasto sobre ingreso: 2 / 5 = 40 %', () => {
    expect(valor('expenseShare')).toBeCloseTo(40, 5);
  });

  it('gasto diario: 2 M entre 10 días = 200 mil', () => {
    expect(valor('dailyExpense')).toBe(200_000);
  });

  it('ingreso diario: 5 M entre 10 días = 500 mil', () => {
    expect(valor('dailyIncome')).toBe(500_000);
  });

  it('el recuento cuenta todos los movimientos', () => {
    expect(valor('count')).toBe(5);
  });

  it('sin ingresos el gasto sobre ingreso es 0, no infinito', () => {
    const soloGasto = MOVIMIENTOS.filter((m) => m.id === 'mercado');

    expect(valorDeKpiSobre('expenseShare', soloGasto, 10, medir)).toBe(0);
  });

  it('sin movimientos todo vale 0', () => {
    expect(valorDeKpiSobre('income', [], 10, medir)).toBe(0);
    expect(valorDeKpiSobre('expense', [], 10, medir)).toBe(0);
    expect(valorDeKpiSobre('dailyExpense', [], 10, medir)).toBe(0);
  });
});

describe('KPI sobre un punto de la historia, calculados a mano', () => {
  const valor = (formula: Parameters<typeof valorDeKpiEnPunto>[0], p = punto()) => valorDeKpiEnPunto(formula, p, medir);

  it('importe, ingreso y gasto salen del punto', () => {
    expect(valor('amount')).toBe(3_000_000);
    expect(valor('income')).toBe(5_000_000);
    expect(valor('expense')).toBe(2_000_000);
  });

  it('gasto diario del punto: 2 M entre 10 días', () => {
    expect(valor('dailyExpense')).toBe(200_000);
  });

  it('gasto fijo: lo recurrente (0,5 M) entre el gasto (2 M) = 25 %', () => {
    expect(valor('fixedExpenseShare')).toBeCloseTo(25, 5);
  });

  it('gasto en cuotas: lo diferido (0,5 M) entre el gasto (2 M) = 25 %', () => {
    expect(valor('installmentExpenseShare')).toBeCloseTo(25, 5);
  });

  it('concentración: la categoría mayor, Mercado con 1,5 M de 2 M = 75 %', () => {
    expect(valor('expenseConcentration')).toBeCloseTo(75, 5);
  });

  it('sin gasto los porcentajes de composición valen 0', () => {
    const sinGasto = punto({ movs: MOVIMIENTOS.filter((m) => m.id === 'salario') });

    expect(valor('fixedExpenseShare', sinGasto)).toBe(0);
    expect(valor('expenseConcentration', sinGasto)).toBe(0);
  });

  it('sin movimientos detallados los KPI de composición no se calculan', () => {
    expect(valor('fixedExpenseShare', punto({ movs: undefined }))).toBeNull();
  });
});

describe('KPI: utilidades', () => {
  it('los días del rango incluyen ambos extremos y nunca bajan de 1', () => {
    expect(diasDelRango({ start: '2026-08-01', end: '2026-08-31' })).toBe(31);
    expect(diasDelRango({ start: '2026-08-15', end: '2026-08-15' })).toBe(1);
    expect(diasDelRango({ start: '2028-02-01', end: '2028-02-29' })).toBe(29);
  });

  it('las razones se muestran en porcentaje y los importes no', () => {
    expect(enPorcentaje('savingsRate')).toBe(true);
    expect(enPorcentaje('creditUtilization')).toBe(true);
    expect(enPorcentaje('income')).toBe(false);
  });

  it('el gasto sube mal y el ingreso sube bien, con su tono', () => {
    expect(subirEsBueno('expense')).toBe(false);
    expect(subirEsBueno('income')).toBe(true);
    expect(tonoDeKpi('expense')).toBe('danger');
    expect(tonoDeKpi('income')).toBe('success');
    expect(tonoDeKpi('count')).toBe('accent');
  });
});
