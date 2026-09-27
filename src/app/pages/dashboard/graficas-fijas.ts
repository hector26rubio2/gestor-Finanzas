import { ChartOption, ChartPalette } from '@ui/chart';
import type { Movement } from '@core/state';
import { CategorySlice, TimelinePoint } from '@shared/tablero/dashboard.model';
import { cifraCorta, conAlfa, degradado, ejesDeIntervalo } from '@shared/graficas';

export interface ContextoDeGrafica {
  palette: ChartPalette;
  t: (key: string, params?: Record<string, string | number>) => string;
  money: (value: number) => string;
}

export interface CubetasDeHistograma {
  montos: readonly number[];
  ancho: number;
  conteo: readonly number[];
  etiquetas: string[];
  cubetas: number;
}

export function opcionDeFlujo(ctx: ContextoDeGrafica, puntos: readonly TimelinePoint[]): ChartOption {
  const { palette } = ctx;
  const serie = (nombre: string, valores: number[], color: string) => ({
    name: nombre,
    type: 'line' as const,
    smooth: 0.24,
    showSymbol: false,
    symbol: 'circle',
    symbolSize: 7,
    lineStyle: { width: 2.4, color },
    itemStyle: { color },
    areaStyle: { color: degradado(color) },
    emphasis: { focus: 'series' as const, showSymbol: true },
    data: valores,
  });
  return {
    ...ejesDeIntervalo(
      palette,
      puntos.map((p) => p.label),
    ),
    legend: {
      data: [ctx.t('dashboard.series.income'), ctx.t('dashboard.series.expense')],
      top: 0,
      right: 0,
      textStyle: { color: palette.muted },
      icon: 'circle',
    },
    tooltip: {
      trigger: 'axis' as const,
      axisPointer: { type: 'line' as const, lineStyle: { color: palette.line } },
      valueFormatter: (valor: unknown) => ctx.money(Number(valor)),
    },
    dataZoom:
      puntos.length > 14
        ? [
            { type: 'inside' as const, start: 0, end: 100 },
            {
              type: 'slider' as const,
              height: 16,
              bottom: 4,
              borderColor: palette.line,
              backgroundColor: 'transparent',
              fillerColor: conAlfa(palette.accent, 0.14),
              dataBackground: {
                lineStyle: { color: palette.line },
                areaStyle: { color: conAlfa(palette.accent, 0.1) },
              },
              selectedDataBackground: {
                lineStyle: { color: palette.accent },
                areaStyle: { color: conAlfa(palette.accent, 0.18) },
              },
              handleStyle: { color: palette.surface, borderColor: palette.accent },
              moveHandleStyle: { color: conAlfa(palette.accent, 0.4) },
              textStyle: { color: palette.muted },
            },
          ]
        : undefined,
    series: [
      serie(
        ctx.t('dashboard.series.income'),
        puntos.map((p) => p.income),
        palette.accent,
      ),
      serie(
        ctx.t('dashboard.series.expense'),
        puntos.map((p) => p.expense),
        palette.danger,
      ),
    ],
  };
}

export function opcionDeTendencia(ctx: ContextoDeGrafica, puntos: readonly TimelinePoint[]): ChartOption {
  const { palette } = ctx;
  const gastos = puntos.map((p) => p.expense);
  const promedio = gastos.length ? gastos.reduce((s, v) => s + v, 0) / gastos.length : 0;
  return {
    ...ejesDeIntervalo(
      palette,
      puntos.map((p) => p.label),
    ),
    tooltip: { trigger: 'axis' as const, valueFormatter: (valor: unknown) => ctx.money(Number(valor)) },
    series: [
      {
        name: ctx.t('dashboard.series.expense'),
        type: 'line' as const,
        smooth: 0.24,
        showSymbol: false,
        lineStyle: { width: 2.4, color: palette.accent },
        itemStyle: { color: palette.accent },
        areaStyle: { color: degradado(palette.accent) },
        data: gastos,
        markLine: {
          silent: true,
          symbol: 'none',
          label: {
            formatter: ctx.t('dashboard.chart.average', { value: cifraCorta(promedio) }),
            color: palette.muted,
            position: 'insideEndTop' as const,
          },
          lineStyle: { color: palette.muted, type: 'dashed' as const },
          data: [{ yAxis: promedio }],
        },
      },
    ],
  };
}

