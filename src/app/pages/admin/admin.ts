import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import {
  ApiAdminFeatureFlag,
  ApiAdminOverride,
  ApiAdminRole,
  ApiAdminUser,
  ApiAuditEvent,
  ApiPermissionDescriptor,
  ApiClientError,
  FinanceApiClient,
} from '../../core/api-client';
import { P } from '../../core/permissions';
import { IconComponent } from '../../ui/icon';
import { UiOption, UiSelectComponent } from '../../ui/select';
import { RemoteBootstrap } from '../../core/remote-bootstrap';
import { CAPABILITIES, DemoStore } from '../../core/store';
import { EmptyStateComponent } from '../../ui/ui';
import { I18nService } from '../../core/i18n';

type Tab = 'summary' | 'users' | 'roles' | 'flags' | 'audit' | 'errors';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent, UiSelectComponent, EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './admin.html',
  styleUrl: './admin.css',
})
export class AdminComponent implements OnInit {
  readonly store = inject(DemoStore);
  private api = inject(FinanceApiClient);
  private readonly arranque = inject(RemoteBootstrap);
  readonly caps = inject(CAPABILITIES);
  readonly i18n = inject(I18nService);

  /**
   * Vuelve a leer la sesion en cuanto se toca algo que cambia accesos.
   *
   * El sondeo normal corre cada minuto y al volver el foco a la ventana. Quien acaba de
   * quitar un permiso desde esta consola no hace ninguna de las dos cosas: se queda
   * mirando la misma pestana, y durante hasta un minuto seguia viendo la entrada de menu
   * que acababa de retirar. El servidor ya rechazaba la peticion —la revalidacion de la
   * cookie recalcula los permisos en cada llamada—, pero la pantalla mentia.
   *
   * Solo importa si el cambio afecta a quien lo hace; si no, no cambia nada y no molesta.
   */
  private async refrescarAccesos(): Promise<void> {
    if (this.store.runtime.mode !== 'api') return;
    await this.arranque.pollSession();
  }
  readonly P = P;
  /**
   * `ngOnInit` solo pide datos en modo `api` (ver mas abajo): en modo demo los signals de
   * usuarios/roles/banderas/errores se quedan en su valor inicial vacio y las tarjetas de
   * resumen mostraban "0" en todo, indistinguible de una consola realmente rota. Con esta
   * bandera el resumen explica la ausencia de datos en vez de mentir con ceros.
   */
  readonly sinDatosDeAdministracion = computed(() => this.store.runtime.mode !== 'api');
  readonly tab = signal<Tab>('summary');
  readonly users = signal<ApiAdminUser[]>([]);
  readonly roles = signal<readonly ApiAdminRole[]>([]);
  readonly errors = signal<ApiClientError[]>([]);
  readonly audit = signal<ApiAuditEvent[]>([]);
  readonly adminFlags = signal<readonly ApiAdminFeatureFlag[]>([]);
  readonly selectedUser = signal<ApiAdminUser | null>(null);
  readonly roleDraft = signal<ApiAdminRole | null>(null);
  readonly selectedError = signal<ApiClientError | null>(null);
  readonly selectedAudit = signal<ApiAuditEvent | null>(null);
  readonly selectFlag = signal<string | null>(null);
  userSearch = '';
  userStatus = 'all';
  flagSearch = '';
  auditSearch = '';
  auditAction = 'all';
  errorStatus = 'all';
  readonly userStatusOptions = computed<readonly UiOption[]>(() => [
    { value: 'all', label: this.i18n.t('admin.users.status.all') },
    { value: 'active', label: this.i18n.t('admin.users.status.active') },
    { value: 'inactive', label: this.i18n.t('admin.users.status.inactive') },
  ]);
  readonly auditActionOptions = computed<readonly UiOption[]>(() => [
    { value: 'all', label: this.i18n.t('admin.audit.action.all') },
    { value: 'create', label: this.i18n.t('admin.audit.action.create') },
    { value: 'update', label: this.i18n.t('admin.audit.action.update') },
    { value: 'access', label: this.i18n.t('admin.audit.action.access') },
  ]);
  readonly errorStatusOptions = computed<readonly UiOption[]>(() => [
    { value: 'all', label: this.i18n.t('admin.errors.status.all') },
    { value: 'new', label: this.i18n.t('admin.errors.status.new') },
    { value: 'investigating', label: this.i18n.t('admin.errors.status.investigating') },
    { value: 'resolved', label: this.i18n.t('admin.errors.status.resolved') },
  ]);
  readonly errorStateOptions = computed(() => this.errorStatusOptions().filter((option) => option.value !== 'all'));
  private readonly allTabs = [
    { id: 'summary' as Tab, labelKey: 'admin.tabs.summary', icon: 'dashboard', capability: P.administracion.ver },
    { id: 'users' as Tab, labelKey: 'admin.tabs.users', icon: 'people', capability: P.administracion.usuarios.listar },
    {
      id: 'roles' as Tab,
      labelKey: 'admin.tabs.roles',
      icon: 'shield',
      capability: P.administracion.roles.listar,
    },
    {
      id: 'flags' as Tab,
      labelKey: 'admin.tabs.flags',
      icon: 'flag',
      capability: P.administracion.banderas.listar,
    },
    { id: 'audit' as Tab, labelKey: 'admin.tabs.audit', icon: 'list', capability: P.administracion.auditoria.listar },
    { id: 'errors' as Tab, labelKey: 'admin.tabs.errors', icon: '!', capability: P.administracion.errores.listar },
  ];

