import { describe, expect, it } from 'vitest';
import {
  ApiMovementKindSpec,
  CashFlow,
  EconomicEffect,
  MovementKind,
  MovementKindCatalog,
  MovementLink,
  signOf,
} from './movement-kinds';

function spec(partial: Partial<ApiMovementKindSpec> & { kind: number }): ApiMovementKindSpec {
  return {
    allowedEffects: [],
    allowedFlows: [],
    requiredLinks: [],
    forbiddenLinks: [],
    exactlyOneOfLinks: [],
    isAlwaysNeutral: false,
    ...partial,
  };
}

const catalogo = new MovementKindCatalog([
  spec({ kind: MovementKind.income, allowedEffects: [EconomicEffect.income], allowedFlows: [CashFlow.inflow] }),
  spec({ kind: MovementKind.expense, allowedEffects: [EconomicEffect.expense], allowedFlows: [CashFlow.outflow] }),
  spec({
    kind: MovementKind.transferOut,
    allowedFlows: [CashFlow.outflow],
    requiredLinks: [MovementLink.account],
    forbiddenLinks: [MovementLink.category],
    isAlwaysNeutral: true,
  }),
  spec({
    kind: MovementKind.transferIn,
    allowedFlows: [CashFlow.inflow],
    requiredLinks: [MovementLink.account],
    forbiddenLinks: [MovementLink.category],
    isAlwaysNeutral: true,
  }),
  spec({
    kind: MovementKind.cardPayment,
    allowedFlows: [CashFlow.outflow],
    requiredLinks: [MovementLink.card],
    forbiddenLinks: [MovementLink.category],
    isAlwaysNeutral: true,
  }),
  spec({ kind: MovementKind.cardInterest, allowedEffects: [EconomicEffect.expense], allowedFlows: [CashFlow.none] }),
]);

describe('catálogo de clases de movimiento', () => {
  it('deriva la familia de la tabla publicada, no de números escritos a mano', () => {
    expect(catalogo.family(MovementKind.income)).toBe('income');
    expect(catalogo.family(MovementKind.expense)).toBe('expense');
    expect(catalogo.family(MovementKind.transferOut)).toBe('transfer');
    expect(catalogo.family(MovementKind.transferIn)).toBe('transfer');
    expect(catalogo.family(MovementKind.cardPayment)).toBe('payment');
  });

  it('distingue el pago de tarjeta del traslado por el enlace obligatorio', () => {
    expect(catalogo.spec(MovementKind.cardPayment)!.requiredLinks).toContain(MovementLink.card);
    expect(catalogo.spec(MovementKind.transferOut)!.requiredLinks).not.toContain(MovementLink.card);
  });

  it('marca como neutras las clases que nunca son ingreso ni gasto', () => {
    expect(catalogo.isAlwaysNeutral(MovementKind.cardPayment)).toBe(true);
    expect(catalogo.isAlwaysNeutral(MovementKind.expense)).toBe(false);
  });

  it('cae al efecto del propio movimiento cuando la clase no está en la tabla', () => {
    expect(catalogo.family(999, EconomicEffect.income, CashFlow.inflow)).toBe('income');
    expect(catalogo.family(999, EconomicEffect.expense, CashFlow.none)).toBe('expense');
    expect(catalogo.family(999, EconomicEffect.neutral, CashFlow.outflow)).toBe('transfer');
  });

  it('el signo sale del flujo de caja, y del efecto sólo cuando no hay flujo', () => {
    expect(signOf(CashFlow.outflow, EconomicEffect.neutral)).toBe(-1);
    expect(signOf(CashFlow.inflow, EconomicEffect.income)).toBe(1);
    expect(signOf(CashFlow.none, EconomicEffect.expense)).toBe(-1);
    expect(signOf(CashFlow.none, EconomicEffect.income)).toBe(1);
  });

  it('un devengo de interés resta aunque no mueva saldo', () => {
    expect(signOf(CashFlow.none, EconomicEffect.expense)).toBe(-1);
    expect(catalogo.family(MovementKind.cardInterest)).toBe('expense');
  });
});
