import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { AppStore } from './store';
import type { Movement } from './view-model';

const movimiento = (id: string, date: string): Movement => ({
  id,
  date,
  description: id,
  accountId: 'cuenta-1',
  category: 'Mercado',
  kind: 'expense',
  amount: -1000,
  status: 'confirmed',
});

describe('AppStore: movimientos cargados fuera de la página del libro', () => {
  let store: AppStore;

  beforeEach(() => {
    window.__FINANZAS_CONFIG__ = { apiBaseUrl: 'https://api.example.test' };
    TestBed.resetTestingModule();
    store = TestBed.inject(AppStore);
    store.data.update((data) => ({ ...data, movements: [movimiento('pagina-1', '2026-10-07')] }));
  });

  it('dayMoves une la página del libro con los movimientos recordados', () => {
    store.recordarMovimientos([movimiento('mes-pasado', '2026-09-15'), movimiento('pagina-1', '2026-10-07')]);

    expect(store.dayMoves('2026-09-15').map((m) => m.id)).toEqual(['mes-pasado']);
    expect(store.dayMoves('2026-10-07').map((m) => m.id)).toEqual(['pagina-1']);
  });

  it('movimiento encuentra por id tanto en la página como en lo recordado', () => {
    store.recordarMovimientos([movimiento('mes-pasado', '2026-09-15')]);

    expect(store.movimiento('pagina-1')?.date).toBe('2026-10-07');
    expect(store.movimiento('mes-pasado')?.date).toBe('2026-09-15');
    expect(store.movimiento('no-existe')).toBeUndefined();
    expect(store.movimiento(undefined)).toBeUndefined();
  });

  it('la página del libro manda sobre una copia recordada más vieja', () => {
    store.recordarMovimientos([{ ...movimiento('pagina-1', '2026-10-07'), description: 'vieja' }]);

    expect(store.movimiento('pagina-1')?.description).toBe('pagina-1');
    expect(store.dayMoves('2026-10-07')).toHaveLength(1);
  });
});
