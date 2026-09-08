/**
 * Catálogo de clases de movimiento, construido con la tabla que publica el
 * backend en `GET /api/v1/movement-kinds`.
 *
 * `HANDOFF.md` §1 decide que `MovementKindSpecDto` viaje **como dato** para que
 * no existan dos verdades. El cliente escribía a mano `kind === 10 || kind === 11`
 * y la misma expresión de signo copiada en tres archivos: reordenar un enum en
 * `Contracts` pasaba las pruebas del backend y rompía los signos de la interfaz
 * en silencio. Aquí las constantes tienen nombre y la familia se deriva de la
 * tabla, no de números escritos a mano.
 */

/** Espejo de `MovementKindDto`. Los valores numéricos son parte del contrato. */
export const MovementKind = {
  income: 1,
  expense: 2,
  openingBalance: 3,
  transferOut: 10,
  transferIn: 11,
  cardPurchase: 20,
  cardPayment: 21,
  cardInterest: 22,
  cardFee: 23,
  investmentContribution: 30,
  investmentWithdrawal: 31,
  investmentBuy: 32,
  investmentSell: 33,
  investmentDividend: 34,
  investmentFee: 35,
  loanDisbursement: 40,
  loanCharge: 41,
  loanInterest: 42,
  loanRepayment: 43,
  loanAdjustment: 44,
} as const;

/** Espejo de `EconomicEffectDto`: efecto sobre el resultado del periodo. */
export const EconomicEffect = { neutral: 0, income: 1, expense: 2 } as const;

/** Espejo de `CashFlowDto`: efecto sobre el saldo del instrumento. */
export const CashFlow = { none: 0, inflow: 1, outflow: 2 } as const;

/** Espejo de `MovementLinkDto`, banderas combinables. */
export const MovementLink = {
  none: 0,
  operation: 1,
  account: 2,
  card: 4,
  category: 8,
  counterparty: 16,
  obligation: 32,
  recurrence: 64,
  position: 128,
  sharedPurchase: 256,
} as const;

/** Familia de presentación. No la publica el contrato: se deriva de la tabla. */
export type MovementFamily = 'income' | 'expense' | 'transfer' | 'payment';

export interface ApiMovementKindSpec {
  kind: number;
  allowedEffects: readonly number[];
  allowedFlows: readonly number[];
  requiredLinks: readonly number[];
  forbiddenLinks: readonly number[];
  exactlyOneOfLinks: readonly number[];
  isAlwaysNeutral: boolean;
}

/**
 * El signo depende del flujo de caja, y del efecto económico sólo cuando el
 * movimiento no mueve saldo (un devengo de interés es gasto sin flujo).
 */
export function signOf(flow: number, effect: number): 1 | -1 {
  if (flow === CashFlow.outflow) return -1;
  if (flow === CashFlow.none && effect === EconomicEffect.expense) return -1;
  return 1;
}

export class MovementKindCatalog {
  private readonly byKind: ReadonlyMap<number, ApiMovementKindSpec>;

  constructor(specs: readonly ApiMovementKindSpec[]) {
    this.byKind = new Map(specs.map((spec) => [spec.kind, spec]));
  }

  get size(): number {
    return this.byKind.size;
  }

  spec(kind: number): ApiMovementKindSpec | undefined {
    return this.byKind.get(kind);
  }

  isAlwaysNeutral(kind: number): boolean {
    return this.byKind.get(kind)?.isAlwaysNeutral ?? false;
  }

  /**
   * Deriva la familia de los efectos admitidos y de los enlaces obligatorios:
   * si la clase nunca es ingreso ni gasto y exige una tarjeta, es un pago; si
   * nunca es ingreso ni gasto y no la exige, es un traslado.
   */
  family(kind: number, effect?: number, flow?: number): MovementFamily {
    const spec = this.byKind.get(kind);
    if (!spec) return familyFromEffect(effect, flow);
    if (spec.isAlwaysNeutral || !spec.allowedEffects.length) {
      return spec.requiredLinks.includes(MovementLink.card) ? 'payment' : 'transfer';
    }
    const income = spec.allowedEffects.includes(EconomicEffect.income);
    const expense = spec.allowedEffects.includes(EconomicEffect.expense);
    if (income && !expense) return 'income';
    if (expense && !income) return 'expense';
    return spec.allowedFlows.includes(CashFlow.inflow) && !spec.allowedFlows.includes(CashFlow.outflow)
      ? 'income'
      : 'expense';
  }
}

/**
 * Último recurso cuando la clase no está en la tabla: se lee el propio
 * movimiento. Es menos preciso que la tabla, pero no inventa un gasto.
 */
function familyFromEffect(effect: number | undefined, flow: number | undefined): MovementFamily {
  if (effect === EconomicEffect.income) return 'income';
  if (effect === EconomicEffect.expense) return 'expense';
  if (flow === CashFlow.none) return 'transfer';
  return 'transfer';
}

/** Catálogo vacío: en modo demo los movimientos ya nacen con su familia. */
export const EMPTY_KIND_CATALOG = new MovementKindCatalog([]);
