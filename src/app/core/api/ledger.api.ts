import { inject, Injectable } from '@angular/core';
import { API_TRANSPORT } from '@core/http/api-http-client';
import { ApiMovementKindSpec, CashFlow, EconomicEffect, MovementKind } from '@core/utils/movement-kinds';
import { API_ROUTES } from './api-routes';
import { ApiConvertedMoney, ApiLinkRef, ApiMoney, ApiPage, MovementQuery, monthRange } from './shared-api-types';

export type MovementKindValue = (typeof MovementKind)[keyof typeof MovementKind];
export type EconomicEffectValue = (typeof EconomicEffect)[keyof typeof EconomicEffect];
export type CashFlowValue = (typeof CashFlow)[keyof typeof CashFlow];

export interface CreateMovementLinks {
  operation?: string;
  account?: string;
  card?: string;
  category?: string;
  counterparty?: string;
  obligation?: string;
  recurrence?: string;
  position?: string;
  sharedPurchase?: string;
}

export interface CreateMovementBody {
  date: string;
  kind: MovementKindValue;
  effect: EconomicEffectValue;
  flow: CashFlowValue;
  amount: ApiMoney;
  links: CreateMovementLinks;
  rate?: string;
  rateAsOf?: string;
  description?: string;
  idempotencyKey: string;
  purchaseApr?: number;
  cardBucket?: number;
  installments?: number;
}

export interface CreateTransferBody {
  date: string;
  amount: ApiMoney;
  sourceAccount: string;
  destinationAccount: string;
  description?: string;
  idempotencyKey: string;
}

export interface CreateCardPaymentBody {
  date: string;
  amount: ApiMoney;
  account: string;
  card: string;
  description?: string;
  idempotencyKey: string;
}

export interface CreateCashAdvanceBody {
  date: string;
  amount: ApiMoney;
  card: string;
  account: string;
  description?: string;
  idempotencyKey: string;
  installments?: number;
  apr?: number;
}

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
  purchaseApr: number | null;
  cardBucket?: number | null;
  installments?: number | null;
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
          ...query.filter,
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

  createMovement(request: CreateMovementBody) {
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

  createTransfer(request: CreateTransferBody) {
    return this.transport.request<ApiOperation>({ method: 'POST', path: API_ROUTES.transfers, body: request });
  }

  createCardPayment(request: CreateCardPaymentBody) {
    return this.transport.request<ApiOperation>({ method: 'POST', path: API_ROUTES.cardPayments, body: request });
  }

  createCashAdvance(request: CreateCashAdvanceBody) {
    return this.transport.request<ApiOperation>({ method: 'POST', path: API_ROUTES.cashAdvances, body: request });
  }
}
