import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  AdministrationApi,
  ApiAdminOrganization,
  ApiAdminRole,
  ApiAdminUser,
  ApiOrganizationMember,
  ApiPage,
} from '@core/api';
import { CAPABILITIES, AppStore } from '@core/state';
import { I18nService } from '@core/i18n';
import { P, RemoteBootstrap } from '@core/session';
import { AdminChange, sameIds } from './admin-changes';
import { describeAdminChange } from './admin-change-description';
import { AdminAuditStore } from './stores/admin-audit.store';
import { AdminErrorsStore } from './stores/admin-errors.store';
import { AdminPermissionsStore } from './stores/admin-permissions.store';
import { AdminDrafts, SaveFailure } from './stores/admin-drafts';
import { AdminFlagsStore } from './stores/admin-flags.store';

export type AdminTab = 'summary' | 'users' | 'roles' | 'organizations' | 'flags' | 'audit' | 'errors';

export type { SaveFailure };

const EMPTY_PAGE = { items: [], page: 1, size: 0, total: 0, totalPages: 0, hasNext: false } as const;

@Injectable()
export class AdminStore {
  private readonly api = inject(AdministrationApi);
  private readonly arranque = inject(RemoteBootstrap);
  private readonly app = inject(AppStore);
  private readonly caps = inject(CAPABILITIES);
  private readonly i18n = inject(I18nService);
  private readonly auditoria = inject(AdminAuditStore);
  private readonly errores = inject(AdminErrorsStore);
  private readonly permisos = inject(AdminPermissionsStore);
  private readonly drafts = inject(AdminDrafts);
  private readonly banderas = inject(AdminFlagsStore);

  readonly tab = signal<AdminTab>('summary');
  private readonly directory = signal<Readonly<Record<string, ApiAdminUser>>>({});
  readonly users = signal<readonly ApiAdminUser[]>([]);
  readonly usersPage = signal(1);
  readonly usersTotal = signal(0);
  readonly usersSize = 100;
  readonly userSearch = signal('');
  readonly roles = signal<readonly ApiAdminRole[]>([]);
  readonly rolesPage = signal(1);
  readonly rolesTotal = signal(0);
  readonly rolesSize = 50;
  readonly rolesOrganizationFilter = signal('');
  private readonly rolesByOrganization = signal<Readonly<Record<string, readonly ApiAdminRole[]>>>({});
  readonly organizations = signal<readonly ApiAdminOrganization[]>([]);
  private readonly membersByOrganization = signal<Readonly<Record<string, readonly ApiOrganizationMember[]>>>({});

  readonly loading = signal(false);
  readonly loadFailed = signal(false);

  readonly changes = this.drafts.changes;
  readonly count = this.drafts.count;
  readonly dirty = this.drafts.dirty;
  readonly failures = this.drafts.failures;
  readonly saving = this.drafts.saving;

