import { AdminStore } from './admin.store';
import { AdminAuditStore } from './stores/admin-audit.store';
import { AdminCommands } from './stores/admin-commands';
import { AdminDrafts } from './stores/admin-drafts';
import { AdminErrorsStore } from './stores/admin-errors.store';
import { AdminFlagsStore } from './stores/admin-flags.store';
import { AdminPermissionsStore } from './stores/admin-permissions.store';

export const ADMIN_STORE_PROVIDERS = [
  AdminStore,
  AdminCommands,
  AdminDrafts,
  AdminFlagsStore,
  AdminAuditStore,
  AdminErrorsStore,
  AdminPermissionsStore,
];
