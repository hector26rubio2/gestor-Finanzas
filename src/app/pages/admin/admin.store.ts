import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  AdministrationApi,
  ApiAdminFeatureFlag,
  ApiAdminOrganization,
  ApiAdminOrganizationFlag,
  ApiAdminRole,
  ApiAdminUser,
  ApiAuditEvent,
  ApiAuditFilter,
  ApiClientError,
  ApiOrganizationMember,
  ApiPermissionDescriptor,
} from '../../core/api/administration.api';
import { CAPABILITIES, AppStore } from '../../core/state/store';
import { I18nService } from '../../core/i18n';
import { P } from '../../core/session/permissions';
import { RemoteBootstrap } from '../../core/session/remote-bootstrap';
import { ApiPage } from '../../core/api/shared-api-types';
import { AdminChange, affectsAccess, changeKey, changeWave, sameIds } from './admin-changes';

export type AdminTab = 'summary' | 'users' | 'roles' | 'organizations' | 'flags' | 'audit' | 'errors';

export interface SaveFailure {
  key: string;
  label: string;
  reason: string;
}

const serverStatus = (status: string): string => (status === 'new' ? 'open' : status);

const EMPTY_PAGE = { items: [], page: 1, size: 0, total: 0, totalPages: 0, hasNext: false } as const;

@Injectable()
export class AdminStore {
  private readonly api = inject(AdministrationApi);
  private readonly arranque = inject(RemoteBootstrap);
  private readonly app = inject(AppStore);
  private readonly caps = inject(CAPABILITIES);
  private readonly i18n = inject(I18nService);

  readonly tab = signal<AdminTab>('summary');
  private readonly directory = signal<Readonly<Record<string, ApiAdminUser>>>({});
  readonly users = signal<readonly ApiAdminUser[]>([]);
  readonly usersPage = signal(1);
  readonly usersTotal = signal(0);
  readonly usersSize = 25;
  readonly userSearch = signal('');
  readonly roles = signal<readonly ApiAdminRole[]>([]);
  readonly rolesPage = signal(1);
  readonly rolesTotal = signal(0);
  readonly rolesSize = 12;
  readonly rolesOrganizationFilter = signal('');
  private readonly rolesByOrganization = signal<Readonly<Record<string, readonly ApiAdminRole[]>>>({});
  readonly organizations = signal<readonly ApiAdminOrganization[]>([]);
  readonly flags = signal<readonly ApiAdminFeatureFlag[]>([]);
  readonly permissionCatalog = signal<readonly ApiPermissionDescriptor[]>([]);
  readonly audit = signal<readonly ApiAuditEvent[]>([]);
  readonly auditPage = signal(1);
  readonly auditTotal = signal(0);
  readonly auditSize = 25;
  readonly auditFilter = signal<ApiAuditFilter>({});
  readonly errors = signal<readonly ApiClientError[]>([]);
  readonly errorsPage = signal(1);
  readonly errorsTotal = signal(0);
  readonly errorsSize = 25;
  readonly errorsStatus = signal('');
  private readonly membersByOrganization = signal<Readonly<Record<string, readonly ApiOrganizationMember[]>>>({});
  private readonly flagsByOrganization = signal<Readonly<Record<string, readonly ApiAdminOrganizationFlag[]>>>({});

  readonly loading = signal(false);
  readonly loadFailed = signal(false);
  readonly sinDatos = computed(() => this.app.runtime.mode !== 'api');

  private readonly pending = signal<ReadonlyMap<string, AdminChange>>(new Map());
  readonly changes = computed(() => [...this.pending().values()]);
  readonly count = computed(() => this.pending().size);
  readonly dirty = computed(() => this.pending().size > 0);
  readonly saving = signal(false);
  readonly failures = signal<readonly SaveFailure[]>([]);

  readonly permissionGroups = computed(() => {
    const groups = new Map<string, ApiPermissionDescriptor[]>();
    for (const permiso of this.permissionCatalog()) {
      const items = groups.get(permiso.resource) ?? [];
      items.push(permiso);
      groups.set(permiso.resource, items);
    }
    return [...groups.entries()].map(([name, items]) => ({ name, items }));
  });
  readonly organizationOptions = computed(() =>
    this.organizations().map((org) => ({
      value: org.id,
      label: this.isDefaultOrganization(org)
        ? this.i18n.t('admin.organizations.defaultOption', { name: org.name })
        : org.name,
    })),
  );
  readonly platformFlags = computed(() => {
    const rows = new Map<string, ApiAdminFeatureFlag>();
    for (const flag of this.flags()) if (!flag.organizationId && !flag.userId) rows.set(flag.key, flag);
    return [...rows.values()].sort((a, b) => a.key.localeCompare(b.key));
  });

