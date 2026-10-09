import { I18nService } from '@core/i18n';
import { Movement, ViewData } from '@core/state/view-model';
import { ApiAccount, ApiCard, ApiDebtPosition, ApiInvestment, ApiNotification } from '@core/api/api-client';
import { cardToViewAccount, toViewAccount } from './accounts.mapper';
import { ApiPersonSummary, toViewPeople } from './people.mapper';
import { toViewInvestment } from './investments.mapper';
import { toViewNotification } from './notifications.mapper';

export interface RemoteViewSources {
  accounts: readonly ApiAccount[];
  cards: readonly ApiCard[];
  people: readonly ApiPersonSummary[];
  debts: readonly ApiDebtPosition[];
  investments: readonly ApiInvestment[];
  notifications: readonly ApiNotification[];
}

export function toViewData(i18n: I18nService, sources: RemoteViewSources, movements: Movement[]): ViewData {
  return {
    accounts: [...sources.accounts.map(toViewAccount), ...sources.cards.map(cardToViewAccount)],
    movements,
    people: toViewPeople(sources.people, sources.debts),
    investments: sources.investments.map(toViewInvestment),
    notifications: sources.notifications.map((notification) => toViewNotification(i18n, notification)),
    auditEvents: [],
    featureFlags: {},
  };
}
