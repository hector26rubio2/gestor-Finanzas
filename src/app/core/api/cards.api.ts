import { inject, Injectable } from '@angular/core';
import { API_TRANSPORT } from '../http/api-http-client';
import { API_ROUTES } from './api-routes';
import { ApiMoney } from './shared-api-types';

export interface ApiCard {
  id: string;
  name: string;
  currency: string;
  creditLimit: ApiMoney;
  cycle: { statementDay: number; paymentDueDay: number };
  /** Condiciones financieras. La tasa de compras decide el interes del proximo corte. */
  terms?: { purchaseApr?: { value?: string | number | null } | null } | null;
  issuer: string | null;
  lastFour: string | null;
  isActive: boolean;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class CardsApi {
  private readonly transport = inject(API_TRANSPORT);

  cards() {
    return this.transport.request<readonly ApiCard[]>({ method: 'GET', path: API_ROUTES.cards });
  }

  createCard(request: {
    name: string;
    currency: string;
    creditLimit: ApiMoney;
    cycle: { statementDay: number; paymentDueDay: number };
    terms: unknown;
    issuer?: string | null;
    lastFour?: string | null;
  }) {
    return this.transport.request<ApiCard>({ method: 'POST', path: API_ROUTES.cards, body: request });
  }

  cardStatus(id: string, asOf?: string) {
    return this.transport.request<unknown>({ method: 'GET', path: API_ROUTES.cardStatus(id), params: { asOf } });
  }
}
