import { Account, Movement } from './view-model';
import { anualDesdeMensual } from '@core/utils/tasas';
import { parseMoney } from '@core/utils/money';
import { completarPrioridad, PRIORIDAD_EN_DOLARES, PRIORIDAD_EN_PESOS } from '@core/api/card-buckets';
import type { ApiCard } from '@core/api/cards.api';
import type { CondicionesDeTarjeta } from './store';

/**
 * Mapeo puro API ↔ viewmodel del catálogo (cuentas/tarjetas de crédito):
 * nada de inyecciones ni store, solo funciones deterministas.
 */

/** Aplasta sobre `terms` las condiciones del crédito (prioridades/FI/dualCurrency). */
export function conPrioridad(terms: unknown, credito: CondicionesDeTarjeta): unknown {
  if (!terms || typeof terms !== 'object') return terms;
  return {
    ...terms,
    ...(credito.paymentPriority ? { paymentPriority: credito.paymentPriority } : {}),
    ...(credito.foreignPaymentPriority ? { foreignPaymentPriority: credito.foreignPaymentPriority } : {}),
    ...(credito.monthlyFee !== undefined
      ? { monthlyFee: credito.monthlyFee > 0 ? { amount: String(credito.monthlyFee), currency: 'COP' } : null }
      : {}),
    ...(credito.dualCurrency !== undefined ? { dualCurrency: credito.dualCurrency } : {}),
    ...(credito.applyPaymentPriority !== undefined ? { applyPaymentPriority: credito.applyPaymentPriority } : {}),
  };
}

/** Reescribe purchaseApr/cashAdvanceApr con la tasa mensual anualizada (como fracción). */
export function conTasa(terms: unknown, mensual: number | undefined): unknown {
  if (mensual === undefined || !terms || typeof terms !== 'object') return terms;
  const tasa = { rate: String(anualDesdeMensual(mensual) / 100) };
  return { ...terms, purchaseApr: tasa, cashAdvanceApr: tasa };
}

/** Tasa mensual → anual (porcentaje redondeado a 3 decimales) como la entiende el store. */
export function tasaAnual(mensual: number): number {
  return anualDesdeMensual(mensual);
}

/** ApiCard tal como la devuelve el backend → Account de crédito del store. */
export function tarjetaAAccount(
  card: ApiCard,
  condiciones: Pick<CondicionesDeTarjeta, 'monthlyRate' | 'monthlyFee'>,
): Account {
  const anual = condiciones.monthlyRate === undefined ? undefined : anualDesdeMensual(condiciones.monthlyRate);
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
    annualRate: anual,
    issuerId: card.issuerEntity?.id,
    paymentPriority: completarPrioridad(card.terms?.paymentPriority, PRIORIDAD_EN_PESOS),
    foreignPaymentPriority: completarPrioridad(card.terms?.foreignPaymentPriority, PRIORIDAD_EN_DOLARES),
    ...(condiciones.monthlyFee ? { monthlyFee: condiciones.monthlyFee } : {}),
    dualCurrency: card.terms?.dualCurrency === true,
    applyPaymentPriority: card.terms?.applyPaymentPriority !== false,
  };
}

/**
 * Renombrado de un atributo de los movimientos (`category` o `person`): devuelve un
 * nuevo array con el nombre viejo sustituido por el nuevo, sin mutar. Se comparte
 * entre CategoriesCommands y PeopleCommands para no duplicar la lógica de spread.
 */
export function renombrarEnMovimientos<T extends Pick<Movement, 'category' | 'person'>>(
  movements: readonly T[],
  campo: 'category' | 'person',
  de: string,
  a: string,
): T[] {
  if (de === a) return [...movements];
  return movements.map((movement) => (movement[campo] === de ? { ...movement, [campo]: a } : movement));
}
