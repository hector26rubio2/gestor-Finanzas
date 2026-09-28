import { inject, Injectable } from '@angular/core';
import { API_TRANSPORT } from '@core/http/api-http-client';
import { API_ROUTES } from './api-routes';

export interface ApiUser {
  id: string;
  displayName: string;
  email: string;
  isActive: boolean;
  pictureUrl?: string | null;
}

export interface ApiOrganization {
  id: string;
  name: string;
  slug: string;
  baseCurrency: string;
  isActive: boolean;
  createdAt: string;
}

export interface ApiAuthMethods {
  google: boolean;
  password: boolean;
}

export interface ApiSession {
  user: ApiUser;
  organization: ApiOrganization;
  capabilities: readonly number[];
  organizations: readonly ApiOrganization[];
  expiresAt: string;
  isSuperAdmin?: boolean;
  permissions?: readonly string[];
}

export interface ApiCurrency {
  code: string;
  minorUnits: number;
  isBase: boolean;
}

@Injectable({ providedIn: 'root' })
export class SessionApi {
  private readonly transport = inject(API_TRANSPORT);

  session() {
    return this.transport.request<ApiSession>({ method: 'GET', path: API_ROUTES.session });
  }

  currencies() {
    return this.transport.request<readonly ApiCurrency[]>({ method: 'GET', path: API_ROUTES.currencies });
  }

  csrf() {
    return this.transport.request<{ token: string }>({ method: 'GET', path: API_ROUTES.csrf });
  }

  logout() {
    return this.transport.request<void>({ method: 'POST', path: API_ROUTES.logout });
  }

  authMethods() {
    return this.transport.request<ApiAuthMethods>({ method: 'GET', path: API_ROUTES.authMethods });
  }

  loginWithPassword(userName: string, password: string) {
    return this.transport.request<void>({
      method: 'POST',
      path: API_ROUTES.passwordLogin,
      body: { userName, password },
    });
  }
}
