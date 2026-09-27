import { describe, expect, it } from 'vitest';
import type { Account } from '@core/state';
import { MovementVisibilityBuilder } from './movement-visibility-builder';

const tarjeta: Account = { id: 'c', name: 'Visa', type: 'credit', currency: 'COP', openingBalance: 0 };
const ahorros: Account = { id: 'a', name: 'Ahorros', type: 'savings', currency: 'COP', openingBalance: 0 };
const ver = (kind: string, cuenta: Account, operacion = 'normal') =>
  new MovementVisibilityBuilder(kind, cuenta, false, operacion).withAll().build();

describe('MovementVisibilityBuilder', () => {
  it('una compra con tarjeta ofrece recurrencia y cuotas', () => {
    expect(ver('expense', tarjeta).showRecurrence).toBe(true);
    expect(ver('expense', tarjeta).showInstallments).toBe(true);
  });

  it('préstamo y crédito piden tasa y plazo, sin categoría ni recurrencia', () => {
    for (const [tipo, operacion] of [
      ['expense', 'loan'],
      ['income', 'loan'],
      ['income', 'credit'],
    ]) {
      const visible = ver(tipo, ahorros, operacion);
      expect(visible.showLoanTerms).toBe(true);
      expect(visible.showCategory).toBe(false);
      expect(visible.showRecurrence).toBe(false);
    }
  });

  it('un crédito se relaciona con una entidad y un préstamo con una persona', () => {
    expect(ver('income', ahorros, 'credit').counterparty).toBe('institution');
    expect(ver('income', ahorros, 'credit').showLoanProduct).toBe(true);
    expect(ver('expense', ahorros, 'loan').counterparty).toBe('person');
  });

  it('un préstamo desde una tarjeta pregunta si fue compra o avance', () => {
    expect(ver('expense', tarjeta, 'loan').showCardMode).toBe(true);
    expect(ver('expense', ahorros, 'loan').showCardMode).toBe(false);
  });

  it('el avance pide cuotas y tasa, y no clasifica', () => {
    const visible = ver('expense', tarjeta, 'advance');
    expect(visible.showInstallments).toBe(true);
    expect(visible.showTargetAccount).toBe(true);
    expect(visible.showCategory).toBe(false);
  });

  it('una transferencia recibida pregunta quién envió y admite categoría', () => {
    const visible = ver('income', ahorros, 'received');
    expect(visible.counterparty).toBe('any');
    expect(visible.showCategory).toBe(true);
    expect(visible.showTargetAccount).toBe(false);
  });
});
