import { describe, expect, it } from 'vitest';
import { totalesEnOtrasMonedas, monedasDe } from './otras-monedas';

const ana = {
  id: 'ana',
  name: 'Ana',
  owed: 0,
  owing: 0,
  otherCurrencies: [
    { currency: 'USD', owed: 100, owing: 0 },
    { currency: 'EUR', owed: 0, owing: 30 },
  ],
};
const beto = {
  id: 'beto',
  name: 'Beto',
  owed: 0,
  owing: 0,
  otherCurrencies: [{ currency: 'USD', owed: 50, owing: 20 }],
};
const carla = { id: 'carla', name: 'Carla', owed: 10, owing: 0 };

describe('totales de deuda en otras monedas', () => {
  it('suma por moneda entre todas las personas, ordenadas por código', () => {
    expect(totalesEnOtrasMonedas([ana, beto, carla])).toEqual([
      { currency: 'EUR', owed: 0, owing: 30 },
      { currency: 'USD', owed: 150, owing: 20 },
    ]);
  });

  it('sin deudas en otras monedas no hay totales', () => {
    expect(totalesEnOtrasMonedas([carla])).toEqual([]);
    expect(totalesEnOtrasMonedas([])).toEqual([]);
  });
});

describe('monedas de una persona', () => {
  it('la moneda base más las otras, para mostrarlas juntas', () => {
    expect(monedasDe(ana, 'COP')).toBe('COP + EUR, USD');
    expect(monedasDe(carla, 'COP')).toBe('COP');
  });
});
