import { inject, Injectable } from '@angular/core';
import { API_TRANSPORT } from '../http/api-http-client';
import { API_ROUTES } from './api-routes';

@Injectable({ providedIn: 'root' })
export class SettlementsApi {
  private readonly transport = inject(API_TRANSPORT);

  settlements() {
    return this.transport.request<readonly unknown[]>({ method: 'GET', path: API_ROUTES.settlements });
  }

  issueSettlement(request: {
    counterparty: string;
    period: { start: string; end: string };
    cutOff: string;
    currency: string;
  }) {
    return this.transport.request<unknown>({ method: 'POST', path: API_ROUTES.settlements, body: request });
  }
}
