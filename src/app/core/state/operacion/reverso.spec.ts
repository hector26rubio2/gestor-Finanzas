import { describe, expect, it } from 'vitest';
import { P } from '@core/session/permissions';
import type { Movement } from '../view-model';
import { puedeReversar, solicitudDeReverso } from './reverso';

const gasto: Movement = {
  id: 'mov-1',
  date: '2026-09-01',
  description: 'Mercado',
  accountId: 'c1',
  category: 'Mercado',
  kind: 'expense',
  amount: -1000,
  status: 'confirmed',
};

const permitir =
  (...permisos: string[]) =>
  (permiso: string) =>
    permisos.includes(permiso);

describe('puedeReversar', () => {
  it('permitido con el permiso general cuando el movimiento no tiene familia', () => {
    expect(puedeReversar(gasto, 'cash', permitir(P.movimientos.deshabilitar))).toBe(true);
  });

  it('no permitido sin el permiso general', () => {
    expect(puedeReversar(gasto, 'cash', permitir())).toBe(false);
  });

  it('una transferencia exige además el permiso de su familia', () => {
    const transferencia: Movement = { ...gasto, movementSubtype: 'transfer' };
    expect(puedeReversar(transferencia, 'cash', permitir(P.movimientos.deshabilitar))).toBe(false);
    expect(
      puedeReversar(
        transferencia,
        'cash',
        permitir(P.movimientos.deshabilitar, P.movimientos.transferencias.deshabilitar),
      ),
    ).toBe(true);
  });

  it('una compra en tarjeta exige el permiso de creditos', () => {
    expect(puedeReversar(gasto, 'credit', permitir(P.movimientos.deshabilitar))).toBe(false);
    expect(
      puedeReversar(gasto, 'credit', permitir(P.movimientos.deshabilitar, P.movimientos.creditos.deshabilitar)),
    ).toBe(true);
  });
});

describe('solicitudDeReverso', () => {
  it('fecha del reverso: hoy, o la del movimiento si es futura, con motivo fijo', () => {
    expect(solicitudDeReverso(gasto, '2026-10-08')).toEqual({
      date: '2026-10-08',
      reason: 'Reversado desde la aplicación',
    });
    expect(solicitudDeReverso({ ...gasto, date: '2026-12-01' }, '2026-10-08').date).toBe('2026-12-01');
  });
});
