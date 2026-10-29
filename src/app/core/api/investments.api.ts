import { inject, Injectable } from '@angular/core';
import { API_TRANSPORT } from '@core/http/api-http-client';
import { API_ROUTES } from './api-routes';
import { ApiMoney } from './shared-api-types';

export interface ApiValuation {
  id: string;
  date: string;
  value: ApiMoney;
  source: number;
  reference: string | null;
}

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
  institution?: string | null;
  quantity?: string;
  netContributions?: ApiMoney;
  unrealizedGain?: ApiMoney | null;
  latestValuation?: ApiValuation | null;
  asOf?: string;
  createdAt?: string;
}

export const INVESTMENT_OPERATION = {
  contribution: 1,
  withdrawal: 2,
  buy: 3,
  sell: 4,
  dividend: 5,
  fee: 6,
} as const;

export const VALUATION_SOURCE = { marketPrice: 1, statement: 2, manual: 3 } as const;

export interface ApiInvestmentOperationRequest {
  type: number;
  date: string;
  amount: ApiMoney;
  account?: string | null;
  quantity?: string | null;
  unitPrice?: ApiMoney | null;
  description?: string | null;
  idempotencyKey?: string | null;
}

export interface ApiInvestmentOperation {
  movement: string | null;
  type: number;
  date: string;
  amount: ApiMoney;
  quantity: string | null;
  unitPrice: ApiMoney | null;
}

export interface ApiValuationRequest {
  date: string;
  value: ApiMoney;
  source: number;
  reference?: string | null;
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

  registerOperation(id: string, request: ApiInvestmentOperationRequest) {
    return this.transport.request<ApiInvestmentOperation>({
      method: 'POST',
      path: API_ROUTES.investmentOperations(id),
      body: request,
    });
  }

  listOperations(id: string) {
    return this.transport.request<readonly ApiInvestmentOperation[]>({
      method: 'GET',
      path: API_ROUTES.investmentOperations(id),
    });
  }

  addValuation(id: string, request: ApiValuationRequest) {
    return this.transport.request<ApiValuation>({
      method: 'POST',
      path: API_ROUTES.investmentValuations(id),
      body: request,
    });
  }

  listValuations(id: string) {
    return this.transport.request<readonly ApiValuation[]>({
      method: 'GET',
      path: API_ROUTES.investmentValuations(id),
    });
  }
}
