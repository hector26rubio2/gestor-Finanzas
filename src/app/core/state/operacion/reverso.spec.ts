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

describe('puedeReversar por tipo de movimiento', () => {
  const casos: { tipo: string; movimiento: Movement; cuenta: 'cash' | 'credit'; permiso: string }[] = [
    {
      tipo: 'transferencia',
      movimiento: { ...gasto, movementSubtype: 'transfer' },
      cuenta: 'cash',
      permiso: P.movimientos.transferencias.deshabilitar,
    },
    {
      tipo: 'pago',
      movimiento: { ...gasto, kind: 'payment' },
      cuenta: 'cash',
      permiso: P.movimientos.pagos.deshabilitar,
    },
    {
      tipo: 'avance',
      movimiento: { ...gasto, movementSubtype: 'advance' },
      cuenta: 'credit',
      permiso: P.movimientos.avances.deshabilitar,
    },
    {
      tipo: 'préstamo',
      movimiento: { ...gasto, loanRole: 'lent' },
      cuenta: 'cash',
      permiso: P.movimientos.prestamos.deshabilitar,
    },
    {
      tipo: 'crédito',
      movimiento: gasto,
      cuenta: 'credit',
      permiso: P.movimientos.creditos.deshabilitar,
    },
  ];

  it.each(casos)('$tipo: solo con el permiso general y el de su familia', ({ movimiento, cuenta, permiso }) => {
    expect(puedeReversar(movimiento, cuenta, permitir(P.movimientos.deshabilitar))).toBe(false);
    expect(puedeReversar(movimiento, cuenta, permitir(permiso))).toBe(false);
    expect(puedeReversar(movimiento, cuenta, permitir(P.movimientos.deshabilitar, permiso))).toBe(true);
  });

  it.each(casos)('$tipo: el permiso de otra familia no alcanza', ({ movimiento, cuenta, permiso }) => {
    const ajenos = casos.map((caso) => caso.permiso).filter((otro) => otro !== permiso);
    expect(puedeReversar(movimiento, cuenta, permitir(P.movimientos.deshabilitar, ...ajenos))).toBe(false);
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