  async cargar(): Promise<void> {
    if (this.sinDatos() || !this.caps.allows(P.administracion.ver)) return;
    this.loading.set(true);
    this.loadFailed.set(false);
    const puede = (permiso: string) => this.caps.allows(permiso);
    const vacio = <T>(): Promise<ApiPage<T>> => Promise.resolve(EMPTY_PAGE as ApiPage<T>);
    const resultados = await Promise.allSettled([
      puede(P.administracion.usuarios.listar)
        ? firstValueFrom(this.api.adminUsers(1, this.usersSize, this.userSearch()))
        : vacio<ApiAdminUser>(),
      puede(P.administracion.roles.listar)
        ? firstValueFrom(this.api.adminRoles(1, this.rolesSize, this.rolesOrganizationFilter() || undefined))
        : vacio<ApiAdminRole>(),
      puede(P.administracion.organizaciones.listar)
        ? firstValueFrom(this.api.adminOrganizations(1, 100))
        : vacio<ApiAdminOrganization>(),
      puede(P.administracion.auditoria.listar)
        ? firstValueFrom(this.api.superAdminAudit(1, this.auditSize, this.auditFilter()))
        : vacio<ApiAuditEvent>(),
      puede(P.administracion.errores.listar)
        ? firstValueFrom(this.api.adminErrors(1, this.errorsSize, serverStatus(this.errorsStatus())))
        : vacio<ApiClientError>(),
      puede(P.administracion.banderas.listar) ? firstValueFrom(this.api.adminFeatureFlags()) : Promise.resolve([]),
      puede(P.administracion.capacidades.listar)
        ? firstValueFrom(this.api.superAdminPermissions())
        : Promise.resolve([]),
    ]);
    const [u, r, o, a, e, f, p] = resultados;
    if (u.status === 'fulfilled') this.aplicarUsuarios(u.value);
    if (r.status === 'fulfilled') this.aplicarRoles(r.value);
    if (o.status === 'fulfilled') this.organizations.set(o.value.items);
    if (a.status === 'fulfilled') this.aplicarAuditoria(a.value);
    if (e.status === 'fulfilled') this.aplicarErrores(e.value);
    if (f.status === 'fulfilled') this.flags.set(f.value);
    if (p.status === 'fulfilled') this.permissionCatalog.set(p.value);
    this.loadFailed.set(resultados.some((x) => x.status === 'rejected'));
    if (this.loadFailed()) this.app.toast.set(this.i18n.t('admin.toast.loadFailed'));
    this.loading.set(false);
  }

  private aplicarUsuarios(page: ApiPage<ApiAdminUser>): void {
    this.users.set(
      page.items.map((user) => ({
        ...user,
        roles: user.roles ?? user.memberships?.flatMap((m) => m.roles.map((role) => role.name)) ?? [],
        capabilities: user.capabilities ?? user.memberships?.flatMap((m) => m.effectiveCapabilities) ?? [],
      })),
    );
    this.usersPage.set(page.page);
    this.usersTotal.set(page.total);
  }

  private aplicarRoles(page: ApiPage<ApiAdminRole>): void {
    this.roles.set(page.items);
    this.rolesPage.set(page.page);
    this.rolesTotal.set(page.total);
  }

  private aplicarAuditoria(page: ApiPage<ApiAuditEvent>): void {
    this.audit.set(page.items);
    this.auditPage.set(page.page);
    this.auditTotal.set(page.total);
  }

  private aplicarErrores(page: ApiPage<ApiClientError>): void {
    this.errors.set(
      page.items.map((error) => ({
        ...error,
        status: ((error.status as string) === 'open' ? 'new' : error.status) as ApiClientError['status'],
        occurrences: error.occurrences ?? 1,
        affectedUsers: error.affectedUsers ?? 1,
        version: error.version ?? error.source,
        traceId: error.traceId ?? null,
        lastSeenAt: error.lastSeenAt ?? error.createdAt ?? new Date().toISOString(),
      })),
    );
    this.errorsPage.set(page.page);
    this.errorsTotal.set(page.total);
  }

