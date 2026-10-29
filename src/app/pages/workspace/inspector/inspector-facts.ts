import type { Account, Movement, ViewData } from '@core/state';
import { formatReturnRate } from '@core/utils';
import { SIN_DATO } from '@shared/utils';

type Translate = (key: string, params?: Record<string, string | number>) => string;
type Person = ViewData['people'][number];
type Investment = ViewData['investments'][number];

export interface InspectorFactsContext {
  t: Translate;
  money: (value: number) => string;
  accountName: (id: string) => string | undefined;
  accountType?: (id: string) => Account['type'] | undefined;
}

export type InspectorFact = readonly [string, string];

function cuotasDe(m: Movement, t: Translate, accountType: InspectorFactsContext['accountType']): string {
  if (m.installmentTotal)
    return t('workspace.inspector.facts.installmentsOf', {
      current: m.installmentCurrent ?? 1,
      total: m.installmentTotal,
    });
  return m.amount < 0 && accountType?.(m.accountId) === 'credit'
    ? t('movements.column.financing.singleInstallment')
    : t('movements.column.financing.none');
}

function recurrenciaDe(m: Movement, t: Translate): string {
  if (!m.recurring) return t('movements.column.financing.none');
  const frecuencia = m.recurrence === 'weekly' ? 'weekly' : m.recurrence === 'yearly' ? 'yearly' : 'monthly';
  return `✓ ${t(`movements.column.recurrence.${frecuencia}`)}`;
}

export function hechosDeMovimiento(
  m: Movement,
  { t, accountName, accountType }: InspectorFactsContext,
): InspectorFact[] {
  return [
    [t('workspace.inspector.facts.date'), m.date],
    [t('workspace.inspector.facts.account'), accountName(m.accountId) ?? SIN_DATO],
    [t('workspace.inspector.facts.category'), m.category || t('movements.column.financing.none')],
    [
      t('workspace.inspector.facts.nature'),
      m.amount < 0 ? t('movements.column.effect.debit') : t('movements.column.effect.credit'),
    ],
    [
      t('workspace.inspector.facts.status'),
      t(m.status === 'pending' ? 'movements.column.effect.pending' : 'workspace.inspector.facts.confirmed'),
    ],
    [
      t('workspace.inspector.facts.responsibility'),
      m.person ? t('workspace.inspector.facts.loanedTo', { person: m.person }) : t('workspace.inspector.facts.own'),
    ],
    [t('workspace.inspector.facts.installments'), cuotasDe(m, t, accountType)],
    [t('workspace.inspector.facts.recurrence'), recurrenciaDe(m, t)],
    [t('workspace.inspector.facts.loan'), t(claveDePrestamo(m.loanRole))],
    [
      t('workspace.inspector.facts.originalCurrency'),
      m.originalCurrency === 'USD'
        ? t('workspace.inspector.facts.originalCurrencyValue', {
            amount: m.originalAmount ?? 0,
            rate: m.exchangeRate ?? 0,
          })
        : 'COP',
    ],
  ];
}

export function hechosDeCuenta(a: Account, { t, money }: InspectorFactsContext): InspectorFact[] {
  const hechos: InspectorFact[] = [
    [t('workspace.inspector.facts.lastFour'), a.lastFour ? '•••• ' + a.lastFour : SIN_DATO],
    [t('workspace.inspector.facts.currency'), a.currency],
  ];
  if (a.currency === 'USD')
    hechos.push([
      t('workspace.inspector.facts.referenceRate'),
      a.exchangeRate?.toLocaleString('es-CO') ?? t('workspace.inspector.facts.undefined'),
    ]);
  if (a.type !== 'credit') return hechos;
  return [
    ...hechos,
    [t('workspace.inspector.facts.cutoff'), a.cutDay ? String(a.cutDay) : SIN_DATO],
    [t('workspace.inspector.facts.dueDate'), a.dueDay ? String(a.dueDay) : SIN_DATO],
    [t('workspace.inspector.facts.limit'), a.limit ? money(a.limit) : SIN_DATO],
  ];
}

export function hechosDePersona(p: Person, { t, money }: InspectorFactsContext): InspectorFact[] {
  return [
    [t('workspace.inspector.facts.owed'), money(p.owed)],
    [t('workspace.inspector.facts.owing'), money(p.owing)],
    [t('workspace.inspector.facts.balance'), money(p.owed - p.owing)],
  ];
}

export function hechosDeInversion(i: Investment, { t, money }: InspectorFactsContext): InspectorFact[] {
  return [
    [t('workspace.inspector.facts.type'), i.type],
    [t('workspace.inspector.facts.cost'), money(i.cost)],
    [t('workspace.inspector.facts.value'), money(i.value)],
    [t('workspace.inspector.facts.variation'), formatReturnRate(i.value, i.cost)],
  ];
}

export function hechosDelDia(fecha: string, operaciones: number, { t }: InspectorFactsContext): InspectorFact[] {
  return [
    [t('workspace.inspector.facts.date'), fecha],
    [t('workspace.inspector.facts.operations'), String(operaciones)],
  ];
}

function claveDePrestamo(rol: Movement['loanRole']): string {
  if (rol === 'lent') return 'workspace.inspector.facts.loanGiven';
  if (rol === 'borrowed') return 'workspace.inspector.facts.loanReceived';
  if (rol === 'repayment') return 'workspace.inspector.facts.loanRepayment';
  return 'workspace.inspector.facts.notApplicable';
}
