import { describe, expect, it } from 'vitest';
import { Movement } from '../../core/state/demo-data';
import { longestInstallmentDebt, recurringExpenseCount, topSpendingCategory } from './movement-insights';

const movement = (extra: Partial<Movement>): Movement => ({
  id: Math.random().toString(),
  date: '2026-09-01',
  description: 'x',
  accountId: 'a',
  category: 'Comida',
  kind: 'expense',
  amount: -100,
  status: 'confirmed',
  ...extra,
});

describe('recurringExpenseCount', () => {
  it('cuenta solo gastos recurrentes', () => {
    const list = [
      movement({ recurring: true }),
      movement({ recurring: true, kind: 'income', amount: 100 }),
      movement({ recurring: false }),
      movement({ recurring: true, movementSubtype: 'transfer' } as Partial<Movement>),
    ];
    expect(recurringExpenseCount(list)).toBe(1);
  });
});

describe('longestInstallmentDebt', () => {
  it('usa la cuota más reciente de cada compra y elige la que más cuotas le faltan', () => {
    const list = [
      movement({ description: 'Nevera', installmentCurrent: 1, installmentTotal: 12 }),
      movement({ description: 'Nevera', installmentCurrent: 4, installmentTotal: 12 }),
      movement({ description: 'Celular', installmentCurrent: 2, installmentTotal: 6 }),
    ];
    expect(longestInstallmentDebt(list)).toEqual({ description: 'Nevera', remaining: 8, total: 12 });
  });

  it('ignora compras ya terminadas y devuelve null si no hay cuotas', () => {
    expect(longestInstallmentDebt([movement({ installmentCurrent: 6, installmentTotal: 6 })])).toBeNull();
    expect(longestInstallmentDebt([movement({})])).toBeNull();
  });
});

describe('topSpendingCategory', () => {
  it('suma los gastos por categoría y devuelve la mayor', () => {
    const list = [
      movement({ category: 'Comida', amount: -300 }),
      movement({ category: 'Ocio', amount: -200 }),
      movement({ category: 'Ocio', amount: -150 }),
      movement({ category: 'Sueldo', kind: 'income', amount: 9000 }),
    ];
    expect(topSpendingCategory(list)).toEqual({ category: 'Ocio', amount: 350 });
  });

  it('devuelve null sin gastos', () => {
    expect(topSpendingCategory([])).toBeNull();
  });
});
