import type { ChartOption } from '@ui/chart';
import { agregar, burbujas, cruzar, cubetas, distribucion, etiquetaDeDimension } from '@shared/graficas/datos';
import { Pedido, dimension2De, dimensionDe, formatoDe, limiteDe, medidaDe } from '@shared/graficas/entorno';
import {
  cifraCorta,
  colores,
  conAlfa,
  degradado,
  degradadoDeBarra,
  ejeCategoria,
  ejeValor,
  herramientas,
  leyenda,
} from '@shared/graficas/estilo';

export function dispersion(pedido: Pedido): ChartOption {
  const { config, movs, entorno } = pedido;
  const { palette } = entorno;
  const dim = dimensionDe(config, 'flow');
  const grupos = agregar(movs, dim, 'count', entorno.ctx)
    .slice(0, limiteDe(config, 8))
    .map((g) => g.label);
  const mayor = Math.max(1, ...movs.map((m) => Math.abs(m.amount)));
  const efecto = config.variant === 'effect';
  const paleta = colores(palette);
  const principales = [...movs]
    .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
    .slice(0, 5)
    .map((m) => m.id);
  return {
    color: paleta,
    grid: { top: 40, right: 18, bottom: 40, left: 12, containLabel: true },
    legend: leyenda(palette),
    xAxis: {
      type: 'time' as const,
      axisLine: { lineStyle: { color: palette.line } },
      axisLabel: { color: palette.muted, hideOverlap: true },
      splitLine: { show: false },
    },
    yAxis: ejeValor(palette),
    tooltip: {
      trigger: 'item' as const,
      formatter: (p: { name?: string; value: [string, number]; seriesName: string }) =>
        `${p.name ?? ''}<br/><b>${entorno.dinero(p.value[1])}</b><br/><small>${p.value[0]} · ${p.seriesName}</small>`,
    },
    dataZoom: [{ type: 'inside' as const }, { type: 'inside' as const, yAxisIndex: 0 }],
    toolbox: herramientas(palette, entorno.titulo),
    series: grupos.flatMap((grupo, i) => {
      const puntos = movs.filter((m) => etiquetaDeDimension(m, dim, entorno.ctx).label === grupo);
      const base = {
        name: grupo,
        symbolSize: (valor: [string, number]) => 6 + (Math.abs(valor[1]) / mayor) * 22,
        itemStyle: { color: conAlfa(paleta[i % paleta.length], 0.7), borderColor: paleta[i % paleta.length] },
        emphasis: { focus: 'series' as const },
      };
      return [
        {
          ...base,
          type: 'scatter' as const,
          data: puntos
            .filter((m) => !efecto || !principales.includes(m.id))
            .map((m) => ({ value: [m.date, Math.abs(m.amount)], name: m.description, id: m.id })),
        },
        ...(efecto
          ? [
              {
                ...base,
                type: 'effectScatter' as const,
                rippleEffect: { scale: 3, brushType: 'stroke' as const },
                data: puntos
                  .filter((m) => principales.includes(m.id))
                  .map((m) => ({ value: [m.date, Math.abs(m.amount)], name: m.description, id: m.id })),
              },
            ]
          : []),
      ];
    }),
  };
}

