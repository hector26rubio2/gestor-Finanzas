import { describe, expect, it } from 'vitest';
import type { ChartPalette } from '@ui/chart';
import { ejeCategoria, leyenda } from './estilo';

const palette: ChartPalette = {
  accent: '#00f',
  danger: '#f00',
  warn: '#fa0',
  success: '#0a0',
  text: '#111',
  muted: '#777',
  line: '#ccc',
  surface: '#fff',
  categorical: ['#111'],
};

describe('estilo de gráficas', () => {
  it('la leyenda recorta nombres largos y muestra tooltip', () => {
    const l = leyenda(palette) as unknown as {
      type: string;
      tooltip: { show: boolean };
      formatter: (n: string) => string;
    };
    expect(l.type).toBe('scroll');
    expect(l.tooltip.show).toBe(true);
    expect(l.formatter('Ahorro principalVisa Bancolombia').endsWith('…')).toBe(true);
  });

  it('el eje de categorías recorta etiquetas largas', () => {
    const eje = ejeCategoria(palette, ['a']) as unknown as { axisLabel: { overflow: string; width: number } };
    expect(eje.axisLabel.overflow).toBe('truncate');
    expect(eje.axisLabel.width).toBeGreaterThan(0);
  });
});
