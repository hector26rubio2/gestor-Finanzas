import { inject, Injectable } from '@angular/core';
import { API_TRANSPORT } from '../http/api-http-client';
import { ApiMovementKindSpec } from '../movement-kinds';
import { API_ROUTES } from './api-routes';
import { ApiLinkRef, ApiMoney, ApiPage, MovementQuery, monthRange } from './shared-api-types';

export interface ApiMovement {
  id: string;
  date: string;
  kind: number;
  effect: number;
  flow: number;
  amount: ApiConvertedMoney;
  links: Readonly<Record<string, string | null>>;
  linkNames: Readonly<Record<string, ApiLinkRef | null>>;
  origin: number;
  description: string | null;
  createdAt: string;
  reversalOf: string | null;
  reversedBy: string | null;
}

export interface ApiConvertedMoney {
  original: ApiMoney;
  base: ApiMoney;
  rate: string;
  rateAsOf: string;
}

export interface ApiOperation {
  id: string;
  kind: number;
  date: string;
  description: string | null;
  createdAt: string;
  legs: readonly ApiMovement[];
}

@Injectable({ providedIn: 'root' })
export class LedgerApi {
  private readonly transport = inject(API_TRANSPORT);

  /** Tabla de invariantes por clase de movimiento: viaja como dato, no se reescribe aquí. */
  movementKinds() {
    return this.transport.request<readonly ApiMovementKindSpec[]>({ method: 'GET', path: API_ROUTES.movementKinds });
  }

  movements(query: MovementQuery) {
    const range = query.period ? monthRange(query.period) : undefined;
    return this.transport.request<ApiPage<ApiMovement>, unknown>({
      method: 'POST',
      path: API_ROUTES.movementSearch,
      body: {
        filter: {
          text: query.search || undefined,
          accounts: query.accountId ? [query.accountId] : undefined,
          range,
        },
        page: { page: query.page, size: query.pageSize },
        sortBy: 0,
        direction: 1,
      },
    });
  }

  movement(id: string) {
    return this.transport.request<ApiMovement>({ method: 'GET', path: API_ROUTES.movement(id) });
  }

  createMovement(request: unknown) {
    return this.transport.request<ApiMovement>({ method: 'POST', path: API_ROUTES.movements, body: request });
  }

  reclassifyMovement(id: string, request: { category: string | null; description: string | null }) {
    return this.transport.request<ApiMovement>({
      method: 'PUT',
      path: API_ROUTES.movementClassification(id),
      body: request,
    });
  }

  reverseMovement(id: string, request: { date: string; reason?: string | null }) {
    return this.transport.request<ApiMovement>({
      method: 'POST',
      path: API_ROUTES.movementReversal(id),
      body: request,
    });
  }

  createTransfer(request: unknown) {
    return this.transport.request<ApiOperation>({ method: 'POST', path: API_ROUTES.transfers, body: request });
  }

  createCardPayment(request: unknown) {
    return this.transport.request<ApiOperation>({ method: 'POST', path: API_ROUTES.cardPayments, body: request });
  }
}
