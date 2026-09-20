import { Movement } from '../../core/state/demo-data';

export interface LongestInstallmentDebt {
  description: string;
  remaining: number;
  total: number;
}

export interface TopSpendingCategory {
  category: string;
  amount: number;
}

const isPlainExpense = (movement: Movement): boolean => movement.kind === 'expense' && !movement.movementSubtype;

export function recurringExpenseCount(movements: readonly Movement[]): number {
  return movements.filter((movement) => isPlainExpense(movement) && movement.recurring).length;
}

export function longestInstallmentDebt(movements: readonly Movement[]): LongestInstallmentDebt | null {
  const latestByPurchase = new Map<string, Movement>();
  for (const movement of movements) {
    const total = movement.installmentTotal ?? 0;
    if (total <= 1 || movement.installmentCurrent === undefined) continue;
    const key = `${movement.accountId}|${movement.description}|${total}`;
    const known = latestByPurchase.get(key);
    if (!known || (movement.installmentCurrent ?? 0) > (known.installmentCurrent ?? 0)) latestByPurchase.set(key, movement);
  }
  const debts = [...latestByPurchase.values()]
    .map((movement) => ({
      description: movement.description,
      total: movement.installmentTotal!,
      remaining: movement.installmentTotal! - movement.installmentCurrent!,
    }))
    .filter((debt) => debt.remaining > 0)
    .sort((a, b) => b.remaining - a.remaining);
  return debts[0] ?? null;
}

export function topSpendingCategory(movements: readonly Movement[]): TopSpendingCategory | null {
  const totals = new Map<string, number>();
  for (const movement of movements) {
    if (!isPlainExpense(movement)) continue;
    totals.set(movement.category, (totals.get(movement.category) ?? 0) + Math.abs(movement.amount));
  }
  const [top] = [...totals.entries()].sort((a, b) => b[1] - a[1]);
  return top ? { category: top[0], amount: top[1] } : null;
}
