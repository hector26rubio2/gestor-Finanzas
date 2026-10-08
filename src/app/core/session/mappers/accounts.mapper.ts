import { Account } from '@core/state/view-model';
import { accountKindToViewType, ApiAccount, ApiCard } from '@core/api/api-client';
import { parseMoney } from '@core/utils/money';
import { PRIORIDAD_EN_DOLARES, PRIORIDAD_EN_PESOS, completarPrioridad } from '@core/api/card-buckets';

export function toViewAccount(account: ApiAccount): Account {
  return {
    id: account.id,
    name: account.name,
    type: accountKindToViewType(account.kind),
    currency: account.currency,
    openingBalance: 0,
    lastFour: account.lastFour ?? undefined,
    institution: account.institution ?? undefined,
    issuerId: account.issuerEntity?.id,
    ...(account.isDefault ? { isDefault: true } : {}),
  };
}

export function cardToViewAccount(card: ApiCard): Account {
  return {
    id: card.id,
    name: card.name,
    type: 'credit',
    currency: card.currency,
    openingBalance: 0,
    limit: parseMoney(card.creditLimit),
    lastFour: card.lastFour ?? undefined,
    cutDay: card.cycle.statementDay,
    dueDay: card.cycle.paymentDueDay,
    annualRate: tasaAnual(card.terms?.purchaseApr?.rate),
    paymentPriority: completarPrioridad(card.terms?.paymentPriority, PRIORIDAD_EN_PESOS),
    foreignPaymentPriority: completarPrioridad(card.terms?.foreignPaymentPriority, PRIORIDAD_EN_DOLARES),
    ...(card.terms?.monthlyFee ? { monthlyFee: parseMoney(card.terms.monthlyFee) } : {}),
    dualCurrency: card.terms?.dualCurrency === true,
    issuerId: card.issuerEntity?.id,
  };
}

export function tasaAnual(valor: string | number | null | undefined): number | undefined {
  if (valor === null || valor === undefined) return undefined;
  const numero = typeof valor === 'number' ? valor : Number(valor.trim());
  return Number.isFinite(numero) ? Math.round(numero * 100 * 1000) / 1000 : undefined;
}