  /** La consola era todo o nada: quien entraba veía y podía las seis pestañas. */
  readonly tabs = computed(() =>
    this.allTabs
      .filter((item) => this.caps.allows(item.capability))
      .map((item) => ({ id: item.id, icon: item.icon, label: this.i18n.t(item.labelKey) })),
  );
  /**
   * Lo que se concede son permisos, y es lo que hay que contar.
   *
   * Decia «capacidades disponibles» y contaba las catorce de la mascara, que ya no es lo
   * que un rol guarda. Un numero que no corresponde con lo que se ve al abrir el editor
   * hace dudar de todo lo demas.
   */
  readonly permissionCount = computed(() => this.permissionCatalog().length);

  /** Catálogo granular, agrupado por recurso: es como se lee y como se concede. */
  readonly permissionCatalog = signal<readonly ApiPermissionDescriptor[]>([]);
  readonly permissionGroups = computed(() => {
    const groups = new Map<string, ApiPermissionDescriptor[]>();
    for (const permiso of this.permissionCatalog()) {
      const items = groups.get(permiso.resource) ?? [];
      items.push(permiso);
      groups.set(permiso.resource, items);
    }
    return [...groups.entries()].map(([name, items]) => ({ name, items }));
  });

  private readonly accionKeys: Readonly<Record<number, string>> = {
    1: 'view',
    2: 'list',
    3: 'create',
    4: 'edit',
    5: 'delete',
    6: 'disable',
    7: 'export',
  };
  private readonly nivelKeys: Readonly<Record<number, string>> = { 1: 'basic', 2: 'advanced', 3: 'premium' };
  accionDe(permiso: ApiPermissionDescriptor): string {
    const clave = this.accionKeys[permiso.action];
    return this.i18n.t(clave ? `admin.permissions.action.${clave}` : 'admin.permissions.action.fallback');
  }
  nivelDe(permiso: ApiPermissionDescriptor): string {
    return this.i18n.t(`admin.permissions.level.${this.nivelKeys[permiso.level] ?? 'basic'}`);
  }
  marcadosEn(items: readonly ApiPermissionDescriptor[]): number {
    const concedidos = this.roleDraft()?.permissions ?? [];
    return items.filter((permiso) => concedidos.includes(permiso.code)).length;
  }

  /** Marca o desmarca un recurso entero: con un centenar de casillas hace falta. */
  marcarGrupo(items: readonly ApiPermissionDescriptor[], marcar: boolean) {
    this.roleDraft.update((rol) => {
      if (!rol) return rol;
      const codigos = items.map((permiso) => permiso.code);
      const restantes = rol.permissions.filter((codigo) => !codigos.includes(codigo));
      return { ...rol, permissions: marcar ? [...restantes, ...codigos] : restantes };
    });
  }

  /**
   * Los códigos que el catálogo conoce. Si todavía no ha llegado, no se filtra: es
   * preferible mandar lo que había a vaciar los permisos de un rol por una carrera.
   */
  private permisosDelCatalogo(permisos: readonly string[]): readonly string[] {
    const catalogo = this.permissionCatalog();
    if (!catalogo.length) return permisos;
    const conocidos = new Set(catalogo.map((permiso) => permiso.code));
    return permisos.filter((codigo) => conocidos.has(codigo));
  }

