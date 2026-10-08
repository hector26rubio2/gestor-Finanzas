const MODULOS_BAJO_DEMANDA: Readonly<Record<string, () => Promise<unknown>>> = {
  boxplot: () => import('echarts/lib/chart/boxplot'),
  candlestick: () => import('echarts/lib/chart/candlestick'),
  chord: () => import('echarts/lib/chart/chord'),
  effectScatter: () => import('echarts/lib/chart/effectScatter'),
  funnel: () => import('echarts/lib/chart/funnel'),
  graph: () => import('echarts/lib/chart/graph'),
  heatmap: () => import('echarts/lib/chart/heatmap'),
  parallel: () => import('echarts/lib/chart/parallel'),
  pictorialBar: () => import('echarts/lib/chart/pictorialBar'),
  radar: () => import('echarts/lib/chart/radar'),
  sankey: () => import('echarts/lib/chart/sankey'),
  sunburst: () => import('echarts/lib/chart/sunburst'),
  themeRiver: () => import('echarts/lib/chart/themeRiver'),
  tree: () => import('echarts/lib/chart/tree'),
  treemap: () => import('echarts/lib/chart/treemap'),
  calendar: () => import('echarts/lib/component/calendar'),
  polar: () => import('echarts/lib/component/polar'),
  singleAxis: () => import('echarts/lib/component/singleAxis'),
};

const cargados = new Set<string>();

function seriesDe(opcion: object): string[] {
  const series = (opcion as { series?: unknown }).series;
  const lista = Array.isArray(series) ? series : series ? [series] : [];
  return lista
    .map((serie) => (serie as { type?: unknown }).type)
    .filter((tipo): tipo is string => typeof tipo === 'string');
}

export function modulosFaltantes(opcion: object): string[] {
  const pedidos = new Set([...seriesDe(opcion), ...Object.keys(opcion)]);
  return [...pedidos].filter((nombre) => nombre in MODULOS_BAJO_DEMANDA && !cargados.has(nombre));
}

export async function cargarModulos(nombres: readonly string[]): Promise<void> {
  await Promise.all(nombres.map((nombre) => MODULOS_BAJO_DEMANDA[nombre]()));
  for (const nombre of nombres) cargados.add(nombre);
}
