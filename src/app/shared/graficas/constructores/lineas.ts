import type { ChartOption } from '@ui/chart';
import { agregar, cruzar, etiquetaDeDimension, valorDeMedida } from '@shared/graficas/datos';
import { Pedido, dimension2De, dimensionDe, formatoDe, limiteDe, medidaDe } from '@shared/graficas/entorno';
import {
  cifraCorta,
  colores,
  degradado,
  ejeCategoria,
  ejeValor,
  herramientas,
  leyenda,
  zoomDeTiempo,
} from '@shared/graficas/estilo';

export function linea(pedido: Pedido, area: boolean): ChartOption {
  const { config, movs, entorno } = pedido;
  const { palette } = entorno;
  const formato = formatoDe(pedido);
  const datos = agregar(movs, dimensionDe(config, 'date'), medidaDe(config), entorno.ctx);
  const variante = config.variant ?? (area ? 'gradient' : 'smooth');
  const promedio = datos.length ? datos.reduce((s, d) => s + d.value, 0) / datos.length : 0;
  const color = palette.accent;
  const escalon = variante === 'step';
  return {
    grid: { top: 30, right: 18, bottom: 34, left: 12, containLabel: true },
    xAxis: ejeCategoria(
      palette,
      datos.map((d) => d.label),
      { boundaryGap: false },
    ),
    yAxis: ejeValor(palette),
    tooltip: { trigger: 'axis' as const, valueFormatter: (v: unknown) => formato(Number(v)) },
    dataZoom: zoomDeTiempo(palette, datos.length),
    toolbox: herramientas(palette, entorno.titulo, ['line', 'bar']),
    series: [
      {
        type: 'line' as const,
        smooth: variante === 'smooth' || variante === 'gradient' ? 0.3 : false,
        step: escalon ? ('middle' as const) : undefined,
        showSymbol: variante === 'points' || datos.length <= 12,
        symbol: 'circle',
        symbolSize: 7,
        lineStyle: { width: 2.6, color, shadowBlur: 8, shadowColor: degradado(color).colorStops[0].color },
        itemStyle: { color, borderColor: palette.surface, borderWidth: 2 },
        areaStyle: area ? { color: variante === 'solid' ? degradado(color, 0.35, 0.35) : degradado(color) } : undefined,
        emphasis: { focus: 'series' as const },
        markLine: {
          silent: true,
          symbol: 'none',
          label: {
            formatter: entorno.ctx.t('dashboard.chart.average', { value: cifraCorta(promedio) }),
            color: palette.muted,
            position: 'insideEndTop' as const,
          },
          lineStyle: { color: palette.muted, type: 'dashed' as const },
          data: [
            { yAxis: promedio },
            ...(config.goalTarget
              ? [
                  {
                    yAxis: config.goalTarget,
                    lineStyle: { color: palette.success },
                    label: { formatter: entorno.ctx.t('charts.goal'), color: palette.success },
                  },
                ]
              : []),
          ],
        },
        markPoint: {
          symbolSize: 42,
          itemStyle: { color },
          label: { color: palette.surface, fontSize: 10, formatter: (p: { value: number }) => cifraCorta(p.value) },
          data: [{ type: 'max' as const }],
        },
        data: datos.map((d) => ({ value: d.value, id: d.label })),
      },
    ],
  };
}

export function areasApiladas(pedido: Pedido, porcentaje: boolean): ChartOption {
  const { config, movs, entorno } = pedido;
  const { palette } = entorno;
  const formato = formatoDe(pedido);
  const { categories, series } = cruzar(
    movs,
    dimensionDe(config, 'date'),
    dimension2De(config, 'category'),
    medidaDe(config),
    entorno.ctx,
    limiteDe(config, 60),
  );
  const totales = categories.map((_, i) => series.reduce((s, serie) => s + serie.data[i], 0) || 1);
  const paleta = colores(palette);
  return {
    color: paleta,
    grid: { top: 40, right: 18, bottom: 34, left: 12, containLabel: true },
    legend: leyenda(palette),
    xAxis: ejeCategoria(palette, categories, { boundaryGap: false }),
    yAxis: ejeValor(palette, porcentaje ? (v) => `${v}%` : cifraCorta, porcentaje ? { max: 100 } : {}),
    tooltip: {
      trigger: 'axis' as const,
      valueFormatter: (v: unknown) => (porcentaje ? `${Number(v).toFixed(1)}%` : formato(Number(v))),
    },
    dataZoom: zoomDeTiempo(palette, categories.length),
    toolbox: herramientas(palette, entorno.titulo, ['line', 'bar', 'stack']),
    series: series.map((serie, i) => ({
      name: serie.name,
      type: 'line' as const,
      stack: 'total',
      smooth: (config.variant ?? 'smooth') === 'smooth' ? 0.3 : false,
      showSymbol: false,
      lineStyle: { width: 1.4 },
      areaStyle: { color: degradado(paleta[i % paleta.length], 0.55, 0.12) },
      emphasis: { focus: 'series' as const },
      data: porcentaje ? serie.data.map((v, idx) => Math.round((v / totales[idx]) * 1000) / 10) : [...serie.data],
    })),
  };
}

export function rio(pedido: Pedido): ChartOption {
  const { config, movs, entorno } = pedido;
  const { palette } = entorno;
  const formato = formatoDe(pedido);
  const dim2 = dimension2De(config, 'category');
  const medida = medidaDe(config);
  const principales = new Set(
    agregar(movs, dim2, medida, entorno.ctx)
      .slice(0, limiteDe(config, 8))
      .map((d) => d.label),
  );
  const celdas = new Map<string, (typeof movs)[number][]>();
  for (const m of movs) {
    const serie = etiquetaDeDimension(m, dim2, entorno.ctx).label;
    if (!principales.has(serie)) continue;
    const clave = m.date + '\u0000' + serie;
    celdas.set(clave, [...(celdas.get(clave) ?? []), m]);
  }
  const datos = [...celdas].map(([clave, filas]) => {
    const [fecha, serie] = clave.split('\u0000');
    return [fecha, valorDeMedida(filas, medida), serie];
  });
  return {
    color: colores(palette),
    legend: leyenda(palette, { data: [...principales] }),
    singleAxis: {
      type: 'time' as const,
      top: 40,
      bottom: 30,
      axisLabel: { color: palette.muted },
      axisLine: { lineStyle: { color: palette.line } },
      splitLine: { show: false },
    },
    tooltip: {
      trigger: 'axis' as const,
      axisPointer: { type: 'line' as const, lineStyle: { color: palette.line } },
      valueFormatter: (v: unknown) => formato(Number(v)),
    },
    toolbox: herramientas(palette, entorno.titulo),
    series: [
      { type: 'themeRiver' as const, emphasis: { itemStyle: { shadowBlur: 16 } }, label: { show: false }, data: datos },
    ],
  };
}
