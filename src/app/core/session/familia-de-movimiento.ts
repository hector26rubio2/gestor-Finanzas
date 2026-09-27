import { P } from './permissions';
import type { Account, Movement } from '@core/state';

export type FamiliaDeMovimiento = 'transferencias' | 'pagos' | 'avances' | 'prestamos' | 'creditos';

export function familiaDeMovimiento(
  movimiento: Pick<Movement, 'movementSubtype' | 'kind' | 'loanRole'>,
  tipoDeCuenta?: Account['type'],
): FamiliaDeMovimiento | null {
  if (movimiento.movementSubtype === 'transfer') return 'transferencias';
  if (movimiento.movementSubtype === 'advance') return 'avances';
  if (movimiento.kind === 'payment') return 'pagos';
  if (movimiento.loanRole) return 'prestamos';
  if (tipoDeCuenta === 'credit') return 'creditos';
  return null;
}

export const PERMISO_DE_REVERSO: Readonly<Record<FamiliaDeMovimiento, string>> = {
  transferencias: P.movimientos.transferencias.deshabilitar,
  pagos: P.movimientos.pagos.deshabilitar,
  avances: P.movimientos.avances.deshabilitar,
  prestamos: P.movimientos.prestamos.deshabilitar,
  creditos: P.movimientos.creditos.deshabilitar,
};
