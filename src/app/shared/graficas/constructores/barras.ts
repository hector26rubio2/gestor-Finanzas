import type { ChartOption } from '@ui/chart';
import { agregar, cruzar } from '@shared/graficas/datos';
import { Pedido, dimension2De, dimensionDe, formatoDe, limiteDe, medidaDe } from '@shared/graficas/entorno';
import {
  cifraCorta,
  colores,
  conAlfa,
  degradadoDeBarra,
  ejeCategoria,
  ejeValor,
  herramientas,
  leyenda,
  zoomDeTiempo,
} from '@shared/graficas/estilo';

const RADIO_VERTICAL: [number, number, number, number] = [6, 6, 0, 0];
const RADIO_HORIZONTAL: [number, number, number, number] = [0, 6, 6, 0];

export function barras(pedido: Pedido, horizontal: boolean): ChartOption {
  const { config, movs, entorno } = pedido;
  const { palette } = entorno;
  const formato = formatoDe(pedido);
  const datos = agregar(movs, dimensionDe(config), medidaDe(config), entorno.ctx).slice(0, limiteDe(config, 14));
  const variante = config.variant ?? 'gradient';
  const etiquetas = datos.map((d) => d.label);
  const color = palette.accent;
  return {
    grid: { top: 24, right: 24, bottom: horizontal ? 12 : 30, left: 12, containLabel: true },
    xAxis: horizontal ? ejeValor(palette) : ejeCategoria(palette, etiquetas),
    yAxis: horizontal ? ejeCategoria(palette, [...etiquetas].reverse()) : ejeValor(palette),
    tooltip: {
      trigger: 'axis' as const,
      axisPointer: { type: 'shadow' as const },
      valueFormatter: (v: unknown) => formato(Number(v)),
    },
    dataZoom: horizontal ? undefined : zoomDeTiempo(palette, datos.length, 16),
    toolbox: herramientas(palette, entorno.titulo, ['line', 'bar']),
    series: [
      {
        type: 'bar' as const,
        barMaxWidth: 30,
        showBackground: variante === 'background',
        backgroundStyle: {
          color: conAlfa(palette.line, 0.45),
          borderRadius: horizontal ? RADIO_HORIZONTAL : RADIO_VERTICAL,
        },
        itemStyle: {
          color: variante === 'gradient' ? degradadoDeBarra(color, horizontal) : color,
          borderRadius: variante === 'labels' ? 3 : horizontal ? RADIO_HORIZONTAL : RADIO_VERTICAL,
        },
        label: {
          show: variante === 'labels',
          position: horizontal ? ('right' as const) : ('top' as const),
          color: palette.muted,
          formatter: (p: { value: number }) => cifraCorta(p.value),
        },
        emphasis: { itemStyle: { color: palette.accent, shadowBlur: 12, shadowColor: conAlfa(color, 0.4) } },
        data: (horizontal ? [...datos].reverse() : datos).map((d) => ({ value: d.value, id: d.label })),
      },
    ],
  };
}

export function barrasCruzadas(pedido: Pedido, modo: 'grouped' | 'stacked' | 'stacked100'): ChartOption {
  const { config, movs, entorno } = pedido;
  const { palette } = entorno;
  const formato = formatoDe(pedido);
  const horizontal = config.variant === 'horizontal';
  const { categories, series } = cruzar(
    movs,
    dimensionDe(config),
    dimension2De(config),
    medidaDe(config),
    entorno.ctx,
    limiteDe(config, 12),
  );
  const porcentaje = modo === 'stacked100';
  const totales = categories.map((_, i) => series.reduce((s, serie) => s + serie.data[i], 0) || 1);
  const paleta = colores(palette);
  const ultima = series.length - 1;
  return {
    color: paleta,
    grid: { top: 40, right: 18, bottom: 30, left: 12, containLabel: true },
    legend: leyenda(palette),
    xAxis: horizontal ? ejeValor(palette, porcentaje ? (v) => `${v}%` : cifraCorta) : ejeCategoria(palette, categories),
    yAxis: horizontal ? ejeCategoria(palette, categories) : ejeValor(palette, porcentaje ? (v) => `${v}%` : cifraCorta),
    tooltip: {
      trigger: 'axis' as const,
      axisPointer: { type: 'shadow' as const },
      valueFormatter: (v: unknown) => (porcentaje ? `${Number(v).toFixed(1)}%` : formato(Number(v))),
    },
    dataZoom: horizontal ? undefined : zoomDeTiempo(palette, categories.length, 16),
    toolbox: herramientas(palette, entorno.titulo, ['line', 'bar', 'stack']),
    series: series.map((serie, i) => ({
      name: serie.name,
      type: 'bar' as const,
      stack: modo === 'grouped' ? undefined : 'total',
      barMaxWidth: 28,
      emphasis: { focus: 'series' as const },
      itemStyle: {
        borderRadius: modo === 'grouped' || i === ultima ? (horizontal ? RADIO_HORIZONTAL : RADIO_VERTICAL) : 0,
      },
      data: porcentaje ? serie.data.map((v, idx) => Math.round((v / totales[idx]) * 1000) / 10) : [...serie.data],
    })),
  };
}

