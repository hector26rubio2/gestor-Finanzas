import { describe, expect, it } from 'vitest';
import { SIN_DATO } from '@shared/utils';
import { tasaDeAhorro } from './tasa-de-ahorro';

describe('tasaDeAhorro', () => {
  it('sin ingresos devuelve el marcador de sin dato', () => {
    expect(tasaDeAhorro(0, -500)).toBe(SIN_DATO);
  });

  it('calcula el porcentaje redondeado', () => {
    expect(tasaDeAhorro(1000, 250)).toBe('25 %');
  });

  it('un neto negativo da porcentaje negativo', () => {
    expect(tasaDeAhorro(1000, -500)).toBe('-50 %');
  });
});
