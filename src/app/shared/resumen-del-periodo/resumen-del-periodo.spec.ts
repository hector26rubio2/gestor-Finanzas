import { describe, expect, it } from 'vitest';
import type { Account, Movement } from '@core/state/view-model';
import type { ApiDashboard } from '@core/api/reporting.api';
import { SIN_DATO } from '@shared/utils';
import {
  formatoDeTasaDeAhorro,
  resumenDelPeriodo,
  resumenDelServidor,
  resumenDeMovimientos,
  resumenDeTotales,
  tasaDeAhorro,
} from './resumen-del-periodo';

const cuentas: Account[] = [
  { id: 'a1', name: 'Ahorros', type: 'savings', currency: 'COP', openingBalance: 0 },
  { id: 't1', name: 'Visa', type: 'credit', currency: 'COP', openingBalance: 0 },
];
const cuentaDe = (id: string) => cuentas.find((c) => c.id === id);

const mov = (id: string, date: string, amount: number, extra: Partial<Movement> = {}): Movement => ({
  id,
  date,
  description: id,
  accountId: 'a1',
  category: 'General',
  kind: amount >= 0 ? 'income' : 'expense',
  amount,
  status: 'confirmed',
  ...extra,
});

const movimientos: Movement[] = [
  mov('sueldo', '2026-10-02', 1_000_000, { category: 'Sueldo' }),
  mov('mercado', '2026-10-05', -300_000, { category: 'Comida' }),
  mov('visa', '2026-10-09', -100_000, { accountId: 't1', category: 'Comida' }),
  mov('traslado', '2026-10-10', -50_000, { kind: 'payment', effect: 'neutral' }),
  mov('septiembre', '2026-09-28', -999_000),
];
const octubre = { start: '2026-10-01', end: '2026-10-31' };

const dinero = (amount: string) => ({ amount, currency: 'COP' });
const tablero = (inicio: string, fin: string, ingreso: string, gasto: string): ApiDashboard => ({
  period: {
    income: dinero(ingreso),
    expense: dinero(gasto),
    net: dinero(String(Number(ingreso) - Number(gasto))),
    period: { start: inicio, end: fin },
  },
  accounts: [],
  cards: [],
  topCategories: [],
  series: [],
  asOf: fin,
});

describe('tasaDeAhorro', () => {
  it('es neto sobre ingreso en porcentaje', () => {
    expect(tasaDeAhorro(1_000_000, 600_000)).toBe(60);
  });

  it('sin ingreso es sin dato y nunca cero', () => {
    expect(tasaDeAhorro(0, -200_000)).toBeNull();
    expect(tasaDeAhorro(0, 0)).toBeNull();
  });

  it('puede ser negativa si se gastó más de lo que entró', () => {
    expect(tasaDeAhorro(100, -100)).toBe(-100);
  });
});

describe('resumen desde movimientos', () => {
  it('suma ingreso y gasto económicos del rango y deja fuera lo neutro y lo de otros meses', () => {
    const r = resumenDeMovimientos(movimientos, octubre, {}, cuentaDe);
    expect(r.ingreso).toBe(1_000_000);
    expect(r.gasto).toBe(400_000);
    expect(r.neto).toBe(600_000);
    expect(r.tasaDeAhorro).toBe(60);
    expect(r.economicos?.map((m) => m.id)).toEqual(['sueldo', 'mercado', 'visa']);
  });

  it('aplica filtros de cuenta, tipo de cuenta, categoría y predicado', () => {
    expect(resumenDeMovimientos(movimientos, octubre, { cuentaId: 't1' }, cuentaDe).gasto).toBe(100_000);
    expect(resumenDeMovimientos(movimientos, octubre, { tipoDeCuenta: 'credit' }, cuentaDe).gasto).toBe(100_000);
    expect(resumenDeMovimientos(movimientos, octubre, { categoria: 'Comida' }, cuentaDe).gasto).toBe(400_000);
    expect(resumenDeMovimientos(movimientos, octubre, { predicado: (m) => m.id === 'mercado' }, cuentaDe).gasto).toBe(
      300_000,
    );
  });

  it('sin ingresos la tasa de ahorro es sin dato', () => {
    const r = resumenDeMovimientos(movimientos, octubre, { categoria: 'Comida' }, cuentaDe);
    expect(r.ingreso).toBe(0);
    expect(r.tasaDeAhorro).toBeNull();
  });
});

