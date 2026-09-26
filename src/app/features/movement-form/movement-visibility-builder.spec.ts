import { describe, expect, it } from 'vitest';
import type { Account } from '../../core/state/demo-data';
import { MovementVisibilityBuilder } from './movement-visibility-builder';

const tarjeta: Account = { id: 'c', name: 'Visa', type: 'credit', currency: 'COP', openingBalance: 0 };
const ahorros: Account = { id: 'a', name: 'Ahorros', type: 'savings', currency: 'COP', openingBalance: 0 };
const ver = (kind: string, cuenta: Account, operacion = 'normal') =>
  new MovementVisibilityBuilder(kind, cuenta, false, operacion).withAll().build();

describe('MovementVisibilityBuilder', () => {
  it('un gasto normal ofrece recurrencia y, con tarjeta, cuotas', () => {
    expect(ver('expense', tarjeta).showRecurrence).toBe(true);
    expect(ver('expense', tarjeta).showInstallments).toBe(true);
  });

  it('un préstamo o un crédito no ofrecen recurrencia ni cuotas de tarjeta', () => {
    for (const operacion of ['loan', 'credit']) {
      expect(ver('expense', ahorros, operacion).showRecurrence).toBe(false);
      expect(ver('expense', tarjeta, operacion).showInstallments).toBe(false);
    }
  });

  it('transferencia y avance no clasifican ni recurren', () => {
    for (const tipo of ['transfer', 'advance']) {
      const visible = ver(tipo, ahorros, tipo);
      expect(visible.showRecurrence).toBe(false);
      expect(visible.showCategory).toBe(false);
      expect(visible.showTargetAccount).toBe(true);
    }
  });
});
