import { describe, expect, it } from 'vitest';
import { iconForCategory } from './category-badge';

describe('icono de una categoría', () => {
  it('reconoce categorías comunes en español e inglés', () => {
    expect(iconForCategory('Alimentación')).toBe('utensils');
    expect(iconForCategory('Transporte')).toBe('car');
    expect(iconForCategory('Vivienda')).toBe('home');
    expect(iconForCategory('Pago de tarjeta')).toBe('bank');
    expect(iconForCategory('Health')).toBe('health');
  });

  it('usa la etiqueta genérica cuando no la reconoce', () => {
    expect(iconForCategory('Zzz')).toBe('tag');
  });
});
