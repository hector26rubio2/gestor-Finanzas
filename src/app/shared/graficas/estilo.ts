import type { ChartPalette } from '@ui/chart';

export function cifraCorta(valor: number): string {
  const absoluto = Math.abs(valor);
  if (absoluto >= 1_000_000) return `${(valor / 1_000_000).toFixed(absoluto >= 10_000_000 ? 0 : 1)} M`;
  if (absoluto >= 1_000) return `${Math.round(valor / 1_000)} k`;
  return String(Math.round(valor * 100) / 100);
}

export function conAlfa(color: string, alfa: number): string {
  const limpio = color.trim();
  if (/^#[0-9a-f]{6}$/i.test(limpio)) {
    const n = parseInt(limpio.slice(1), 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alfa})`;
  }
  if (/^#[0-9a-f]{3}$/i.test(limpio)) return conAlfa('#' + [...limpio.slice(1)].map((c) => c + c).join(''), alfa);
  if (limpio.startsWith('rgb'))
    return limpio.replace(/^rgba?\(([^)]+)\)$/, (_, dentro: string) => {
      const partes = dentro.split(/[,/]/).map((x) => x.trim());
      return `rgba(${partes[0]}, ${partes[1]}, ${partes[2]}, ${alfa})`;
    });
  return `color-mix(in srgb, ${limpio} ${Math.round(alfa * 100)}%, transparent)`;
}

export function degradado(color: string, arriba = 0.32, abajo = 0) {
  return {
    type: 'linear' as const,
    x: 0,
    y: 0,
    x2: 0,
    y2: 1,
    colorStops: [
      { offset: 0, color: conAlfa(color, arriba) },
      { offset: 1, color: conAlfa(color, abajo) },
    ],
  };
}

export function degradadoDeBarra(color: string, horizontal = false) {
  return {
    type: 'linear' as const,
    x: 0,
    y: horizontal ? 0 : 1,
    x2: horizontal ? 1 : 0,
    y2: 0,
    colorStops: [
      { offset: 0, color: conAlfa(color, 0.55) },
      { offset: 1, color },
    ],
  };
}

export function colores(palette: ChartPalette): string[] {
  return [...palette.categorical, '#22c55e', '#f472b6', '#facc15', '#38bdf8'];
}

export function leyenda(palette: ChartPalette, extra: Record<string, unknown> = {}) {
  return {
    type: 'scroll' as const,
    top: 0,
    left: 0,
    right: 84,
    textStyle: { color: palette.muted },
    pageTextStyle: { color: palette.muted },
    pageIconColor: palette.accent,
    icon: 'circle',
    itemWidth: 10,
    itemHeight: 10,
    ...extra,
  };
}

export function ejeCategoria(palette: ChartPalette, datos?: readonly string[], extra: Record<string, unknown> = {}) {
  return {
    type: 'category' as const,
    ...(datos ? { data: [...datos] } : {}),
    axisLine: { lineStyle: { color: palette.line } },
    axisTick: { show: false },
    axisLabel: { color: palette.muted, hideOverlap: true },
    ...extra,
  };
}

export function ejeValor(
  palette: ChartPalette,
  formato: (v: number) => string = cifraCorta,
  extra: Record<string, unknown> = {},
) {
  return {
    type: 'value' as const,
    splitLine: { lineStyle: { color: palette.line, type: 'dashed' as const } },
    axisLabel: { color: palette.muted, formatter: formato },
    ...extra,
  };
}

export function ejesDeIntervalo(palette: ChartPalette, etiquetas: readonly string[], separado = false) {
  return {
    grid: { top: 36, right: 18, bottom: 34, left: 12, containLabel: true },
    xAxis: ejeCategoria(palette, etiquetas, { boundaryGap: separado }),
    yAxis: ejeValor(palette),
  };
}

export function zoomDeTiempo(palette: ChartPalette, puntos: number, umbral = 14) {
  if (puntos <= umbral) return undefined;
  return [
    { type: 'inside' as const, start: 0, end: 100 },
    {
      type: 'slider' as const,
      height: 16,
      bottom: 4,
      borderColor: palette.line,
      backgroundColor: 'transparent',
      fillerColor: conAlfa(palette.accent, 0.14),
      dataBackground: { lineStyle: { color: palette.line }, areaStyle: { color: conAlfa(palette.accent, 0.1) } },
      selectedDataBackground: {
        lineStyle: { color: palette.accent },
        areaStyle: { color: conAlfa(palette.accent, 0.18) },
      },
      handleStyle: { color: palette.surface, borderColor: palette.accent },
      moveHandleStyle: { color: conAlfa(palette.accent, 0.4) },
      textStyle: { color: palette.muted },
    },
  ];
}

export function herramientas(palette: ChartPalette, titulo: string, cambiar?: readonly ('line' | 'bar' | 'stack')[]) {
  return {
    show: true,
    right: 0,
    top: 0,
    itemSize: 12,
    itemGap: 6,
    iconStyle: { borderColor: palette.muted },
    emphasis: { iconStyle: { borderColor: palette.accent } },
    feature: {
      ...(cambiar?.length ? { magicType: { type: [...cambiar] } } : {}),
      dataView: {
        readOnly: true,
        backgroundColor: palette.surface,
        textColor: palette.text,
        textareaColor: palette.surface,
      },
      saveAsImage: { name: titulo, backgroundColor: palette.surface, pixelRatio: 2 },
    },
  };
}
