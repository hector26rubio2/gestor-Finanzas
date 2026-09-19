import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdministrationApi, ApiAdminOrganization, ApiAdminRole, ApiAdminUser } from '../../core/api/administration.api';
import { RemoteBootstrap } from '../../core/remote-bootstrap';
import { CAPABILITIES, AppStore } from '../../core/store';
import { AdminStore } from './admin.store';

const role = (over: Partial<ApiAdminRole> = {}): ApiAdminRole => ({
  id: 'r1',
  name: 'Colaborador',
  description: null,
  organizationId: 'o1',
  capabilities: [],
  permissions: ['movimientos.ver'],
  isSystem: false,
  isActive: true,
  ...over,
});

const user = (over: Partial<ApiAdminUser> = {}): ApiAdminUser => ({
  id: 'u1',
  displayName: 'Daniel Ríos',
  email: 'daniel@finanzas.local',
  isActive: true,
  lastSeenAt: null,
  roles: ['Colaborador'],
  capabilities: [],
  memberships: [
    {
      id: 'm1',
      organizationId: 'o1',
      organizationName: 'Finanzas',
      status: 'Active',
      effectiveCapabilities: [],
      effectivePermissions: ['movimientos.ver'],
      overrides: [],
      roles: [role()],
    },
  ],
  ...over,
});

const organization = (over: Partial<ApiAdminOrganization> = {}): ApiAdminOrganization => ({
  id: 'o1',
  name: 'Finanzas',
  slug: 'finanzas',
  baseCurrency: 'COP',
  isActive: true,
  isDefault: true,
  memberCount: 1,
  createdAt: '2026-01-01T00:00:00Z',
  ...over,
});

