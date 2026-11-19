import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { AdministrationApi, ApiAdminOrganization, ApiAdminUser, ApiClientError } from '@core/api';
import { RemoteBootstrap } from '@core/session';
import { AppStore, CAPABILITIES } from '@core/state';
import { AdminStore } from '@pages/admin/admin.store';
import { ADMIN_STORE_PROVIDERS } from '@pages/admin/admin.providers';
import { AdminErrorsStore } from '@pages/admin/stores/admin-errors.store';
import { AdminFlagsStore } from '@pages/admin/stores/admin-flags.store';
import { AdminPermissionsStore } from '@pages/admin/stores/admin-permissions.store';
import { SummaryTabComponent } from './summary-tab';

const usuario = (id: string, parcial: Partial<ApiAdminUser> = {}): ApiAdminUser => ({
  id,
  displayName: `Persona ${id}`,
  email: `${id}@finanzas.local`,
  isActive: true,
  lastSeenAt: null,
  roles: ['Colaborador'],
  capabilities: [],
  memberships: [],
  ...parcial,
});

const organizacion = (id: string, parcial: Partial<ApiAdminOrganization> = {}): ApiAdminOrganization => ({
  id,
  name: `Org ${id}`,
  slug: id,
  baseCurrency: 'COP',
  isActive: true,
  isDefault: false,
  memberCount: 1,
  createdAt: '2026-01-01T00:00:00Z',
  ...parcial,
});

const error = (id: string, status: ApiClientError['status'], ocurrencias: number): ApiClientError => ({
  id,
  fingerprint: id,
  message: id,
  source: 'web',
  status,
  occurrences: ocurrencias,
  affectedUsers: 1,
  version: '1',
  lastSeenAt: '2026-08-01T00:00:00Z',
  traceId: null,
});

function montar() {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      ...ADMIN_STORE_PROVIDERS,
      { provide: AdministrationApi, useValue: {} },
      { provide: RemoteBootstrap, useValue: { pollSession: () => Promise.resolve() } },
      { provide: AppStore, useValue: { runtime: { mode: 'api' }, toast: { set: () => undefined } } },
      { provide: CAPABILITIES, useValue: { allows: () => true } },
    ],
  });
  const store = TestBed.inject(AdminStore);
  const resumen = TestBed.runInInjectionContext(() => new SummaryTabComponent());
  return { store, resumen };
}

const tarjeta = (resumen: SummaryTabComponent, indice: number) => resumen.kpis()[indice];

describe('Administración: el resumen refleja los números', () => {
  it('usuarios activos sobre el total', () => {
    const { store, resumen } = montar();
    store.users.set([usuario('a'), usuario('b'), usuario('c', { isActive: false })]);

    expect(tarjeta(resumen, 0).value).toBe(2);
    expect(tarjeta(resumen, 0).detail).toContain('3');
  });

  it('desactivar a alguien baja el contador de activos', () => {
    const { store, resumen } = montar();
    store.users.set([usuario('a'), usuario('b')]);
    expect(tarjeta(resumen, 0).value).toBe(2);

    store.marcarUsuarioActivo('b', false);

    expect(tarjeta(resumen, 0).value).toBe(1);
  });

  it('organizaciones activas sobre el total', () => {
    const { store, resumen } = montar();
    store.organizations.set([organizacion('o1'), organizacion('o2', { isActive: false })]);

    expect(tarjeta(resumen, 1).value).toBe(1);
    expect(tarjeta(resumen, 1).detail).toContain('2');
  });

  it('roles: el total que informa el servidor y los permisos del catálogo', () => {
    const { store, resumen } = montar();
    store.rolesTotal.set(7);
    TestBed.inject(AdminPermissionsStore).catalog.set([{ key: 'a' }, { key: 'b' }, { key: 'c' }] as never);

    expect(tarjeta(resumen, 2).value).toBe(7);
    expect(tarjeta(resumen, 2).detail).toContain('3');
  });

  it('banderas activas de la plataforma, sin contar las de organización ni de usuario', () => {
    const { resumen } = montar();
    TestBed.inject(AdminFlagsStore).flags.set([
      { key: 'a', organizationId: null, userId: null, isEnabled: true, updatedAt: '' },
      { key: 'b', organizationId: null, userId: null, isEnabled: false, updatedAt: '' },
      { key: 'a', organizationId: 'o1', userId: null, isEnabled: true, updatedAt: '' },
      { key: 'c', organizationId: null, userId: 'u1', isEnabled: true, updatedAt: '' },
    ]);

    expect(tarjeta(resumen, 3).value).toBe(1);
    expect(tarjeta(resumen, 3).detail).toContain('2');
  });

  it('errores abiertos: los resueltos no cuentan y las ocurrencias suman', () => {
    const { resumen } = montar();
    TestBed.inject(AdminErrorsStore).items.set([
      error('e1', 'new', 3),
      error('e2', 'investigating', 4),
      error('e3', 'resolved', 50),
    ]);

    expect(tarjeta(resumen, 4).value).toBe(2);
    expect(tarjeta(resumen, 4).detail).toContain('7');
    expect(tarjeta(resumen, 4).warn).toBe(true);
  });

  it('sin errores abiertos no hay alerta', () => {
    const { resumen } = montar();
    TestBed.inject(AdminErrorsStore).items.set([error('e3', 'resolved', 9)]);

    expect(tarjeta(resumen, 4).value).toBe(0);
    expect(tarjeta(resumen, 4).warn).toBe(false);
  });

  it('la tabla de usuarios muestra el estado, el rol o el acceso directo y el último acceso', () => {
    const { store, resumen } = montar();
    store.users.set([
      usuario('a', { roles: ['Administrador', 'Colaborador'] }),
      usuario('b', { roles: [], isActive: false }),
    ]);

    const [a, b] = resumen.userRows();

    expect(a.roles).toBe('Administrador, Colaborador');
    expect(a.status).not.toBe(b.status);
    expect(b.roles).not.toBe('');
    expect(a.lastAccess).toBe(b.lastAccess);
  });

  it('la organización de cada usuario sale de su membresía y, si no tiene, «—»', () => {
    const { store, resumen } = montar();
    store.organizations.set([organizacion('o1', { name: 'Finanzas' })]);
    store.users.set([
      usuario('a', {
        memberships: [
          {
            id: 'm1',
            organizationId: 'o1',
            organizationName: 'Finanzas',
            status: 'Active',
            effectiveCapabilities: [],
            effectivePermissions: [],
            roles: [],
          },
        ],
      }),
      usuario('b'),
    ]);

    expect(resumen.organizationOf('a')).toBe('Finanzas');
    expect(resumen.organizationOf('b')).toBe('—');
  });

  it('las filas de organizaciones traen miembros y estado', () => {
    const { store, resumen } = montar();
    store.organizations.set([
      organizacion('o1', { memberCount: 4 }),
      organizacion('o2', { isActive: false, memberCount: 0 }),
    ]);

    const [o1, o2] = resumen.organizationRows();

    expect(o1.members).toBe(4);
    expect(o2.members).toBe(0);
    expect(o1.status).not.toBe(o2.status);
  });
});
