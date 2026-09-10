import { describe, expect, it } from 'vitest';
import { formatReturnRate, returnRate } from './money';

/**
 * El rendimiento se enseñaba dividiendo por el coste sin mirarlo. Con la cartera vacia
 * la pantalla ponia «NaN %», y con una inversion de coste cero, «Infinity %». Las dos
 * salian tal cual a la vista, y en la exportacion a CSV.
 */
describe('rendimiento de una inversion', () => {
  it('calcula la variacion sobre el coste', () => {
    expect(returnRate(110, 100)).toBeCloseTo(10);
    expect(returnRate(80, 100)).toBeCloseTo(-20);
  });

  it('sin coste no hay porcentaje que dar', () => {
    // Antes: «Infinity %».
    expect(returnRate(100, 0)).toBeNull();
    expect(formatReturnRate(100, 0)).toBe('—');
  });

  it('la cartera vacia no rinde «NaN %»', () => {
    // Sumar cero valores da 0 y 0: antes salia NaN y se pintaba.
    expect(returnRate(0, 0)).toBeNull();
    expect(formatReturnRate(0, 0)).toBe('—');
  });

  it('un valor absurdo no se convierte en porcentaje', () => {
    expect(returnRate(Number.NaN, 100)).toBeNull();
    expect(returnRate(100, Number.POSITIVE_INFINITY)).toBeNull();
  });

  it('el formato lleva una decimal y su signo de porcentaje', () => {
    expect(formatReturnRate(110, 100)).toBe('10.0 %');
    expect(formatReturnRate(95, 100)).toBe('-5.0 %');
  });
});
