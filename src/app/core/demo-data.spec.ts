import { describe, expect, it } from 'vitest';
import { accountBalance, createDemoData, demoUsers } from './demo-data';

describe('deterministic demonstration ledger', () => {
  it('covers twelve complete months with unique and valid records', () => {
    const data = createDemoData();
    expect(data).toEqual(createDemoData());
    expect(data.movements.length).toBeGreaterThan(400);
    expect(new Set(data.movements.map((m) => m.date.slice(0, 7))).size).toBe(12);
    expect(data.movements.every((m) => m.date >= '2025-09-01' && m.date <= '2026-08-31')).toBe(true);
    expect(new Set(data.movements.map((m) => m.id)).size).toBe(data.movements.length);
    expect(
      data.movements.every((m) => data.accounts.some((a) => a.id === m.accountId) && Number.isFinite(m.amount)),
    ).toBe(true);
  });

  it('balances every transfer and credit-card payment pair', () => {
    const groups = new Map<string, number>();
    for (const m of createDemoData().movements.filter((m) => m.kind === 'transfer' || m.kind === 'payment')) {
      const key = `${m.date}:${m.description}`;
      groups.set(key, (groups.get(key) ?? 0) + m.amount);
    }
    expect(groups.size).toBe(60);
    expect([...groups.values()].every((amount) => amount === 0)).toBe(true);
  });

  it('keeps posted credit balances within limits and excludes authorizations', () => {
    const data = createDemoData();
    for (const card of data.accounts.filter((a) => a.type === 'credit')) {
      const balance = accountBalance(card, data.movements);
      expect(balance).toBeLessThanOrEqual(0);
      expect(balance).toBeGreaterThanOrEqual(-card.limit!);
      expect(balance).toBe(
        accountBalance(
          card,
          data.movements.filter((m) => m.status === 'confirmed'),
        ),
      );
    }
  });

  it('reconciles borrower claims and investment contributions', () => {
    const data = createDemoData();
    for (const person of data.people) {
      const net = data.movements
        .filter((m) => m.person === person.name && m.status === 'confirmed')
        .reduce((sum, m) => sum + m.amount, 0);
      expect(person.owed).toBe(-net || 0);
    }
    expect(data.movements.filter((m) => m.category === 'Inversiones').reduce((sum, m) => sum - m.amount, 0)).toBe(
      data.investments.reduce((sum, i) => sum + i.cost, 0),
    );
    expect(demoUsers[1].capabilities).not.toContain('movement.create');
    expect(demoUsers[0].email).toMatch(/example\.test$/);
  });

  it('describes financing, ownership, recurrence and foreign-currency context', () => {
    const data = createDemoData();
    expect(data.movements.some((m) => m.installmentTotal === 6 && m.installmentCurrent === 6)).toBe(true);
    expect(data.movements.some((m) => m.recurring && m.recurrence === 'monthly')).toBe(true);
    expect(data.movements.some((m) => m.ownership === 'loaned' && m.person)).toBe(true);
    expect(data.movements.some((m) => m.loanRole === 'lent')).toBe(true);
    expect(data.movements.some((m) => m.originalCurrency === 'USD' && (m.exchangeRate ?? 0) > 0)).toBe(true);
    expect(data.accounts.some((a) => a.currency === 'USD' && (a.exchangeRate ?? 0) > 0)).toBe(true);
  });
});
