import { inject, Injectable } from '@angular/core';
import { API_TRANSPORT } from '@core/http/api-http-client';
import { API_ROUTES } from './api-routes';

@Injectable({ providedIn: 'root' })
export class PrivacyApi {
  private readonly transport = inject(API_TRANSPORT);

  exportMyData() {
    return this.transport.request<Blob>({ method: 'GET', path: API_ROUTES.meExport, responseType: 'blob' });
  }

  deleteMyAccount(confirmation: string) {
    return this.transport.request<void, { confirmation: string }>({
      method: 'DELETE',
      path: API_ROUTES.me,
      body: { confirmation },
    });
  }
}
