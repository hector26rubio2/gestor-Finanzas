import { describe, expect, it } from 'vitest';
import type { ChartPalette } from '@ui/chart';
import { proyectar } from './amortizacion';
import { mesAMes, type EntornoDeProyeccion } from './graficas';

const palette: ChartPalette = {
  accent: '#00f',
  danger: '#f00',
  warn: '#fa0',
  success: '#0a0',
  text: '#000',
  muted: '#888',
  line: '#ccc',
  surface: '#fff',
  categorical: ['#111', '#222', '#333', '#444'],
};

const entorno: EntornoDeProyeccion = {
  palette,
  etiquetas: ['m1', 'm2'],
  dinero: String,
  t: (clave) => clave,
};

interface SerieDeBarras {
  readonly name: string;
  readonly type: string;
  readonly data: readonly number[];
}

describe('mesAMes', () => {
  it('aplica el recorte de gasto a las barras y cuadra con el flujo libre', () => {
    const flujo = {
      ingreso: [2_000_000, 2_000_000],
      gasto: [1_000_000, 1_000_000],
      gastoPorLinea: [{ nombre: 'Mercado', valores: [1_000_000, 1_000_000] }],
    };
    const escenario = proyectar(
      [],
      [],
      {
        ingresoMensual: 2_000_000,
        gastoMensual: 1_000_000,
        ingresoPorMes: flujo.ingreso,
        gastoPorMes: flujo.gasto,
        recorteDeGasto: 20,
        metaDeAhorro: 0,
      },
      2,
    );
    const opcion = mesAMes(escenario, flujo, entorno, 20) as unknown as { series: SerieDeBarras[] };
    const gasto = opcion.series.find((s) => s.name === 'Mercado');
    expect(gasto?.data).toEqual([800_000, 800_000]);
    const libre = opcion.series.find((s) => s.name === 'planning.sim.series.freeCash');
    expect(libre?.data).toEqual([1_200_000, 1_200_000]);
  });
});
