import type { ChartOption } from '@ui/chart';
import { barras, barrasCruzadas, barrasPolares, cascada, pictorica } from './constructores/barras';
import { arbol, mapaDeArbol, solar, torta } from './constructores/circulares';
import { burbujasPorGrupo, cajas, dispersion, histograma, matriz } from './constructores/distribucion';
import { embudo, radar } from './constructores/indicadores';
import { areasApiladas, linea, rio } from './constructores/lineas';
import { cuerdas, grafo, paralelas, sankey } from './constructores/relaciones';
import { calendario, velasDeSaldo } from './constructores/tiempo';
import type { Pedido } from './entorno';
import type { TipoVisual } from './modelo';

const CONSTRUCTORES: Record<TipoVisual, (pedido: Pedido) => ChartOption> = {
  bar: (p) => barras(p, false),
  barH: (p) => barras(p, true),
  grouped: (p) => barrasCruzadas(p, 'grouped'),
  stackedBars: (p) => barrasCruzadas(p, 'stacked'),
  stacked100: (p) => barrasCruzadas(p, 'stacked100'),
  waterfall: cascada,
  polarBar: barrasPolares,
  pictorial: pictorica,
  line: (p) => linea(p, false),
  area: (p) => linea(p, true),
  stackedArea: (p) => areasApiladas(p, false),
  stackedArea100: (p) => areasApiladas(p, true),
  themeRiver: rio,
  pie: torta,
  sunburst: solar,
  treemap: mapaDeArbol,
  tree: arbol,
  sankey,
  chord: cuerdas,
  graph: grafo,
  parallel: paralelas,
  scatterPoints: dispersion,
  bubble: burbujasPorGrupo,
  boxplot: cajas,
  histogramBins: histograma,
  matrix: matriz,
  calendar: calendario,
  candlestick: velasDeSaldo,
  funnel: embudo,
  radar,
};

export function construirVisual(pedido: Pedido): ChartOption {
  if (!pedido.movs.length) return { series: [] };
  return CONSTRUCTORES[pedido.config.tipo](pedido);
}
