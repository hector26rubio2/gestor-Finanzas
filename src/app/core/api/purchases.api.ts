import { inject, Injectable } from '@angular/core';
import { API_TRANSPORT } from '@core/http/api-http-client';
import { API_ROUTES } from './api-routes';
import type { CreateMovementBody } from './ledger.api';
import { ApiLinkRef, ApiMoney } from './shared-api-types';

export const SHARE_BASIS = { full: 1, percentage: 2, fixedAmount: 3 } as const;

export interface ShareBody {
  counterparty: string;
  basis: number;
  percent?: { rate: string } | null;
  fixedAmount?: ApiMoney | null;
}

export interface AsentarCompraCompartidaBody {
  purchase: CreateMovementBody;
  shares: readonly ShareBody[];
  description?: string | null;
}

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
    shares: readonly ShareBody[];
    description?: string | null;
  }) {
    return this.transport.request<unknown>({ method: 'POST', path: API_ROUTES.sharedPurchases, body: request });
  }

  asentarCompraCompartida(request: AsentarCompraCompartidaBody) {
    return this.transport.request<ApiSharedPurchase>({
      method: 'POST',
      path: API_ROUTES.sharedPurchaseOperation,
      body: request,
    });
  }
}
