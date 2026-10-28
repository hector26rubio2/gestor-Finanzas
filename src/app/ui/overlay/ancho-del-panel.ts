export const PROPORCION_MAXIMA = 0.92;

export function limitarAncho(propuesto: number, minimo: number, anchoDePantalla: number): number {
  const maximo = Math.round(anchoDePantalla * PROPORCION_MAXIMA);
  return Math.round(Math.min(Math.max(propuesto, Math.min(minimo, maximo)), maximo));
}

export function anchoAlArrastrar(anchoDePantalla: number, punteroX: number, minimo: number): number {
  return limitarAncho(anchoDePantalla - punteroX, minimo, anchoDePantalla);
}
