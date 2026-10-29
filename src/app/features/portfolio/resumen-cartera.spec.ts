import { describe, expect, it } from 'vitest';
import type { Investment } from '@core/state';
import { resumenCartera } from './resumen-cartera';

const inversion = (value: number, cost: number, currency: string): Investment => ({
  id: `${currency}-${value}`,
  name: 'x',
  type: 'Fondo',
  value,
  cost,
  currency,
  netContributions: 0,
  sinValoracion: false,
});

describe('resumenCartera', () => {
  it('suma solo la moneda base y agrupa las demas', () => {
    const resumen = resumenCartera(
      [
        inversion(1200, 1000, 'COP'),
        inversion(500, 400, 'USD'),
        inversion(300, 300, 'USD'),
        inversion(110, 100, 'COP'),
      ],
      'COP',
    );
    expect(resumen.valor).toBe(1310);
    expect(resumen.costo).toBe(1100);
    expect(resumen.ganancia).toBe(210);
    expect(resumen.rendimiento).toBeCloseTo(19.09, 1);
    expect(resumen.otrasMonedas).toEqual([{ moneda: 'USD', valor: 800 }]);
  });

  it('reporta perdida como ganancia negativa', () => {
    const resumen = resumenCartera([inversion(800, 1000, 'COP')], 'COP');
    expect(resumen.ganancia).toBe(-200);
    expect(resumen.rendimiento).toBeCloseTo(-20, 5);
  });

  it('sin costo el rendimiento es null', () => {
    const resumen = resumenCartera([inversion(500, 0, 'COP')], 'COP');
    expect(resumen.rendimiento).toBeNull();
    expect(resumen.otrasMonedas).toEqual([]);
  });
});