export function opcionDeDispersion(ctx: ContextoDeGrafica, movimientos: readonly Movement[]): ChartOption {
  const { palette } = ctx;
  const puntos = movimientos.filter((m) => m.amount !== 0);
  const mayor = Math.max(1, ...puntos.map((m) => Math.abs(m.amount)));
  const serie = (nombre: string, color: string, entra: boolean) => ({
    name: nombre,
    type: 'scatter' as const,
    symbolSize: (valor: number[]) => 8 + (Math.abs(valor[1]) / mayor) * 16,
    itemStyle: { color, opacity: 0.75 },
    data: puntos
      .filter((m) => m.amount > 0 === entra)
      .map((m) => ({ value: [m.date, Math.abs(m.amount)], name: m.description, id: m.id })),
  });
  return {
    grid: { top: 28, right: 18, bottom: 40, left: 62 },
    legend: { top: 0, right: 0, textStyle: { color: palette.muted }, icon: 'circle' },
    xAxis: {
      type: 'time' as const,
      axisLine: { lineStyle: { color: palette.line } },
      axisLabel: { color: palette.muted, hideOverlap: true },
      splitLine: { show: false },
    },
    yAxis: {
      type: 'value' as const,
      name: ctx.t('dashboard.chart.amountAxis'),
      nameTextStyle: { color: palette.muted },
      splitLine: { lineStyle: { color: palette.line, type: 'dashed' as const } },
      axisLabel: { color: palette.muted, formatter: (valor: number) => cifraCorta(valor) },
    },
    tooltip: {
      trigger: 'item' as const,
      formatter: (parametro: { name?: string; value: [string, number] }) =>
        (parametro.name ?? '') +
        '<br/><b>' +
        ctx.money(parametro.value[1]) +
        '</b><br/><small>' +
        parametro.value[0] +
        '</small>',
    },
    series: [
      serie(ctx.t('dashboard.series.income'), palette.accent, true),
      serie(ctx.t('dashboard.series.expense'), palette.danger, false),
    ],
  };
}

export function opcionDeAnillo(
  ctx: ContextoDeGrafica,
  distribucion: readonly CategorySlice[],
  totalGasto: number,
): ChartOption {
  const { palette } = ctx;
  const reparto = distribucion.slice(0, 6);
  return {
    tooltip: {
      trigger: 'item' as const,
      formatter: (parametro: { name: string; value: number; percent: number }) =>
        parametro.name + '<br/><b>' + ctx.money(parametro.value) + '</b> · ' + parametro.percent + '%',
    },
    legend: {
      orient: 'vertical' as const,
      right: 0,
      top: 'middle',
      textStyle: { color: palette.muted, fontSize: 14 },
      itemWidth: 13,
      itemHeight: 13,
      itemGap: 16,
      icon: 'circle',
    },
    series: [
      {
        type: 'pie' as const,
        radius: ['58%', '82%'],
        center: ['34%', '50%'],
        avoidLabelOverlap: true,
        itemStyle: { borderColor: palette.surface, borderWidth: 2, borderRadius: 6 },
        label: {
          show: true,
          position: 'center' as const,
          formatter: () =>
            '{valor|' + ctx.money(totalGasto) + '}\n{pie|' + ctx.t('dashboard.widget.donut.totalLabel') + '}',
          rich: {
            valor: { color: palette.text, fontSize: 24, fontWeight: 700 },
            pie: { color: palette.muted, fontSize: 13, padding: [8, 0, 0, 0] },
          },
        },
        emphasis: { label: { show: true }, scaleSize: 6 },
        data: reparto.map((categoria) => ({ name: categoria.name, value: categoria.value })),
      },
    ],
  };
}

export function opcionApilada(ctx: ContextoDeGrafica, puntos: readonly TimelinePoint[]): ChartOption {
  const { palette } = ctx;
  const barra = (nombre: string, valores: number[], color: string, arriba: boolean) => ({
    name: nombre,
    type: 'bar' as const,
    stack: 'total',
    barMaxWidth: 26,
    itemStyle: { color, borderRadius: arriba ? ([5, 5, 0, 0] as [number, number, number, number]) : 0 },
    emphasis: { focus: 'series' as const },
    data: valores,
  });
  return {
    ...ejesDeIntervalo(
      palette,
      puntos.map((p) => p.label),
    ),
    legend: {
      data: [ctx.t('dashboard.series.income'), ctx.t('dashboard.series.expense')],
      top: 0,
      right: 0,
      textStyle: { color: palette.muted },
      icon: 'circle',
    },
    tooltip: {
      trigger: 'axis' as const,
      axisPointer: { type: 'shadow' as const },
      valueFormatter: (valor: unknown) => ctx.money(Number(valor)),
    },
    series: [
      barra(
        ctx.t('dashboard.series.expense'),
        puntos.map((p) => p.expense),
        palette.danger,
        false,
      ),
      barra(
        ctx.t('dashboard.series.income'),
        puntos.map((p) => p.income),
        palette.accent,
        true,
      ),
    ],
  };
}

