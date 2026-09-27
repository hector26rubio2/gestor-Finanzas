import type { Movement } from '@core/state';
import type { ChartPalette } from '@ui/chart';
import type { ContextoDeDatos } from './datos';
import type { ConfiguracionVisual, Dimension, Measure } from './modelo';

export interface EntornoVisual {
  readonly palette: ChartPalette;
  readonly ctx: ContextoDeDatos;
  readonly dinero: (valor: number) => string;
  readonly titulo: string;
}

export interface Pedido {
  readonly config: ConfiguracionVisual;
  readonly movs: readonly Movement[];
  readonly entorno: EntornoVisual;
}

export const dimensionDe = (config: ConfiguracionVisual, porDefecto: Dimension = 'category'): Dimension =>
  config.dimension ?? porDefecto;

export const dimension2De = (config: ConfiguracionVisual, porDefecto: Dimension = 'kind'): Dimension =>
  config.dimension2 ?? porDefecto;

export const medidaDe = (config: ConfiguracionVisual): Measure => config.measure ?? 'expense';

export function formatoDe(pedido: Pedido): (valor: number) => string {
  return medidaDe(pedido.config) === 'count'
    ? (valor) => Math.round(valor).toLocaleString(pedido.entorno.ctx.locale)
    : pedido.entorno.dinero;
}

export const limiteDe = (config: ConfiguracionVisual, porDefecto: number) =>
  config.limit && config.limit > 0 ? config.limit : porDefecto;
