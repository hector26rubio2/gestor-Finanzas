import { describe, expect, it } from 'vitest';
import { anualDesdeMensual, cuotaFija, mensualDesdeAnual } from './tasas';

describe('tasas', () => {
  it('convierte una tasa mensual a efectiva anual y de vuelta', () => {
    expect(anualDesdeMensual(2)).toBeCloseTo(26.824, 3);
    expect(mensualDesdeAnual(26.824)).toBeCloseTo(2, 3);
  });

  it('calcula la cuota fija de un crédito', () => {
    expect(cuotaFija(1_200_000, 0, 12)).toBe(100_000);
    expect(cuotaFija(1_000_000, 2, 12)).toBeCloseTo(94_559.6, 1);
  });
});
