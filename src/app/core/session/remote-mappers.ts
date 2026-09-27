import { I18nService } from '@core/i18n';
import { Account, ViewData, Movement, SessionUser } from '@core/state/view-model';
import {
  accountKindToViewType,
  ApiAccount,
  ApiCard,
  ApiDebtPosition,
  ApiInvestment,
  ApiMovement,
  ApiNotification,
  ApiSession,
} from '@core/api/api-client';
import { parseAmount, parseMoney, parseRate } from '@core/utils/money';
import { CashFlow, classifyFamily, MovementKind, MovementKindCatalog, signOf } from '@core/utils/movement-kinds';
import { COUNTERPARTY_KIND } from '@core/api/people.api';
import { PRIORIDAD_EN_DOLARES, PRIORIDAD_EN_PESOS, completarPrioridad } from '@core/api/card-buckets';

export function toViewUser(session: ApiSession): SessionUser {
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
  people: readonly { id: string; displayName: string; kind?: number }[],
  debts: readonly ApiDebtPosition[],
  investments: readonly ApiInvestment[],
  notifications: readonly ApiNotification[],
): ViewData {
  const viewAccounts: Account[] = [
    ...accounts.map((account) => ({
      id: account.id,
      name: account.name,
      // El tipo de vista sale del `kind` del contrato: cash/checking/savings/wallet/other
      // se conservan en lugar de colapsarlos en ahorro, que era como una cuenta corriente
      // acababa etiquetada y agrupada.
      type: accountKindToViewType(account.kind),
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
      annualRate: tasaAnual(card.terms?.purchaseApr?.rate),
      paymentPriority: completarPrioridad(card.terms?.paymentPriority, PRIORIDAD_EN_PESOS),
      foreignPaymentPriority: completarPrioridad(card.terms?.foreignPaymentPriority, PRIORIDAD_EN_DOLARES),
      ...(card.terms?.monthlyFee ? { monthlyFee: parseMoney(card.terms.monthlyFee) } : {}),
      dualCurrency: card.terms?.dualCurrency === true,
      issuerId: card.issuerEntity?.id,
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
        kind: person.kind === COUNTERPARTY_KIND.institution ? ('institution' as const) : ('person' as const),
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
    ...(source.kind === MovementKind.cardCashAdvance
      ? { kind: amount < 0 ? ('expense' as const) : ('income' as const), movementSubtype: 'advance' as const }
      : classifyFamily(family, amount)),
    amount,
    status: 'confirmed',
    person: source.linkNames['counterparty']?.name,
    ownership: source.links['counterparty'] ? 'loaned' : 'own',
    recurring: Boolean(source.links['recurrence']),
    originalCurrency: source.amount.original.currency === 'USD' ? 'USD' : 'COP',
    originalAmount: parseAmount(source.amount.original.amount, source.amount.original.currency),
    exchangeRate: parseRate(source.amount.rate),
    ...(source.installments
      ? { installmentTotal: source.installments, installmentCurrent: cuotaEnCurso(source.date, source.installments) }
      : {}),
    ...(source.cardBucket ? { cardBucket: source.cardBucket } : {}),
    ...(source.purchaseApr !== null && source.purchaseApr !== undefined ? { purchaseApr: source.purchaseApr } : {}),
    ...(rolDePrestamo(source) ? { loanRole: rolDePrestamo(source) } : {}),
  };
}

function rolDePrestamo(source: ApiMovement): Movement['loanRole'] {
  if (source.kind === MovementKind.loanDisbursement) return source.flow === CashFlow.inflow ? 'borrowed' : 'lent';
  if (source.kind === MovementKind.loanRepayment) return 'repayment';
  return undefined;
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
  return Number.isFinite(numero) ? Math.round(numero * 100 * 1000) / 1000 : undefined;
}

export function cuotaEnCurso(fecha: string, total: number, hoy = new Date().toISOString().slice(0, 10)): number {
  const [a1, m1] = fecha.split('-').map(Number);
  const [a2, m2] = hoy.split('-').map(Number);
  return Math.min(total, Math.max(1, (a2 - a1) * 12 + (m2 - m1) + 1));
}
