import { I18nService } from '@core/i18n';
import { ViewData } from '@core/state/view-model';
import {
  ApiAccount,
  ApiCard,
  ApiDebtPosition,
  ApiInvestment,
  ApiMovement,
  ApiNotification,
} from '@core/api/api-client';
import { MovementKindCatalog } from '@core/utils/movement-kinds';
import { cardToViewAccount, toViewAccount } from './accounts.mapper';
import { toMovement } from './movements.mapper';
import { ApiPersonSummary, toViewPeople } from './people.mapper';
import { toViewInvestment } from './investments.mapper';
import { toViewNotification } from './notifications.mapper';

export interface RemoteViewSources {
  accounts: readonly ApiAccount[];
  cards: readonly ApiCard[];
  movements: readonly ApiMovement[];
  people: readonly ApiPersonSummary[];
  debts: readonly ApiDebtPosition[];
  investments: readonly ApiInvestment[];
  notifications: readonly ApiNotification[];
}

export function toViewData(i18n: I18nService, catalog: MovementKindCatalog, sources: RemoteViewSources): ViewData {
  return {
    accounts: [...sources.accounts.map(toViewAccount), ...sources.cards.map(cardToViewAccount)],
    movements: sources.movements.map((movement) => toMovement(i18n, catalog, movement)),
    people: toViewPeople(sources.people, sources.debts),
    investments: sources.investments.map(toViewInvestment),
    notifications: sources.notifications.map((notification) => toViewNotification(i18n, notification)),
    auditEvents: [],
    featureFlags: {},
  };
}