describe('AdminStore', () => {
  const calls: string[] = [];
  const api = {
    setAdminUserActive: vi.fn(() => of(undefined)),
    assignAdminUserRoles: vi.fn(() => of(undefined)),
    setAdminUserCapability: vi.fn(() => of(undefined)),
    setAdminRoleActive: vi.fn(() => of(undefined)),
    addAdminOrganizationMember: vi.fn(() => of(undefined)),
    updateAdminFeatureFlag: vi.fn(),
    updateAdminOrganization: vi.fn(),
    setDefaultAdminOrganization: vi.fn(),
    adminUsers: vi.fn(() => of({ items: [user()], page: 1, size: 25, total: 1, totalPages: 1, hasNext: false })),
    saveAdminRole: vi.fn(),
  };
  const pollSession = vi.fn(() => Promise.resolve());
  const toast = { set: vi.fn() };

  function create(): AdminStore {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        AdminStore,
        { provide: AdministrationApi, useValue: api },
        { provide: RemoteBootstrap, useValue: { pollSession } },
        { provide: AppStore, useValue: { runtime: { mode: 'api' }, toast } },
        { provide: CAPABILITIES, useValue: { allows: () => true } },
      ],
    });
    const store = TestBed.inject(AdminStore);
    store.users.set([user()]);
    store.organizations.set([organization(), organization({ id: 'o2', name: 'Equipo', isDefault: false })]);
    store.roles.set([role()]);
    return store;
  }

  beforeEach(() => {
    calls.length = 0;
    vi.clearAllMocks();
    api.adminUsers.mockReturnValue(of({ items: [user()], page: 1, size: 25, total: 1, totalPages: 1, hasNext: false }));
  });

  it('un interruptor pulsado dos veces no deja nada pendiente', () => {
    const store = create();
    const daniel = store.users()[0];

    store.setUserActive(daniel, false);
    expect(store.count()).toBe(1);
    expect(store.isUserActive(daniel)).toBe(false);

    store.setUserActive(daniel, true);
    expect(store.count()).toBe(0);
    expect(store.dirty()).toBe(false);
  });

  it('anotar cambios no llama al servidor', () => {
    const store = create();
    const daniel = store.users()[0];

    store.setUserActive(daniel, false);
    store.togglePermission(daniel, 'movimientos.crear');
    store.setRoleActive(store.roles()[0], false);

    expect(api.setAdminUserActive).not.toHaveBeenCalled();
    expect(api.setAdminUserCapability).not.toHaveBeenCalled();
    expect(api.setAdminRoleActive).not.toHaveBeenCalled();
    expect(store.count()).toBe(3);
  });

  it('guardar aplica todo junto, relee la lista de personas una vez y refresca la sesión una vez', async () => {
    const store = create();
    const daniel = store.users()[0];
    store.setUserActive(daniel, false);
    store.togglePermission(daniel, 'movimientos.crear');
    store.toggleUserRole(daniel, 'r2');

    await store.guardar();

    expect(api.setAdminUserActive).toHaveBeenCalledWith('u1', false);
    expect(api.setAdminUserCapability).toHaveBeenCalledWith('u1', 'o1', 'movimientos.crear', true);
    expect(api.assignAdminUserRoles).toHaveBeenCalledWith('u1', 'o1', ['r1', 'r2']);
    expect(api.adminUsers).toHaveBeenCalledTimes(1);
    expect(pollSession).toHaveBeenCalledTimes(1);
    expect(store.dirty()).toBe(false);
    expect(store.failures()).toEqual([]);
  });

  it('un cambio que falla se queda en el borrador con su motivo y los demás se aplican', async () => {
    const store = create();
    const daniel = store.users()[0];
    api.setAdminUserActive.mockReturnValueOnce(throwError(() => new Error('sin permiso')));
    store.setUserActive(daniel, false);
    store.togglePermission(daniel, 'movimientos.crear');

    await store.guardar();

    expect(store.count()).toBe(1);
    expect(store.changes()[0].kind).toBe('userActive');
    expect(store.failures()).toHaveLength(1);
    expect(store.failures()[0].reason).toBe('sin permiso');
    expect(api.setAdminUserCapability).toHaveBeenCalledTimes(1);
  });

  it('activar una organización va antes de fijarla como predeterminada y desactivar va después', async () => {
    const store = create();
    const orden: string[] = [];
    const estado: Record<string, ApiAdminOrganization> = {
      o1: organization(),
      o2: organization({ id: 'o2', name: 'Equipo', isDefault: false, isActive: false }),
    };
    api.updateAdminOrganization.mockImplementation((id: string, body: { isActive: boolean }) => {
      orden.push(`active:${id}:${body.isActive}`);
      estado[id] = { ...estado[id], isActive: body.isActive };
      return of(estado[id]);
    });
    api.setDefaultAdminOrganization.mockImplementation((id: string) => {
      orden.push(`default:${id}`);
      for (const key of Object.keys(estado)) estado[key] = { ...estado[key], isDefault: key === id };
      return of(estado[id]);
    });
    store.organizations.set(Object.values(estado));

    store.setOrganizationActive(store.organizations()[1], true);
    store.setDefaultOrganization(store.organizations()[1]);
    store.setOrganizationActive(store.organizations()[0], false);
    await store.guardar();

    expect(orden).toEqual(['active:o2:true', 'default:o2', 'active:o1:false']);
    expect(store.organizations().find((o) => o.id === 'o2')?.isDefault).toBe(true);
    expect(store.organizations().find((o) => o.id === 'o1')?.isDefault).toBe(false);
  });

  it('mudar a alguien descarta lo demás anotado para esa persona', () => {
    const store = create();
    const daniel = store.users()[0];
    store.setUserActive(daniel, false);
    store.togglePermission(daniel, 'movimientos.crear');
    store.setFlag('calendar', 'o1', daniel.id, false);

    store.setUserOrganization(daniel, 'o2');

    expect(
      store
        .changes()
        .map((c) => c.kind)
        .sort(),
    ).toEqual(['userActive', 'userOrganization']);
    expect(store.hasPendingMove(daniel)).toBe(true);
    store.togglePermission(daniel, 'movimientos.editar');
    expect(store.count()).toBe(2);
  });

  it('una excepción restablecida vuelve a lo que digan los roles', () => {
    const store = create();
    const daniel = store.users()[0];

    store.clearOverride(daniel, 'movimientos.ver');

    expect(store.permissionOverride(daniel, 'movimientos.ver')).toBeNull();
    expect(store.hasPermission(daniel, 'movimientos.ver')).toBe(true);
    expect(store.count()).toBe(1);
  });

  it('guardar un rol manda solo permisos del catálogo', async () => {
    const store = create();
    store.permissionCatalog.set([
      { code: 'movimientos.ver', resource: 'movimientos', action: 1, level: 1, description: 'Entrar' },
    ]);
    api.saveAdminRole.mockReturnValue(of(role({ id: 'r9' })));

    await store.guardarRol(null, {
      organizationId: 'o1',
      name: 'Nuevo',
      description: '',
      capabilities: [],
      permissions: ['movimientos.ver', 'vocabulario.viejo'],
    });

    expect(api.saveAdminRole).toHaveBeenCalledWith(null, expect.objectContaining({ permissions: ['movimientos.ver'] }));
  });

  it('describe cada cambio con el nombre de quien afecta', () => {
    const store = create();
    const daniel = store.users()[0];
    store.setUserActive(daniel, false);

    expect(store.describe(store.changes()[0])).toContain('Daniel Ríos');
  });
});