  togglePermiso(code: string) {
    this.roleDraft.update((rol) =>
      rol
        ? {
            ...rol,
            permissions: rol.permissions.includes(code)
              ? rol.permissions.filter((x) => x !== code)
              : [...rol.permissions, code],
          }
        : rol,
    );
  }
  readonly organizations = computed(() => {
    const map = new Map<string, string>();
    for (const user of this.users())
      for (const membership of user.memberships ?? []) map.set(membership.organizationId, membership.organizationName);
    return [...map.entries()].map(([id, name]) => ({ id, name }));
  });
  readonly organizationOptions = computed<readonly UiOption[]>(() =>
    this.organizations().map((organization) => ({ value: organization.id, label: organization.name })),
  );
  readonly activeUsers = computed(() => this.users().filter((x) => x.isActive).length);
  readonly enabledFlags = computed(() => this.flagRows().filter((x) => x.isEnabled).length);
  readonly openErrors = computed(() => this.errors().filter((x) => x.status !== 'resolved').length);
  readonly errorOccurrences = computed(() =>
    this.errors()
      .filter((x) => x.status !== 'resolved')
      .reduce((n, x) => n + x.occurrences, 0),
  );
  readonly flagRows = computed(() =>
    this.adminFlags().map((flag) => ({
      ...flag,
      audience: flag.userId
        ? this.i18n.t('admin.flags.audience.user')
        : flag.organizationId
          ? this.i18n.t('admin.flags.audience.organization')
          : this.i18n.t('admin.flags.audience.global'),
    })),
  );
  /** Una fila por función de plataforma, usando el valor global como base. */
  readonly platformFlags = computed(() => {
    const rows = new Map<string, ApiAdminFeatureFlag>();
    for (const flag of this.adminFlags()) if (!flag.organizationId && !flag.userId) rows.set(flag.key, flag);
    return [...rows.values()].sort((a, b) => a.key.localeCompare(b.key));
  });
  readonly filteredUsers = computed(() =>
    this.users().filter(
      (u) =>
        (this.userStatus === 'all' || (this.userStatus === 'active') === u.isActive) &&
        `${u.displayName} ${u.email}`.toLowerCase().includes(this.userSearch.toLowerCase()),
    ),
  );
  readonly filteredFlags = computed(() =>
    this.flagRows().filter((x) => x.key.toLowerCase().includes(this.flagSearch.toLowerCase())),
  );
  readonly auditRows = computed(() => this.audit());
  readonly filteredAudit = computed(() =>
    this.audit().filter(
      (e) =>
        (this.auditAction === 'all' || e.action.toLowerCase().includes(this.auditAction)) &&
        `${e.action} ${e.entityType} ${e.traceId}`.toLowerCase().includes(this.auditSearch.toLowerCase()),
    ),
  );
  readonly filteredErrors = computed(() =>
    this.errors().filter((e) => this.errorStatus === 'all' || e.status === this.errorStatus),
  );
  async ngOnInit() {
    if (!this.caps.allows(P.administracion.ver)) return;
    if (this.store.runtime.mode !== 'api') return;
    try {
      // Solo se pide lo que el permiso abre: así una sesión sin una pestaña no
      // provoca un 403 en el arranque de la consola.
      const [u, r, a, e, f, p] = await Promise.all([
        this.caps.allows(P.administracion.usuarios.listar)
          ? firstValueFrom(this.api.adminUsers())
          : Promise.resolve({ items: [], page: 1, size: 0, total: 0, totalPages: 0, hasNext: false }),
        this.caps.allows(P.administracion.roles.listar) ? firstValueFrom(this.api.adminRoles()) : Promise.resolve([]),
        this.caps.allows(P.administracion.auditoria.listar)
          ? firstValueFrom(this.api.superAdminAudit(1, 50))
          : Promise.resolve({ items: [], page: 1, size: 0, total: 0, totalPages: 0, hasNext: false }),
        this.caps.allows(P.administracion.errores.listar)
          ? firstValueFrom(this.api.adminErrors())
          : Promise.resolve({ items: [], page: 1, size: 0, total: 0, totalPages: 0, hasNext: false }),
        this.caps.allows(P.administracion.banderas.listar)
          ? firstValueFrom(this.api.adminFeatureFlags())
          : Promise.resolve([]),
        this.caps.allows(P.administracion.capacidades.listar)
          ? firstValueFrom(this.api.superAdminPermissions())
          : Promise.resolve([]),
      ]);
      this.users.set(
        u.items.map((user) => ({
          ...user,
          roles: user.roles ?? user.memberships?.flatMap((m) => m.roles.map((role) => role.name)) ?? [],
          capabilities: user.capabilities ?? user.memberships?.flatMap((m) => m.effectiveCapabilities) ?? [],
        })),
      );
      this.roles.set(r);
      this.audit.set([...a.items]);
      this.adminFlags.set(f);
      this.permissionCatalog.set(p);
      this.errors.set(
        e.items.map((error) => ({
          ...error,
          status: ((error.status as string) === 'open' ? 'new' : error.status) as ApiClientError['status'],
          occurrences: error.occurrences ?? 1,
          affectedUsers: error.affectedUsers ?? 1,
          version: error.version ?? error.source,
          traceId: error.traceId ?? null,
          lastSeenAt: error.lastSeenAt ?? error.createdAt ?? new Date().toISOString(),
        })),
      );
    } catch {
      this.store.toast.set(this.i18n.t('admin.toast.loadFailed'));
    }
  }
  initials(n: string) {
    return n
      .split(' ')
      .slice(0, 2)
      .map((x) => x[0])
      .join('')
      .toUpperCase();
  }
  actor(id: string | null) {
    return this.users().find((x) => x.id === id)?.displayName ?? this.i18n.t('admin.audit.systemActor');
  }
  /** Recursos que toca un rol, para resumirlo sin repetir los ciento doce codigos. */
  recursosDe(role: ApiAdminRole): readonly string[] {
    return [...new Set((role.permissions ?? []).map((codigo) => codigo.split('.')[0]))].sort();
  }
  anulacionesDe(u: ApiAdminUser): readonly ApiAdminOverride[] {
    return u.memberships?.flatMap((m) => m.overrides ?? []) ?? [];
  }

