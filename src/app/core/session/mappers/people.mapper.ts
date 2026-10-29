import { PersonRelationship, ViewData } from '@core/state/view-model';
import { ApiDebtPosition } from '@core/api/api-client';
import { parseMoney } from '@core/utils/money';
import { COUNTERPARTY_KIND } from '@core/api/people.api';

export interface ApiPersonSummary {
  id: string;
  displayName: string;
  kind?: number;
  relationship?: string | null;
}

export function toViewPeople(people: readonly ApiPersonSummary[]): ViewData['people'] {
  return people.map((person) => ({
    id: person.id,
    name: person.displayName,
    kind: person.kind === COUNTERPARTY_KIND.institution ? ('institution' as const) : ('person' as const),
    ...(person.relationship ? { relationship: person.relationship as PersonRelationship } : {}),
    owed: 0,
    owing: 0,
  }));
}

export function conPosicionesDeDeuda(
  people: ViewData['people'],
  debts: readonly ApiDebtPosition[],
): ViewData['people'] {
  if (!debts.length) return people;
  const debtByPerson = new Map(debts.map((debt) => [debt.counterparty.id, debt]));
  return people.map((person) => {
    const position = debtByPerson.get(person.id);
    return position
      ? { ...person, owed: parseMoney(position.receivable), owing: parseMoney(position.ownDebt) }
      : person;
  });
}
