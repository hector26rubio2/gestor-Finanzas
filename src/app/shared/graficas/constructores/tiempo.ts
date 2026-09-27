import type { ChartOption } from '@ui/chart';
import { porDia, velas } from '../datos';
import { Pedido, formatoDe, medidaDe } from '../entorno';
import { cifraCorta, conAlfa, ejeCategoria, ejeValor, herramientas, zoomDeTiempo } from '../estilo';

const nombresDeDias = (locale: string) =>
  Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat(locale, { weekday: 'narrow', timeZone: 'UTC' }).format(new Date(Date.UTC(2024, 0, 7 + i))),
  );

const nombresDeMeses = (locale: string) =>
  Array.from({ length: 12 }, (_, i) =>
    new Intl.DateTimeFormat(locale, { month: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(2024, i, 15))),
  );

export function calendario(pedido: Pedido): ChartOption {
  const { config, movs, entorno } = pedido;
  const { palette } = entorno;
  const formato = formatoDe(pedido);
  const dias = porDia(movs, medidaDe(config));
  const desde = dias[0]?.[0] ?? new Date().toISOString().slice(0, 10);
  const hasta = dias[dias.length - 1]?.[0] ?? desde;
  const max = Math.max(1, ...dias.map((d) => d[1]));
  const mayores = [...dias].sort((a, b) => b[1] - a[1]).slice(0, 6);
  const efecto = config.variant === 'effect';
  return {
    tooltip: { formatter: (p: { value: [string, number] }) => `${p.value[0]}<br/><b>${formato(p.value[1])}</b>` },
    visualMap: {
      min: 0,
      max,
      calculable: true,
      orient: 'horizontal' as const,
      left: 'center',
      bottom: 0,
      itemHeight: 160,
      textStyle: { color: palette.muted },
      formatter: (v: number) => cifraCorta(v),
      inRange: { color: [conAlfa(palette.accent, 0.06), conAlfa(palette.accent, 0.5), palette.accent] },
      seriesIndex: 0,
    },
    calendar: {
      top: 34,
      left: 36,
      right: 12,
      bottom: 52,
      range: [desde, hasta],
      cellSize: ['auto', 'auto'],
      splitLine: { lineStyle: { color: palette.line, width: 1.5 } },
      itemStyle: { color: 'transparent', borderColor: palette.surface, borderWidth: 2 },
      dayLabel: { color: palette.muted, firstDay: 1, nameMap: nombresDeDias(entorno.ctx.locale) },
      monthLabel: { color: palette.muted, nameMap: nombresDeMeses(entorno.ctx.locale) },
      yearLabel: { show: false },
    },
    toolbox: herramientas(palette, entorno.titulo),
    series: [
      { type: 'heatmap' as const, coordinateSystem: 'calendar' as const, itemStyle: { borderRadius: 3 }, data: dias },
      ...(efecto
        ? [
            {
              type: 'effectScatter' as const,
              coordinateSystem: 'calendar' as const,
              symbolSize: (v: [string, number]) => 6 + (v[1] / max) * 14,
              rippleEffect: { scale: 2.5 },
              itemStyle: { color: palette.danger },
              data: mayores,
            },
          ]
        : []),
    ],
  };
}

export function velasDeSaldo(pedido: Pedido): ChartOption {
  const { movs, entorno } = pedido;
  const { palette } = entorno;
  const { etiquetas, velas: lista } = velas(movs, entorno.ctx);
  const cierres = lista.map((v) => v[1]);
  const media = cierres.map((_, i) => {
    const ventana = cierres.slice(Math.max(0, i - 2), i + 1);
    return Math.round(ventana.reduce((s, v) => s + v, 0) / ventana.length);
  });
  return {
    grid: { top: 36, right: 18, bottom: 40, left: 12, containLabel: true },
    legend: {
      top: 0,
      right: 0,
      textStyle: { color: palette.muted },
      data: [entorno.ctx.t('charts.candle.balance'), entorno.ctx.t('charts.candle.average')],
    },
    xAxis: ejeCategoria(palette, etiquetas, { boundaryGap: true }),
    yAxis: ejeValor(palette, cifraCorta, { scale: true }),
    tooltip: {
      trigger: 'axis' as const,
      axisPointer: { type: 'cross' as const },
      formatter: (p: { name: string; seriesType: string; value: number[] }[]) => {
        const vela = p.find((x) => x.seriesType === 'candlestick');
        if (!vela) return '';
        const [, abre, cierra, bajo, alto] = vela.value;
        return `${vela.name}<br/>${entorno.ctx.t('charts.candle.open')}: ${entorno.dinero(abre)}<br/>${entorno.ctx.t('charts.candle.close')}: <b>${entorno.dinero(cierra)}</b><br/>${entorno.ctx.t('charts.candle.low')}: ${entorno.dinero(bajo)}<br/>${entorno.ctx.t('charts.candle.high')}: ${entorno.dinero(alto)}`;
      },
    },
    dataZoom: zoomDeTiempo(palette, etiquetas.length, 12),
    toolbox: herramientas(palette, entorno.titulo),
    series: [
      {
        name: entorno.ctx.t('charts.candle.balance'),
        type: 'candlestick' as const,
        itemStyle: {
          color: palette.success,
          color0: palette.danger,
          borderColor: palette.success,
          borderColor0: palette.danger,
        },
        data: lista,
      },
      {
        name: entorno.ctx.t('charts.candle.average'),
        type: 'line' as const,
        smooth: true,
        showSymbol: false,
        lineStyle: { color: palette.warn, width: 1.6, type: 'dashed' as const },
        data: media,
      },
    ],
  };
}