  async cargarUsuarios(page = this.usersPage(), search = this.userSearch()): Promise<void> {
    if (!this.caps.allows(P.administracion.usuarios.listar)) return;
    try {
      this.userSearch.set(search);
      this.aplicarUsuarios(await firstValueFrom(this.api.adminUsers(page, this.usersSize, search)));
    } catch {
      this.app.toast.set(this.i18n.t('admin.toast.loadFailed'));
    }
  }

  async cargarRoles(page: number, organizationId = this.rolesOrganizationFilter()): Promise<void> {
    if (!this.caps.allows(P.administracion.roles.listar)) return;
    try {
      this.rolesOrganizationFilter.set(organizationId);
      this.aplicarRoles(await firstValueFrom(this.api.adminRoles(page, this.rolesSize, organizationId || undefined)));
    } catch {
      this.app.toast.set(this.i18n.t('admin.toast.loadFailed'));
    }
  }

  async cargarAuditoria(page: number, filter: ApiAuditFilter = this.auditFilter()): Promise<void> {
    if (!this.caps.allows(P.administracion.auditoria.listar)) return;
    try {
      this.auditFilter.set(filter);
      this.aplicarAuditoria(await firstValueFrom(this.api.superAdminAudit(page, this.auditSize, filter)));
    } catch {
      this.app.toast.set(this.i18n.t('admin.toast.loadFailed'));
    }
  }

  async cargarErrores(page: number, status = this.errorsStatus()): Promise<void> {
    if (!this.caps.allows(P.administracion.errores.listar)) return;
    try {
      this.errorsStatus.set(status);
      this.aplicarErrores(await firstValueFrom(this.api.adminErrors(page, this.errorsSize, serverStatus(status))));
    } catch {
      this.app.toast.set(this.i18n.t('admin.toast.loadFailed'));
    }
  }

  rolesOf(organizationId: string | undefined): readonly ApiAdminRole[] {
    return organizationId ? (this.rolesByOrganization()[organizationId] ?? []) : [];
  }

  async cargarRolesDe(organizationId: string): Promise<void> {
    if (this.rolesByOrganization()[organizationId] || !this.caps.allows(P.administracion.roles.listar)) return;
    try {
      const page = await firstValueFrom(this.api.adminRoles(1, 100, organizationId));
      this.rolesByOrganization.update((x) => ({ ...x, [organizationId]: page.items }));
    } catch {}
  }

  async buscarUsuarios(search: string): Promise<readonly ApiAdminUser[]> {
    if (!this.caps.allows(P.administracion.usuarios.listar)) return [];
    const page = await firstValueFrom(this.api.adminUsers(1, 8, search));
    this.directory.update((known) => ({ ...known, ...Object.fromEntries(page.items.map((user) => [user.id, user])) }));
    return page.items;
  }

  pendingMembersOf(organizationId: string): readonly string[] {
    return this.changes().flatMap((change) =>
      change.kind === 'userOrganization' && change.organizationId === organizationId ? [change.userId] : [],
    );
  }

  userName(id: string): string {
    return this.users().find((u) => u.id === id)?.displayName ?? this.directory()[id]?.displayName ?? id;
  }

  membersOf(organizationId: string): readonly ApiOrganizationMember[] | undefined {
    return this.membersByOrganization()[organizationId];
  }

  async cargarMiembros(organizationId: string): Promise<void> {
    try {
      const members = await firstValueFrom(this.api.adminOrganizationMembers(organizationId));
      this.membersByOrganization.update((x) => ({ ...x, [organizationId]: members }));
    } catch {
      this.app.toast.set(this.i18n.t('admin.toast.loadFailed'));
    }
  }

  organizationFlagsOf(organizationId: string): readonly ApiAdminOrganizationFlag[] | undefined {
    return this.flagsByOrganization()[organizationId];
  }

  async cargarBanderasDe(organizationId: string): Promise<void> {
    if (!this.caps.allows(P.administracion.banderas.listar)) return;
    try {
      const flags = await firstValueFrom(this.api.adminOrganizationFlags(organizationId));
      this.flagsByOrganization.update((x) => ({ ...x, [organizationId]: flags }));
    } catch {
      this.app.toast.set(this.i18n.t('admin.toast.loadFailed'));
    }
  }

