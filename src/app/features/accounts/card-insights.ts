import { Account, Movement } from '../../core/state/demo-data';

export const HEALTHY_UTILIZATION_PERCENT = 50;
const RECENT_USAGE_DAYS = 30;
const MS_PER_DAY = 86_400_000;

export interface CardDue {
  account: Account;
  days: number;
  date: string;
}

export interface CardUsage {
  account: Account;
  movements: number;
}

export interface CardUtilization {
  account: Account;
  percent: number;
  overHealthyPoints: number;
}

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

function startOfDay(iso: string): number {
  const [year, month, day] = iso.split('-').map(Number);
  return Date.UTC(year, month - 1, day);
}

function dueDateOnOrAfter(today: string, dueDay: number): string {
  const [year, month, day] = today.split('-').map(Number);
  const thisMonthDay = Math.min(dueDay, daysInMonth(year, month - 1));
  const target =
    thisMonthDay >= day
      ? new Date(Date.UTC(year, month - 1, thisMonthDay))
      : new Date(Date.UTC(year, month, Math.min(dueDay, daysInMonth(year, month))));
  return target.toISOString().slice(0, 10);
}

export function creditCards(accounts: readonly Account[]): Account[] {
  return accounts.filter((account) => account.type === 'credit');
}

export function nextCardDue(
  cards: readonly Account[],
  debtOf: (card: Account) => number,
  today: string,
): CardDue | null {
  const due = cards
    .filter((card) => card.dueDay && debtOf(card) > 0)
    .map((card) => {
      const date = dueDateOnOrAfter(today, card.dueDay!);
      return { account: card, date, days: Math.round((startOfDay(date) - startOfDay(today)) / MS_PER_DAY) };
    })
    .sort((a, b) => a.days - b.days);
  return due[0] ?? null;
}

export function mostUsedCard(
  cards: readonly Account[],
  movements: readonly Movement[],
  today: string,
): CardUsage | null {
  const since = startOfDay(today) - RECENT_USAGE_DAYS * MS_PER_DAY;
  const usage = cards
    .map((card) => ({
      account: card,
      movements: movements.filter((movement) => movement.accountId === card.id && startOfDay(movement.date) >= since)
        .length,
    }))
    .filter((entry) => entry.movements > 0)
    .sort((a, b) => b.movements - a.movements);
  return usage[0] ?? null;
}

export function mostOverextendedCard(cards: readonly Account[], debtOf: (card: Account) => number): CardUtilization | null {
  const utilization = cards
    .filter((card) => (card.limit ?? 0) > 0)
    .map((card) => {
      const percent = Math.round((debtOf(card) / card.limit!) * 100);
      return { account: card, percent, overHealthyPoints: percent - HEALTHY_UTILIZATION_PERCENT };
    })
    .sort((a, b) => b.percent - a.percent);
  return utilization[0] ?? null;
}
