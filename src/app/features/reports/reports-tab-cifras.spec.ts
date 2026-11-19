import { type Provider } from '@angular/core';
import { provideRouter } from '@angular/router';
import { describe, expect, it } from 'vitest';
import type { Account, Movement } from '@core/state';
import { addMonthsToIso, todayIso } from '@core/utils/dates';
import { datosDe } from '@testing/datos-de-prueba';
import { pruebaRender } from '@testing/prueba-render';
import { sesionDe } from '@testing/sesion-de-prueba';
import { ReportsTabComponent } from './reports-tab';

const PROVEEDORES: Provider[] = [provideRouter([]) as unknown as Provider];

const primerDia = (mesesAtras: number) => addMonthsToIso(`${todayIso().slice(0, 7)}-01`, -mesesAtras);

const base = (id: string, fecha: string, parcial: Partial<Movement>): Movement =>
  ({
    id,
    date: fecha,
    description: id,
    accountId: 'banco',
    category: 'Varios',
    kind: 'expense',
    effect: 'expense',
    amount: -1,
    status: 'confirmed',
    ...parcial,
  }) as Movement;

const gasto = (id: string, mesesAtras: number, categoria: string, monto: number, cuenta = 'banco') =>
  base(id, primerDia(mesesAtras), { category: categoria, amount: -monto, accountId: cuenta });

const salario = (id: string, mesesAtras: number) =>
  base(id, primerDia(mesesAtras), {
    kind: 'income',
    effect: 'income',
    category: 'Salario',
    amount: 5_000_000,
  });

const cuentas: Account[] = [
  { id: 'banco', name: 'Banco', type: 'checking', currency: 'COP', openingBalance: 20_000_000 },
  {
    id: 'visa',
    name: 'Visa',
    type: 'credit',
    currency: 'COP',
    openingBalance: 0,
    limit: 5_000_000,
    annualRate: 24,
    cutDay: 10,
    dueDay: 25,
  },
];

const SEMBRADO: Movement[] = [
  salario('s2', 2),
  salario('s1', 1),
  salario('s0', 0),
  gasto('mercado-2', 2, 'Mercado', 800_000, 'visa'),
  gasto('ocio-2', 2, 'Ocio', 200_000),
  gasto('mercado-1', 1, 'Mercado', 1_000_000),
  gasto('ocio-1', 1, 'Ocio', 500_000),
  gasto('mercado-0', 0, 'Mercado', 300_000),
  base('traslado', primerDia(1), { amount: -1_000_000, movementSubtype: 'transfer', effect: 'neutral' }),
  base('pago-tarjeta', primerDia(1), { kind: 'payment', amount: -400_000, effect: 'neutral' }),
];

function montar() {
  const montado = pruebaRender(ReportsTabComponent, {
    session: sesionDe(),
    data: datosDe({
      accounts: cuentas,
      movements: SEMBRADO,
      investments: [
        { id: 'i1', name: 'CDT', type: 'cdt', cost: 900_000, value: 1_000_000, currency: 'COP' },
        { id: 'i2', name: 'Fondo', type: 'fondo', cost: 2_000_000, value: 2_500_000, currency: 'COP' },
      ] as never,
    }),
    providers: PROVEEDORES,
  });
  montado.cambios();
  montado.component.reportPeriod.set('3');
  return montado.component;
}

describe('Reportes: con datos sembrados cada cifra coincide con el cálculo a mano', () => {
  it('el ingreso suma los tres salarios', () => {
    expect(montar().reportIncome()).toBe(15_000_000);
  });

  it('el gasto suma los cinco gastos y deja fuera la transferencia y el pago de tarjeta', () => {
    expect(montar().reportExpenses()).toBe(2_800_000);
  });

  it('el neto es ingreso menos gasto', () => {
    expect(montar().reportNet()).toBe(12_200_000);
  });

  it('la tasa de ahorro es el neto entre el ingreso: 12,2 de 15 es 81 %', () => {
    expect(montar().reportSavingsRate()).toContain('81');
  });

  it('el gasto promedio mensual divide entre los dos meses cerrados: (1,0 + 1,5) / 2 = 1,25 millones', () => {
    expect(montar().reportAverageExpense()).toBe(1_250_000);
  });

  it('las categorías suman lo suyo y su porcentaje del gasto: Mercado 2,1 millones (75 %), Ocio 0,7 (25 %)', () => {
    const categorias = montar().reportCategories();

    expect(categorias.map((c) => [c.name, c.value, c.percent])).toEqual([
      ['Mercado', 2_100_000, 75],
      ['Ocio', 700_000, 25],
    ]);
  });

  it('la categoría principal es Mercado con 2,1 millones', () => {
    expect(montar().topCategory()).toMatchObject({ name: 'Mercado', value: 2_100_000 });
  });

  it('cada mes de la serie trae su ingreso, gasto y neto', () => {
    const serie = montar().reportSeries();

    expect(serie.map((m) => [m.income, m.expense, m.net])).toEqual([
      [5_000_000, 1_000_000, 4_000_000],
      [5_000_000, 1_500_000, 3_500_000],
      [5_000_000, 300_000, 4_700_000],
    ]);
  });

  it('el hallazgo de la mayor subida es Ocio, que pasó de 200 mil a 500 mil: +150 %', () => {
    const hallazgos = montar().insights();

    expect(hallazgos[1]).toContain('Ocio');
    expect(hallazgos[1]).toContain('150');
  });

  it('la utilización de tarjetas es la deuda entre el cupo: 800 mil de 5 millones, 16 %', () => {
    expect(montar().utilization()).toBeCloseTo(16, 5);
  });

  it('el interés estimado es la deuda por la tasa anual entre 12: 800 mil × 24 % / 12 = 16 mil', () => {
    expect(montar().estimatedInterest()).toBeCloseTo(16_000, 5);
  });

  it('el próximo vencimiento es el de la tarjeta con deuda', () => {
    expect(montar().nextDue()?.tarjeta).toBe('Visa');
  });

  it('el valor de las inversiones suma lo que valen hoy: 3,5 millones', () => {
    expect(montar().investmentValue()).toBe(3_500_000);
  });
});
