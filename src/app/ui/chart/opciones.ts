import type { ChartOption } from './chart';
import type { ChartPalette } from './chart-theme';

export type Dinero = (valor: number) => string;

export interface SerieDeBarras {
  nombre: string;
  valores: readonly number[];
  color: string;
  discontinua?: boolean;
}

export interface Porcion {
  nombre: string;
  valor: number;
}

const ejeDeValores = (palette: ChartPalette, compacto: Dinero) => ({
  type: 'value' as const,
  axisLabel: { color: palette.muted, formatter: (valor: number) => compacto(valor) },
  splitLine: { lineStyle: { color: palette.line, type: 'dashed' as const } },
});

const ejeDeCategorias = (palette: ChartPalette, etiquetas: readonly string[]) => ({
  type: 'category' as const,
  data: [...etiquetas],
  axisLine: { lineStyle: { color: palette.line } },
  axisTick: { show: false },
  axisLabel: { color: palette.muted },
});

export function barrasAgrupadas(
  palette: ChartPalette,
  etiquetas: readonly string[],
  series: readonly SerieDeBarras[],
  dinero: Dinero,
  compacto: Dinero,
): ChartOption {
  return {
    grid: { left: 8, right: 8, top: 36, bottom: 8, containLabel: true },
    legend: { top: 0, textStyle: { color: palette.muted }, icon: 'circle', itemWidth: 10, itemHeight: 10 },
    tooltip: { trigger: 'axis', valueFormatter: (valor: unknown) => dinero(Number(valor)) },
    xAxis: ejeDeCategorias(palette, etiquetas),
    yAxis: ejeDeValores(palette, compacto),
    series: series.map((serie) => ({
      name: serie.nombre,
      type: 'bar' as const,
      data: [...serie.valores],
      barMaxWidth: 22,
      itemStyle: { color: serie.color, borderRadius: [5, 5, 0, 0] },
    })),
  };
}

export function anillo(
  palette: ChartPalette,
  porciones: readonly Porcion[],
  dinero: Dinero,
  total: { valor: string; etiqueta: string },
): ChartOption {
  return {
    tooltip: {
      trigger: 'item',
      formatter: (parametro: unknown) => {
        const { name, value, percent } = parametro as { name: string; value: number; percent: number };
        return `${name}<br/><b>${dinero(value)}</b> · ${percent}%`;
      },
    },
    legend: {
      orient: 'vertical',
      right: 0,
      top: 'middle',
      textStyle: { color: palette.muted },
      icon: 'circle',
      itemWidth: 10,
      itemHeight: 10,
    },
    series: [
      {
        type: 'pie',
        radius: ['56%', '80%'],
        center: ['32%', '50%'],
        avoidLabelOverlap: true,
        itemStyle: { borderColor: palette.surface, borderWidth: 2, borderRadius: 6 },
        label: {
          show: true,
          position: 'center',
          formatter: () => `{valor|${total.valor}}\n{pie|${total.etiqueta}}`,
          rich: {
            valor: { color: palette.text, fontSize: 18, fontWeight: 700 },
            pie: { color: palette.muted, fontSize: 12, padding: [6, 0, 0, 0] },
          },
        },
        labelLine: { show: false },
        data: porciones.map((porcion) => ({ name: porcion.nombre, value: porcion.valor })),
      },
    ],
  };
}

export function lineaConCero(
  palette: ChartPalette,
  etiquetas: readonly string[],
  series: readonly SerieDeBarras[],
  dinero: Dinero,
  compacto: Dinero,
): ChartOption {
  return {
    grid: { left: 8, right: 16, top: series.length > 1 ? 36 : 16, bottom: 8, containLabel: true },
    legend: series.length > 1 ? { top: 0, textStyle: { color: palette.muted }, icon: 'circle' } : undefined,
    tooltip: { trigger: 'axis', valueFormatter: (valor: unknown) => dinero(Number(valor)) },
    xAxis: { ...ejeDeCategorias(palette, etiquetas), boundaryGap: false },
    yAxis: ejeDeValores(palette, compacto),
    series: series.map((serie, indice) => ({
      name: serie.nombre,
      type: 'line' as const,
      smooth: true,
      symbolSize: 7,
      data: [...serie.valores],
      lineStyle: { color: serie.color, width: 3, type: serie.discontinua ? ('dashed' as const) : ('solid' as const) },
      itemStyle: { color: serie.color },
      areaStyle: indice === 0 ? { color: serie.color, opacity: 0.12 } : undefined,
      markLine:
        indice === 0
          ? {
              silent: true,
              symbol: 'none',
              lineStyle: { color: palette.muted, type: 'dashed' as const },
              label: { show: false },
              data: [{ yAxis: 0 }],
            }
          : undefined,
    })),
  };
}

