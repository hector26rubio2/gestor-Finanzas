import { inject, Injectable } from '@angular/core';
import { API_TRANSPORT } from '../http/api-http-client';
import { API_ROUTES } from './api-routes';
import { ApiLinkRef, ApiMoney } from './shared-api-types';

export interface ApiPeriodPoint {
  date: string;
  income: ApiMoney;
  expense: ApiMoney;
  net: ApiMoney;
}

export interface ApiCategoryTotal {
  category: ApiLinkRef;
  type: number;
  total: ApiMoney;
  movementCount: number;
}

export interface ApiDashboard {
  period: { income: ApiMoney; expense: ApiMoney; net: ApiMoney; period: { start: string; end: string } };
  accounts: readonly { account: ApiLinkRef; balance: ApiMoney; asOf: string }[];
  cards: readonly unknown[];
  topCategories: readonly ApiCategoryTotal[];
  /** Un punto por día del periodo. El cliente agrupa; no suma importes. */
  series: readonly ApiPeriodPoint[];
  asOf: string;
}

@Injectable({ providedIn: 'root' })
export class ReportingApi {
  private readonly transport = inject(API_TRANSPORT);

  dashboard(from?: string, to?: string) {
    return this.transport.request<ApiDashboard>({ method: 'GET', path: API_ROUTES.dashboard, params: { from, to } });
  }
}
