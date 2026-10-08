import { inject, Injectable } from '@angular/core';
import { API_TRANSPORT } from '@core/http/api-http-client';
import { API_ROUTES } from './api-routes';
import type { ApiLinkRef, ApiMoney } from './shared-api-types';

export interface ApiBudget {
  id: string;
  category: ApiLinkRef;
  monthlyLimit: ApiMoney;
  updatedAt: string;
}

@Injectable({ providedIn: 'root' })
export class BudgetsApi {
  private readonly transport = inject(API_TRANSPORT);

  budgets() {
    return this.transport.request<readonly ApiBudget[]>({ method: 'GET', path: API_ROUTES.budgets });
  }

  setBudget(categoryId: string, monthlyLimit: ApiMoney) {
    return this.transport.request<ApiBudget>({
      method: 'PUT',
      path: API_ROUTES.budget(categoryId),
      body: { monthlyLimit },
    });
  }

  deleteBudget(categoryId: string) {
    return this.transport.request<void>({ method: 'DELETE', path: API_ROUTES.budget(categoryId) });
  }
}
