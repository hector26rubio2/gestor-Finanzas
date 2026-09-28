import { describe, expect, it } from 'vitest';
import { Account } from './view-model';

function interesDelCorte(tarjeta: Pick<Account, 'annualRate'>, deuda: number): number | null {
  const anual = tarjeta.annualRate;
  if (anual === undefined || anual === null || !Number.isFinite(anual)) return null;
  return Math.round(deuda * (anual / 100 / 12));
}

describe('interes del proximo corte', () => {
  it('usa la tasa que declara la tarjeta', () => {
    expect(interesDelCorte({ annualRate: 24 }, 1_000_000)).toBe(20_000);
  });

  it('cada tarjeta usa la suya', () => {
    expect(interesDelCorte({ annualRate: 10.2 }, 1_000_000)).not.toBe(interesDelCorte({ annualRate: 7.8 }, 1_000_000));
  });

  it('sin tasa no se inventa un numero', () => {
    expect(interesDelCorte({}, 1_000_000)).toBeNull();
    expect(interesDelCorte({ annualRate: undefined }, 1_000_000)).toBeNull();
  });

  it('una tasa cero es una tasa, no una ausencia', () => {
    expect(interesDelCorte({ annualRate: 0 }, 1_000_000)).toBe(0);
  });

  it('un valor absurdo no pasa por tasa', () => {
    expect(interesDelCorte({ annualRate: Number.NaN }, 1_000_000)).toBeNull();
  });
});
