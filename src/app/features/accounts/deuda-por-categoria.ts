import { PRIORIDAD_EN_DOLARES, PRIORIDAD_EN_PESOS, completarPrioridad } from '@core/api';
import type { Account, Movement } from '@core/state';
import { comprasPendientes, ordenDeAbono } from '@shared/tarjetas';

function prioridadDe(tarjeta: Account) {
  return tarjeta.currency && tarjeta.currency !== 'COP'
    ? completarPrioridad(tarjeta.foreignPaymentPriority, PRIORIDAD_EN_DOLARES)
    : completarPrioridad(tarjeta.paymentPriority, PRIORIDAD_EN_PESOS);
}

export function deudaPendienteComoMovimientos(
  tarjetas: readonly Account[],
  movimientos: readonly Movement[],
): Movement[] {
  const porId = new Map(movimientos.map((movimiento) => [movimiento.id, movimiento]));
  return tarjetas.flatMap((tarjeta) => {
    const propios = movimientos.filter((movimiento) => movimiento.accountId === tarjeta.id);
    const orden = ordenDeAbono(prioridadDe(tarjeta), tarjeta.applyPaymentPriority !== false);
    return comprasPendientes(propios, orden).flatMap((compra) => {
      const original = porId.get(compra.id);
      return original ? [{ ...original, amount: -compra.pendiente }] : [];
    });
  });
}
