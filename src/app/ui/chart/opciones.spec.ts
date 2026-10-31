import { describe, expect, it } from 'vitest';
import type { ChartPalette } from './chart-theme';
import { anillo, barrasHorizontales, medidor } from './opciones';
import { leyendaDeGrafica, recortarEtiqueta } from './leyenda';

const palette: ChartPalette = {
  accent: '#00f',
  danger: '#f00',
  warn: '#fa0',
  success: '#0a0',
  text: '#111111',
  muted: '#777777',
  line: '#ccc',
  surface: '#fff',
  categorical: ['#111', '#222'],
};

const dinero = (valor: number) => `COP ${valor}`;

interface Leyenda {
  type: string;
  textStyle: { overflow: string; width: number };
  tooltip: { show: boolean };
  formatter: (nombre: string) => string;
}

describe('recortarEtiqueta', () => {
  it('deja intactos los nombres cortos y recorta los largos con puntos suspensivos', () => {
    expect(recortarEtiqueta('Efectivo', 18)).toBe('Efectivo');
    const recortado = recortarEtiqueta('Ahorro principalVisa Bancolombia', 18);
    expect(recortado.endsWith('…')).toBe(true);
    expect(recortado.length).toBeLessThanOrEqual(18);
  });
});

describe('leyendaDeGrafica', () => {
  it('desplaza, recorta y muestra el nombre completo en tooltip', () => {
    const leyenda = leyendaDeGrafica(palette) as unknown as Leyenda;
    expect(leyenda.type).toBe('scroll');
    expect(leyenda.tooltip.show).toBe(true);
    expect(leyenda.formatter('Ahorro principalVisa Bancolombia').endsWith('…')).toBe(true);
  });
});

describe('anillo', () => {
  const porciones = [{ nombre: 'Ahorro principalVisa Bancolombia', valor: 30 }];
  const opcion = anillo(palette, porciones, dinero, { valor: 'COP 2270000', etiqueta: 'Gasto total' }) as unknown as {
    legend: Leyenda;
    media: { query: object; option: { legend: { bottom: number } } }[];
    series: { label: { formatter: () => string; rich: Record<string, { color: string; fontSize: number }> } }[];
  };

  it('usa leyenda con scroll, texto recortado y tooltip', () => {
    expect(opcion.legend.type).toBe('scroll');
    expect(opcion.legend.tooltip.show).toBe(true);
    expect(opcion.legend.formatter('Ahorro principalVisa Bancolombia').endsWith('…')).toBe(true);
  });

  it('trunca con puntos suspensivos el texto que no cabe en la leyenda', () => {
    expect(opcion.legend.textStyle.overflow).toBe('truncate');
    expect(opcion.legend.textStyle.width).toBeGreaterThan(0);
  });

  it('mueve la leyenda abajo en anchos pequeños', () => {
    expect(opcion.media.length).toBeGreaterThan(0);
    expect(opcion.media[0].option.legend.bottom).toBe(0);
  });

  it('pinta el centro con los colores del tema y tamaño legible', () => {
    const { rich } = opcion.series[0].label;
    expect(rich['valor'].color).toBe(palette.text);
    expect(rich['pie'].color).toBe(palette.muted);
    expect(rich['valor'].fontSize).toBeGreaterThanOrEqual(16);
    expect(rich['pie'].fontSize).toBeGreaterThanOrEqual(13);
  });
});

describe('barrasHorizontales', () => {
  it('recorta las etiquetas del eje Y y contiene las etiquetas en el grid', () => {
    const opcion = barrasHorizontales(
      palette,
      ['Ahorro principalVisa Bancolombia'],
      [{ nombre: 's', valores: [1], color: '#00f' }],
      dinero,
      dinero,
    ) as unknown as { grid: { containLabel: boolean }; yAxis: { axisLabel: { width: number; overflow: string } } };
    expect(opcion.grid.containLabel).toBe(true);
    expect(opcion.yAxis.axisLabel.overflow).toBe('truncate');
    expect(opcion.yAxis.axisLabel.width).toBeGreaterThan(0);
  });
});

describe('medidor', () => {
  it('deja espacio al texto inferior con los colores del tema', () => {
    const opcion = medidor(palette, 40, 'Meta', 50) as unknown as {
      series: { title: { color: string; fontSize: number }; detail: { color: string } }[];
    };
    expect(opcion.series[0].detail.color).toBe(palette.text);
    expect(opcion.series[0].title.fontSize).toBeGreaterThanOrEqual(13);
  });
});
