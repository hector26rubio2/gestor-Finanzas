import { inject, Injectable } from '@angular/core';
import { API_TRANSPORT } from '../http/api-http-client';
import { API_ROUTES } from './api-routes';
import { ApiMovement } from './ledger.api';
import { ApiLinkRef, ApiMoney } from './shared-api-types';

export const OBLIGATION_DIRECTION = { receivable: 1, payable: 2 } as const;
export const LOAN_PRODUCT = { informal: 0, personal: 1, mortgage: 2, vehicle: 3, education: 4, other: 5 } as const;
export const LOAN_CARD_MODE = { purchase: 1, cashAdvance: 2 } as const;

export type LoanProductKey = keyof typeof LOAN_PRODUCT;
export type LoanCardModeKey = keyof typeof LOAN_CARD_MODE;

export interface CreateLoanBody {
  date: string;
  direction: (typeof OBLIGATION_DIRECTION)[keyof typeof OBLIGATION_DIRECTION];
  counterparty: string;
  amount: ApiMoney;
  account?: string;
  card?: string;
  cardMode?: (typeof LOAN_CARD_MODE)[LoanCardModeKey];
  product: (typeof LOAN_PRODUCT)[LoanProductKey];
  monthlyRate?: number;
  termMonths?: number;
  description?: string;
  idempotencyKey: string;
}

export interface ApiLoan {
  obligation: { id: string; counterparty: ApiLinkRef; dueOn: string | null };
  terms: { product: number; monthlyRate: number | null; termMonths: number | null; cardMode: number | null };
  movements: readonly ApiMovement[];
}

@Injectable({ providedIn: 'root' })
export class ObligationsApi {
  private readonly transport = inject(API_TRANSPORT);

  obligations() {
    return this.transport.request<readonly unknown[]>({ method: 'GET', path: API_ROUTES.obligations });
  }

  createLoan(request: CreateLoanBody) {
    return this.transport.request<ApiLoan>({ method: 'POST', path: API_ROUTES.loans, body: request });
  }
}