describe('resumen desde el servidor', () => {
  it('usa los totales del tablero cuando el rango coincide en inicio y fin', () => {
    const r = resumenDelServidor(tablero('2026-10-01', '2026-10-31', '1000000', '400000'), octubre, {});
    expect(r).toMatchObject({ ingreso: 1_000_000, gasto: 400_000, neto: 600_000, tasaDeAhorro: 60, economicos: null });
  });

  it('no aplica si solo coincide el inicio del rango', () => {
    expect(resumenDelServidor(tablero('2026-10-01', '2026-10-15', '1', '1'), octubre, {})).toBeNull();
  });

  it('no aplica si solo coincide el fin del rango', () => {
    expect(resumenDelServidor(tablero('2026-09-01', '2026-10-31', '1', '1'), octubre, {})).toBeNull();
  });

  it('no aplica con filtros ni sin tablero', () => {
    const t = tablero('2026-10-01', '2026-10-31', '1000000', '400000');
    expect(resumenDelServidor(t, octubre, { categoria: 'Comida' })).toBeNull();
    expect(resumenDelServidor(t, octubre, { cuentaId: 'a1' })).toBeNull();
    expect(resumenDelServidor(t, octubre, { tipoDeCuenta: 'credit' })).toBeNull();
    expect(resumenDelServidor(t, octubre, { predicado: () => true })).toBeNull();
    expect(resumenDelServidor(null, octubre, {})).toBeNull();
  });

  it('sin ingresos la tasa de ahorro es sin dato', () => {
    const r = resumenDelServidor(tablero('2026-10-01', '2026-10-31', '0', '250000'), octubre, {});
    expect(r?.tasaDeAhorro).toBeNull();
    expect(r?.neto).toBe(-250_000);
  });
});

describe('resumenDelPeriodo', () => {
  it('prefiere el servidor y mismo periodo da la misma tasa por ambos caminos', () => {
    const t = tablero('2026-10-01', '2026-10-31', '1000000', '400000');
    const conServidor = resumenDelPeriodo({ movimientos, tablero: t, cuentaDe }, octubre, {});
    const sinServidor = resumenDelPeriodo({ movimientos, tablero: null, cuentaDe }, octubre, {});
    expect(conServidor.tasaDeAhorro).toBe(sinServidor.tasaDeAhorro);
    expect(conServidor.economicos).toBeNull();
    expect(sinServidor.economicos).not.toBeNull();
  });

  it('cae a los movimientos si el tablero es de otro rango', () => {
    const t = tablero('2026-09-01', '2026-09-30', '5', '5');
    const r = resumenDelPeriodo({ movimientos, tablero: t, cuentaDe }, octubre, {});
    expect(r.ingreso).toBe(1_000_000);
  });
});

describe('resumen desde totales ya calculados', () => {
  it('arma neto y tasa de ahorro', () => {
    expect(resumenDeTotales(2_000, 500)).toMatchObject({ neto: 1_500, tasaDeAhorro: 75, economicos: null });
    expect(resumenDeTotales(0, 500).tasaDeAhorro).toBeNull();
  });
});

describe('formatoDeTasaDeAhorro', () => {
  it('sin dato muestra el marcador y no 0 %', () => {
    expect(formatoDeTasaDeAhorro(null)).toBe(SIN_DATO);
  });

  it('redondea y conserva el signo', () => {
    expect(formatoDeTasaDeAhorro(25.4)).toBe('25 %');
    expect(formatoDeTasaDeAhorro(-50)).toBe('-50 %');
    expect(formatoDeTasaDeAhorro(0)).toBe('0 %');
  });
});
