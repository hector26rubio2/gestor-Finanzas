import { describe, expect, it } from 'vitest';
import type { Investment } from '@core/state';
import { filaDeInversion } from './fila-de-inversion';

const inversion = (currency: string): Investment => ({
  id: 'i1',
  name: 'Fondo',
  type: 'Fondo',
  value: 1200,
  cost: 1000,
  currency,
  netContributions: 0,
  sinValoracion: false,
});

const dinero = (valor: number, moneda: string) => `${moneda} ${valor}`;

describe('filaDeInversion', () => {
  it('formatea costo y valor en la moneda de la inversion USD', () => {
    const fila = filaDeInversion(inversion('USD'), dinero);
    expect(fila.cost).toBe('USD 1000');
    expect(fila.value).toBe('USD 1200');
  });

  it('formatea costo y valor en la moneda de la inversion COP', () => {
    const fila = filaDeInversion(inversion('COP'), dinero);
    expect(fila.cost).toBe('COP 1000');
    expect(fila.value).toBe('COP 1200');
  });

  it('marca las inversiones sin valorización', () => {
    expect(filaDeInversion(inversion('COP'), dinero).sinValoracion).toBe(false);
    expect(filaDeInversion({ ...inversion('COP'), sinValoracion: true }, dinero).sinValoracion).toBe(true);
  });

  it('muestra el riesgo aunque no haya liquidez', () => {
    expect(filaDeInversion({ ...inversion('COP'), risk: 'Alto' }, dinero).risk).toBe('Alto');
    expect(filaDeInversion({ ...inversion('COP'), risk: 'Alto', liquidity: 'Inmediata' }, dinero).risk).toBe(
      'Alto · Inmediata',
    );
  });
});
