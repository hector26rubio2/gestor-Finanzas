import { inject, Injectable } from '@angular/core';
import { API_TRANSPORT } from '../http/api-http-client';
import { API_ROUTES } from './api-routes';
import { ApiLinkRef, ApiMoney } from './shared-api-types';

export interface ApiRecurrence {
  id: string;
  name: string;
  kind: number;
  movementTemplate: number | null;
  amount: ApiMoney;
  target: Readonly<Record<string, string | null>>;
  sourceAccount: string | null;
  destinationAccount: string | null;
  schedule: {
    frequency: number;
    interval: number;
    start: string;
    end: string | null;
    dayOfMonth: number | null;
    dayOfWeek: number | null;
  };
  isActive: boolean;
  nextOccurrence: string | null;
  materializedOccurrences: readonly string[];
  createdAt: string;
}

export interface ApiProjectedOccurrence {
  recurrence: ApiLinkRef;
  occurrence: string;
  amount: ApiMoney;
  kind: number;
}

export interface ApiMaterialization {
  occurrence: string;
  operation: string | null;
  movements: readonly string[];
}

@Injectable({ providedIn: 'root' })
export class RecurrencesApi {
  private readonly transport = inject(API_TRANSPORT);

  recurrences() {
    return this.transport.request<readonly ApiRecurrence[]>({ method: 'GET', path: API_ROUTES.recurrences });
  }

  createRecurrence(request: unknown) {
    return this.transport.request<ApiRecurrence>({ method: 'POST', path: API_ROUTES.recurrences, body: request });
  }

  projectedCalendar(from: string, to: string) {
    return this.transport.request<readonly ApiProjectedOccurrence[]>({
      method: 'GET',
      path: API_ROUTES.projectedCalendar,
      params: { from, to },
    });
  }

  materializeRecurrence(
    id: string,
    request: { occurrence: string; amount?: ApiMoney | null; idempotencyKey?: string | null },
  ) {
    return this.transport.request<ApiMaterialization>({
      method: 'POST',
      path: API_ROUTES.recurrenceMaterializations(id),
      body: request,
    });
  }
}