export function burbujasPorGrupo(pedido: Pedido): ChartOption {
  const { config, movs, entorno } = pedido;
  const { palette } = entorno;
  const grupos = burbujas(movs, dimensionDe(config), entorno.ctx, limiteDe(config, 14));
  const mayor = Math.max(1, ...grupos.map((g) => g.total));
  const paleta = colores(palette);
  return {
    grid: { top: 30, right: 24, bottom: 40, left: 12, containLabel: true },
    xAxis: ejeValor(palette, (v) => String(v), {
      name: entorno.ctx.t('charts.bubble.count'),
      nameLocation: 'middle' as const,
      nameGap: 26,
      nameTextStyle: { color: palette.muted },
    }),
    yAxis: ejeValor(palette, cifraCorta, {
      name: entorno.ctx.t('charts.bubble.average'),
      nameTextStyle: { color: palette.muted },
    }),
    tooltip: {
      formatter: (p: { data: { name: string; value: [number, number, number] } }) =>
        `${p.data.name}<br/>${entorno.ctx.t('charts.bubble.count')}: <b>${p.data.value[0]}</b><br/>${entorno.ctx.t('charts.bubble.average')}: <b>${entorno.dinero(p.data.value[1])}</b><br/>${entorno.ctx.t('charts.total')}: <b>${entorno.dinero(p.data.value[2])}</b>`,
    },
    toolbox: herramientas(palette, entorno.titulo),
    series: [
      {
        type: 'scatter' as const,
        symbolSize: (valor: [number, number, number]) => 14 + Math.sqrt(valor[2] / mayor) * 56,
        label: {
          show: true,
          color: palette.text,
          fontSize: 10,
          formatter: (p: { data: { name: string } }) => p.data.name,
        },
        itemStyle: { opacity: 0.85, borderColor: palette.surface, borderWidth: 1 },
        emphasis: { focus: 'self' as const },
        data: grupos.map((g, i) => ({
          name: g.nombre,
          id: g.nombre,
          value: [g.cantidad, g.promedio, g.total],
          itemStyle: {
            color: {
              type: 'radial' as const,
              x: 0.4,
              y: 0.3,
              r: 0.8,
              colorStops: [
                { offset: 0, color: conAlfa(paleta[i % paleta.length], 0.5) },
                { offset: 1, color: paleta[i % paleta.length] },
              ],
            },
          },
        })),
      },
    ],
  };
}

export function cajas(pedido: Pedido): ChartOption {
  const { config, movs, entorno } = pedido;
  const { palette } = entorno;
  const {
    categorias,
    cajas: lista,
    atipicos,
  } = distribucion(movs, dimensionDe(config), entorno.ctx, limiteDe(config, 10));
  const horizontal = config.variant === 'horizontal';
  return {
    grid: { top: 24, right: 18, bottom: 30, left: 12, containLabel: true },
    xAxis: horizontal ? ejeValor(palette) : ejeCategoria(palette, categorias),
    yAxis: horizontal ? ejeCategoria(palette, categorias) : ejeValor(palette),
    tooltip: {
      trigger: 'item' as const,
      formatter: (p: { name: string; seriesType: string; value: number[] }) =>
        p.seriesType === 'boxplot'
          ? `${p.name}<br/>${entorno.ctx.t('charts.box.min')}: ${entorno.dinero(p.value[1])}<br/>Q1: ${entorno.dinero(p.value[2])}<br/>${entorno.ctx.t('charts.box.median')}: <b>${entorno.dinero(p.value[3])}</b><br/>Q3: ${entorno.dinero(p.value[4])}<br/>${entorno.ctx.t('charts.box.max')}: ${entorno.dinero(p.value[5])}`
          : `${entorno.ctx.t('charts.box.outlier')}: <b>${entorno.dinero(p.value[1])}</b>`,
    },
    toolbox: herramientas(palette, entorno.titulo),
    series: [
      {
        type: 'boxplot' as const,
        itemStyle: { color: conAlfa(palette.accent, 0.18), borderColor: palette.accent, borderWidth: 1.6 },
        boxWidth: [8, 36],
        data: lista,
      },
      {
        type: 'scatter' as const,
        symbolSize: 7,
        itemStyle: { color: palette.danger },
        data: horizontal ? atipicos.map(([i, v]) => [v, i]) : atipicos,
      },
    ],
  };
}

