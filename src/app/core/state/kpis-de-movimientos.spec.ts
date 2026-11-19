import { Component, inject } from '@angular/core';
import { describe, expect, it } from 'vitest';
import { AppStore, type Movement } from '@core/state';
import { datosDe } from '@testing/datos-de-prueba';
import { pruebaRender } from '@testing/prueba-render';

@Component({ selector: 'prueba-kpis-de-movimientos', template: '' })
class ComponenteVacio {
  readonly store = inject(AppStore);
}

const mov = (id: string, parcial: Partial<Movement>): Movement => ({
  id,
  date: '2026-10-10',
  description: id,
  accountId: 'a',
  category: 'Varios',
  kind: 'expense',
  amount: -100,
  status: 'confirmed',
  ...parcial,
});

const movimientos: Movement[] = [
  mov('sueldo', { kind: 'income', amount: 1_000_000, category: 'Salario', effect: 'income' }),
  mov('mercado', { amount: -200_000, category: 'Mercado', effect: 'expense' }),
  mov('cine', { amount: -50_000, category: 'Ocio', effect: 'expense', accountId: 'b' }),
  mov('mercado-sep', { date: '2026-09-05', amount: -80_000, category: 'Mercado', effect: 'expense' }),
  mov('traslado', { amount: -300_000, effect: 'neutral', movementSubtype: 'transfer' }),
];

function montar() {
  const montado = pruebaRender(ComponenteVacio, { data: datosDe({ movements: movimientos }) });
  montado.cambios();
  return montado.store;
}

describe('los totales de Movimientos coinciden con las filas visibles', () => {
  it('sin filtros suman todo y la transferencia no cuenta como gasto', () => {
    const store = montar();

    expect(store.movements()).toHaveLength(5);
    expect(store.income()).toBe(1_000_000);
    expect(store.expense()).toBe(330_000);
  });

  it('el período deja solo los movimientos de ese mes', () => {
    const store = montar();
    store.period.set('2026-09');

    expect(store.movements().map((m) => m.id)).toEqual(['mercado-sep']);
    expect(store.income()).toBe(0);
    expect(store.expense()).toBe(80_000);
  });

  it('el filtro de cuenta recalcula ingresos y gastos', () => {
    const store = montar();
    store.accountFilter.set('b');

    expect(store.movements().map((m) => m.id)).toEqual(['cine']);
    expect(store.expense()).toBe(50_000);
    expect(store.income()).toBe(0);
  });

  it('la búsqueda mira descripción y categoría sin distinguir mayúsculas', () => {
    const store = montar();
    store.query.set('MERCADO');

    expect(
      store
        .movements()
        .map((m) => m.id)
        .sort(),
    ).toEqual(['mercado', 'mercado-sep']);
    expect(store.expense()).toBe(280_000);
  });

  it('los filtros se combinan y al quitarlos todo vuelve', () => {
    const store = montar();
    store.period.set('2026-10');
    store.accountFilter.set('a');
    store.query.set('mercado');

    expect(store.movements().map((m) => m.id)).toEqual(['mercado']);
    expect(store.expense()).toBe(200_000);

    store.period.set('all');
    store.accountFilter.set('all');
    store.query.set('');

    expect(store.movements()).toHaveLength(5);
    expect(store.expense()).toBe(330_000);
  });

  it('un movimiento anulado y su reverso no suman gasto', () => {
    const montado = pruebaRender(ComponenteVacio, {
      data: datosDe({
        movements: [
          mov('g', { amount: -100_000, effect: 'expense', anulado: true }),
          mov('g-reverso', { amount: 100_000, effect: 'expense', anulado: true }),
        ],
      }),
    });
    montado.cambios();

    expect(montado.store.expense()).toBe(0);
  });
});
