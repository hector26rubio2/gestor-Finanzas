import { inject, Injectable } from '@angular/core';
import { map } from 'rxjs';
import { API_TRANSPORT } from '@core/http/api-http-client';
import { API_ROUTES } from './api-routes';
import { ApiLinkRef, ApiMoney } from './shared-api-types';

export interface ApiSettlement {
  id: string;
  counterparty: ApiLinkRef;
  period: { start: string; end: string };
  cutOff: string;
  currency: string;
  openingBalance: ApiMoney;
  charges: ApiMoney;
  interest: ApiMoney;
  payments: ApiMoney;
  closingBalance: ApiMoney;
  issuedAt: string;
}

@Injectable({ providedIn: 'root' })
export class SettlementsApi {
  private readonly transport = inject(API_TRANSPORT);

  settlements() {
    return this.transport
      .request<readonly ApiSettlement[] | { readonly items: readonly ApiSettlement[] }>({
        method: 'GET',
        path: API_ROUTES.settlements,
      })
      .pipe(map((respuesta) => ('items' in respuesta ? respuesta.items : respuesta)));
  }

  issueSettlement(request: {
    counterparty: string;
    period: { start: string; end: string };
    cutOff: string;
    currency: string;
  }) {
    return this.transport.request<ApiSettlement>({ method: 'POST', path: API_ROUTES.settlements, body: request });
  }
}