export function histograma(pedido: Pedido): ChartOption {
  const { config, movs, entorno } = pedido;
  const { palette } = entorno;
  const { etiquetas, conteo } = cubetas(movs, limiteDe(config, 10));
  const rotulos = etiquetas.map(([desde, hasta]) => `${cifraCorta(desde)}–${cifraCorta(hasta)}`);
  const comoArea = config.variant === 'area';
  return {
    grid: { top: 24, right: 18, bottom: 30, left: 12, containLabel: true },
    xAxis: ejeCategoria(palette, rotulos, { boundaryGap: !comoArea }),
    yAxis: ejeValor(palette, (v) => String(v)),
    tooltip: {
      trigger: 'axis' as const,
      valueFormatter: (v: unknown) =>
        `${v} ${entorno.ctx.t(Number(v) === 1 ? 'dashboard.unit.movement' : 'dashboard.unit.movements')}`,
    },
    toolbox: herramientas(palette, entorno.titulo, ['line', 'bar']),
    series: [
      comoArea
        ? {
            type: 'line' as const,
            smooth: 0.4,
            showSymbol: false,
            lineStyle: { color: palette.accent, width: 2.4 },
            areaStyle: { color: degradado(palette.accent) },
            data: conteo,
          }
        : {
            type: 'bar' as const,
            barCategoryGap: '4%',
            itemStyle: {
              color: degradadoDeBarra(palette.accent),
              borderRadius: [4, 4, 0, 0] as [number, number, number, number],
            },
            data: conteo.map((valor, i) => ({ value: valor, id: `${etiquetas[i][0]}|${etiquetas[i][1]}` })),
          },
    ],
  };
}

export function matriz(pedido: Pedido): ChartOption {
  const { config, movs, entorno } = pedido;
  const { palette } = entorno;
  const formato = formatoDe(pedido);
  const { categories, series } = cruzar(
    movs,
    dimensionDe(config, 'weekday'),
    dimension2De(config, 'category'),
    medidaDe(config),
    entorno.ctx,
    limiteDe(config, 16),
  );
  const celdas: [number, number, number][] = [];
  series.forEach((s, yi) => s.data.forEach((valor, xi) => celdas.push([xi, yi, valor])));
  const max = Math.max(1, ...celdas.map((c) => c[2]));
  const burbujasVar = config.variant === 'bubbles';
  const eje = {
    axisLine: { show: false },
    axisTick: { show: false },
    splitArea: { show: !burbujasVar },
    splitLine: { show: burbujasVar, lineStyle: { color: palette.line, type: 'dashed' as const } },
  };
  return {
    grid: { top: 12, right: 18, bottom: 64, left: 12, containLabel: true },
    xAxis: ejeCategoria(palette, categories, eje),
    yAxis: ejeCategoria(
      palette,
      series.map((s) => s.name),
      eje,
    ),
    visualMap: {
      min: 0,
      max,
      calculable: true,
      orient: 'horizontal' as const,
      left: 'center',
      bottom: 0,
      itemHeight: 140,
      textStyle: { color: palette.muted },
      formatter: (v: number) => cifraCorta(v),
      inRange: { color: [conAlfa(palette.accent, 0.08), conAlfa(palette.accent, 0.55), palette.accent] },
    },
    tooltip: {
      formatter: (p: { value: [number, number, number] }) =>
        `${categories[p.value[0]]} · ${series[p.value[1]].name}<br/><b>${formato(p.value[2])}</b>`,
    },
    toolbox: herramientas(palette, entorno.titulo),
    series: [
      burbujasVar
        ? {
            type: 'scatter' as const,
            symbolSize: (v: [number, number, number]) => 4 + Math.sqrt(v[2] / max) * 30,
            data: celdas,
          }
        : {
            type: 'heatmap' as const,
            label: {
              show: categories.length <= 12,
              color: palette.text,
              fontSize: 10,
              formatter: (p: { value: [number, number, number] }) => (p.value[2] ? cifraCorta(p.value[2]) : ''),
            },
            itemStyle: { borderColor: palette.surface, borderWidth: 2, borderRadius: 4 },
            data: celdas,
          },
    ],
  };
}
