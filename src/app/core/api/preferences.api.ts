import { inject, Injectable } from '@angular/core';
import { API_TRANSPORT } from '../http/api-http-client';
import { API_ROUTES } from './api-routes';

export interface ApiPreference {
  userId: string;
  language: string;
  theme: string;
  font: string;
  density: string;
  baseCurrency: string;
  customThemeJson: string | null;
  updatedAt: string;
}

export interface ApiFeatureFlag {
  key: string;
  isEnabled: boolean;
  audienceJson: string | null;
  updatedAt: string;
}

@Injectable({ providedIn: 'root' })
export class PreferencesApi {
  private readonly transport = inject(API_TRANSPORT);

  preferences() {
    return this.transport.request<ApiPreference>({ method: 'GET', path: API_ROUTES.preferences });
  }

  updatePreferences(request: Omit<ApiPreference, 'userId' | 'updatedAt'>) {
    return this.transport.request<ApiPreference>({ method: 'PUT', path: API_ROUTES.preferences, body: request });
  }

  featureFlags() {
    return this.transport.request<readonly ApiFeatureFlag[]>({ method: 'GET', path: API_ROUTES.featureFlags });
  }
}