interface TramoDeCascada {
  readonly base: number;
  readonly positivo: number;
  readonly negativo: number;
}

function tramoDeCascada(inicio: number, fin: number): TramoDeCascada {
  const bajo = Math.min(inicio, fin);
  const alto = Math.max(inicio, fin);
  if (bajo >= 0) return { base: bajo, positivo: alto - bajo, negativo: 0 };
  if (alto <= 0) return { base: alto, positivo: 0, negativo: bajo - alto };
  return { base: 0, positivo: alto, negativo: bajo };
}

export function cascada(pedido: Pedido): ChartOption {
  const { config, movs, entorno } = pedido;
  const { palette } = entorno;
  const horizontal = config.variant === 'horizontal';
  const todos = agregar(movs, dimensionDe(config, 'date'), config.measure ?? 'net', entorno.ctx);
  const limite = limiteDe(config, 18);
  const datos =
    todos.length > limite
      ? [
          ...todos.slice(0, limite),
          {
            key: 'otros',
            label: entorno.ctx.t('charts.others'),
            value: todos.slice(limite).reduce((suma, d) => suma + d.value, 0),
          },
        ]
      : todos;
  let acumulado = 0;
  const tramos: TramoDeCascada[] = [];
  const colores: string[] = [];
  const cambios: number[] = [];
  for (const d of datos) {
    tramos.push(tramoDeCascada(acumulado, acumulado + d.value));
    colores.push(d.value >= 0 ? palette.success : palette.danger);
    cambios.push(d.value);
    acumulado += d.value;
  }
  tramos.push(tramoDeCascada(0, acumulado));
  colores.push(palette.accent);
  cambios.push(acumulado);
  const etiquetas = [...datos.map((d) => d.label), entorno.ctx.t('charts.waterfall.total')];
  const visibles = (valor: (t: TramoDeCascada) => number) =>
    tramos.map((t, i) => ({ value: valor(t), itemStyle: { color: colores[i], borderRadius: 4 } }));
  const etiqueta = (position: 'top' | 'bottom' | 'right' | 'left', mostrar: (i: number) => boolean) => ({
    show: datos.length <= 10,
    position,
    color: palette.muted,
    formatter: (p: { dataIndex: number }) => (mostrar(p.dataIndex) ? cifraCorta(cambios[p.dataIndex]) : ''),
  });
  return {
    grid: { top: 24, right: 18, bottom: 30, left: 12, containLabel: true },
    xAxis: horizontal ? ejeValor(palette) : ejeCategoria(palette, etiquetas),
    yAxis: horizontal ? ejeCategoria(palette, etiquetas) : ejeValor(palette),
    tooltip: {
      trigger: 'axis' as const,
      axisPointer: { type: 'shadow' as const },
      formatter: (p: { name: string; dataIndex: number }[]) =>
        p.length ? `${p[0].name}<br/><b>${entorno.dinero(cambios[p[0].dataIndex])}</b>` : '',
    },
    toolbox: herramientas(palette, entorno.titulo),
    series: [
      {
        type: 'bar' as const,
        stack: 'cascada',
        itemStyle: { color: 'transparent' },
        silent: true,
        data: tramos.map((t) => t.base),
      },
      {
        type: 'bar' as const,
        stack: 'cascada',
        barMaxWidth: 30,
        label: etiqueta(horizontal ? 'right' : 'top', (i) => tramos[i].positivo > 0),
        data: visibles((t) => t.positivo),
      },
      {
        type: 'bar' as const,
        stack: 'cascada',
        barMaxWidth: 30,
        label: etiqueta(horizontal ? 'left' : 'bottom', (i) => tramos[i].positivo === 0 && tramos[i].negativo < 0),
        data: visibles((t) => t.negativo),
      },
    ],
  };
}

