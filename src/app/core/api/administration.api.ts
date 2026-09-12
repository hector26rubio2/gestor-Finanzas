import { inject, Injectable } from '@angular/core';
import { API_TRANSPORT } from '../http/api-http-client';
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
    overrides?: readonly ApiAdminOverride[];
    roles: readonly ApiAdminRole[];
  }[];
}

export interface ApiAdminRole {
  id: string;
  name: string;
  description: string | null;
  organizationId?: string;
  /** Capacidades íntegramente concedidas. Derivada del servidor, solo lectura. */
  capabilities: readonly string[];
  /** Permisos concedidos, uno por acción. Es lo que se edita. */
  permissions: readonly string[];
  isSystem: boolean;
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

/** Una excepcion directa sobre una persona. */
export interface ApiAdminOverride {
  code: string;
  isAllowed: boolean;
  affects: readonly string[];
}

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
}

@Injectable({ providedIn: 'root' })
export class AdministrationApi {
  private readonly transport = inject(API_TRANSPORT);

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

  setAdminUserCapability(id: string, organizationId: string, capability: string, isAllowed: boolean | null) {
    return this.transport.request<void>({
      method: 'PUT',
      path: API_ROUTES.adminUserCapability(id),
      body: { organizationId, capability, isAllowed },
    });
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

  adminRoles() {
    return this.transport.request<readonly ApiAdminRole[]>({ method: 'GET', path: API_ROUTES.adminRoles });
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

  superAdminAudit(page = 1, size = 50) {
    return this.transport.request<ApiPage<ApiAuditEvent>>({
      method: 'GET',
      path: API_ROUTES.superAdminAudit,
      params: { page, size },
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
}