  /**
   * Devuelve un permiso a lo que digan los roles.
   *
   * Sin esto, una excepción puesta con el vocabulario viejo —una sola, con el nombre de
   * una capacidad— retiraba de golpe sus veintiséis acciones y no había forma de
   * deshacerla desde la consola: se editaba el rol, se recargaba, y seguía sin aparecer.
   */
  quitarExcepcion(u: ApiAdminUser, anulacion: ApiAdminOverride) {
    const organizationId = this.userOrganizationId(u);
    if (!organizationId) return;
    firstValueFrom(this.api.setAdminUserCapability(u.id, organizationId, anulacion.code, null))
      .then(() => this.refrescarAccesos())
      .then(() => this.recargarUsuarios())
      .catch(() => this.store.toast.set(this.i18n.t('admin.toast.removeOverrideFailed')));
  }

  /** Permisos vigentes de la persona, tal como los resolvio el servidor. */
  private permisosDe(u: ApiAdminUser): readonly string[] {
    return u.memberships?.flatMap((m) => m.effectivePermissions ?? []) ?? [];
  }
  tienePermiso(u: ApiAdminUser, code: string): boolean {
    return this.permisosDe(u).includes(code);
  }
  concedidosEn(u: ApiAdminUser, items: readonly ApiPermissionDescriptor[]): number {
    const concedidos = this.permisosDe(u);
    return items.filter((permiso) => concedidos.includes(permiso.code)).length;
  }
  errorLabel(s: ApiClientError['status']) {
    return s === 'new'
      ? this.i18n.t('admin.errors.state.new')
      : s === 'investigating'
        ? this.i18n.t('admin.errors.state.investigating')
        : this.i18n.t('admin.errors.state.resolved');
  }
  memberCount(roleId: string) {
    return this.users().filter((u) => u.memberships?.some((m) => m.roles.some((r) => r.id === roleId))).length;
  }
  userOrganizationId(user: ApiAdminUser) {
    return (
      user.memberships?.find((m) => m.status === 'Active')?.organizationId ?? user.memberships?.[0]?.organizationId
    );
  }
  organizationName(user: ApiAdminUser, role: ApiAdminRole) {
    return (
      this.organizations().find((org) => org.id === (role.organizationId ?? this.userOrganizationId(user)))?.name ?? ''
    );
  }
  rolesFor(user: ApiAdminUser) {
    const organizationId = this.userOrganizationId(user);
    return organizationId ? this.roles().filter((r) => r.organizationId === organizationId) : this.roles();
  }
  userHasRole(user: ApiAdminUser, roleId: string) {
    return user.memberships?.some((m) => m.roles.some((r) => r.id === roleId)) ?? false;
  }
  openUser(u: ApiAdminUser) {
    this.selectedUser.set({ ...u, roles: [...u.roles], capabilities: [...u.capabilities] });
  }
  setUserActive(u: ApiAdminUser, v: boolean) {
    this.patchUser({ ...u, isActive: v });
    firstValueFrom(this.api.setAdminUserActive(u.id, v)).catch(() =>
      this.store.toast.set(this.i18n.t('admin.toast.userActiveFailed')),
    );
  }
  async toggleUserRole(user: ApiAdminUser, roleId: string) {
    const organizationId = this.userOrganizationId(user);
    if (!organizationId) return;
    const current = user.memberships?.find((m) => m.organizationId === organizationId)?.roles.map((r) => r.id) ?? [];
    const roleIds = this.userHasRole(user, roleId) ? current.filter((x) => x !== roleId) : [...current, roleId];
    try {
      await firstValueFrom(this.api.assignAdminUserRoles(user.id, organizationId, roleIds));
      await this.refrescarAccesos();
      const roles = this.roles().filter((r) => roleIds.includes(r.id));
      this.patchUser({
        ...user,
        roles: roles.map((r) => r.name),
        memberships: user.memberships?.map((m) => (m.organizationId === organizationId ? { ...m, roles } : m)),
      });
    } catch {
      this.store.toast.set(this.i18n.t('admin.toast.assignRoleFailed'));
    }
  }
  /**
   * Concede o retira un permiso concreto a una persona, como excepción directa.
   *
   * Recibe un código del catálogo, el mismo que edita el rol. Antes recibía el nombre de
   * una de las catorce capacidades, así que la ficha de un usuario y el editor de su rol
   * hablaban idiomas distintos y mostraban cosas que no cuadraban.
   */
  toggleUserCapability(u: ApiAdminUser, code: string) {
    const concedido = this.tienePermiso(u, code);
    const organizationId = this.userOrganizationId(u);
    if (!organizationId) return;

    // Se pinta el cambio antes de confirmarlo y se corrige al releer la sesion.
    this.patchUser({
      ...u,
      memberships: u.memberships?.map((m) =>
        m.organizationId === organizationId
          ? {
              ...m,
              effectivePermissions: concedido
                ? (m.effectivePermissions ?? []).filter((x) => x !== code)
                : [...(m.effectivePermissions ?? []), code],
            }
          : m,
      ),
    });

    firstValueFrom(this.api.setAdminUserCapability(u.id, organizationId, code, !concedido))
      .then(() => this.refrescarAccesos())
      .then(() => this.recargarUsuarios())
      .catch(() => this.store.toast.set(this.i18n.t('admin.toast.togglePermissionFailed')));
  }

