import type { Dimension, GrupoVisual, Measure, TipoVisual } from './modelo';

export interface DefinicionVisual {
  readonly tipo: TipoVisual;
  readonly grupo: GrupoVisual;
  readonly dimensiones: 0 | 1 | 2;
  readonly usaMedida: boolean;
  readonly variantes: readonly string[];
  readonly ancha: boolean;
  readonly sugerida: { readonly dimension: Dimension; readonly dimension2?: Dimension; readonly measure?: Measure };
}

const v = (
  tipo: TipoVisual,
  grupo: GrupoVisual,
  dimensiones: 0 | 1 | 2,
  variantes: readonly string[] = [],
  {
    usaMedida = true,
    ancha = false,
    sugerida = { dimension: 'category' as Dimension } as DefinicionVisual['sugerida'],
  } = {},
): DefinicionVisual => ({ tipo, grupo, dimensiones, usaMedida, variantes, ancha, sugerida });

export const VISUALES: readonly DefinicionVisual[] = [
  v('bar', 'barras', 1, ['gradient', 'rounded', 'labels', 'background']),
  v('barH', 'barras', 1, ['gradient', 'rounded', 'labels', 'background']),
  v('grouped', 'barras', 2, ['vertical', 'horizontal'], {
    ancha: true,
    sugerida: { dimension: 'date', dimension2: 'flow', measure: 'amount' },
  }),
  v('stackedBars', 'barras', 2, ['vertical', 'horizontal'], {
    ancha: true,
    sugerida: { dimension: 'date', dimension2: 'category' },
  }),
  v('stacked100', 'barras', 2, ['vertical', 'horizontal'], {
    ancha: true,
    sugerida: { dimension: 'monthOfYear', dimension2: 'category' },
  }),
  v('waterfall', 'barras', 1, ['vertical', 'horizontal'], {
    ancha: true,
    sugerida: { dimension: 'date', measure: 'net' },
  }),
  v('polarBar', 'barras', 1, ['radial', 'columns']),
  v('pictorial', 'barras', 1, ['bars', 'dots', 'diamonds']),
  v('line', 'lineas', 1, ['smooth', 'straight', 'step', 'points'], { ancha: true, sugerida: { dimension: 'date' } }),
  v('area', 'lineas', 1, ['gradient', 'solid', 'step'], { ancha: true, sugerida: { dimension: 'date' } }),
  v('stackedArea', 'lineas', 2, ['smooth', 'straight'], {
    ancha: true,
    sugerida: { dimension: 'date', dimension2: 'category' },
  }),
  v('stackedArea100', 'lineas', 2, ['smooth', 'straight'], {
    ancha: true,
    sugerida: { dimension: 'date', dimension2: 'category' },
  }),
  v('themeRiver', 'lineas', 2, [], { ancha: true, sugerida: { dimension: 'date', dimension2: 'category' } }),
  v('pie', 'circulares', 1, ['pie', 'donut', 'half', 'rose']),
  v('sunburst', 'circulares', 2, ['radial', 'rounded'], { sugerida: { dimension: 'category', dimension2: 'account' } }),
  v('treemap', 'jerarquicas', 2, ['nested', 'flat'], { sugerida: { dimension: 'category', dimension2: 'account' } }),
  v('tree', 'jerarquicas', 2, ['horizontal', 'vertical', 'radial'], {
    ancha: true,
    sugerida: { dimension: 'category', dimension2: 'account' },
  }),
  v('sankey', 'relaciones', 2, ['horizontal', 'vertical'], {
    ancha: true,
    sugerida: { dimension: 'account', dimension2: 'category' },
  }),
  v('chord', 'relaciones', 2, [], { sugerida: { dimension: 'account', dimension2: 'category' } }),
  v('graph', 'relaciones', 2, ['force', 'circular'], { sugerida: { dimension: 'account', dimension2: 'category' } }),
  v('parallel', 'relaciones', 0, [], { usaMedida: false, ancha: true }),
  v('scatterPoints', 'distribucion', 1, ['bubbles', 'effect'], { ancha: true, sugerida: { dimension: 'flow' } }),
  v('bubble', 'distribucion', 1, [], { usaMedida: false }),
  v('boxplot', 'distribucion', 1, ['vertical', 'horizontal'], { usaMedida: false }),
  v('histogramBins', 'distribucion', 0, ['bars', 'area'], { usaMedida: false }),
  v('matrix', 'distribucion', 2, ['heatmap', 'bubbles'], {
    ancha: true,
    sugerida: { dimension: 'weekday', dimension2: 'category' },
  }),
  v('calendar', 'tiempo', 0, ['heatmap', 'effect'], { ancha: true }),
  v('candlestick', 'tiempo', 0, [], { usaMedida: false, ancha: true }),
  v('funnel', 'indicadores', 1, ['funnel', 'pyramid', 'aligned', 'compare']),
  v('radar', 'indicadores', 2, ['polygon', 'circle', 'filled'], {
    sugerida: { dimension: 'category', dimension2: 'flow', measure: 'amount' },
  }),
];

export const GRUPOS_VISUALES: readonly GrupoVisual[] = [
  'barras',
  'lineas',
  'circulares',
  'jerarquicas',
  'relaciones',
  'distribucion',
  'tiempo',
  'indicadores',
];

export const TIPOS_DEL_MOTOR: ReadonlySet<string> = new Set(VISUALES.map((visual) => visual.tipo));

export function definicionDe(tipo: string): DefinicionVisual | undefined {
  return VISUALES.find((visual) => visual.tipo === tipo);
}