export function barrasHorizontales(
  palette: ChartPalette,
  etiquetas: readonly string[],
  series: readonly SerieDeBarras[],
  dinero: Dinero,
  compacto: Dinero,
): ChartOption {
  return {
    grid: { left: 8, right: 16, top: series.length > 1 ? 36 : 8, bottom: 8, containLabel: true },
    legend: series.length > 1 ? { top: 0, textStyle: { color: palette.muted }, icon: 'circle' } : undefined,
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      valueFormatter: (valor: unknown) => dinero(Number(valor)),
    },
    xAxis: ejeDeValores(palette, compacto),
    yAxis: { ...ejeDeCategorias(palette, etiquetas), inverse: true },
    series: series.map((serie) => ({
      name: serie.nombre,
      type: 'bar' as const,
      data: [...serie.valores],
      barMaxWidth: 18,
      itemStyle: { color: serie.color, borderRadius: [0, 5, 5, 0] },
    })),
  };
}

export function medidor(palette: ChartPalette, porcentaje: number, etiqueta: string, sano: number): ChartOption {
  const color = porcentaje <= sano ? palette.success : porcentaje <= 80 ? palette.warn : palette.danger;
  return {
    series: [
      {
        type: 'gauge',
        startAngle: 200,
        endAngle: -20,
        min: 0,
        max: 100,
        radius: '100%',
        center: ['50%', '62%'],
        progress: { show: true, width: 14, roundCap: true, itemStyle: { color } },
        axisLine: { lineStyle: { width: 14, color: [[1, palette.line]] }, roundCap: true },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: { show: false },
        pointer: { show: false },
        anchor: { show: false },
        title: { offsetCenter: [0, '32%'], color: palette.muted, fontSize: 12 },
        detail: {
          valueAnimation: true,
          offsetCenter: [0, '-4%'],
          formatter: '{value} %',
          color: palette.text,
          fontSize: 24,
          fontWeight: 700,
        },
        data: [{ value: Math.round(porcentaje), name: etiqueta }],
      },
    ],
  };
}

export interface FlujoConSaldo {
  etiquetas: readonly string[];
  ingresos: readonly number[];
  gastos: readonly number[];
  saldo: readonly number[];
  nombres: { ingresos: string; gastos: string; saldo: string };
}

export function barrasConSaldo(
  palette: ChartPalette,
  flujo: FlujoConSaldo,
  dinero: Dinero,
  compacto: Dinero,
): ChartOption {
  return {
    grid: { left: 8, right: 8, top: 36, bottom: 8, containLabel: true },
    legend: { top: 0, textStyle: { color: palette.muted }, icon: 'circle', itemWidth: 10, itemHeight: 10 },
    tooltip: { trigger: 'axis', valueFormatter: (valor: unknown) => dinero(Number(valor)) },
    xAxis: ejeDeCategorias(palette, flujo.etiquetas),
    yAxis: ejeDeValores(palette, compacto),
    series: [
      {
        name: flujo.nombres.ingresos,
        type: 'bar' as const,
        data: [...flujo.ingresos],
        barMaxWidth: 22,
        itemStyle: { color: palette.success, borderRadius: [5, 5, 0, 0] },
      },
      {
        name: flujo.nombres.gastos,
        type: 'bar' as const,
        data: [...flujo.gastos],
        barMaxWidth: 22,
        itemStyle: { color: palette.danger, borderRadius: [5, 5, 0, 0] },
      },
      {
        name: flujo.nombres.saldo,
        type: 'line' as const,
        data: [...flujo.saldo],
        smooth: 0.35,
        symbolSize: 7,
        lineStyle: { color: palette.accent, width: 2.5 },
        itemStyle: { color: palette.accent },
      },
    ],
  };
}