  /** Vuelve a pedir la lista para que lo mostrado sea lo que resolvio el servidor. */
  private async recargarUsuarios(): Promise<void> {
    if (!this.caps.allows(P.administracion.usuarios.listar)) return;
    try {
      const pagina = await firstValueFrom(this.api.adminUsers());
      this.users.set(
        pagina.items.map((user) => ({
          ...user,
          roles: user.roles ?? user.memberships?.flatMap((m) => m.roles.map((role) => role.name)) ?? [],
          capabilities: user.capabilities ?? user.memberships?.flatMap((m) => m.effectiveCapabilities) ?? [],
        })),
      );
      const abierto = this.selectedUser();
      if (abierto) this.selectedUser.set(this.users().find((x) => x.id === abierto.id) ?? null);
    } catch {
      /* se queda lo pintado; el proximo refresco lo corrige */
    }
  }
  private patchUser(u: ApiAdminUser) {
    this.users.update((xs) => xs.map((x) => (x.id === u.id ? u : x)));
    this.selectedUser.set(u);
  }
  newRole() {
    this.roleDraft.set({
      id: '',
      name: '',
      description: '',
      organizationId: this.organizations()[0]?.id ?? '',
      capabilities: [],
      permissions: [],
      isSystem: false,
    });
  }
  editRole(r: ApiAdminRole) {
    this.roleDraft.set({
      ...r,
      capabilities: [...r.capabilities],
      permissions: [...(r.permissions ?? [])],
      organizationId: r.organizationId ?? '',
    });
  }
  async saveRole() {
    const r = this.roleDraft();
    if (!r || !r.name.trim()) return;
    if (!r.organizationId) {
      this.store.toast.set(this.i18n.t('admin.toast.selectOrganization'));
      return;
    }
    try {
      const saved = await firstValueFrom(
        this.api.saveAdminRole(r.id || null, {
          organizationId: r.organizationId,
          name: r.name,
          description: r.description ?? '',
          capabilities: r.capabilities,
          // Solo códigos del catálogo que esta pantalla pintó: un rol traído de una
          // versión anterior puede llevar cadenas que el servidor ya no reconoce, y
          // devolvérselas hacía fallar el guardado sin haber tocado nada.
          permissions: this.permisosDelCatalogo(r.permissions),
        }),
      );
      this.roles.update((xs) => (r.id ? xs.map((x) => (x.id === saved.id ? saved : x)) : [...xs, saved]));
      this.roleDraft.set(null);
      await this.refrescarAccesos();
    } catch (error) {
      // El servidor dice qué código sobra; callarlo dejaba un «no fue posible» sin pista.
      const motivo = error instanceof Error ? error.message : '';
      this.store.toast.set(
        motivo
          ? this.i18n.t('admin.toast.saveRoleFailedReason', { reason: motivo })
          : this.i18n.t('admin.toast.saveRoleFailed'),
      );
    }
  }
  toggleFlag(flag: { key: string; organizationId: string | null; userId: string | null; isEnabled: boolean }) {
    const isEnabled = !flag.isEnabled;
    this.adminFlags.update((flags) =>
      flags.map((x) =>
        x.key === flag.key && x.organizationId === flag.organizationId && x.userId === flag.userId
          ? { ...x, isEnabled }
          : x,
      ),
    );
    firstValueFrom(
      this.api.updateAdminFeatureFlag(flag.key, {
        organizationId: flag.organizationId,
        userId: flag.userId,
        isEnabled,
      }),
    ).catch(() => this.store.toast.set(this.i18n.t('admin.toast.updateFlagFailed')));
  }

