import { inject, Injectable } from '@angular/core';
import { API_TRANSPORT } from '@core/http/api-http-client';
import { ApiMovementKindSpec } from '@core/utils/movement-kinds';
import { API_ROUTES } from './api-routes';
import { ApiAccount } from './accounts.api';
import { ApiCard } from './cards.api';
import { ApiCategory } from './categories.api';
import { ApiNotification } from './notifications.api';
import { ApiCounterparty } from './people.api';
import { ApiFeatureFlag, ApiPreference } from './preferences.api';
import { ApiCurrency, ApiSession } from './session.api';
import { ApiLinkRef, ApiMoney } from './shared-api-types';

export type ApiBootstrapPart =
  | 'featureFlags'
  | 'currencies'
  | 'movementKinds'
  | 'accounts'
  | 'cards'
  | 'categories'
  | 'people'
  | 'preferences'
  | 'notifications'
  | 'balances';

export interface ApiBootstrapOmission {
  part: ApiBootstrapPart;
  reason: 'forbidden' | 'failed';
}

export interface ApiBootstrapBalances {
  asOf: string;
  accounts: readonly { account: ApiLinkRef; balance: ApiMoney; asOf: string }[] | null;
  cards: readonly { cardId: string; debt: ApiMoney }[] | null;
}

export interface ApiBootstrap {
  session: ApiSession;
  featureFlags: readonly ApiFeatureFlag[] | null;
  currencies: readonly ApiCurrency[] | null;
  movementKinds: readonly ApiMovementKindSpec[] | null;
  accounts: readonly ApiAccount[] | null;
  cards: readonly ApiCard[] | null;
  categories: readonly ApiCategory[] | null;
  people: readonly ApiCounterparty[] | null;
  preferences: ApiPreference | null;
  notifications: { unreadCount: number; latest: readonly ApiNotification[] } | null;
  balances: ApiBootstrapBalances | null;
  omitted: readonly ApiBootstrapOmission[];
}

@Injectable({ providedIn: 'root' })
export class BootstrapApi {
  private readonly transport = inject(API_TRANSPORT);

  bootstrap(asOf: string) {
    return this.transport.request<ApiBootstrap>({ method: 'GET', path: API_ROUTES.bootstrap, params: { asOf } });
  }
}
