import { inject, Injectable } from '@angular/core';
import { API_TRANSPORT } from '../http/api-http-client';
import { RUNTIME_CONFIG } from '../session/runtime';
import { API_ROUTES } from './api-routes';
import { ApiFeatureFlag } from './preferences.api';
import { ApiPage } from './shared-api-types';

export interface ApiAuditEvent {
  id: string;
  userId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  traceId: string;
  changesJson: string | null;
  createdAt: string;
  organizationId?: string;
  /** Quién hizo el cambio; `userId` es la persona afectada. Nulo si lo hizo el sistema. */
  actorUserId?: string | null;
}

/** Filtros de la auditoría; se aplican en el servidor y se combinan. */
export interface ApiAuditFilter {
  organizationId?: string;
  actorUserId?: string;
  userId?: string;
  traceId?: string;
  entityId?: string;
  action?: string;
  entityType?: string;
  from?: string;
  to?: string;
}

export interface ApiBugReportResult {
  error: ApiClientError;
  githubIssueUrl: string | null;
  githubStatus: 'created' | 'disabled' | 'rejected' | 'failed';
  githubDetail: string | null;
}

export interface ApiAdminUser {
  id: string;
  displayName: string;
  email: string;
  isActive: boolean;
  lastSeenAt: string | null;
  roles: readonly string[];
  capabilities: readonly string[];
  isSuperAdmin?: boolean;
  createdAt?: string;
  memberships?: readonly {
    id: string;
    organizationId: string;
    organizationName: string;
    status: string;
    effectiveCapabilities: readonly string[];
    /** Lo que la persona puede hacer ahora, accion por accion. */
    effectivePermissions?: readonly string[];
    /** Excepciones directas: mandan sobre lo que digan los roles. */
    roles: readonly ApiAdminRole[];
  }[];
}

export interface ApiAdminRole {
  id: string;
  name: string;
  description: string | null;
  organizationId?: string;
  organizationName?: string;
  /** Capacidades íntegramente concedidas. Derivada del servidor, solo lectura. */
  capabilities: readonly string[];
  /** Permisos concedidos, uno por acción. Es lo que se edita. */
  permissions: readonly string[];
  isSystem: boolean;
  /** En falso, nadie recibe sus permisos aunque siga asignado. */
  isActive: boolean;
}

/** Una organización, tal como la ve Administración. */
export interface ApiAdminOrganization {
  id: string;
  name: string;
  slug: string;
  baseCurrency: string;
  isActive: boolean;
  /** La organización donde cae quien entra sin invitación pendiente. A lo sumo una. */
  isDefault: boolean;
  memberCount: number;
  createdAt: string;
}

/** Valor efectivo de una bandera para una organización y de dónde sale. */
export interface ApiConsolidationResult {
  targetOrganizationId: string;
  movedUsers: number;
  archivedOrganizations: number;
  deletedOrganizations: number;
}

export interface ApiAdminOrganizationFlag {
  key: string;
  isEnabled: boolean;
  /** `organization` si la organización la fija ella misma; si no, hereda de `global` o `default`. */
  source: 'organization' | 'global' | 'default';
  organizationValue: boolean | null;
  globalEnabled: boolean;
}

/** Un permiso del catálogo: código, dónde vive y qué concede. */
export interface ApiPermissionDescriptor {
  code: string;
  resource: string;
  action: number;
  level: number;
  description: string;
}

/** Espejo de `PermissionActionDto`. */
export const ApiPermissionAction: Readonly<Record<number, string>> = {
  1: 'Ver',
  2: 'Listar',
  3: 'Crear',
  4: 'Editar',
  5: 'Eliminar',
  6: 'Deshabilitar',
  7: 'Exportar',
};

/** Espejo de `PermissionLevelDto`. */
export const ApiPermissionLevel: Readonly<Record<number, string>> = {
  1: 'básico',
  2: 'avanzado',
  3: 'premium',
};

/** Una persona dentro de la organizacion activa. */
export interface ApiOrganizationMember {
  membershipId: string;
  userId: string;
  displayName: string;
  email: string;
  status: string;
  roles: readonly string[];
  createdAt: string;
}

export interface ApiCapabilityDescriptor {
  key: string;
  module: string;
  description: string;
}

export interface ApiAdminFeatureFlag {
  key: string;
  organizationId: string | null;
  userId: string | null;
  isEnabled: boolean;
  updatedAt: string;
}