  private readonly featureKeys: ReadonlySet<string> = new Set([
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
  featureLabel(key: string): string {
    // Mismas claves que el menú lateral (`nav.*`): son el mismo módulo visto desde dos pantallas.
    return this.featureKeys.has(key) ? this.i18n.t(`nav.${key}`) : key;
  }

  enabledFeaturesFor(user: ApiAdminUser): number {
    return this.platformFlags().filter((flag) => this.featureEnabledFor(user, flag.key)).length;
  }

  private readonly resourceKeys: ReadonlySet<string> = new Set([
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
  resourceLabel(resource: string): string {
    return this.resourceKeys.has(resource) ? this.i18n.t(`admin.resources.${resource}`) : resource;
  }

  featureEnabledFor(user: ApiAdminUser, key: string): boolean {
    const organizationId = this.userOrganizationId(user);
    const candidates = this.adminFlags().filter((flag) => flag.key === key);
    return (
      candidates.find((flag) => flag.userId === user.id && flag.organizationId === organizationId)?.isEnabled ??
      candidates.find((flag) => !flag.userId && flag.organizationId === organizationId)?.isEnabled ??
      candidates.find((flag) => !flag.userId && !flag.organizationId)?.isEnabled ??
      false
    );
  }

  async toggleUserFeature(user: ApiAdminUser, key: string) {
    const organizationId = this.userOrganizationId(user);
    if (!organizationId) return;
    const isEnabled = !this.featureEnabledFor(user, key);
    try {
      const saved = await firstValueFrom(
        this.api.updateAdminFeatureFlag(key, { organizationId, userId: user.id, isEnabled }),
      );
      this.adminFlags.update((flags) => [
        ...flags.filter(
          (flag) => !(flag.key === key && flag.organizationId === organizationId && flag.userId === user.id),
        ),
        saved,
      ]);
      await this.refrescarAccesos();
      this.store.toast.set(
        this.i18n.t('admin.toast.featureToggled', {
          feature: this.featureLabel(key),
          state: this.i18n.t(isEnabled ? 'admin.common.enabled' : 'admin.common.disabled'),
          user: user.displayName,
        }),
      );
    } catch {
      this.store.toast.set(this.i18n.t('admin.toast.toggleFeatureFailed'));
    }
  }
  setErrorStatus(e: ApiClientError, status: ApiClientError['status']) {
    const next = { ...e, status };
    this.errors.update((xs) => xs.map((x) => (x.id === e.id ? next : x)));
    this.selectedError.set(next);
    firstValueFrom(this.api.updateAdminError(e.id, status)).catch(() =>
      this.store.toast.set(this.i18n.t('admin.toast.errorStatusFailed')),
    );
  }
}
