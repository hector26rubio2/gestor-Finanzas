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
}

export type InspectorFact = readonly [string, string];

export function hechosDeMovimiento(m: Movement, { t, accountName }: InspectorFactsContext): InspectorFact[] {
  return [
    [t('workspace.inspector.facts.date'), m.date],
    [t('workspace.inspector.facts.account'), accountName(m.accountId) ?? SIN_DATO],
    [t('workspace.inspector.facts.category'), m.category],
    [
      t('workspace.inspector.facts.nature'),
      m.amount < 0 ? t('workspace.inspector.facts.debit') : t('workspace.inspector.facts.credit'),
    ],
    [t('workspace.inspector.facts.status'), m.status],
    [
      t('workspace.inspector.facts.responsibility'),
      m.person ? t('workspace.inspector.facts.loanedTo', { person: m.person }) : t('workspace.inspector.facts.own'),
    ],
    [
      t('workspace.inspector.facts.installments'),
      m.installmentTotal
        ? t('workspace.inspector.facts.installmentsOf', {
            current: m.installmentCurrent ?? 1,
            total: m.installmentTotal,
          })
        : t('workspace.inspector.facts.oneInstallment'),
    ],
    [
      t('workspace.inspector.facts.recurrence'),
      m.recurring ? (m.recurrence ?? t('workspace.inspector.facts.yes')) : t('workspace.inspector.facts.notRecurring'),
    ],
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
  const noAplica = t('workspace.inspector.facts.notApplicable');
  return [
    [t('workspace.inspector.facts.lastFour'), a.lastFour ? '•••• ' + a.lastFour : SIN_DATO],
    [t('workspace.inspector.facts.currency'), a.currency],
    [
      t('workspace.inspector.facts.referenceRate'),
      a.currency === 'USD'
        ? (a.exchangeRate?.toLocaleString('es-CO') ?? t('workspace.inspector.facts.undefined'))
        : noAplica,
    ],
    [t('workspace.inspector.facts.cutoff'), a.cutDay ? String(a.cutDay) : noAplica],
    [t('workspace.inspector.facts.dueDate'), a.dueDay ? String(a.dueDay) : noAplica],
    [t('workspace.inspector.facts.limit'), a.limit ? money(a.limit) : noAplica],
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
