import type { ChartThemeService } from '../../ui/chart/chart-theme';

export type ChartPalette = ReturnType<ChartThemeService['palette']>;

export function cifraCorta(valor: number): string {
  const absoluto = Math.abs(valor);
  if (absoluto >= 1_000_000) return `${(valor / 1_000_000).toFixed(absoluto >= 10_000_000 ? 0 : 1)} M`;
  if (absoluto >= 1_000) return `${Math.round(valor / 1_000)} k`;
  return String(valor);
}

export function conAlfa(color: string, alfa: number): string {
  const limpio = color.trim();
  if (/^#[0-9a-f]{6}$/i.test(limpio)) {
    const n = parseInt(limpio.slice(1), 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alfa})`;
  }
  if (limpio.startsWith('rgb'))
    return limpio.replace(/^rgba?\(([^)]+)\)$/, (_, dentro: string) => {
      const partes = dentro.split(/[,/]/).map((x) => x.trim());
      return `rgba(${partes[0]}, ${partes[1]}, ${partes[2]}, ${alfa})`;
    });
  return `color-mix(in srgb, ${limpio} ${Math.round(alfa * 100)}%, transparent)`;
}

export function degradado(color: string) {
  return {
    type: 'linear' as const,
    x: 0,
    y: 0,
    x2: 0,
    y2: 1,
    colorStops: [
      { offset: 0, color: conAlfa(color, 0.28) },
      { offset: 1, color: conAlfa(color, 0) },
    ],
  };
}

export function ejesDeIntervalo(palette: ChartPalette, etiquetas: readonly string[]) {
  return {
    grid: { top: 28, right: 18, bottom: 34, left: 62 },
    xAxis: {
      type: 'category' as const,
      data: [...etiquetas],
      boundaryGap: false,
      axisLine: { lineStyle: { color: palette.line } },
      axisTick: { show: false },
      axisLabel: { color: palette.muted, hideOverlap: true },
    },
    yAxis: {
      type: 'value' as const,
      splitLine: { lineStyle: { color: palette.line, type: 'dashed' as const } },
      axisLabel: { color: palette.muted, formatter: (valor: number) => cifraCorta(valor) },
    },
  };
}
