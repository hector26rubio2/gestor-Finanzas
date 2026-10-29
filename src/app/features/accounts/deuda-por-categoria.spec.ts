import { describe, expect, it } from 'vitest';
import type { Account, Movement } from '@core/state';
import { deudaPendienteComoMovimientos } from './deuda-por-categoria';

const visa = { id: 'visa', name: 'Visa', type: 'credit', currency: 'COP' } as Account;
const master = { id: 'master', name: 'Master', type: 'credit', currency: 'COP' } as Account;

function compra(
  id: string,
  tarjeta: string,
  categoria: string,
  monto: number,
  extra: Partial<Movement> = {},
): Movement {
  return {
    id,
    date: '2026-10-10',
    description: id,
    accountId: tarjeta,
    category: categoria,
    kind: 'expense',
    status: 'confirmed',
    amount: -monto,
    ...extra,
  };
}

const resumen = (movimientos: readonly Movement[]) =>
  movimientos.map((m) => ({ id: m.id, tarjeta: m.accountId, categoria: m.category, monto: m.amount }));

describe('deudaPendienteComoMovimientos', () => {
  it('cada compra pendiente de cada tarjeta queda como gasto por lo que falta pagar, con su categoría', () => {
    const pendientes = deudaPendienteComoMovimientos(
      [visa, master],
      [
        compra('mercado', 'visa', 'Mercado', 100_000),
        compra('viaje', 'visa', 'Viajes', 300_000),
        compra('ropa', 'master', 'Ropa', 80_000),
      ],
    );

    expect(resumen(pendientes)).toEqual(
      expect.arrayContaining([
        { id: 'mercado', tarjeta: 'visa', categoria: 'Mercado', monto: -100_000 },
        { id: 'viaje', tarjeta: 'visa', categoria: 'Viajes', monto: -300_000 },
        { id: 'ropa', tarjeta: 'master', categoria: 'Ropa', monto: -80_000 },
      ]),
    );
    expect(pendientes).toHaveLength(3);
  });

  it('descuenta los abonos y omite lo ya pagado', () => {
    const pendientes = deudaPendienteComoMovimientos(
      [visa],
      [
        compra('mercado', 'visa', 'Mercado', 100_000),
        { ...compra('abono', 'visa', '', 100_000), kind: 'payment', amount: 100_000 },
      ],
    );

    expect(pendientes).toEqual([]);
  });

  it('una compra a cuotas aporta solo lo que falta por pagar', () => {
    const pendientes = deudaPendienteComoMovimientos(
      [visa],
      [compra('tv', 'visa', '', 1_200_000, { installmentTotal: 12, installmentCurrent: 4 })],
    );

    expect(resumen(pendientes)).toEqual([{ id: 'tv', tarjeta: 'visa', categoria: '', monto: -900_000 }]);
  });
});
