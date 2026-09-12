import { inject, Injectable } from '@angular/core';
import { API_TRANSPORT } from '../http/api-http-client';
import { API_ROUTES } from './api-routes';
import { ApiLinkRef, ApiMoney } from './shared-api-types';

export interface ApiCounterparty {
  id: string;
  displayName: string;
  alias: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface ApiDebtPosition {
  counterparty: ApiLinkRef;
  ownDebt: ApiMoney;
  receivable: ApiMoney;
  asOf: string;
}

@Injectable({ providedIn: 'root' })
export class PeopleApi {
  private readonly transport = inject(API_TRANSPORT);

  people() {
    return this.transport.request<readonly ApiCounterparty[]>({ method: 'GET', path: API_ROUTES.people });
  }

  createPerson(request: {
    displayName: string;
    alias?: string | null;
    email?: string | null;
    phone?: string | null;
    notes?: string | null;
  }) {
    return this.transport.request<ApiCounterparty>({ method: 'POST', path: API_ROUTES.people, body: request });
  }

  debts() {
    return this.transport.request<readonly ApiDebtPosition[]>({ method: 'GET', path: API_ROUTES.debts });
  }
}
