import { I18nService } from '@core/i18n';
import { Movement } from '@core/state/view-model';
import { ApiMovement } from '@core/api/api-client';
import { parseAmount, parseMoney, parseRate } from '@core/utils/money';
import { CashFlow, classifyFamily, MovementKind, MovementKindCatalog, signOf } from '@core/utils/movement-kinds';

export function toMovement(i18n: I18nService, catalog: MovementKindCatalog, source: ApiMovement): Movement {
  const accountId = source.links['account'] ?? source.links['card'] ?? '';
  const sign = signOf(source.flow, source.effect);
  const amount = parseMoney(source.amount.base) * sign;
  const family = catalog.family(source.kind, source.effect, source.flow);
  const loanRole = rolDePrestamo(source);
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
    ...(loanRole ? { loanRole } : {}),
  };
}

export function cuotaEnCurso(fecha: string, total: number, hoy = new Date().toISOString().slice(0, 10)): number {
  const [a1, m1] = fecha.split('-').map(Number);
  const [a2, m2] = hoy.split('-').map(Number);
  return Math.min(total, Math.max(1, (a2 - a1) * 12 + (m2 - m1) + 1));
}

function rolDePrestamo(source: ApiMovement): Movement['loanRole'] {
  if (source.kind === MovementKind.loanDisbursement) return source.flow === CashFlow.inflow ? 'borrowed' : 'lent';
  if (source.kind === MovementKind.loanRepayment) return 'repayment';
  return undefined;
}