export function barrasPolares(pedido: Pedido): ChartOption {
  const { config, movs, entorno } = pedido;
  const { palette } = entorno;
  const formato = formatoDe(pedido);
  const datos = agregar(movs, dimensionDe(config), medidaDe(config), entorno.ctx).slice(0, limiteDe(config, 10));
  const radial = (config.variant ?? 'radial') === 'radial';
  const etiquetas = datos.map((d) => d.label);
  const paleta = colores(palette);
  return {
    polar: { radius: ['18%', '82%'] },
    angleAxis: radial
      ? {
          max: Math.max(1, ...datos.map((d) => d.value)) * 1.1,
          startAngle: 90,
          axisLine: { show: false },
          axisLabel: { show: false },
          splitLine: { show: false },
          axisTick: { show: false },
        }
      : {
          type: 'category' as const,
          data: etiquetas,
          axisLabel: { color: palette.muted },
          axisLine: { lineStyle: { color: palette.line } },
        },
    radiusAxis: radial
      ? {
          type: 'category' as const,
          data: etiquetas,
          axisLabel: { color: palette.muted, fontSize: 11 },
          axisLine: { show: false },
          axisTick: { show: false },
          z: 10,
        }
      : {
          axisLabel: { color: palette.muted, formatter: cifraCorta },
          splitLine: { lineStyle: { color: palette.line, type: 'dashed' as const } },
        },
    tooltip: {
      trigger: 'item' as const,
      formatter: (p: { name: string; value: number }) => `${p.name}<br/><b>${formato(p.value)}</b>`,
    },
    toolbox: herramientas(palette, entorno.titulo),
    series: [
      {
        type: 'bar' as const,
        coordinateSystem: 'polar' as const,
        roundCap: true,
        barWidth: radial ? 10 : undefined,
        itemStyle: { borderRadius: 4 },
        data: datos.map((d, i) => ({
          value: d.value,
          name: d.label,
          id: d.label,
          itemStyle: { color: paleta[i % paleta.length] },
        })),
      },
    ],
  };
}

const SIMBOLOS: Record<string, string> = {
  bars: 'roundRect',
  dots: 'circle',
  diamonds: 'diamond',
};

export function pictorica(pedido: Pedido): ChartOption {
  const { config, movs, entorno } = pedido;
  const { palette } = entorno;
  const formato = formatoDe(pedido);
  const datos = agregar(movs, dimensionDe(config), medidaDe(config), entorno.ctx)
    .slice(0, limiteDe(config, 8))
    .reverse();
  const simbolo = SIMBOLOS[config.variant ?? 'bars'] ?? 'roundRect';
  const max = Math.max(1, ...datos.map((d) => d.value));
  return {
    grid: { top: 12, right: 60, bottom: 12, left: 12, containLabel: true },
    xAxis: { type: 'value' as const, max, show: false },
    yAxis: ejeCategoria(
      palette,
      datos.map((d) => d.label),
      { axisLine: { show: false } },
    ),
    tooltip: {
      trigger: 'axis' as const,
      axisPointer: { type: 'none' as const },
      valueFormatter: (v: unknown) => formato(Number(v)),
    },
    series: [
      {
        type: 'pictorialBar' as const,
        symbol: simbolo,
        symbolRepeat: 'fixed' as const,
        symbolMargin: '12%',
        symbolClip: true,
        symbolSize: [14, 14],
        symbolBoundingData: max,
        itemStyle: { color: palette.accent },
        label: {
          show: true,
          position: 'right' as const,
          offset: [8, 0],
          color: palette.muted,
          formatter: (p: { value: number }) => cifraCorta(p.value),
        },
        data: datos.map((d) => ({ value: d.value, id: d.label })),
        z: 10,
      },
      {
        type: 'pictorialBar' as const,
        symbol: simbolo,
        symbolRepeat: 'fixed' as const,
        symbolMargin: '12%',
        symbolSize: [14, 14],
        symbolBoundingData: max,
        itemStyle: { color: conAlfa(palette.accent, 0.14) },
        silent: true,
        animation: false,
        data: datos.map((d) => d.value),
        z: 5,
      },
    ],
  };
}
