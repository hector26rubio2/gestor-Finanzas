import { inject, Injectable } from '@angular/core';
import { API_TRANSPORT } from '@core/http/api-http-client';
import { RUNTIME_CONFIG } from '@core/session/runtime';
import { API_ROUTES } from './api-routes';
import { ApiFeatureFlag } from './preferences.api';
import { ApiPage } from './shared-api-types';

import {
  ApiAuditEvent,
  ApiAuditFilter,
  ApiBugReportResult,
  ApiAdminUser,
  ApiAdminRole,
  ApiAdminOrganization,
  ApiConsolidationResult,
  ApiAdminOrganizationFlag,
  ApiPermissionDescriptor,
  ApiOrganizationMember,
  ApiCapabilityDescriptor,
  ApiAdminFeatureFlag,
  ApiClientError,
  BugReportPayload,
} from './administration.models';

export * from './administration.models';

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

  organizationMembers() {
    return this.transport.request<readonly ApiOrganizationMember[]>({
      method: 'GET',
      path: API_ROUTES.organizationMembers,
    });
  }

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

  superAdminPermissions() {
    return this.transport.request<readonly ApiPermissionDescriptor[]>({
      method: 'GET',
      path: API_ROUTES.superAdminPermissions,
    });
  }

  setPermissionDescription(code: string, description: string | null) {
    return this.transport.request<void>({
      method: 'PUT',
      path: API_ROUTES.superAdminPermission(code),
      body: { description },
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

  adminOrganizationMembers(id: string) {
    return this.transport.request<readonly ApiOrganizationMember[]>({
      method: 'GET',
      path: API_ROUTES.adminOrganizationMembers(id),
    });
  }

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

  adminErrors(page = 1, size = 25, status = '', traceId?: string) {
    return this.transport.request<ApiPage<ApiClientError>>({
      method: 'GET',
      path: API_ROUTES.adminErrors,
      params: { page, size, status, traceId },
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

  reportClientError(payload: {
    source: 'web';
    fingerprint: string;
    message: string;
    contextJson: string;
    traceId?: string | null;
  }) {
    return this.transport.request<ApiClientError>({
      method: 'POST',
      path: API_ROUTES.clientErrors,
      body: payload,
    });
  }

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
