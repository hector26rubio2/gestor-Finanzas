import { inject, Injectable } from '@angular/core';
import { API_TRANSPORT } from '@core/http/api-http-client';
import { API_ROUTES } from './api-routes';
import type { EsquemaApi } from './generado/esquemas';

export type ApiPreference = EsquemaApi<'UserPreferenceDto'>;

export type ApiFeatureFlag = EsquemaApi<'FeatureFlagDto'>;

@Injectable({ providedIn: 'root' })
export class PreferencesApi {
  private readonly transport = inject(API_TRANSPORT);

  preferences() {
    return this.transport.request<ApiPreference>({ method: 'GET', path: API_ROUTES.preferences });
  }

  updatePreferences(request: Omit<ApiPreference, 'userId' | 'updatedAt' | 'dashboardLayoutJson'>) {
    return this.transport.request<ApiPreference>({ method: 'PUT', path: API_ROUTES.preferences, body: request });
  }

  saveDashboardLayout(layoutJson: string | null) {
    return this.transport.request<ApiPreference>({
      method: 'PUT',
      path: `${API_ROUTES.preferences}/dashboard-layout`,
      body: { layoutJson },
    });
  }

  featureFlags() {
    return this.transport.request<readonly ApiFeatureFlag[]>({ method: 'GET', path: API_ROUTES.featureFlags });
  }
}
