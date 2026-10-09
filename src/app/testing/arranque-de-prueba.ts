import { ApiBootstrap, ApiSession } from '@core/api/api-client';

export function arranqueDe(session: ApiSession, partes: Partial<Omit<ApiBootstrap, 'session'>> = {}): ApiBootstrap {
  return {
    session,
    featureFlags: [],
    currencies: null,
    movementKinds: null,
    accounts: null,
    cards: null,
    categories: null,
    people: null,
    preferences: null,
    notifications: { unreadCount: 0, latest: [] },
    balances: null,
    omitted: [],
    ...partes,
  };
}
