import { Movement, ViewData } from '@core/state/view-model';
import { ApiAccount, ApiCard, ApiInvestment } from '@core/api/api-client';
import { cardToViewAccount, toViewAccount } from './accounts.mapper';
import { ApiPersonSummary, toViewPeople } from './people.mapper';
import { toViewInvestment } from './investments.mapper';

export interface RemoteViewSources {
  accounts: readonly ApiAccount[];
  cards: readonly ApiCard[];
  people: readonly ApiPersonSummary[];
  investments: readonly ApiInvestment[];
}

export function toViewData(sources: RemoteViewSources, movements: Movement[]): ViewData {
  return {
    accounts: [
      ...sources.accounts.filter((cuenta) => cuenta.isActive).map(toViewAccount),
      ...sources.cards.filter((tarjeta) => tarjeta.isActive).map(cardToViewAccount),
    ],
    movements,
    people: toViewPeople(sources.people),
    investments: sources.investments.map(toViewInvestment),
    auditEvents: [],
    featureFlags: {},
  };
}
