import { describe, expect, it } from 'vitest';
import type { ApiDebtPosition } from '@core/api/people.api';
import { conPosicionesDeDeuda } from './people.mapper';

const dinero = (amount: string, currency = 'COP') => ({ amount, currency });
const personas = [
  { id: 'ana', name: 'Ana', owed: 0, owing: 0 },
  { id: 'beto', name: 'Beto', owed: 0, owing: 0 },
];

function posicion(id: string, sobre: Partial<ApiDebtPosition> = {}): ApiDebtPosition {
  return {
    counterparty: { id, name: id },
    receivable: dinero('1000'),
    ownDebt: dinero('0'),
    asOf: '2026-11-01',
    ...sobre,
  };
}

describe('posiciones de deuda por persona', () => {
  it('suma en la moneda base lo que le deben y lo que debe', () => {
    const [ana] = conPosicionesDeDeuda(personas, [
      posicion('ana', { receivable: dinero('5000'), ownDebt: dinero('700') }),
    ]);

    expect(ana).toMatchObject({ owed: 5000, owing: 700 });
    expect(ana.otherCurrencies).toBeUndefined();
  });

  it('conserva por moneda lo que la API reporta en otras monedas', () => {
    const [ana, beto] = conPosicionesDeDeuda(personas, [
      posicion('ana', {
        otherCurrencies: [
          { currency: 'USD', receivable: dinero('120.50', 'USD'), ownDebt: dinero('0', 'USD') },
          { currency: 'EUR', receivable: dinero('0', 'EUR'), ownDebt: dinero('30', 'EUR') },
        ],
      }),
    ]);

    expect(ana.otherCurrencies).toEqual([
      { currency: 'USD', owed: 120.5, owing: 0 },
      { currency: 'EUR', owed: 0, owing: 30 },
    ]);
    expect(beto.otherCurrencies).toBeUndefined();
  });

  it('una lista vacía o nula de otras monedas no deja rastro', () => {
    const [ana] = conPosicionesDeDeuda(personas, [posicion('ana', { otherCurrencies: [] })]);
    const [otra] = conPosicionesDeDeuda(personas, [posicion('ana', { otherCurrencies: null })]);

    expect(ana.otherCurrencies).toBeUndefined();
    expect(otra.otherCurrencies).toBeUndefined();
  });
});
