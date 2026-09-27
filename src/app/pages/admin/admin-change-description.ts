import { AdminChange } from './admin-changes';

export interface AdminNames {
  user(id: string): string;
  role(id: string): string;
  organization(id: string): string;
}

type Translate = (key: string, params?: Record<string, string | number>) => string;

export function describeAdminChange(change: AdminChange, names: AdminNames, t: Translate): string {
  const estado = (on: boolean) => t(on ? 'admin.common.enabled' : 'admin.common.disabled');
  switch (change.kind) {
    case 'userActive':
      return t(change.value ? 'admin.changes.userActivate' : 'admin.changes.userDeactivate', {
        user: names.user(change.userId),
      });
    case 'userRoles':
      return t('admin.changes.userRoles', {
        user: names.user(change.userId),
        roles: change.roleIds.map((id) => names.role(id)).join(', ') || t('admin.users.directAccess'),
      });
    case 'userOrganization':
      return t('admin.changes.userOrganization', {
        user: names.user(change.userId),
        organization: names.organization(change.organizationId),
      });
    case 'roleActive':
      return t(change.value ? 'admin.changes.roleActivate' : 'admin.changes.roleDeactivate', {
        role: names.role(change.roleId),
      });
    case 'flag': {
      const alcance = change.userId
        ? names.user(change.userId)
        : change.organizationId
          ? names.organization(change.organizationId)
          : t('admin.flags.audience.global');
      return t('admin.changes.flag', { key: change.key, scope: alcance, state: estado(change.value) });
    }
    case 'organizationActive':
      return t(change.value ? 'admin.changes.organizationActivate' : 'admin.changes.organizationDeactivate', {
        organization: names.organization(change.organizationId),
      });
    case 'organizationDefault':
      return t('admin.changes.organizationDefault', { organization: names.organization(change.organizationId) });
  }
}
