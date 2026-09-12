import { inject, Injectable } from '@angular/core';
import { API_TRANSPORT } from '../http/api-http-client';
import { API_ROUTES } from './api-routes';

@Injectable({ providedIn: 'root' })
export class ObligationsApi {
  private readonly transport = inject(API_TRANSPORT);

  obligations() {
    return this.transport.request<readonly unknown[]>({ method: 'GET', path: API_ROUTES.obligations });
  }
}
