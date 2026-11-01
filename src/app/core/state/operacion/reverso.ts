import { PERMISO_DE_REVERSO, familiaDeMovimiento } from '@core/session/familia-de-movimiento';
import { P } from '@core/session/permissions';
import { fechaDeReverso } from '@core/utils/dates';
import type { Account, Movement } from '../view-model';

export function puedeReversar(
  movimiento: Movement,
  tipoDeCuenta: Account['type'] | undefined,
  permite: (permiso: string) => boolean,
): boolean {
  if (!permite(P.movimientos.deshabilitar)) return false;
  const familia = familiaDeMovimiento(movimiento, tipoDeCuenta);
  return !familia || permite(PERMISO_DE_REVERSO[familia]);
}

export function solicitudDeReverso(movimiento: Movement, hoy?: string) {
  return {
    date: fechaDeReverso(movimiento.date, hoy),
    reason: 'Reversado desde la aplicación',
  };
}
