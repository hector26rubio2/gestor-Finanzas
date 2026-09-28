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
  cardCashAdvance: 24,
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

export const EconomicEffect = { neutral: 0, income: 1, expense: 2 } as const;

export const CashFlow = { none: 0, inflow: 1, outflow: 2 } as const;

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

function familyFromEffect(effect: number | undefined, flow: number | undefined): MovementFamily {
  if (effect === EconomicEffect.income) return 'income';
  if (effect === EconomicEffect.expense) return 'expense';
  if (flow === CashFlow.none) return 'transfer';
  return 'transfer';
}

export const EMPTY_KIND_CATALOG = new MovementKindCatalog([]);

export function classifyFamily(
  family: MovementFamily,
  amount: number,
): { kind: 'income' | 'expense' | 'payment'; movementSubtype?: 'transfer' } {
  if (family === 'payment') return { kind: 'payment' };
  if (family === 'transfer') return { kind: amount < 0 ? 'expense' : 'income', movementSubtype: 'transfer' };
  return { kind: family };
}