  private draft<K extends AdminChange['kind']>(kind: K, key: string): Extract<AdminChange, { kind: K }> | undefined {
    const change = this.pending().get(key);
    return change?.kind === kind ? (change as Extract<AdminChange, { kind: K }>) : undefined;
  }

  userOrganizationId(user: ApiAdminUser): string | undefined {
    return (
      user.memberships?.find((m) => m.status === 'Active')?.organizationId ?? user.memberships?.[0]?.organizationId
    );
  }

  targetOrganizationId(user: ApiAdminUser): string | undefined {
    return (
      this.draft('userOrganization', `userOrganization:${user.id}`)?.organizationId ?? this.userOrganizationId(user)
    );
  }

  hasPendingMove(user: ApiAdminUser): boolean {
    return this.pending().has(`userOrganization:${user.id}`);
  }

  userHasChanges(user: ApiAdminUser): boolean {
    return this.changes().some((change) => 'userId' in change && change.userId === user.id);
  }

  isUserActive(user: ApiAdminUser): boolean {
    return this.draft('userActive', `userActive:${user.id}`)?.value ?? user.isActive;
  }

  userRoleIds(user: ApiAdminUser): readonly string[] {
    const organizationId = this.userOrganizationId(user);
    if (!organizationId) return [];
    return (
      this.draft('userRoles', `userRoles:${user.id}:${organizationId}`)?.roleIds ??
      this.membership(user, organizationId)?.roles.map((role) => role.id) ??
      []
    );
  }

  private membership(user: ApiAdminUser, organizationId: string) {
    return user.memberships?.find((m) => m.organizationId === organizationId);
  }

  private grantedByRoles(user: ApiAdminUser, code: string): boolean {
    const organizationId = this.userOrganizationId(user);
    const membership = organizationId ? this.membership(user, organizationId) : undefined;
    return membership?.roles.some((role) => role.isActive && role.permissions?.includes(code)) ?? false;
  }

  hasPermission(user: ApiAdminUser, code: string): boolean {
    const organizationId = this.userOrganizationId(user);
    if (!organizationId) return false;
    const draft = this.draft('userPermission', `userPermission:${user.id}:${organizationId}:${code}`);
    if (draft) return draft.value ?? this.grantedByRoles(user, code);
    return this.membership(user, organizationId)?.effectivePermissions?.includes(code) ?? false;
  }

  permissionOverride(user: ApiAdminUser, code: string): boolean | null {
    const organizationId = this.userOrganizationId(user);
    if (!organizationId) return null;
    const draft = this.draft('userPermission', `userPermission:${user.id}:${organizationId}:${code}`);
    if (draft) return draft.value;
    return this.membership(user, organizationId)?.overrides?.find((o) => o.code === code)?.isAllowed ?? null;
  }

  permissionChanged(user: ApiAdminUser, code: string): boolean {
    const organizationId = this.userOrganizationId(user);
    return !!organizationId && this.pending().has(`userPermission:${user.id}:${organizationId}:${code}`);
  }

  isRoleActive(role: ApiAdminRole): boolean {
    return this.draft('roleActive', `roleActive:${role.id}`)?.value ?? role.isActive;
  }

  isOrganizationActive(org: ApiAdminOrganization): boolean {
    return this.draft('organizationActive', `organizationActive:${org.id}`)?.value ?? org.isActive;
  }

  isDefaultOrganization(org: ApiAdminOrganization): boolean {
    const draft = this.draft('organizationDefault', 'organizationDefault');
    return draft ? draft.organizationId === org.id : org.isDefault;
  }

  flagValue(key: string, organizationId: string | null, userId: string | null): boolean {
    const draft = this.draft('flag', `flag:${key}:${organizationId ?? '-'}:${userId ?? '-'}`);
    if (draft) return draft.value;
    return this.flagBase(key, organizationId, userId);
  }

  private flagBase(key: string, organizationId: string | null, userId: string | null): boolean {
    if (organizationId && !userId) {
      const efectiva = this.flagsByOrganization()[organizationId]?.find((flag) => flag.key === key);
      if (efectiva) return efectiva.isEnabled;
    }
    const candidatas = this.flags().filter((flag) => flag.key === key);
    const propia = userId
      ? candidatas.find((f) => f.userId === userId && f.organizationId === organizationId)
      : undefined;
    const deOrganizacion = organizationId
      ? candidatas.find((f) => !f.userId && f.organizationId === organizationId)
      : undefined;
    const global = candidatas.find((f) => !f.userId && !f.organizationId);
    return (propia ?? deOrganizacion ?? global)?.isEnabled ?? false;
  }

