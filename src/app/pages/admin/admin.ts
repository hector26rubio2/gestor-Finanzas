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
  ApiPermissionAction,
  ApiPermissionDescriptor,
  ApiPermissionLevel,
  ApiClientError,
  FinanceApiClient,
} from '../core/api-client';
import { P } from '../core/permissions';
import { IconComponent } from '../ui/icon';
import { UiOption, UiSelectComponent } from '../ui/select';
import { RemoteBootstrap } from '../core/remote-bootstrap';
import { CAPABILITIES, DemoStore } from '../core/store';

type Tab = 'summary' | 'users' | 'roles' | 'flags' | 'audit' | 'errors';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent, UiSelectComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './admin.html',
  styleUrl: './admin.css',
})
export class AdminComponent implements OnInit {
  readonly store = inject(DemoStore);
  private api = inject(FinanceApiClient);
  private readonly arranque = inject(RemoteBootstrap);
  readonly caps = inject(CAPABILITIES);

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
  readonly userStatusOptions: readonly UiOption[] = [
    { value: 'all', label: 'Todos los estados' },
    { value: 'active', label: 'Activos' },
    { value: 'inactive', label: 'Desactivados' },
  ];
  readonly auditActionOptions: readonly UiOption[] = [
    { value: 'all', label: 'Todas las acciones' },
    { value: 'create', label: 'Creación' },
    { value: 'update', label: 'Cambios' },
    { value: 'access', label: 'Accesos' },
  ];
  readonly errorStatusOptions: readonly UiOption[] = [
    { value: 'all', label: 'Todos los estados' },
    { value: 'new', label: 'Nuevos' },
    { value: 'investigating', label: 'En análisis' },
    { value: 'resolved', label: 'Resueltos' },
  ];
  readonly errorStateOptions = this.errorStatusOptions.filter((option) => option.value !== 'all');
  private readonly allTabs = [
    { id: 'summary' as Tab, label: 'Resumen', icon: 'dashboard', capability: P.administracion.ver },
    { id: 'users' as Tab, label: 'Usuarios', icon: 'people', capability: P.administracion.usuarios.listar },
    { id: 'roles' as Tab, label: 'Roles y capacidades', icon: 'shield', capability: P.administracion.roles.listar },
    { id: 'flags' as Tab, label: 'Feature Flags', icon: 'flag', capability: P.administracion.banderas.listar },
    { id: 'audit' as Tab, label: 'Auditoría', icon: 'list', capability: P.administracion.auditoria.listar },
    { id: 'errors' as Tab, label: 'Errores', icon: '!', capability: P.administracion.errores.listar },
  ];

  /** La consola era todo o nada: quien entraba veía y podía las seis pestañas. */
  readonly tabs = computed(() => this.allTabs.filter((item) => this.caps.allows(item.capability)));
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

  accionDe(permiso: ApiPermissionDescriptor): string {
    return ApiPermissionAction[permiso.action] ?? 'Acción';
  }
  nivelDe(permiso: ApiPermissionDescriptor): string {
    return ApiPermissionLevel[permiso.level] ?? 'básico';
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
      audience: flag.userId ? 'Usuario' : flag.organizationId ? 'Organización' : 'Global',
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
      this.store.toast.set('No fue posible cargar los datos de la consola de administración.');
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
    return this.users().find((x) => x.id === id)?.displayName ?? 'Sistema';
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
      .catch(() => this.store.toast.set('No fue posible quitar la excepción.'));
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
    return s === 'new' ? 'Nuevo' : s === 'investigating' ? 'En análisis' : 'Resuelto';
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
      this.store.toast.set('No fue posible cambiar el estado del usuario.'),
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
      this.store.toast.set('No fue posible asignar el rol.');
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
      .catch(() => this.store.toast.set('No fue posible aplicar el cambio de permiso.'));
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
      this.store.toast.set('Selecciona una organización para el rol.');
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
      this.store.toast.set(motivo ? `No fue posible guardar el rol: ${motivo}` : 'No fue posible guardar el rol.');
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
    ).catch(() => this.store.toast.set('No fue posible actualizar el flag.'));
  }

  featureLabel(key: string): string {
    const labels: Record<string, string> = {
      dashboard: 'Dashboard',
      movements: 'Movimientos',
      calendar: 'Calendario',
      accounts: 'Cuentas y tarjetas',
      people: 'Personas y deudas',
      portfolio: 'Patrimonio',
      planning: 'Planificación',
      reports: 'Reportes',
      notifications: 'Notificaciones',
      settings: 'Preferencias',
    };
    return labels[key] ?? key;
  }

  enabledFeaturesFor(user: ApiAdminUser): number {
    return this.platformFlags().filter((flag) => this.featureEnabledFor(user, flag.key)).length;
  }

  resourceLabel(resource: string): string {
    const labels: Record<string, string> = {
      dashboard: 'Dashboard',
      movimientos: 'Movimientos',
      calendario: 'Calendario',
      cuentas: 'Cuentas y tarjetas',
      personas: 'Personas y deudas',
      patrimonio: 'Patrimonio',
      planificacion: 'Planificación',
      reportes: 'Reportes',
      notificaciones: 'Notificaciones',
      preferencias: 'Preferencias',
      organizacion: 'Organización',
      administracion: 'Administración global',
      sesion: 'Sesión',
    };
    return labels[resource] ?? resource;
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
        `${this.featureLabel(key)} ${isEnabled ? 'habilitado' : 'deshabilitado'} para ${user.displayName}.`,
      );
    } catch {
      this.store.toast.set('No fue posible cambiar la función para este usuario.');
    }
  }
  setErrorStatus(e: ApiClientError, status: ApiClientError['status']) {
    const next = { ...e, status };
    this.errors.update((xs) => xs.map((x) => (x.id === e.id ? next : x)));
    this.selectedError.set(next);
    firstValueFrom(this.api.updateAdminError(e.id, status)).catch(() =>
      this.store.toast.set('No fue posible actualizar el estado del error.'),
    );
  }
}
