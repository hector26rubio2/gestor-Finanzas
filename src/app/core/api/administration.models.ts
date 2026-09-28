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
  actorUserId?: string | null;
}

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
    effectivePermissions?: readonly string[];
    roles: readonly ApiAdminRole[];
  }[];
}

export interface ApiAdminRole {
  id: string;
  name: string;
  description: string | null;
  organizationId?: string;
  organizationName?: string;
  capabilities: readonly string[];
  permissions: readonly string[];
  isSystem: boolean;
  isActive: boolean;
}

export interface ApiAdminOrganization {
  id: string;
  name: string;
  slug: string;
  baseCurrency: string;
  isActive: boolean;
  isDefault: boolean;
  memberCount: number;
  createdAt: string;
}

export interface ApiConsolidationResult {
  targetOrganizationId: string;
  movedUsers: number;
  archivedOrganizations: number;
  deletedOrganizations: number;
}

export interface ApiAdminOrganizationFlag {
  key: string;
  isEnabled: boolean;
  source: 'organization' | 'global' | 'default';
  organizationValue: boolean | null;
  globalEnabled: boolean;
}

export interface ApiPermissionDescriptor {
  code: string;
  resource: string;
  action: number;
  level: number;
  description: string;
}

export const ApiPermissionAction: Readonly<Record<number, string>> = {
  1: 'Ver',
  2: 'Listar',
  3: 'Crear',
  4: 'Editar',
  5: 'Eliminar',
  6: 'Deshabilitar',
  7: 'Exportar',
};

export const ApiPermissionLevel: Readonly<Record<number, string>> = {
  1: 'básico',
  2: 'avanzado',
  3: 'premium',
};

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
  title?: string | null;
  severity?: 'low' | 'medium' | 'high' | 'critical' | null;
  stepsToReproduce?: string | null;
  url?: string | null;
  hasScreenshot?: boolean;
  githubIssueUrl?: string | null;
  githubIssueNumber?: number | null;
}

export interface BugReportPayload {
  title: string;
  description: string;
  stepsToReproduce?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  url: string;
  consoleLogJson?: string;
  systemInfoJson?: string;
  screenshotBase64?: string;
  traceId?: string;
}
