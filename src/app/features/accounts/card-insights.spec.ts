import { describe, expect, it } from 'vitest';
import { Account, Movement } from '../../core/state/demo-data';
import { mostOverextendedCard, mostUsedCard, nextCardDue } from './card-insights';

const card = (id: string, extra: Partial<Account> = {}): Account => ({
  id,
  name: id,
  type: 'credit',
  currency: 'COP',
  openingBalance: 0,
  ...extra,
});

const movement = (accountId: string, date: string): Movement => ({
  id: `${accountId}-${date}`,
  date,
  description: 'x',
  accountId,
  category: 'x',
  kind: 'expense',
  amount: -10,
  status: 'confirmed',
});

describe('nextCardDue', () => {
  it('elige la tarjeta con deuda cuyo pago cae antes', () => {
    const cards = [card('a', { dueDay: 25 }), card('b', { dueDay: 12 }), card('c', { dueDay: 5 })];
    const debt = (c: Account) => (c.id === 'c' ? 0 : 100);
    const due = nextCardDue(cards, debt, '2026-09-10');
    expect(due?.account.id).toBe('b');
    expect(due?.days).toBe(2);
  });

  it('pasa al mes siguiente cuando el día ya pasó', () => {
    const due = nextCardDue([card('a', { dueDay: 5 })], () => 100, '2026-09-20');
    expect(due?.date).toBe('2026-10-05');
    expect(due?.days).toBe(15);
  });

  it('ajusta el día 31 en meses cortos', () => {
    const due = nextCardDue([card('a', { dueDay: 31 })], () => 100, '2026-09-20');
    expect(due?.date).toBe('2026-09-30');
  });

  it('devuelve null sin deuda', () => {
    expect(nextCardDue([card('a', { dueDay: 5 })], () => 0, '2026-09-20')).toBeNull();
  });
});

describe('mostUsedCard', () => {
  it('cuenta solo los movimientos de los últimos 30 días', () => {
    const cards = [card('a'), card('b')];
    const movements = [
      movement('a', '2026-09-18'),
      movement('b', '2026-09-17'),
      movement('b', '2026-09-16'),
      movement('a', '2026-06-01'),
      movement('a', '2026-06-02'),
      movement('a', '2026-06-03'),
    ];
    expect(mostUsedCard(cards, movements, '2026-09-20')?.account.id).toBe('b');
  });

  it('devuelve null sin movimientos recientes', () => {
    expect(mostUsedCard([card('a')], [movement('a', '2026-01-01')], '2026-09-20')).toBeNull();
  });
});

describe('mostOverextendedCard', () => {
  it('elige el mayor porcentaje de cupo usado y lo compara con el 50 %', () => {
    const cards = [card('a', { limit: 1000 }), card('b', { limit: 500 })];
    const result = mostOverextendedCard(cards, () => 400);
    expect(result?.account.id).toBe('b');
    expect(result?.percent).toBe(80);
    expect(result?.overHealthyPoints).toBe(30);
  });

  it('ignora tarjetas sin cupo', () => {
    expect(mostOverextendedCard([card('a')], () => 100)).toBeNull();
  });
});
