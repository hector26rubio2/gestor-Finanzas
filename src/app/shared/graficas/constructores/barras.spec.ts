import { describe, expect, it } from 'vitest';
import type { Movement } from '@core/state';
import type { ChartPalette } from '@ui/chart';
import type { ContextoDeDatos } from '../datos';
import type { Pedido } from '../entorno';
import { cascada } from './barras';

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

const ctx: ContextoDeDatos = {
  locale: 'es-CO',
  granularidad: 'day',
  t: (clave) => clave,
  nombreDeCuenta: () => 'cuenta',
  tipoDeCuenta: () => 'tipo',
  tipoDeMovimiento: () => 'tipo',
};

const movimiento = (date: string, neto: number) =>
  ({ date, amount: neto, kind: neto >= 0 ? 'income' : 'expense', category: 'x', accountId: 'a' }) as Movement;

function pedido(netos: readonly number[], limit?: number): Pedido {
  const dia = (i: number) => `2026-01-${String(i + 1).padStart(2, '0')}`;
  return {
    config: { tipo: 'waterfall', dimension: 'date', measure: 'net', limit } as Pedido['config'],
    movs: netos.map((neto, i) => movimiento(dia(i), neto)),
    entorno: { palette, ctx, dinero: String, titulo: 't' },
  };
}

type Dato = number | { value: number };
const valor = (d: Dato) => (typeof d === 'number' ? d : d.value);

function tramos(netos: readonly number[], limit?: number) {
  const opcion = cascada(pedido(netos, limit)) as unknown as { series: { data: Dato[] }[]; xAxis: { data?: string[] } };
  const [base, positivo, negativo] = opcion.series.map((s) => s.data.map(valor));
  return base.map((b, i) => {
    if (b > 0) return [b, b + positivo[i]];
    if (b < 0) return [b + negativo[i], b];
    return [negativo[i], positivo[i]];
  });
}

describe('cascada', () => {
  it('cada barra cubre de su inicio a su fin con acumulado negativo', () => {
    expect(tramos([100, -300, 50])).toEqual([
      [0, 100],
      [-200, 100],
      [-200, -150],
      [-150, 0],
    ]);
  });

  it('el total incluye todos los periodos aunque se recorte la lista', () => {
    const resultado = tramos([10, 10, 10, 10], 2);
    expect(resultado[resultado.length - 1]).toEqual([0, 40]);
  });
});
