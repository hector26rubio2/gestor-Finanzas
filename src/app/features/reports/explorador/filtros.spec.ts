import { describe, expect, it } from 'vitest';
import type { Movement } from '@core/state';
import { filtrarMovimientos } from './filtros';

const movimiento = (parcial: Partial<Movement>): Movement => ({
  id: 'm',
  date: '2026-10-05',
  description: '',
  accountId: 'a1',
  category: 'x',
  kind: 'expense',
  amount: -1,
  status: 'confirmed',
  ...parcial,
});

const todos = { cuenta: 'all', categoria: 'all', flujo: 'all' } as const;

describe('filtrarMovimientos', () => {
  it('excluye transferencias, pagos de tarjeta y avances para cuadrar con el resumen', () => {
    const movimientos = [
      movimiento({ id: 'ingreso', kind: 'income', amount: 1_000_000 }),
      movimiento({ id: 'gasto', amount: -300_000 }),
      movimiento({ id: 'transferencia', kind: 'income', amount: 500_000, movementSubtype: 'transfer' }),
      movimiento({ id: 'pago', kind: 'payment', amount: -200_000 }),
      movimiento({ id: 'avance', kind: 'income', amount: 400_000, movementSubtype: 'advance' }),
    ];
    const filtrados = filtrarMovimientos(movimientos, todos);
    expect(filtrados.map((m) => m.id)).toEqual(['ingreso', 'gasto']);
    expect(filtrados.reduce((suma, m) => suma + m.amount, 0)).toBe(700_000);
  });

  it('aplica cuenta, categoría y signo', () => {
    const movimientos = [
      movimiento({ id: 'a', accountId: 'a1', category: 'x', kind: 'income', amount: 10 }),
      movimiento({ id: 'b', accountId: 'a2', category: 'x', amount: -10 }),
      movimiento({ id: 'c', accountId: 'a1', category: 'y', amount: -10 }),
    ];
    expect(filtrarMovimientos(movimientos, { cuenta: 'a1', categoria: 'all', flujo: 'all' }).map((m) => m.id)).toEqual([
      'a',
      'c',
    ]);
    expect(filtrarMovimientos(movimientos, { cuenta: 'all', categoria: 'x', flujo: 'out' }).map((m) => m.id)).toEqual([
      'b',
    ]);
  });
});
