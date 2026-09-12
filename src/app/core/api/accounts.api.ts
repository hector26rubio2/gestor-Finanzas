import { inject, Injectable } from '@angular/core';
import { API_TRANSPORT } from '../http/api-http-client';
import { API_ROUTES } from './api-routes';
import { ApiMoney } from './shared-api-types';
import { ApiMovement } from './ledger.api';

/** Espejo de `AccountKindDto`. Los valores numéricos son parte del contrato. */
export const ApiAccountKind = { cash: 1, checking: 2, savings: 3, wallet: 4, other: 99 } as const;

export interface ApiAccount {
  id: string;
  name: string;
  kind: number;
  currency: string;
  institution: string | null;
  lastFour: string | null;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
}

export interface ApiAccountOpening {
  account: ApiAccount;
  openingMovement: ApiMovement;
}

@Injectable({ providedIn: 'root' })
export class AccountsApi {
  private readonly transport = inject(API_TRANSPORT);

  accounts() {
    return this.transport.request<readonly ApiAccount[]>({ method: 'GET', path: API_ROUTES.accounts });
  }

  createAccount(request: {
    name: string;
    kind: number;
    currency: string;
    institution?: string | null;
    lastFour?: string | null;
    isDefault?: boolean;
  }) {
    return this.transport.request<ApiAccount, typeof request>({
      method: 'POST',
      path: API_ROUTES.accounts,
      body: request,
    });
  }

  createAccountWithOpening(request: {
    account: {
      name: string;
      kind: number;
      currency: string;
      institution?: string | null;
      lastFour?: string | null;
      isDefault?: boolean;
    };
    openingBalance: ApiMoney;
    date: string;
    rate?: string | null;
    rateAsOf?: string | null;
    idempotencyKey?: string | null;
  }) {
    return this.transport.request<ApiAccountOpening>({
      method: 'POST',
      path: API_ROUTES.accountsWithOpening,
      body: request,
    });
  }

  updateAccount(
    id: string,
    request: {
      name: string;
      institution?: string | null;
      lastFour?: string | null;
      isDefault: boolean;
      isActive: boolean;
    },
  ) {
    return this.transport.request<ApiAccount>({ method: 'PUT', path: API_ROUTES.account(id), body: request });
  }
}
