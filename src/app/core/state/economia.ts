import type { Movement } from './view-model';

export type EfectoEconomico = NonNullable<Movement['effect']>;

function efectoDe(movimiento: Movement): EfectoEconomico {
  if (movimiento.effect) return movimiento.effect;
  if (movimiento.movementSubtype || movimiento.kind === 'payment') return 'neutral';
  return movimiento.kind;
}

export const esGasto = (movimiento: Movement): boolean => efectoDe(movimiento) === 'expense';

export const esIngreso = (movimiento: Movement): boolean => efectoDe(movimiento) === 'income';

export const esEconomico = (movimiento: Movement): boolean => efectoDe(movimiento) !== 'neutral';

export const montoDeGasto = (movimiento: Movement): number => (esGasto(movimiento) ? -movimiento.amount : 0);

export const montoDeIngreso = (movimiento: Movement): number => (esIngreso(movimiento) ? movimiento.amount : 0);

export function totalDeGastos(movimientos: readonly Movement[]): number {
  return movimientos.reduce((total, movimiento) => total + montoDeGasto(movimiento), 0);
}

export function totalDeIngresos(movimientos: readonly Movement[]): number {
  return movimientos.reduce((total, movimiento) => total + montoDeIngreso(movimiento), 0);
}
