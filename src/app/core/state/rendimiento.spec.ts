import { describe, expect, it } from 'vitest';
import { formatReturnRate, returnRate } from '@core/utils/money';

describe('rendimiento de una inversion', () => {
  it('calcula la variacion sobre el coste', () => {
    expect(returnRate(110, 100)).toBeCloseTo(10);
    expect(returnRate(80, 100)).toBeCloseTo(-20);
  });

  it('sin coste no hay porcentaje que dar', () => {
    expect(returnRate(100, 0)).toBeNull();
    expect(formatReturnRate(100, 0)).toBe('—');
  });

  it('la cartera vacia no rinde «NaN %»', () => {
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
