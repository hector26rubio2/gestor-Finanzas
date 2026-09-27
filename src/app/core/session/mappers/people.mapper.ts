import { ViewData } from '@core/state/view-model';
import { ApiDebtPosition } from '@core/api/api-client';
import { parseMoney } from '@core/utils/money';
import { COUNTERPARTY_KIND } from '@core/api/people.api';

export interface ApiPersonSummary {
  id: string;
  displayName: string;
  kind?: number;
}

export function toViewPeople(
  people: readonly ApiPersonSummary[],
  debts: readonly ApiDebtPosition[],
): ViewData['people'] {
  const debtByPerson = new Map(debts.map((debt) => [debt.counterparty.id, debt]));
  return people.map((person) => {
    const position = debtByPerson.get(person.id);
    return {
      id: person.id,
      name: person.displayName,
      kind: person.kind === COUNTERPARTY_KIND.institution ? ('institution' as const) : ('person' as const),
      owed: parseMoney(position?.receivable),
      owing: parseMoney(position?.ownDebt),
    };
  });
}