export interface ApiClientError {
  id: string;
  fingerprint: string;
  message: string;
  source: 'web' | 'desktop' | 'api';
  status: 'new' | 'investigating' | 'resolved';
  occurrences: number;
  affectedUsers: number;
  version: string;
  lastSeenAt: string;
  traceId: string | null;
  organizationId?: string | null;
  userId?: string | null;
  contextJson?: string | null;
  resolution?: string | null;
  createdAt?: string;
  resolvedAt?: string | null;
  /** Presentes solo en reportes manuales enviados desde el botón flotante. */
  title?: string | null;
  severity?: 'low' | 'medium' | 'high' | 'critical' | null;
  stepsToReproduce?: string | null;
  url?: string | null;
  hasScreenshot?: boolean;
  githubIssueUrl?: string | null;
  githubIssueNumber?: number | null;
}

/** Lo que arma `BugReportButtonComponent` a partir de lo capturado en el navegador. */
export interface BugReportPayload {
  title: string;
  description: string;
  stepsToReproduce?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  url: string;
  consoleLogJson?: string;
  systemInfoJson?: string;
  screenshotBase64?: string;
}

@Injectable({ providedIn: 'root' })
export class AdministrationApi {
  private readonly transport = inject(API_TRANSPORT);
  private readonly runtime = inject(RUNTIME_CONFIG);

  audit(page = 1, size = 50) {
    return this.transport.request<ApiPage<ApiAuditEvent>>({
      method: 'GET',
      path: API_ROUTES.audit,
      params: { page, size },
    });
  }

  /** Bandera org/usuario vista desde administración (no el efectivo de un usuario). */
  updateFeatureFlag(key: string, request: { isEnabled: boolean; audienceJson?: string | null }) {
    return this.transport.request<ApiFeatureFlag>({
      method: 'PUT',
      path: API_ROUTES.adminFeatureFlag(key),
      body: request,
    });
  }

  adminUsers(page = 1, size = 25, search = '') {
    return this.transport.request<ApiPage<ApiAdminUser>>({
      method: 'GET',
      path: API_ROUTES.adminUsers,
      params: { page, size, search },
    });
  }

  setAdminUserActive(id: string, isActive: boolean) {
    return this.transport.request<void>({ method: 'PUT', path: API_ROUTES.adminUserActive(id), body: { isActive } });
  }

  /** Personas de la organizacion activa, invitadas incluidas. */
  organizationMembers() {
    return this.transport.request<readonly ApiOrganizationMember[]>({
      method: 'GET',
      path: API_ROUTES.organizationMembers,
    });
  }

  /** Suma a alguien por correo, con los roles con los que entrara. */
  inviteOrganizationMember(request: { email: string; displayName?: string; roleIds: readonly string[] }) {
    return this.transport.request<ApiOrganizationMember>({
      method: 'POST',
      path: API_ROUTES.organizationMembers,
      body: request,
    });
  }

  adminRoles(page = 1, size = 25, organizationId?: string) {
    return this.transport.request<ApiPage<ApiAdminRole>>({
      method: 'GET',
      path: API_ROUTES.adminRoles,
      params: organizationId ? { page, size, organizationId } : { page, size },
    });
  }

  adminOrganizations(page = 1, size = 25) {
    return this.transport.request<ApiPage<ApiAdminOrganization>>({
      method: 'GET',
      path: API_ROUTES.adminOrganizations,
      params: { page, size },
    });
  }

  createAdminOrganization(request: { name: string; baseCurrency?: string | null }) {
    return this.transport.request<ApiAdminOrganization>({
      method: 'POST',
      path: API_ROUTES.adminOrganizations,
      body: request,
    });
  }

  /** Mueve la membresía activa de una persona a otra organización. Solo un administrador. */
  moveAdminUserOrganization(id: string, organizationId: string) {
    return this.transport.request<void>({
      method: 'PUT',
      path: API_ROUTES.adminUserOrganization(id),
      body: { organizationId },
    });
  }

  deleteAdminRole(id: string) {
    return this.transport.request<void>({ method: 'DELETE', path: API_ROUTES.adminRole(id) });
  }

  setAdminRoleActive(id: string, isActive: boolean) {
    return this.transport.request<void>({ method: 'PUT', path: API_ROUTES.adminRoleActive(id), body: { isActive } });
  }

  /** Catálogo completo: una fila por acción, que es lo que pinta el editor de roles. */
  superAdminPermissions() {
    return this.transport.request<readonly ApiPermissionDescriptor[]>({
      method: 'GET',
      path: API_ROUTES.superAdminPermissions,
    });
  }

  superAdminCapabilities() {
    return this.transport.request<readonly ApiCapabilityDescriptor[]>({
      method: 'GET',
      path: API_ROUTES.superAdminCapabilities,
    });
  }

