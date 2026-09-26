import { inject, Injectable } from '@angular/core';
import { API_TRANSPORT } from '../http/api-http-client';
import { API_ROUTES } from './api-routes';
import { ApiMoney } from './shared-api-types';

export interface ApiInvestment {
  id: string;
  name: string;
  instrumentType: string;
  currency: string;
  costBasis: ApiMoney;
  marketValue: ApiMoney | null;
  isActive: boolean;
  risk?: number;
  symbol?: string | null;
}

@Injectable({ providedIn: 'root' })
export class InvestmentsApi {
  private readonly transport = inject(API_TRANSPORT);

  investments(asOf?: string) {
    return this.transport.request<readonly ApiInvestment[]>({
      method: 'GET',
      path: API_ROUTES.investments,
      params: { asOf },
    });
  }

  createInvestment(request: {
    name: string;
    instrumentType: string;
    currency: string;
    risk: number;
    symbol?: string | null;
    institution?: string | null;
  }) {
    return this.transport.request<ApiInvestment>({ method: 'POST', path: API_ROUTES.investments, body: request });
  }

  updateInvestment(
    id: string,
    request: { name: string; instrumentType: string; risk: number; symbol: string | null; isActive: boolean },
  ) {
    return this.transport.request<ApiInvestment>({ method: 'PUT', path: API_ROUTES.investment(id), body: request });
  }
}
