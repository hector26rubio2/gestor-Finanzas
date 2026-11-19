import { describe, expect, it } from 'vitest';
import type { Movement } from '@core/state';
import type { ChartPalette } from '@ui/chart';
import { TIPOS_DEL_MOTOR, VISUALES, definicionDe } from './catalogo';
import type { ContextoDeDatos } from './datos';
import type { Pedido } from './entorno';
import type { ConfiguracionVisual } from './modelo';
import { construirVisual } from './visual';

const palette: ChartPalette = {
  accent: '#00f',
  danger: '#f00',
  warn: '#fa0',
  success: '#0a0',
  text: '#000',
  muted: '#888',
  line: '#ccc',
  surface: '#fff',
  categorical: ['#111', '#222', '#333', '#444', '#555', '#666'],
};

const ctx: ContextoDeDatos = {
  locale: 'es-CO',
  granularidad: 'day',
  t: (clave) => clave,
  nombreDeCuenta: (id) => (id === 'banco' ? 'Banco' : 'Efectivo'),
  tipoDeCuenta: (id) => (id === 'banco' ? 'Corriente' : 'Efectivo'),
  tipoDeMovimiento: (movimiento) => movimiento.kind,
};

const movimiento = (id: string, fecha: string, parcial: Partial<Movement>): Movement =>
  ({
    id,
    date: fecha,
    description: id,
    accountId: 'banco',
    category: 'Mercado',
    kind: 'expense',
    effect: 'expense',
    amount: -100_000,
    status: 'confirmed',
    ...parcial,
  }) as Movement;

const MOVIMIENTOS: Movement[] = [
  movimiento('i1', '2026-07-01', { kind: 'income', effect: 'income', category: 'Salario', amount: 5_000_000 }),
  movimiento('i2', '2026-08-01', { kind: 'income', effect: 'income', category: 'Salario', amount: 5_000_000 }),
  movimiento('g1', '2026-07-03', { amount: -250_000 }),
  movimiento('g2', '2026-07-10', { amount: -80_000, category: 'Ocio', accountId: 'efectivo' }),
  movimiento('g3', '2026-07-21', { amount: -400_000, category: 'Transporte' }),
  movimiento('g4', '2026-08-02', { amount: -120_000, category: 'Mercado', accountId: 'efectivo' }),
  movimiento('g5', '2026-08-05', { amount: -60_000, category: 'Ocio' }),
  movimiento('g6', '2026-08-12', { amount: -900_000, category: 'Transporte' }),
  movimiento('g7', '2026-08-14', { amount: -35_000, category: 'Ocio', accountId: 'efectivo' }),
  movimiento('g8', '2026-08-20', { amount: -150_000, category: 'Mercado' }),
];

const pedidoDe = (config: ConfiguracionVisual, movs: readonly Movement[] = MOVIMIENTOS): Pedido => ({
  config,
  movs,
  entorno: { palette, ctx, dinero: String, titulo: 'Gráfica' },
});

const configDe = (tipo: ConfiguracionVisual['tipo'], variant?: string): ConfiguracionVisual => {
  const definicion = definicionDe(tipo)!;
  return { tipo, ...definicion.sugerida, ...(variant ? { variant } : {}) };
};

describe('galería de gráficas: cada tipo se construye con datos', () => {
  it('el motor sabe construir todos los tipos del catálogo', () => {
    expect([...TIPOS_DEL_MOTOR].sort()).toEqual(VISUALES.map((v) => v.tipo).sort());
  });

  it.each(VISUALES.map((v) => v.tipo))('«%s» devuelve una serie con datos', (tipo) => {
    const opcion = construirVisual(pedidoDe(configDe(tipo)));
    const series = (opcion as { series?: unknown }).series;
    const lista = Array.isArray(series) ? series : series ? [series] : [];

    expect(lista.length).toBeGreaterThan(0);
  });

  it.each(VISUALES.flatMap((v) => v.variantes.map((variante) => [v.tipo, variante] as const)))(
    '«%s» con la variante «%s» también se construye',
    (tipo, variante) => {
      const opcion = construirVisual(pedidoDe(configDe(tipo, variante)));

      expect((opcion as { series?: unknown }).series).toBeDefined();
    },
  );

  it.each(VISUALES.map((v) => v.tipo))('«%s» sin movimientos no dibuja series', (tipo) => {
    expect(construirVisual(pedidoDe(configDe(tipo), []))).toEqual({ series: [] });
  });

  it('el catálogo no repite tipos y cada uno trae su grupo y sugerencia', () => {
    const tipos = VISUALES.map((v) => v.tipo);

    expect(new Set(tipos).size).toBe(tipos.length);
    for (const visual of VISUALES) {
      expect(visual.grupo).toBeTruthy();
      expect(visual.sugerida.dimension).toBeTruthy();
    }
  });
});
