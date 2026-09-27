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
  traceId?: string;
}
