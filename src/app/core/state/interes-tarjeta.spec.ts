import { describe, expect, it } from 'vitest';
import { Account } from './demo-data';

/**
 * El interes del proximo corte sale de la tasa de la tarjeta, o no sale.
 *
 * La pantalla del extracto aplicaba un 0.023 mensual fijo —un 27.6 % anual— a cualquier
 * tarjeta y lo rotulaba «Interes estimado». Ninguna tarjeta tenia esa tasa: el dato ni
 * siquiera viajaba al cliente. Inventar una cifra en una pantalla de dinero es peor que
 * no darla, porque quien la lee decide con ella.
 */
function interesDelCorte(tarjeta: Pick<Account, 'annualRate'>, deuda: number): number | null {
  const anual = tarjeta.annualRate;
  if (anual === undefined || anual === null || !Number.isFinite(anual)) return null;
  return Math.round(deuda * (anual / 100 / 12));
}

describe('interes del proximo corte', () => {
  it('usa la tasa que declara la tarjeta', () => {
    // 24 % anual sobre un millon: 20.000 al mes, no lo que diga una constante.
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
    // Confundir «no se» con «cero» es justo como se acaba enseñando una cifra falsa.
    expect(interesDelCorte({ annualRate: 0 }, 1_000_000)).toBe(0);
  });

  it('un valor absurdo no pasa por tasa', () => {
    expect(interesDelCorte({ annualRate: Number.NaN }, 1_000_000)).toBeNull();
  });
});
