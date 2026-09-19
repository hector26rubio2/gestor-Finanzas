import { I18nService } from '../i18n';
import { Account, DemoData, Movement } from '../state/demo-data';
import type { AppStore } from '../state/store';
import {
  ApiAccount,
  ApiAccountKind,
  ApiCard,
  ApiDebtPosition,
  ApiInvestment,
  ApiMovement,
  ApiNotification,
  ApiSession,
} from '../api/api-client';
import { parseAmount, parseMoney, parseRate } from '../utils/money';
import { classifyFamily, MovementKindCatalog, signOf } from '../utils/movement-kinds';

export function toViewUser(session: ApiSession): AppStore['users'][number] & { photoUrl?: string } {
  return {
    id: session.user.id,
    name: session.user.displayName,
    email: session.user.email,
    capabilities: [...(session.permissions ?? [])],
    photoUrl: session.user.pictureUrl ?? undefined,
  };
}

export function toViewData(
  i18n: I18nService,
  catalog: MovementKindCatalog,
  accounts: readonly ApiAccount[],
  cards: readonly ApiCard[],
  movements: readonly ApiMovement[],
  people: readonly { id: string; displayName: string }[],
  debts: readonly ApiDebtPosition[],
  investments: readonly ApiInvestment[],
  notifications: readonly ApiNotification[],
): DemoData {
  const viewAccounts: Account[] = [
    ...accounts.map((account) => ({
      id: account.id,
      name: account.name,
      type: account.kind === ApiAccountKind.cash ? ('cash' as const) : ('savings' as const),
      currency: account.currency,
      openingBalance: 0,
      lastFour: account.lastFour ?? undefined,
      institution: account.institution ?? undefined,
    })),
    ...cards.map((card) => ({
      id: card.id,
      name: card.name,
      type: 'credit' as const,
      currency: card.currency,
      openingBalance: 0,
      limit: parseMoney(card.creditLimit),
      lastFour: card.lastFour ?? undefined,
      cutDay: card.cycle.statementDay,
      dueDay: card.cycle.paymentDueDay,
      // La tasa de compras la publica el servidor; la pantalla del extracto la usaba
      // inventada. Ausente si no viene: mejor no dar la cifra que darla falsa.
      annualRate: tasaAnual(card.terms?.purchaseApr?.value),
    })),
  ];
  const debtByPerson = new Map(debts.map((debt) => [debt.counterparty.id, debt]));
  // Los campos que la API todavía no expone se dejan ausentes a propósito.
  // Rellenarlos con constantes plausibles —riesgo «Medio», liquidez
  // «Programada», cero unidades— los presentaba en pantalla como si fueran
  // datos medidos. Un dato que falta se comunica; no se sustituye.
  return {
    accounts: viewAccounts,
    movements: movements.map((movement) => toMovement(i18n, catalog, movement)),
    people: people.map((person) => {
      const position = debtByPerson.get(person.id);
      return {
        id: person.id,
        name: person.displayName,
        owed: parseMoney(position?.receivable),
        owing: parseMoney(position?.ownDebt),
      };
    }),
    investments: investments.map((investment) => ({
      id: investment.id,
      name: investment.name,
      type: investment.instrumentType,
      cost: parseMoney(investment.costBasis),
      value: parseMoney(investment.marketValue ?? investment.costBasis),
      currency: investment.currency,
    })),
    notifications: notifications.map((notification) => ({
      id: notification.id,
      title: notification.title,
      detail: notificationDetail(notification),
      read: notification.readAt !== null,
    })),
    auditEvents: [],
    featureFlags: {},
  };
}

export function notificationDetail(notification: ApiNotification): string {
  try {
    const payload = JSON.parse(notification.payloadJson) as Record<string, unknown>;
    return String(payload['detail'] ?? payload['description'] ?? notification.kind);
  } catch {
    return notification.kind;
  }
}

export function toMovement(i18n: I18nService, catalog: MovementKindCatalog, source: ApiMovement): Movement {
  const accountId = source.links['account'] ?? source.links['card'] ?? '';
  const sign = signOf(source.flow, source.effect);
  const amount = parseMoney(source.amount.base) * sign;
  const family = catalog.family(source.kind, source.effect, source.flow);
  return {
    id: source.id,
    date: source.date,
    description: source.description ?? i18n.t('movements.fallback.noDescription'),
    accountId,
    category: source.linkNames['category']?.name ?? i18n.t('movements.fallback.noCategory'),
    ...classifyFamily(family, amount),
    amount,
    status: 'confirmed',
    person: source.linkNames['counterparty']?.name,
    ownership: source.links['counterparty'] ? 'loaned' : 'own',
    recurring: Boolean(source.links['recurrence']),
    originalCurrency: source.amount.original.currency === 'USD' ? 'USD' : 'COP',
    originalAmount: parseAmount(source.amount.original.amount, source.amount.original.currency),
    exchangeRate: parseRate(source.amount.rate),
  };
}

/**
 * Tasa anual publicada por la API, o ausente.
 *
 * No se usa `parseRate` porque devuelve 0 cuando no hay valor, y 0 % es una tasa
 * legitima: confundir «no se» con «cero» es como se acaba enseñando una cifra inventada.
 */
function tasaAnual(valor: string | number | null | undefined): number | undefined {
  if (valor === null || valor === undefined) return undefined;
  const numero = typeof valor === 'number' ? valor : Number(valor.trim());
  return Number.isFinite(numero) ? numero : undefined;
}
