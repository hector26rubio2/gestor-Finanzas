export type Dimension =
  | 'category'
  | 'account'
  | 'accountType'
  | 'date'
  | 'weekday'
  | 'monthOfYear'
  | 'kind'
  | 'flow'
  | 'person'
  | 'recurring'
  | 'installments'
  | 'currency'
  | 'amountRange';

export type Measure = 'expense' | 'income' | 'amount' | 'net' | 'count' | 'average' | 'max' | 'median';

export type Granularidad = 'day' | 'week' | 'month' | 'quarter' | 'year';

export type GrupoVisual =
  'barras' | 'lineas' | 'circulares' | 'jerarquicas' | 'relaciones' | 'distribucion' | 'tiempo' | 'indicadores';

export type TipoVisual =
  | 'bar'
  | 'barH'
  | 'grouped'
  | 'stackedBars'
  | 'stacked100'
  | 'waterfall'
  | 'polarBar'
  | 'pictorial'
  | 'line'
  | 'area'
  | 'stackedArea'
  | 'stackedArea100'
  | 'themeRiver'
  | 'pie'
  | 'sunburst'
  | 'treemap'
  | 'tree'
  | 'sankey'
  | 'chord'
  | 'graph'
  | 'parallel'
  | 'scatterPoints'
  | 'bubble'
  | 'boxplot'
  | 'histogramBins'
  | 'matrix'
  | 'calendar'
  | 'candlestick'
  | 'funnel'
  | 'radar';

export interface ConfiguracionVisual {
  readonly tipo: TipoVisual;
  readonly dimension?: Dimension;
  readonly dimension2?: Dimension;
  readonly measure?: Measure;
  readonly variant?: string;
  readonly granularity?: Granularidad;
  readonly limit?: number;
  readonly goalTarget?: number;
}

export interface Agregado {
  readonly key: string;
  readonly label: string;
  readonly value: number;
}

export interface Cruce {
  readonly categories: readonly string[];
  readonly series: readonly { readonly name: string; readonly data: readonly number[] }[];
}

export interface Nodo {
  readonly name: string;
  readonly value: number;
  readonly children?: readonly Nodo[];
}

export interface Enlace {
  readonly source: string;
  readonly target: string;
  readonly value: number;
}
