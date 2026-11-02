import { describe, expect, it } from 'vitest';
import { anualDesdeMensual, cuotaFija, enFraccion, enPorcentaje, mensualDesdeAnual } from './tasas';

describe('tasas', () => {
  it('convierte una tasa mensual a efectiva anual y de vuelta', () => {
    expect(anualDesdeMensual(2)).toBeCloseTo(26.824, 3);
    expect(mensualDesdeAnual(26.824)).toBeCloseTo(2, 3);
  });

  it('calcula la cuota fija de un crédito', () => {
    expect(cuotaFija(1_200_000, enPorcentaje(0), 12)).toBe(100_000);
    expect(cuotaFija(1_000_000, enPorcentaje(2), 12)).toBeCloseTo(94_559.6, 1);
  });

  it('la misma tasa en porcentaje o en fracción da la misma cuota', () => {
    expect(cuotaFija(1_000_000, enFraccion(0.02), 12)).toBeCloseTo(cuotaFija(1_000_000, enPorcentaje(2), 12), 6);
    expect(cuotaFija(12_000_000, enPorcentaje(1.5), 36)).toBeCloseTo(433_829, 0);
  });

  it('sin plazo o sin capital no hay cuota', () => {
    expect(cuotaFija(1_000_000, enPorcentaje(2), 0)).toBe(0);
    expect(cuotaFija(0, enPorcentaje(2), 12)).toBe(0);
    expect(cuotaFija(-5, enPorcentaje(2), 12)).toBe(0);
  });

  it('una tasa negativa se trata como cero', () => {
    expect(cuotaFija(1_200_000, enFraccion(-0.01), 12)).toBe(100_000);
  });
});
