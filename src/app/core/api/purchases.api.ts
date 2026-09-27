import { inject, Injectable } from '@angular/core';
import { API_TRANSPORT } from '@core/http';
import { API_ROUTES } from './api-routes';
import { ApiLinkRef, ApiMoney } from './shared-api-types';

export interface ApiSharedPurchase {
  id: string;
  purchaseMovement: string;
  card: ApiLinkRef;
  date: string;
  total: ApiMoney;
  description: string | null;
  allocation: {
    shares: readonly { share: { counterparty: ApiLinkRef }; amount: ApiMoney }[];
    holderPortion: ApiMoney;
  };
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class PurchasesApi {
  private readonly transport = inject(API_TRANSPORT);

  sharedPurchases() {
    return this.transport.request<readonly ApiSharedPurchase[]>({ method: 'GET', path: API_ROUTES.sharedPurchases });
  }

  createSharedPurchase(request: {
    purchaseMovement: string;
    shares: readonly {
      counterparty: string;
      basis: number;
      percent?: { rate: string } | null;
      fixedAmount?: ApiMoney | null;
    }[];
    description?: string | null;
  }) {
    return this.transport.request<unknown>({ method: 'POST', path: API_ROUTES.sharedPurchases, body: request });
  }
}