  assignAdminUserRoles(id: string, organizationId: string, roleIds: readonly string[]) {
    return this.transport.request<void>({
      method: 'PUT',
      path: API_ROUTES.adminUserRoles(id),
      body: { organizationId, roleIds },
    });
  }

  adminFeatureFlags() {
    return this.transport.request<readonly ApiAdminFeatureFlag[]>({
      method: 'GET',
      path: API_ROUTES.superAdminFeatureFlags,
    });
  }

  updateAdminFeatureFlag(
    key: string,
    request: { organizationId?: string | null; userId?: string | null; isEnabled: boolean },
  ) {
    return this.transport.request<ApiAdminFeatureFlag>({
      method: 'PUT',
      path: API_ROUTES.superAdminFeatureFlag(key),
      body: request,
    });
  }

  superAdminAudit(page = 1, size = 50, filter: ApiAuditFilter = {}) {
    const params: Record<string, string | number> = { page, size };
    for (const [key, value] of Object.entries(filter)) if (value) params[key] = value;
    return this.transport.request<ApiPage<ApiAuditEvent>>({
      method: 'GET',
      path: API_ROUTES.superAdminAudit,
      params,
    });
  }

  updateAdminOrganization(id: string, request: { name?: string; isActive?: boolean }) {
    return this.transport.request<ApiAdminOrganization>({
      method: 'PUT',
      path: API_ROUTES.adminOrganization(id),
      body: request,
    });
  }

  deleteAdminOrganization(id: string) {
    return this.transport.request<void>({ method: 'DELETE', path: API_ROUTES.adminOrganizationDelete(id) });
  }

  consolidateAdminOrganizations() {
    return this.transport.request<ApiConsolidationResult>({
      method: 'POST',
      path: API_ROUTES.adminOrganizationsConsolidate,
      params: { deleteOthers: 'true' },
    });
  }

  setDefaultAdminOrganization(id: string) {
    return this.transport.request<ApiAdminOrganization>({
      method: 'PUT',
      path: API_ROUTES.adminOrganizationDefault(id),
    });
  }

  /** Quiénes pertenecen a la organización, invitados incluidos. */
  adminOrganizationMembers(id: string) {
    return this.transport.request<readonly ApiOrganizationMember[]>({
      method: 'GET',
      path: API_ROUTES.adminOrganizationMembers(id),
    });
  }

  /** Suma a una persona: si ya estaba en otra organización, se muda; si no tenía ninguna activa, entra. */
  addAdminOrganizationMember(id: string, userId: string) {
    return this.transport.request<void>({
      method: 'POST',
      path: API_ROUTES.adminOrganizationMembers(id),
      body: { userId },
    });
  }

  adminOrganizationFlags(id: string) {
    return this.transport.request<readonly ApiAdminOrganizationFlag[]>({
      method: 'GET',
      path: API_ROUTES.adminOrganizationFlags(id),
    });
  }

  setAdminOrganizationFlag(id: string, key: string, isEnabled: boolean) {
    return this.transport.request<ApiAdminOrganizationFlag>({
      method: 'PUT',
      path: API_ROUTES.adminOrganizationFlag(id, key),
      body: { isEnabled },
    });
  }

  saveAdminRole(
    id: string | null,
    request: {
      organizationId?: string;
      name: string;
      description: string;
      capabilities: readonly string[];
      permissions?: readonly string[];
    },
  ) {
    return this.transport.request<ApiAdminRole>({
      method: id ? 'PUT' : 'POST',
      path: id ? API_ROUTES.adminRole(id) : API_ROUTES.adminRoles,
      body: request,
    });
  }

  adminErrors(page = 1, size = 25, status = '') {
    return this.transport.request<ApiPage<ApiClientError>>({
      method: 'GET',
      path: API_ROUTES.adminErrors,
      params: { page, size, status },
    });
  }

  updateAdminError(id: string, status: ApiClientError['status'], resolution?: string) {
    return this.transport.request<ApiClientError>({
      method: 'PUT',
      path: API_ROUTES.adminError(id),
      body: { status, resolution },
    });
  }

  reportBug(payload: BugReportPayload) {
    return this.transport.request<ApiBugReportResult>({
      method: 'POST',
      path: API_ROUTES.bugReports,
      body: payload,
    });
  }

  /** URL directa (fuera del transporte JSON) para pintar la captura en un `<img>`; va por cookie de sesión. */
  screenshotUrl(id: string): string {
    return `${this.runtime.apiBaseUrl ?? ''}${API_ROUTES.adminErrorScreenshot(id)}`;
  }

  createErrorGithubIssue(id: string) {
    return this.transport.request<ApiBugReportResult>({
      method: 'POST',
      path: API_ROUTES.adminErrorGithubIssue(id),
    });
  }
}
