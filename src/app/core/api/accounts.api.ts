import { inject, Injectable } from '@angular/core';
import { API_TRANSPORT } from '../http/api-http-client';
import { API_ROUTES } from './api-routes';
import { ApiMoney } from './shared-api-types';
import { ApiMovement } from './ledger.api';

/** Espejo de `AccountKindDto`. Los valores numéricos son parte del contrato. */
export const ApiAccountKind = { cash: 1, checking: 2, savings: 3, wallet: 4, other: 99 } as const;

/**
 * Tipo de cuenta tal como lo ve la interfaz: los cinco del contrato más `credit`.
 *
 * `credit` no es una cuenta del libro —la tarjeta es una deuda con el emisor y viaja por
 * su propio endpoint—, pero la vista la trata como un tipo más. Antes la vista solo
 * conocía `savings | cash | credit`, y una cuenta corriente, una billetera o una «otra»
 * se mostraba, se etiquetaba y se agrupaba como ahorro.
 */
export type AccountViewType = 'savings' | 'checking' | 'cash' | 'wallet' | 'other' | 'credit';

/** Los tipos que sí son una cuenta con `kind` en el contrato; la tarjeta queda fuera. */
export type AccountKindViewType = Exclude<AccountViewType, 'credit'>;

/**
 * Contrato → vista. Un `kind` que el cliente no conoce se trata como ahorro, que es lo
 * que ya pasaba antes de que existieran los demás tipos: mejor un etiquetado genérico
 * que romper la pantalla porque el servidor empezó a emitir un número nuevo.
 */
export function accountKindToViewType(kind: number): AccountViewType {
  switch (kind) {
    case ApiAccountKind.cash:
      return 'cash';
    case ApiAccountKind.checking:
      return 'checking';
    case ApiAccountKind.wallet:
      return 'wallet';
    case ApiAccountKind.other:
      return 'other';
    case ApiAccountKind.savings:
    default:
      return 'savings';
  }
}

/** Vista → contrato: lo que se escribe en `CreateAccountRequest.kind`. */
export function viewTypeToAccountKind(type: AccountKindViewType): number {
  const kinds: Record<AccountKindViewType, number> = {
    savings: ApiAccountKind.savings,
    checking: ApiAccountKind.checking,
    cash: ApiAccountKind.cash,
    wallet: ApiAccountKind.wallet,
    other: ApiAccountKind.other,
  };
  return kinds[type];
}

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
