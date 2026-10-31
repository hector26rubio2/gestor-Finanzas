import type { ChartPalette } from './chart-theme';

export const LARGO_MAXIMO_DE_ETIQUETA = 18;
export const ANCHO_DE_ETIQUETA_DE_EJE = 96;
export const ANCHO_MAXIMO_CON_LEYENDA_ABAJO = 440;

export function recortarEtiqueta(texto: string, maximo = LARGO_MAXIMO_DE_ETIQUETA): string {
  return texto.length <= maximo ? texto : `${texto.slice(0, Math.max(1, maximo - 1)).trimEnd()}…`;
}

export function etiquetaDeEjeRecortada(palette: ChartPalette, extra: Record<string, unknown> = {}) {
  return { color: palette.muted, width: ANCHO_DE_ETIQUETA_DE_EJE, overflow: 'truncate' as const, ...extra };
}

export function leyendaDeGrafica(palette: ChartPalette, extra: Record<string, unknown> = {}) {
  return {
    type: 'scroll' as const,
    textStyle: { color: palette.muted },
    pageTextStyle: { color: palette.muted },
    pageIconColor: palette.accent,
    pageIconInactiveColor: palette.line,
    icon: 'circle',
    itemWidth: 10,
    itemHeight: 10,
    formatter: (nombre: string) => recortarEtiqueta(nombre),
    tooltip: { show: true },
    ...extra,
  };
}

export function leyendaLateral(palette: ChartPalette, extra: Record<string, unknown> = {}) {
  return leyendaDeGrafica(palette, {
    orient: 'vertical' as const,
    right: 0,
    top: 'middle',
    width: '34%',
    height: '80%',
    ...extra,
  });
}

export function mediaConLeyendaAbajo(centro: [string, string], radio: [string, string] | string) {
  const option = {
    legend: {
      orient: 'horizontal' as const,
      left: 'center',
      right: 'auto',
      top: 'auto',
      bottom: 0,
      width: '92%',
      height: 'auto',
    },
    series: [{ center: centro, radius: radio }],
  };
  return [
    { query: { maxWidth: ANCHO_MAXIMO_CON_LEYENDA_ABAJO }, option },
    { query: { maxAspectRatio: 1.2 }, option },
  ];
}

export function etiquetaDeCentro(palette: ChartPalette, valor: string, etiqueta: string) {
  const partido = valor.includes(' ') && valor.length > 9;
  const indice = valor.indexOf(' ');
  const encabezado = partido ? valor.slice(0, indice) : '';
  const cifra = partido ? valor.slice(indice + 1) : valor;
  const tamano = cifra.length <= 7 ? 24 : cifra.length <= 10 ? 19 : 16;
  return {
    show: true,
    position: 'center' as const,
    formatter: () => `${partido ? `{pie|${encabezado}}\n` : ''}{valor|${cifra}}\n{pie|${etiqueta}}`,
    rich: {
      valor: { color: palette.text, fontSize: tamano, fontWeight: 700, lineHeight: tamano + 6 },
      pie: { color: palette.muted, fontSize: 13, lineHeight: 18 },
    },
  };
}
