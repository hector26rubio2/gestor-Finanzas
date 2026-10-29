import { describe, expect, it } from 'vitest';
import { fechaDeHoy } from './fecha-de-hoy';

describe('fechaDeHoy', () => {
  it('descompone el ISO sin pasar por la zona horaria local', () => {
    expect(fechaDeHoy('2026-12-31')).toEqual({ anio: 2026, mes: 11, iso: '2026-12-31' });
  });

  it('el mes es base cero', () => {
    expect(fechaDeHoy('2027-01-01')).toEqual({ anio: 2027, mes: 0, iso: '2027-01-01' });
  });
});
