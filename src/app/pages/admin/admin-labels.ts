import { Injectable, inject } from '@angular/core';
import { ApiClientError, ApiPermissionDescriptor } from '../../core/api/administration.api';
import { I18nService } from '../../core/i18n';
import { AppStore } from '../../core/state/store';
import { formatDateTime, formatDateTimeLong } from '../../core/utils/dates';

const ACTION_KEYS: Readonly<Record<number, string>> = {
  1: 'view',
  2: 'list',
  3: 'create',
  4: 'edit',
  5: 'delete',
  6: 'disable',
  7: 'export',
};
const LEVEL_KEYS: Readonly<Record<number, string>> = { 1: 'basic', 2: 'advanced', 3: 'premium' };
const FEATURE_KEYS: ReadonlySet<string> = new Set([
  'dashboard',
  'movements',
  'calendar',
  'accounts',
  'people',
  'portfolio',
  'planning',
  'reports',
  'notifications',
  'settings',
]);
const RESOURCE_KEYS: ReadonlySet<string> = new Set([
  'dashboard',
  'movimientos',
  'calendario',
  'cuentas',
  'personas',
  'patrimonio',
  'planificacion',
  'reportes',
  'notificaciones',
  'preferencias',
  'organizacion',
  'administracion',
  'sesion',
]);

@Injectable({ providedIn: 'root' })
export class AdminLabels {
  private readonly i18n = inject(I18nService);

  initials(name: string): string {
    return name
      .split(' ')
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase();
  }

  action(permission: ApiPermissionDescriptor): string {
    const key = ACTION_KEYS[permission.action];
    return this.i18n.t(key ? `admin.permissions.action.${key}` : 'admin.permissions.action.fallback');
  }

  level(permission: ApiPermissionDescriptor): string {
    return this.i18n.t(`admin.permissions.level.${LEVEL_KEYS[permission.level] ?? 'basic'}`);
  }

  private readonly store = inject(AppStore);

  dateTime(value: string | null | undefined): string {
    return formatDateTime(value, this.store.preferences().locale);
  }

  dateTimeLong(value: string | null | undefined): string {
    return formatDateTimeLong(value, this.store.preferences().locale);
  }

  auditAction(action: string): string {
    const key = `admin.audit.actionName.${action}`;
    const text = this.i18n.t(key);
    return text === key ? action : text;
  }

  auditEntity(entity: string): string {
    const key = `admin.audit.entityName.${entity}`;
    const text = this.i18n.t(key);
    return text === key ? entity : text;
  }

  feature(key: string): string {
    return FEATURE_KEYS.has(key) ? this.i18n.t(`nav.${key}`) : key;
  }

  resource(name: string): string {
    return RESOURCE_KEYS.has(name) ? this.i18n.t(`admin.resources.${name}`) : name;
  }

  errorState(status: ApiClientError['status']): string {
    return this.i18n.t(`admin.errors.state.${status}`);
  }
}
