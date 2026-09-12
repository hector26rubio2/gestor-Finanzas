import { inject, Injectable } from '@angular/core';
import { API_TRANSPORT } from '../http/api-http-client';
import { API_ROUTES } from './api-routes';

export interface ApiUser {
  id: string;
  displayName: string;
  email: string;
  isActive: boolean;
}

export interface ApiOrganization {
  id: string;
  name: string;
  slug: string;
  baseCurrency: string;
  isActive: boolean;
  createdAt: string;
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

/*
 * La máscara numérica de capacidades ya no se reproduce aquí.
 *
 * `session.capabilities` sigue llegando por compatibilidad, pero un rol granular la deja
 * vacía, así que decidir con ella era decidir con un dato que ya no se escribe. Era la
 * única cosa del cliente que no preguntaba por `session.permissions`, y por eso divergía:
 * el menú abría una pantalla cuyos datos nadie llegaba a pedir. Lo que se consulta es el
 * permiso, que es el mismo código que exige el endpoint.
 */

@Injectable({ providedIn: 'root' })
export class SessionApi {
  private readonly transport = inject(API_TRANSPORT);

  session() {
    return this.transport.request<ApiSession>({ method: 'GET', path: API_ROUTES.session });
  }

  csrf() {
    return this.transport.request<{ token: string }>({ method: 'GET', path: API_ROUTES.csrf });
  }

  logout() {
    return this.transport.request<void>({ method: 'POST', path: API_ROUTES.logout });
  }
}
