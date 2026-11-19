import { type Provider } from '@angular/core';
import { provideRouter } from '@angular/router';
import { describe, expect, it } from 'vitest';
import type { Account, Movement } from '@core/state';
import { P } from '@core/session';
import { datosDe } from '@testing/datos-de-prueba';
import { pruebaRender } from '@testing/prueba-render';
import { sesionDe } from '@testing/sesion-de-prueba';
import { DashboardComponent } from './dashboard';

const cuentas: Account[] = [
  { id: 'banco', name: 'Banco', type: 'checking', currency: 'COP', openingBalance: 0 },
  { id: 'efectivo', name: 'Efectivo', type: 'cash', currency: 'COP', openingBalance: 0 },
];

const movimiento = (id: string, date: string, parcial: Partial<Movement>): Movement =>
  ({
    id,
    date,
    description: id,
    accountId: 'banco',
    category: 'Mercado',
    kind: 'expense',
    effect: 'expense',
    amount: -100_000,
    status: 'confirmed',
    ...parcial,
  }) as Movement;

const MOVIMIENTOS: Movement[] = [
  movimiento('hoy', '2026-08-15', { amount: -100_000 }),
  movimiento('ayer', '2026-08-14', { amount: -50_000, category: 'Ocio' }),
  movimiento('semana-pasada', '2026-08-06', { amount: -30_000, accountId: 'efectivo' }),
  movimiento('mes-pasado', '2026-07-20', { amount: -70_000 }),
  movimiento('anio-pasado', '2025-08-15', { amount: -900_000 }),
  movimiento('sueldo', '2026-08-01', {
    kind: 'income',
    effect: 'income',
    category: 'Salario',
    amount: 4_000_000,
  }),
];

function montar() {
  const montado = pruebaRender(DashboardComponent, {
    session: sesionDe().conCapacidad(P.dashboard.ver, P.dashboard.tabla.ver),
    data: datosDe({ accounts: cuentas, movements: MOVIMIENTOS }),
    providers: [provideRouter([]) as unknown as Provider],
  });
  const { component } = montado;
  component.periodo.anchor.set('2026-08-15');
  component.periodo.scale.set('month');
  montado.cambios();
  return component;
}

const ids = (movimientos: readonly Movement[]) => movimientos.map((m) => m.id).sort();

describe('Dashboard: el periodo cambia las cifras', () => {
  it('mes: del 1 al 31 de agosto, con sus gastos e ingresos', () => {
    const { periodo, datos } = montar();

    expect(periodo.range()).toEqual({ start: '2026-08-01', end: '2026-08-31' });
    expect(ids(datos.movements())).toEqual(['ayer', 'hoy', 'semana-pasada', 'sueldo']);
  });

  it('día: solo lo de ese día', () => {
    const { periodo, datos } = montar();
    periodo.scale.set('day');

    expect(periodo.range()).toEqual({ start: '2026-08-15', end: '2026-08-15' });
    expect(ids(datos.movements())).toEqual(['hoy']);
  });

  it('semana: de lunes a domingo', () => {
    const { periodo, datos } = montar();
    periodo.scale.set('week');

    expect(periodo.range()).toEqual({ start: '2026-08-10', end: '2026-08-16' });
    expect(ids(datos.movements())).toEqual(['ayer', 'hoy']);
  });

  it('año: todo 2026 y nada de 2025', () => {
    const { periodo, datos } = montar();
    periodo.scale.set('year');

    expect(periodo.range()).toEqual({ start: '2026-01-01', end: '2026-12-31' });
    expect(ids(datos.movements())).not.toContain('anio-pasado');
    expect(ids(datos.movements())).toContain('mes-pasado');
  });

  it('anterior y siguiente mueven el periodo según la escala', () => {
    const { periodo } = montar();

    periodo.shiftPeriod(-1);
    expect(periodo.range()).toEqual({ start: '2026-07-01', end: '2026-07-31' });
    periodo.shiftPeriod(1);
    periodo.shiftPeriod(1);
    expect(periodo.range()).toEqual({ start: '2026-09-01', end: '2026-09-30' });

    periodo.scale.set('week');
    periodo.anchor.set('2026-08-15');
    periodo.shiftPeriod(-1);
    expect(periodo.range()).toEqual({ start: '2026-08-03', end: '2026-08-09' });

    periodo.scale.set('year');
    periodo.shiftPeriod(1);
    expect(periodo.range().start).toBe('2027-01-01');
  });

  it('de enero hacia atrás se pasa a diciembre del año anterior', () => {
    const { periodo } = montar();
    periodo.anchor.set('2026-01-10');

    periodo.shiftPeriod(-1);

    expect(periodo.range()).toEqual({ start: '2025-12-01', end: '2025-12-31' });
  });

  it('febrero de un año bisiesto tiene 29 días', () => {
    const { periodo } = montar();
    periodo.anchor.set('2028-02-10');

    expect(periodo.range().end).toBe('2028-02-29');
  });
});

describe('Dashboard: los filtros cambian las cifras', () => {
  it('el filtro de cuenta deja solo lo de esa cuenta', () => {
    const { datos } = montar();
    datos.accountId.set('efectivo');

    expect(ids(datos.movements())).toEqual(['semana-pasada']);
    expect(datos.expense()).toBe(30_000);
  });

  it('el filtro de tipo de cuenta deja las cuentas de ese tipo', () => {
    const { datos } = montar();
    datos.accountType.set('cash');

    expect(ids(datos.movements())).toEqual(['semana-pasada']);
  });

  it('las cuentas ofrecidas siguen al tipo elegido', () => {
    const { datos } = montar();
    datos.accountType.set('checking');

    expect(datos.accountOptions().map((c) => c.id)).toEqual(['banco']);
  });

  it('el filtro de categoría global deja solo esa categoría', () => {
    const { datos } = montar();
    datos.globalCategory.set('Ocio');

    expect(ids(datos.movements())).toEqual(['ayer']);
    expect(datos.expense()).toBe(50_000);
  });

  it('los filtros se combinan', () => {
    const { datos } = montar();
    datos.accountId.set('banco');
    datos.globalCategory.set('Mercado');

    expect(ids(datos.movements())).toEqual(['hoy']);
  });

  it('el gasto del mes suma 180 mil sin filtros y el ingreso 4 millones', () => {
    const { datos } = montar();

    expect(datos.expense()).toBe(180_000);
    expect(datos.income()).toBe(4_000_000);
    expect(datos.net()).toBe(3_820_000);
  });

  it('«Aplicar a todo» pasa la categoría local a global y filtra las cifras', () => {
    const { datos } = montar();
    datos.localCategory.set('Ocio');

    datos.promoteCategory();

    expect(datos.globalCategory()).toBe('Ocio');
    expect(datos.expense()).toBe(50_000);
  });

  it('las categorías locales ofrecidas son las de gasto del periodo', () => {
    const { datos } = montar();

    expect(datos.localOptions()).toEqual(['Mercado', 'Ocio']);
  });

  it('restablecer vuelve a mes, hoy y sin filtros', () => {
    const { datos, periodo } = montar();
    periodo.scale.set('year');
    datos.accountId.set('banco');
    datos.accountType.set('checking');
    datos.globalCategory.set('Ocio');

    datos.reset();

    expect(periodo.scale()).toBe('month');
    expect(periodo.anchor()).toBe(periodo.anclaPorDefecto);
    expect([datos.accountId(), datos.accountType(), datos.globalCategory()]).toEqual(['all', 'all', 'all']);
  });
});