  flagChanged(key: string, organizationId: string | null, userId: string | null): boolean {
    return this.pending().has(`flag:${key}:${organizationId ?? '-'}:${userId ?? '-'}`);
  }

  private put(change: AdminChange, equalsBase: boolean): void {
    this.pending.update((map) => {
      const next = new Map(map);
      if (equalsBase) next.delete(changeKey(change));
      else next.set(changeKey(change), change);
      return next;
    });
    this.failures.set(this.failures().filter((f) => f.key !== changeKey(change)));
  }

  setUserActive(user: ApiAdminUser, value: boolean): void {
    this.put({ kind: 'userActive', userId: user.id, value }, value === user.isActive);
  }

  toggleUserRole(user: ApiAdminUser, roleId: string): void {
    const organizationId = this.userOrganizationId(user);
    if (!organizationId || this.hasPendingMove(user)) return;
    const actuales = this.userRoleIds(user);
    const roleIds = actuales.includes(roleId) ? actuales.filter((id) => id !== roleId) : [...actuales, roleId];
    const base = this.membership(user, organizationId)?.roles.map((role) => role.id) ?? [];
    this.put({ kind: 'userRoles', userId: user.id, organizationId, roleIds }, sameIds(roleIds, base));
  }

  togglePermission(user: ApiAdminUser, code: string): void {
    const organizationId = this.userOrganizationId(user);
    if (!organizationId || this.hasPendingMove(user)) return;
    const value = !this.hasPermission(user, code);
    const base = this.membership(user, organizationId)?.effectivePermissions?.includes(code) ?? false;
    this.put({ kind: 'userPermission', userId: user.id, organizationId, code, value }, value === base);
  }

  clearOverride(user: ApiAdminUser, code: string): void {
    const organizationId = this.userOrganizationId(user);
    if (!organizationId || this.hasPendingMove(user)) return;
    this.put({ kind: 'userPermission', userId: user.id, organizationId, code, value: null }, false);
  }

  setUserOrganization(user: ApiAdminUser, organizationId: string): void {
    const actual = this.userOrganizationId(user);
    if (organizationId === actual) {
      this.put({ kind: 'userOrganization', userId: user.id, organizationId }, true);
      return;
    }
    this.pending.update((map) => {
      const next = new Map(map);
      for (const [key, change] of map) {
        const deLaPersona =
          (change.kind === 'userRoles' || change.kind === 'userPermission') && change.userId === user.id;
        const bandera = change.kind === 'flag' && change.userId === user.id;
        if (deLaPersona || bandera) next.delete(key);
      }
      return next;
    });
    this.put({ kind: 'userOrganization', userId: user.id, organizationId }, false);
  }

  setRoleActive(role: ApiAdminRole, value: boolean): void {
    this.put({ kind: 'roleActive', roleId: role.id, value }, value === role.isActive);
  }

  setFlag(key: string, organizationId: string | null, userId: string | null, value: boolean): void {
    this.put(
      { kind: 'flag', key, organizationId, userId, value },
      value === this.flagBase(key, organizationId, userId),
    );
  }

  setOrganizationActive(org: ApiAdminOrganization, value: boolean): void {
    this.put({ kind: 'organizationActive', organizationId: org.id, value }, value === org.isActive);
  }

  setDefaultOrganization(org: ApiAdminOrganization): void {
    this.put({ kind: 'organizationDefault', organizationId: org.id }, org.isDefault);
  }

  descartar(): void {
    this.pending.set(new Map());
    this.failures.set([]);
  }

