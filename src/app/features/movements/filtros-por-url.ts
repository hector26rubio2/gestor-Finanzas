const PERIODO = /^\d{4}(-(0[1-9]|1[0-2]))?$/;
const IDENTIFICADOR = /^[\w-]{1,64}$/;

export type EscalaDelTablero = 'day' | 'week' | 'month' | 'year';

export function esPeriodoValido(valor: string): boolean {
  return PERIODO.test(valor);
}

export function esCuentaValida(valor: string): boolean {
  return IDENTIFICADOR.test(valor);
}

export function periodoDeLaEscala(escala: EscalaDelTablero, inicio: string): string {
  return escala === 'year' ? inicio.slice(0, 4) : inicio.slice(0, 7);
}
