import { describe, expect, it } from 'vitest';
import { anchoAlArrastrar, limitarAncho } from './ancho-del-panel';

describe('limitarAncho', () => {
  it('nunca baja del mínimo ni pasa del 92 % de la pantalla', () => {
    expect(limitarAncho(300, 576, 1500)).toBe(576);
    expect(limitarAncho(900, 576, 1500)).toBe(900);
    expect(limitarAncho(1600, 576, 1500)).toBe(1380);
  });

  it('si la pantalla es más angosta que el mínimo, manda el mínimo de la pantalla', () => {
    expect(limitarAncho(700, 576, 500)).toBe(460);
  });
});

describe('anchoAlArrastrar', () => {
  it('el panel derecho mide lo que hay entre el puntero y el borde derecho', () => {
    expect(anchoAlArrastrar(1500, 600, 576)).toBe(900);
    expect(anchoAlArrastrar(1500, 1400, 576)).toBe(576);
  });
});