  async guardar(): Promise<void> {
    if (this.saving() || !this.dirty()) return;
    this.saving.set(true);
    this.failures.set([]);
    const pendientes = this.changes();
    const fallos: SaveFailure[] = [];
    const aplicados: AdminChange[] = [];

    for (const ola of [1, 2, 3, 4] as const) {
      const deLaOla = pendientes.filter((c) => changeWave(c) === ola);
      const resultados = await Promise.allSettled(deLaOla.map((c) => this.ejecutar(c)));
      resultados.forEach((resultado, i) => {
        const cambio = deLaOla[i];
        if (resultado.status === 'fulfilled') {
          aplicados.push(cambio);
          return;
        }
        const reason = resultado.reason instanceof Error ? resultado.reason.message : '';
        fallos.push({ key: changeKey(cambio), label: this.describe(cambio), reason });
      });
    }

    this.pending.update((map) => {
      const next = new Map(map);
      for (const c of aplicados) next.delete(changeKey(c));
      return next;
    });
    this.failures.set(fallos);

    if (aplicados.length) {
      if (aplicados.some(affectsAccess)) await this.cargarUsuarios();
      if (this.app.runtime.mode === 'api') await this.arranque.pollSession();
    }
    this.saving.set(false);
    this.app.toast.set(
      fallos.length
        ? this.i18n.t('admin.save.partial', { done: aplicados.length, failed: fallos.length })
        : this.i18n.t('admin.save.done', { count: aplicados.length }),
    );
  }

  private async ejecutar(change: AdminChange): Promise<void> {
    switch (change.kind) {
      case 'userActive':
        await firstValueFrom(this.api.setAdminUserActive(change.userId, change.value));
        this.users.update((xs) => xs.map((u) => (u.id === change.userId ? { ...u, isActive: change.value } : u)));
        return;
      case 'userRoles': {
        await firstValueFrom(this.api.assignAdminUserRoles(change.userId, change.organizationId, change.roleIds));
        return;
      }
      case 'userPermission':
        await firstValueFrom(
          this.api.setAdminUserCapability(change.userId, change.organizationId, change.code, change.value),
        );
        return;
      case 'userOrganization':
        await firstValueFrom(this.api.addAdminOrganizationMember(change.organizationId, change.userId));
        this.membersByOrganization.set({});
        return;
      case 'roleActive':
        await firstValueFrom(this.api.setAdminRoleActive(change.roleId, change.value));
        this.parchearRol(change.roleId, { isActive: change.value });
        return;
      case 'flag': {
        const saved = await firstValueFrom(
          this.api.updateAdminFeatureFlag(change.key, {
            organizationId: change.organizationId,
            userId: change.userId,
            isEnabled: change.value,
          }),
        );
        this.flags.update((flags) => [
          ...flags.filter(
            (f) => !(f.key === change.key && f.organizationId === change.organizationId && f.userId === change.userId),
          ),
          saved,
        ]);
        if (change.organizationId && !change.userId) this.parchearBanderaDeOrganizacion(change);
        return;
      }
      case 'organizationActive': {
        const org = await firstValueFrom(
          this.api.updateAdminOrganization(change.organizationId, { isActive: change.value }),
        );
        this.organizations.update((xs) => xs.map((x) => (x.id === org.id ? org : x)));
        return;
      }
      case 'organizationDefault': {
        const org = await firstValueFrom(this.api.setDefaultAdminOrganization(change.organizationId));
        this.organizations.update((xs) => xs.map((x) => (x.id === org.id ? org : { ...x, isDefault: false })));
        return;
      }
    }
  }

  private parchearBanderaDeOrganizacion(change: Extract<AdminChange, { kind: 'flag' }>): void {
    const id = change.organizationId as string;
    this.flagsByOrganization.update((todas) => {
      const actuales = todas[id];
      if (!actuales) return todas;
      const propia: ApiAdminOrganizationFlag = {
        key: change.key,
        isEnabled: change.value,
        source: 'organization',
        organizationValue: change.value,
      };
      return {
        ...todas,
        [id]: [...actuales.filter((f) => f.key !== change.key), propia].sort((a, b) => a.key.localeCompare(b.key)),
      };
    });
  }

  private parchearRol(roleId: string, cambios: Partial<ApiAdminRole>): void {
    const aplica = (xs: readonly ApiAdminRole[]) => xs.map((r) => (r.id === roleId ? { ...r, ...cambios } : r));
    this.roles.update(aplica);
    this.rolesByOrganization.update((todas) =>
      Object.fromEntries(Object.entries(todas).map(([id, roles]) => [id, aplica(roles)])),
    );
  }

