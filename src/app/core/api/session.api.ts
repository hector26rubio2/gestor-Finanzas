import { inject, Injectable } from '@angular/core';
import { API_TRANSPORT } from '../http/api-http-client';
import { API_ROUTES } from './api-routes';

export interface ApiUser {
  id: string;
  displayName: string;
  email: string;
  isActive: boolean;
  /** Foto de la cuenta de Google, si el proveedor la entregó. */
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

/** Espejo de `CurrencyDto`: catálogo de monedas que el backend publica para toda la instancia. */
export interface ApiCurrency {
  code: string;
  minorUnits: number;
  isBase: boolean;
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

  /**
   * Catálogo de monedas. El endpoint solo pide sesión autenticada, pero el vocabulario
   * publica `sesion.monedas.listar` y el resto de la aplicación pregunta por el permiso
   * antes de pedir nada: aquí se respeta la misma regla, en vez de abrir una petición que
   * nadie le había concedido a esa sesión.
   */
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
