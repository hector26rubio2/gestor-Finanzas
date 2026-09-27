import type { ChartOption } from '@ui/chart';
import { agregar, cruzar } from '@shared/graficas/datos';
import { Pedido, dimension2De, dimensionDe, formatoDe, limiteDe, medidaDe } from '@shared/graficas/entorno';
import { colores, conAlfa, degradado, herramientas, leyenda } from '@shared/graficas/estilo';

export function embudo(pedido: Pedido): ChartOption {
  const { config, movs, entorno } = pedido;
  const { palette } = entorno;
  const formato = formatoDe(pedido);
  const datos = agregar(movs, dimensionDe(config), medidaDe(config), entorno.ctx)
    .filter((d) => d.value > 0)
    .slice(0, limiteDe(config, 7));
  const variante = config.variant ?? 'funnel';
  const paleta = colores(palette);
  const comun = {
    type: 'funnel' as const,
    top: 24,
    bottom: 12,
    gap: 3,
    minSize: variante === 'aligned' ? '20%' : '0%',
    label: {
      show: true,
      position: 'inside' as const,
      color: '#fff',
      fontSize: 11,
      formatter: (p: { name: string; percent: number }) => `${p.name} · ${Math.round(p.percent)}%`,
    },
    labelLine: { show: false },
    itemStyle: { borderColor: palette.surface, borderWidth: 1 },
    emphasis: { label: { fontSize: 13 } },
    data: datos.map((d, i) => ({
      name: d.label,
      value: d.value,
      id: d.label,
      itemStyle: { color: paleta[i % paleta.length] },
    })),
  };
  const series =
    variante === 'compare'
      ? [
          {
            ...comun,
            name: entorno.ctx.t('charts.funnel.actual'),
            left: '8%',
            width: '84%',
            sort: 'descending' as const,
            itemStyle: { ...comun.itemStyle, opacity: 0.35 },
            label: { show: false },
          },
          {
            ...comun,
            name: entorno.ctx.t('charts.funnel.share'),
            left: '18%',
            width: '64%',
            sort: 'descending' as const,
            z: 10,
          },
        ]
      : [
          {
            ...comun,
            left: variante === 'aligned' ? '4%' : '10%',
            width: variante === 'aligned' ? '70%' : '80%',
            sort: variante === 'pyramid' ? ('ascending' as const) : ('descending' as const),
            funnelAlign: variante === 'aligned' ? ('left' as const) : ('center' as const),
          },
        ];
  return {
    tooltip: {
      trigger: 'item' as const,
      formatter: (p: { name: string; value: number; percent: number }) =>
        `${p.name}<br/><b>${formato(p.value)}</b> · ${Math.round(p.percent)}%`,
    },
    toolbox: herramientas(palette, entorno.titulo),
    series,
  };
}

export function radar(pedido: Pedido): ChartOption {
  const { config, movs, entorno } = pedido;
  const { palette } = entorno;
  const formato = formatoDe(pedido);
  const { categories, series } = cruzar(
    movs,
    dimensionDe(config),
    dimension2De(config, 'flow'),
    medidaDe(config),
    entorno.ctx,
    limiteDe(config, 8),
  );
  const max = Math.max(1, ...series.flatMap((s) => s.data));
  const variante = config.variant ?? 'polygon';
  const paleta = colores(palette);
  return {
    color: paleta,
    legend: leyenda(palette),
    tooltip: { trigger: 'item' as const, valueFormatter: (v: unknown) => formato(Number(v)) },
    toolbox: herramientas(palette, entorno.titulo),
    radar: {
      shape: variante === 'circle' ? ('circle' as const) : ('polygon' as const),
      center: ['50%', '56%'],
      radius: '66%',
      indicator: categories.map((nombre) => ({ name: nombre, max: max * 1.1 })),
      axisName: { color: palette.muted, fontSize: 11 },
      splitLine: { lineStyle: { color: palette.line } },
      splitArea: { areaStyle: { color: [conAlfa(palette.accent, 0.02), conAlfa(palette.accent, 0.06)] } },
      axisLine: { lineStyle: { color: palette.line } },
    },
    series: [
      {
        type: 'radar' as const,
        symbol: 'circle',
        symbolSize: 5,
        emphasis: { lineStyle: { width: 3 } },
        data: series.map((s, i) => ({
          name: s.name,
          value: [...s.data],
          lineStyle: { width: 2, color: paleta[i % paleta.length] },
          itemStyle: { color: paleta[i % paleta.length] },
          areaStyle:
            variante === 'filled' ? { color: degradado(paleta[i % paleta.length], 0.45, 0.15) } : { opacity: 0.08 },
        })),
      },
    ],
  };
}
