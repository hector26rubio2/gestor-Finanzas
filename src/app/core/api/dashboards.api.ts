import { inject, Injectable } from '@angular/core';
import { API_TRANSPORT } from '@core/http/api-http-client';
import { API_ROUTES } from './api-routes';
import { ApiLinkRef } from './shared-api-types';

export interface ApiSavedDashboard {
  id: string;
  name: string;
  owner: ApiLinkRef;
  isMine: boolean;
  isPinned: boolean;
  sharedWith: readonly ApiLinkRef[];
  layoutJson: string | null;
  updatedAt: string;
  kind?: string;
}

export interface ApiDashboardMember {
  id: string;
  name: string;
  email: string;
}

const PREFIJO_DE_VISTA = {
  dashboard: '/api/v1/dashboards',
  'plan.deudas': '/api/v1/planning/plans/debts',
  'plan.compras': '/api/v1/planning/plans/purchases',
  'plan.vacaciones': '/api/v1/planning/plans/vacations',
  'plan.inversiones': '/api/v1/planning/plans/investments',
  reporte: '/api/v1/reports/saved',
} as const;

export type TipoDeVista = keyof typeof PREFIJO_DE_VISTA;

@Injectable({ providedIn: 'root' })
export class DashboardsApi {
  private readonly transport = inject(API_TRANSPORT);

  lista(tipo: TipoDeVista) {
    return this.transport.request<readonly ApiSavedDashboard[]>({ method: 'GET', path: PREFIJO_DE_VISTA[tipo] });
  }

  una(tipo: TipoDeVista, id: string) {
    return this.transport.request<ApiSavedDashboard>({
      method: 'GET',
      path: `${PREFIJO_DE_VISTA[tipo]}/${encodeURIComponent(id)}`,
    });
  }

  miembrosPara(tipo: TipoDeVista) {
    return this.transport.request<readonly ApiDashboardMember[]>({
      method: 'GET',
      path: `${PREFIJO_DE_VISTA[tipo]}/members`,
    });
  }

  crear(tipo: TipoDeVista, request: { name: string; layoutJson?: string | null; copyFrom?: string | null }) {
    return this.transport.request<ApiSavedDashboard>({ method: 'POST', path: PREFIJO_DE_VISTA[tipo], body: request });
  }

  actualizar(tipo: TipoDeVista, id: string, request: { name: string; layoutJson: string | null; isPinned: boolean }) {
    return this.transport.request<ApiSavedDashboard>({
      method: 'PUT',
      path: `${PREFIJO_DE_VISTA[tipo]}/${encodeURIComponent(id)}`,
      body: request,
    });
  }

  borrar(tipo: TipoDeVista, id: string) {
    return this.transport.request<void>({
      method: 'DELETE',
      path: `${PREFIJO_DE_VISTA[tipo]}/${encodeURIComponent(id)}`,
    });
  }

  compartirCon(tipo: TipoDeVista, id: string, users: readonly string[]) {
    return this.transport.request<ApiSavedDashboard>({
      method: 'PUT',
      path: `${PREFIJO_DE_VISTA[tipo]}/${encodeURIComponent(id)}/shares`,
      body: { users },
    });
  }

  dashboards() {
    return this.transport.request<readonly ApiSavedDashboard[]>({ method: 'GET', path: API_ROUTES.dashboards });
  }

  dashboard(id: string) {
    return this.transport.request<ApiSavedDashboard>({ method: 'GET', path: API_ROUTES.savedDashboard(id) });
  }

  members() {
    return this.transport.request<readonly ApiDashboardMember[]>({ method: 'GET', path: API_ROUTES.dashboardMembers });
  }

  create(request: { name: string; layoutJson?: string | null; copyFrom?: string | null }) {
    return this.transport.request<ApiSavedDashboard>({ method: 'POST', path: API_ROUTES.dashboards, body: request });
  }

  update(id: string, request: { name: string; layoutJson: string | null; isPinned: boolean }) {
    return this.transport.request<ApiSavedDashboard>({
      method: 'PUT',
      path: API_ROUTES.savedDashboard(id),
      body: request,
    });
  }

  remove(id: string) {
    return this.transport.request<void>({ method: 'DELETE', path: API_ROUTES.savedDashboard(id) });
  }

  share(id: string, users: readonly string[]) {
    return this.transport.request<ApiSavedDashboard>({
      method: 'PUT',
      path: API_ROUTES.savedDashboardShares(id),
      body: { users },
    });
  }
}
