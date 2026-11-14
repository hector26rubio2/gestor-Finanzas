import { describe, expect, it } from 'vitest';
import { enRango, rangoSiguiente, rangoVisible } from './periodos';

describe('rango visible del calendario', () => {
  it('en día es ese día', () => {
    expect(rangoVisible('day', '2026-11-12')).toEqual({ desde: '2026-11-12', hasta: '2026-11-12' });
  });

  it('en semana va de lunes a domingo', () => {
    expect(rangoVisible('week', '2026-11-12')).toEqual({ desde: '2026-11-09', hasta: '2026-11-15' });
    expect(rangoVisible('week', '2026-11-15')).toEqual({ desde: '2026-11-09', hasta: '2026-11-15' });
    expect(rangoVisible('week', '2026-11-09')).toEqual({ desde: '2026-11-09', hasta: '2026-11-15' });
  });

  it('en mes es el mes completo, también en febrero bisiesto', () => {
    expect(rangoVisible('month', '2026-11-12')).toEqual({ desde: '2026-11-01', hasta: '2026-11-30' });
    expect(rangoVisible('month', '2024-02-10')).toEqual({ desde: '2024-02-01', hasta: '2024-02-29' });
  });

  it('en año es el año completo', () => {
    expect(rangoVisible('year', '2026-11-12')).toEqual({ desde: '2026-01-01', hasta: '2026-12-31' });
  });
});

describe('rango siguiente', () => {
  it('en día es el día siguiente, cruzando mes y año', () => {
    expect(rangoSiguiente('day', '2026-12-31')).toEqual({ desde: '2027-01-01', hasta: '2027-01-01' });
  });

  it('en semana es la semana siguiente', () => {
    expect(rangoSiguiente('week', '2026-11-12')).toEqual({ desde: '2026-11-16', hasta: '2026-11-22' });
  });

  it('en mes es el mes siguiente, cruzando año', () => {
    expect(rangoSiguiente('month', '2026-12-05')).toEqual({ desde: '2027-01-01', hasta: '2027-01-31' });
    expect(rangoSiguiente('month', '2026-01-31')).toEqual({ desde: '2026-02-01', hasta: '2026-02-28' });
  });

  it('en año es el año siguiente', () => {
    expect(rangoSiguiente('year', '2026-11-12')).toEqual({ desde: '2027-01-01', hasta: '2027-12-31' });
  });
});

describe('pertenencia a un rango', () => {
  it('incluye los extremos', () => {
    const rango = { desde: '2026-11-09', hasta: '2026-11-15' };
    expect(enRango('2026-11-09', rango)).toBe(true);
    expect(enRango('2026-11-15', rango)).toBe(true);
    expect(enRango('2026-11-16', rango)).toBe(false);
    expect(enRango('2026-11-08', rango)).toBe(false);
  });
});