export function opcionDeMedidor(ctx: ContextoDeGrafica, tasa: number): ChartOption {
  const { palette } = ctx;
  return {
    series: [
      {
        type: 'gauge' as const,
        startAngle: 200,
        endAngle: -20,
        min: 0,
        max: 100,
        radius: '96%',
        center: ['50%', '64%'],
        progress: { show: false },
        axisLine: {
          lineStyle: {
            width: 26,
            color: [
              [0.1, conAlfa(palette.danger, 0.75)],
              [0.2, conAlfa(palette.warn, 0.75)],
              [1, conAlfa(palette.accent, 0.75)],
            ],
          },
        },
        pointer: { width: 6, length: '60%', itemStyle: { color: palette.text } },
        anchor: {
          show: true,
          size: 16,
          itemStyle: { color: palette.surface, borderColor: palette.text, borderWidth: 2 },
        },
        axisTick: { distance: -28, length: 5, lineStyle: { color: palette.surface, width: 1 } },
        splitLine: { distance: -28, length: 12, lineStyle: { color: palette.surface, width: 2 } },
        axisLabel: { distance: 34, color: palette.muted, fontSize: 11, formatter: (valor: number) => `${valor}%` },
        detail: {
          valueAnimation: true,
          offsetCenter: [0, '38%'],
          color: palette.text,
          fontSize: 30,
          fontWeight: 700,
          formatter: (valor: number) => `${valor}%`,
        },
        title: { offsetCenter: [0, '70%'], color: palette.muted, fontSize: 12 },
        data: [{ value: tasa, name: ctx.t('dashboard.widget.gauge.subtitle') }],
      },
    ],
  };
}

export function opcionDeIntensidad(ctx: ContextoDeGrafica, puntos: readonly TimelinePoint[]): ChartOption {
  const { palette } = ctx;
  const totales = puntos.map((p) => p.income + p.expense);
  return {
    grid: { top: 10, right: 18, bottom: 58, left: 18, containLabel: true },
    xAxis: {
      type: 'category' as const,
      data: puntos.map((p) => p.label),
      axisLine: { lineStyle: { color: palette.line } },
      axisTick: { show: false },
      axisLabel: { color: palette.muted, hideOverlap: true },
    },
    yAxis: {
      type: 'category' as const,
      data: [ctx.t('dashboard.widget.heatmap.axisLabel')],
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: palette.muted },
    },
    visualMap: {
      min: 0,
      max: Math.max(1, ...totales),
      calculable: true,
      orient: 'horizontal' as const,
      left: 'center',
      bottom: 0,
      itemHeight: 120,
      textStyle: { color: palette.muted },
      formatter: (valor: number) => cifraCorta(valor),
      inRange: { color: [conAlfa(palette.accent, 0.12), palette.accent] },
    },
    tooltip: {
      position: 'top' as const,
      formatter: (parametro: { value: [number, number, number] }) =>
        (puntos[parametro.value[0]]?.label ?? '') + '<br/><b>' + ctx.money(parametro.value[2]) + '</b>',
    },
    series: [
      {
        type: 'heatmap' as const,
        data: totales.map((valor, indice) => [indice, 0, valor]),
        itemStyle: { borderColor: palette.surface, borderWidth: 2, borderRadius: 4 },
        emphasis: { itemStyle: { borderColor: palette.text } },
      },
    ],
  };
}

export function opcionDeHistograma(ctx: ContextoDeGrafica, cubetas: CubetasDeHistograma): ChartOption {
  const { palette } = ctx;
  const { montos, conteo, etiquetas } = cubetas;
  if (!montos.length) return { series: [] };
  return {
    ...ejesDeIntervalo(palette, etiquetas),
    tooltip: {
      trigger: 'axis' as const,
      valueFormatter: (v: unknown) =>
        `${v} ${ctx.t(Number(v) === 1 ? 'dashboard.unit.movement' : 'dashboard.unit.movements')}`,
    },
    series: [
      {
        type: 'bar' as const,
        barMaxWidth: 34,
        itemStyle: { color: palette.accent, borderRadius: [4, 4, 0, 0] as [number, number, number, number] },
        data: conteo,
      },
    ],
  };
}