  async guardarRol(id: string | null, body: Parameters<AdministrationApi['saveAdminRole']>[1]): Promise<ApiAdminRole> {
    const saved = await firstValueFrom(
      this.api.saveAdminRole(id, { ...body, permissions: this.permisosDelCatalogo(body.permissions ?? []) }),
    );
    this.roles.update((xs) => (id ? xs.map((x) => (x.id === saved.id ? saved : x)) : [...xs, saved]));
    if (saved.organizationId) {
      this.rolesByOrganization.update((todas) => {
        const actuales = todas[saved.organizationId as string];
        if (!actuales) return todas;
        const lista = id ? actuales.map((x) => (x.id === saved.id ? saved : x)) : [...actuales, saved];
        return { ...todas, [saved.organizationId as string]: lista };
      });
    }
    if (id && this.app.runtime.mode === 'api') await this.arranque.pollSession();
    return saved;
  }

  async eliminarRol(role: ApiAdminRole): Promise<void> {
    await firstValueFrom(this.api.deleteAdminRole(role.id));
    this.rolesByOrganization.set({});
    const quedan = this.roles().length - 1;
    await this.cargarRoles(quedan === 0 && this.rolesPage() > 1 ? this.rolesPage() - 1 : this.rolesPage());
    await this.cargarUsuarios();
  }

  async crearOrganizacion(body: { name: string; baseCurrency: string }): Promise<void> {
    const creada = await firstValueFrom(this.api.createAdminOrganization(body));
    this.organizations.update((xs) => [...xs, creada]);
  }

  async renombrarOrganizacion(id: string, name: string): Promise<void> {
    const org = await firstValueFrom(this.api.updateAdminOrganization(id, { name }));
    this.organizations.update((xs) => xs.map((x) => (x.id === org.id ? org : x)));
  }

  async actualizarError(error: ApiClientError, status: ApiClientError['status']): Promise<void> {
    await firstValueFrom(this.api.updateAdminError(error.id, status));
    this.errors.update((xs) => xs.map((x) => (x.id === error.id ? { ...x, status } : x)));
  }

  private permisosDelCatalogo(permisos: readonly string[]): readonly string[] {
    const catalogo = this.permissionCatalog();
    if (!catalogo.length) return permisos;
    const conocidos = new Set(catalogo.map((permiso) => permiso.code));
    return permisos.filter((codigo) => conocidos.has(codigo));
  }

  private organizationName(id: string): string {
    return this.organizations().find((o) => o.id === id)?.name ?? id;
  }

  private roleName(id: string): string {
    return (
      this.roles().find((r) => r.id === id)?.name ??
      Object.values(this.rolesByOrganization())
        .flat()
        .find((r) => r.id === id)?.name ??
      id
    );
  }

  describe(change: AdminChange): string {
    const t = (key: string, params?: Record<string, string | number>) => this.i18n.t(key, params);
    const estado = (on: boolean) => t(on ? 'admin.common.enabled' : 'admin.common.disabled');
    switch (change.kind) {
      case 'userActive':
        return t(change.value ? 'admin.changes.userActivate' : 'admin.changes.userDeactivate', {
          user: this.userName(change.userId),
        });
      case 'userRoles':
        return t('admin.changes.userRoles', {
          user: this.userName(change.userId),
          roles: change.roleIds.map((id) => this.roleName(id)).join(', ') || t('admin.users.directAccess'),
        });
      case 'userPermission':
        return t(
          change.value === null
            ? 'admin.changes.permissionReset'
            : change.value
              ? 'admin.changes.permissionGrant'
              : 'admin.changes.permissionRevoke',
          { user: this.userName(change.userId), code: change.code },
        );
      case 'userOrganization':
        return t('admin.changes.userOrganization', {
          user: this.userName(change.userId),
          organization: this.organizationName(change.organizationId),
        });
      case 'roleActive':
        return t(change.value ? 'admin.changes.roleActivate' : 'admin.changes.roleDeactivate', {
          role: this.roleName(change.roleId),
        });
      case 'flag': {
        const alcance = change.userId
          ? this.userName(change.userId)
          : change.organizationId
            ? this.organizationName(change.organizationId)
            : t('admin.flags.audience.global');
        return t('admin.changes.flag', { key: change.key, scope: alcance, state: estado(change.value) });
      }
      case 'organizationActive':
        return t(change.value ? 'admin.changes.organizationActivate' : 'admin.changes.organizationDeactivate', {
          organization: this.organizationName(change.organizationId),
        });
      case 'organizationDefault':
        return t('admin.changes.organizationDefault', { organization: this.organizationName(change.organizationId) });
    }
  }
}
