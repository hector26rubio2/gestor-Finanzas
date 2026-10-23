import * as echarts from 'echarts/core';
/**
 * Registro bajo demanda de módulos de echarts: cada entrada se resuelve con un
 * `import()` dinámico (los módulos de `echarts/lib` se auto-registran al
 * importarse, vía `use(install)`), de modo que el bundle principal solo
 * descarga los tipos/componentes que una gráfica concreta realmente pide.
 */
const MODULOS_BAJO_DEMANDA: Readonly<Record<string, () => Promise<unknown>>> = {
  // Tipos de serie
  bar: () => import('echarts/lib/chart/bar'),
  boxplot: () => import('echarts/lib/chart/boxplot'),
  candlestick: () => import('echarts/lib/chart/candlestick'),
  chord: () => import('echarts/lib/chart/chord'),
  effectScatter: () => import('echarts/lib/chart/effectScatter'),
  funnel: () => import('echarts/lib/chart/funnel'),
  gauge: () => import('echarts/lib/chart/gauge'),
  graph: () => import('echarts/lib/chart/graph'),
  heatmap: () => import('echarts/lib/chart/heatmap'),
  line: () => import('echarts/lib/chart/line'),
  parallel: () => import('echarts/lib/chart/parallel'),
  pictorialBar: () => import('echarts/lib/chart/pictorialBar'),
  pie: () => import('echarts/lib/chart/pie'),
  radar: () => import('echarts/lib/chart/radar'),
  sankey: () => import('echarts/lib/chart/sankey'),
  scatter: () => import('echarts/lib/chart/scatter'),
  sunburst: () => import('echarts/lib/chart/sunburst'),
  themeRiver: () => import('echarts/lib/chart/themeRiver'),
  tree: () => import('echarts/lib/chart/tree'),
  treemap: () => import('echarts/lib/chart/treemap'),
  // Componentes
  aria: () => import('echarts/lib/component/aria'),
  calendar: () => import('echarts/lib/component/calendar'),
  dataZoom: () => import('echarts/lib/component/dataZoom'),
  dataset: () => import('echarts/lib/component/dataset'),
  graphic: () => import('echarts/lib/component/graphic'),
  grid: () => import('echarts/lib/component/grid'),
  legend: () => import('echarts/lib/component/legend'),
  markArea: () => import('echarts/lib/component/markArea'),
  markLine: () => import('echarts/lib/component/markLine'),
  markPoint: () => import('echarts/lib/component/markPoint'),
  polar: () => import('echarts/lib/component/polar'),
  singleAxis: () => import('echarts/lib/component/singleAxis'),
  title: () => import('echarts/lib/component/title'),
  toolbox: () => import('echarts/lib/component/toolbox'),
  tooltip: () => import('echarts/lib/component/tooltip'),
  transform: () => import('echarts/lib/component/transform'),
  visualMap: () => import('echarts/lib/component/visualMap'),
};

const cargados = new Set<string>();

function seriesDe(opcion: object): Record<string, unknown>[] {
  const series = (opcion as { series?: unknown }).series;
  const lista = Array.isArray(series) ? series : series ? [series] : [];
  return lista.filter((serie): serie is Record<string, unknown> => !!serie && typeof serie === 'object');
}

interface Contexto {
  clavesSuperiores: Set<string>;
  tipoSeries: string[];
  clavesDeSeries: string[];
}

function contextoDe(opcion: object): Contexto {
  const clavesSuperiores = new Set(Object.keys(opcion));
  const series = seriesDe(opcion);
  return {
    clavesSuperiores,
    tipoSeries: series.flatMap((serie) => (typeof serie['type'] === 'string' ? [serie['type'] as string] : [])),
    clavesDeSeries: series.flatMap((serie) => Object.keys(serie)),
  };
}

export function modulosFaltantes(opcion: object): string[] {
  const { clavesSuperiores, tipoSeries, clavesDeSeries } = contextoDe(opcion);
  const pedidos = new Set<string>(['tooltip', ...tipoSeries, ...clavesSuperiores, ...clavesDeSeries]);
  // Los ejes requieren el sistema de coordenadas de rejilla implícito.
  if (clavesSuperiores.has('xAxis') || clavesSuperiores.has('yAxis')) pedidos.add('grid');
  // series con coordinateSystem 'polar' (o ejes polares) requieren el componente polar.
  const usaPolar =
    clavesSuperiores.has('polar') ||
    clavesSuperiores.has('angleAxis') ||
    clavesSuperiores.has('radiusAxis') ||
    clavesDeSeries.includes('coordinateSystem');
  if (usaPolar) pedidos.add('polar');
  return [...pedidos].filter(
    (nombre) => nombre in MODULOS_BAJO_DEMANDA && !cargados.has(nombre),
  );
}

export async function cargarModulos(nombres: readonly string[]): Promise<void> {
  await Promise.all(nombres.map((nombre) => MODULOS_BAJO_DEMANDA[nombre]()));
  for (const nombre of nombres) cargados.add(nombre);
}