  readonly organizationOptions = computed(() =>
    this.organizations().map((org) => ({
      value: org.id,
      label: this.isDefaultOrganization(org)
        ? this.i18n.t('admin.organizations.defaultOption', { name: org.name })
        : org.name,
    })),
  );
  async cargar(): Promise<void> {
    if (!this.caps.allows(P.administracion.ver)) return;
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
      puede(P.administracion.auditoria.listar) ? this.auditoria.primeraPagina() : vacio<never>(),
      puede(P.administracion.errores.listar) ? this.errores.primeraPagina() : vacio<never>(),
      puede(P.administracion.banderas.listar) ? this.banderas.cargarGlobales() : Promise.resolve([]),
      puede(P.administracion.capacidades.listar) ? this.permisos.cargarCatalogo() : Promise.resolve([]),
    ]);
    const [u, r, o, a, e, f, p] = resultados;
    if (u.status === 'fulfilled') this.aplicarUsuarios(u.value);
    if (r.status === 'fulfilled') this.aplicarRoles(r.value);
    if (o.status === 'fulfilled') this.organizations.set(o.value.items);
    if (a.status === 'fulfilled') this.auditoria.aplicar(a.value);
    if (e.status === 'fulfilled') this.errores.aplicar(e.value);
    if (f.status === 'fulfilled') this.banderas.flags.set(f.value);
    if (p.status === 'fulfilled') this.permisos.catalog.set(p.value);
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

  verAccion(traceId: string): void {
    this.tab.set('audit');
    void this.auditoria.cargar(1, { traceId });
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

  userOrganizationId(user: ApiAdminUser): string | undefined {
    return (
      user.memberships?.find((m) => m.status === 'Active')?.organizationId ?? user.memberships?.[0]?.organizationId
    );
  }

  targetOrganizationId(user: ApiAdminUser): string | undefined {
    return (
      this.drafts.draft('userOrganization', `userOrganization:${user.id}`)?.organizationId ??
      this.userOrganizationId(user)
    );
  }

  hasPendingMove(user: ApiAdminUser): boolean {
    return this.drafts.has(`userOrganization:${user.id}`);
  }

  userHasChanges(user: ApiAdminUser): boolean {
    return this.changes().some((change) => 'userId' in change && change.userId === user.id);
  }

  isUserActive(user: ApiAdminUser): boolean {
    return this.drafts.draft('userActive', `userActive:${user.id}`)?.value ?? user.isActive;
  }

  userRoleIds(user: ApiAdminUser): readonly string[] {
    const organizationId = this.userOrganizationId(user);
    if (!organizationId) return [];
    return (
      this.drafts.draft('userRoles', `userRoles:${user.id}:${organizationId}`)?.roleIds ??
      this.membership(user, organizationId)?.roles.map((role) => role.id) ??
      []
    );
  }

  private membership(user: ApiAdminUser, organizationId: string) {
    return user.memberships?.find((m) => m.organizationId === organizationId);
  }

  effectivePermissions(user: ApiAdminUser): readonly string[] {
    const organizationId = this.userOrganizationId(user);
    if (!organizationId) return [];
    const draft = this.drafts.draft('userRoles', `userRoles:${user.id}:${organizationId}`);
    if (draft) {
      const chosen = new Set(draft.roleIds);
      const known = new Map<string, ApiAdminRole>();
      const sources = [
        ...(this.membership(user, organizationId)?.roles ?? []),
        ...this.roles().filter((role) => role.organizationId === organizationId),
        ...this.rolesOf(organizationId),
      ];
      for (const role of sources) known.set(role.id, role);
      const permissions = [...known.values()]
        .filter((role) => chosen.has(role.id) && role.isActive)
        .flatMap((role) => role.permissions ?? []);
      if (permissions.length || draft.roleIds.length) return [...new Set(permissions)].sort();
    }
    return this.membership(user, organizationId)?.effectivePermissions ?? [];
  }

  roleCountOf(organizationId: string): number {
    return this.roles().filter((role) => role.organizationId === organizationId).length;
  }

  isRoleActive(role: ApiAdminRole): boolean {
    return this.drafts.draft('roleActive', `roleActive:${role.id}`)?.value ?? role.isActive;
  }

  isOrganizationActive(org: ApiAdminOrganization): boolean {
    return this.drafts.draft('organizationActive', `organizationActive:${org.id}`)?.value ?? org.isActive;
  }

  isDefaultOrganization(org: ApiAdminOrganization): boolean {
    const draft = this.drafts.draft('organizationDefault', 'organizationDefault');
    return draft ? draft.organizationId === org.id : org.isDefault;
  }

  setUserActive(user: ApiAdminUser, value: boolean): void {
    this.drafts.put({ kind: 'userActive', userId: user.id, value }, value === user.isActive);
  }

  setUserRole(user: ApiAdminUser, roleId: string): void {
    const organizationId = this.userOrganizationId(user);
    if (!organizationId || this.hasPendingMove(user)) return;
    const roleIds = [roleId];
    const base = this.membership(user, organizationId)?.roles.map((role) => role.id) ?? [];
    this.drafts.put({ kind: 'userRoles', userId: user.id, organizationId, roleIds }, sameIds(roleIds, base));
  }

  setUserOrganization(user: ApiAdminUser, organizationId: string): void {
    const actual = this.userOrganizationId(user);
    if (organizationId === actual) {
      this.drafts.put({ kind: 'userOrganization', userId: user.id, organizationId }, true);
      return;
    }
    this.drafts.quitarDonde(
      (change) => (change.kind === 'userRoles' || change.kind === 'flag') && change.userId === user.id,
    );
    this.drafts.put({ kind: 'userOrganization', userId: user.id, organizationId }, false);
  }

  setRoleActive(role: ApiAdminRole, value: boolean): void {
    this.drafts.put({ kind: 'roleActive', roleId: role.id, value }, value === role.isActive);
  }

  setOrganizationActive(org: ApiAdminOrganization, value: boolean): void {
    this.drafts.put({ kind: 'organizationActive', organizationId: org.id, value }, value === org.isActive);
  }

  setDefaultOrganization(org: ApiAdminOrganization): void {
    this.drafts.put({ kind: 'organizationDefault', organizationId: org.id }, org.isDefault);
  }

  descartar(): void {
    this.drafts.descartar();
  }

  marcarUsuarioActivo(userId: string, value: boolean): void {
    this.users.update((xs) => xs.map((u) => (u.id === userId ? { ...u, isActive: value } : u)));
  }

  olvidarMiembros(): void {
    this.membersByOrganization.set({});
  }

  fijarPredeterminada(org: ApiAdminOrganization): void {
    this.organizations.update((xs) => xs.map((x) => (x.id === org.id ? org : { ...x, isDefault: false })));
  }

  olvidarOrganizacion(id: string): void {
    const sin = <T>(known: Readonly<Record<string, T>>) =>
      Object.fromEntries(Object.entries(known).filter(([clave]) => clave !== id));
    this.organizations.update((items) => items.filter((item) => item.id !== id));
    this.rolesByOrganization.update(sin);
    this.membersByOrganization.update(sin);
  }

  olvidarRolesPorOrganizacion(): void {
    this.rolesByOrganization.set({});
  }

  olvidarCaches(): void {
    this.membersByOrganization.set({});
    this.rolesByOrganization.set({});
  }

  ponerOrganizacion(org: ApiAdminOrganization): void {
    this.organizations.update((xs) =>
      xs.some((x) => x.id === org.id) ? xs.map((x) => (x.id === org.id ? org : x)) : [...xs, org],
    );
  }

  parchearRol(roleId: string, cambios: Partial<ApiAdminRole>): void {
    const aplica = (xs: readonly ApiAdminRole[]) => xs.map((r) => (r.id === roleId ? { ...r, ...cambios } : r));
    this.roles.update(aplica);
    this.rolesByOrganization.update((todas) =>
      Object.fromEntries(Object.entries(todas).map(([id, roles]) => [id, aplica(roles)])),
    );
  }

  ponerRol(saved: ApiAdminRole, esEdicion: boolean): void {
    this.roles.update((xs) => (esEdicion ? xs.map((x) => (x.id === saved.id ? saved : x)) : [...xs, saved]));
    if (!saved.organizationId) return;
    const organizationId = saved.organizationId;
    this.rolesByOrganization.update((todas) => {
      const actuales = todas[organizationId];
      if (!actuales) return todas;
      const lista = esEdicion ? actuales.map((x) => (x.id === saved.id ? saved : x)) : [...actuales, saved];
      return { ...todas, [organizationId]: lista };
    });
  }

  paginaTrasQuitarRol(): number {
    const quedan = this.roles().length - 1;
    return quedan === 0 && this.rolesPage() > 1 ? this.rolesPage() - 1 : this.rolesPage();
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
    return describeAdminChange(
      change,
      {
        user: (id) => this.userName(id),
        role: (id) => this.roleName(id),
        organization: (id) => this.organizationName(id),
      },
      (key, params) => this.i18n.t(key, params),
    );
  }
}
