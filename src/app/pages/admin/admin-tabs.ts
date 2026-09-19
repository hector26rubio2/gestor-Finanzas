import { P } from '../../core/session/permissions';
import type { AdminTab } from './admin.store';

export interface AdminTabItem {
  readonly id: AdminTab;
  readonly labelKey: string;
  readonly icon: string;
  readonly capability: string;
}

export const ADMIN_TABS: readonly AdminTabItem[] = [
  { id: 'summary', labelKey: 'admin.tabs.summary', icon: 'dashboard', capability: P.administracion.ver },
  { id: 'users', labelKey: 'admin.tabs.users', icon: 'people', capability: P.administracion.usuarios.listar },
  { id: 'roles', labelKey: 'admin.tabs.roles', icon: 'shield', capability: P.administracion.roles.listar },
  {
    id: 'organizations',
    labelKey: 'admin.tabs.organizations',
    icon: 'organization',
    capability: P.administracion.organizaciones.listar,
  },
  { id: 'flags', labelKey: 'admin.tabs.flags', icon: 'flag', capability: P.administracion.banderas.listar },
  { id: 'audit', labelKey: 'admin.tabs.audit', icon: 'list', capability: P.administracion.auditoria.listar },
  { id: 'errors', labelKey: 'admin.tabs.errors', icon: 'notifications', capability: P.administracion.errores.listar },
];

export const ADMIN_TAB_IDS: readonly string[] = ADMIN_TABS.map((tab) => tab.id);
