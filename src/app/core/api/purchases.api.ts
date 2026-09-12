import { inject, Injectable } from '@angular/core';
import { API_TRANSPORT } from '../http/api-http-client';
import { API_ROUTES } from './api-routes';
import { ApiMoney } from './shared-api-types';

@Injectable({ providedIn: 'root' })
export class PurchasesApi {
  private readonly transport = inject(API_TRANSPORT);

  sharedPurchases() {
    return this.transport.request<readonly unknown[]>({ method: 'GET', path: API_ROUTES.sharedPurchases });
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
