import { provideRouter } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdministrationApi, ApiAdminRole, ApiAdminUser } from '@core/api';
import { RemoteBootstrap, RUNTIME_CONFIG } from '@core/session';
import { AppStore, CAPABILITIES } from '@core/state';
import { ADMIN_STORE_PROVIDERS } from '@pages/admin/admin.providers';
import { AdminStore } from '@pages/admin/admin.store';
import { AdminCommands } from '@pages/admin/stores/admin-commands';
import { RolesTabComponent } from './roles-tab';

const rol = (id: string, parcial: Partial<ApiAdminRole> = {}): ApiAdminRole => ({
  id,
  name: `Rol ${id}`,
  description: null,
  organizationId: 'o1',
  capabilities: [],
  permissions: ['movimientos.ver', 'movimientos.crear', 'cuentas.ver'],
  isSystem: false,
  isActive: true,
  ...parcial,
});

const persona = (id: string, roles: ApiAdminRole[]): ApiAdminUser => ({
  id,
  displayName: `Persona ${id}`,
  email: `${id}@finanzas.local`,
  isActive: true,
  lastSeenAt: null,
  roles: roles.map((r) => r.name),
  capabilities: [],
  memberships: [
    {
      id: `m-${id}`,
      organizationId: 'o1',
      organizationName: 'Finanzas',
      status: 'Active',
      effectiveCapabilities: [],
      effectivePermissions: [],
      roles,
    },
  ],
});

function montar() {
  window.__FINANZAS_CONFIG__ = { apiBaseUrl: 'http://api.test' };
  const toast = { set: vi.fn() };
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: RUNTIME_CONFIG, useValue: { apiBaseUrl: 'http://api.test' } },
      ...ADMIN_STORE_PROVIDERS,
      { provide: AdministrationApi, useValue: {} },
      { provide: RemoteBootstrap, useValue: { pollSession: vi.fn() } },
      { provide: AppStore, useValue: { runtime: { mode: 'api' }, toast } },
      { provide: CAPABILITIES, useValue: { allows: () => true } },
    ],
  });
  const store = TestBed.inject(AdminStore);
  const comandos = TestBed.inject(AdminCommands);
  const pestana = TestBed.createComponent(RolesTabComponent).componentInstance;
  return { store, comandos, pestana, toast };
}

describe('Administración: roles', () => {
  beforeEach(() => vi.clearAllMocks());

  it('las filas traen miembros, cantidad de permisos y estado', () => {
    const { store, pestana } = montar();
    const colaborador = rol('r1');
    store.roles.set([colaborador, rol('r2', { isActive: false, permissions: ['cuentas.ver'] })]);
    store.users.set([persona('a', [colaborador]), persona('b', [colaborador])]);

    const [r1, r2] = pestana.rows();

    expect(r1.members).toBe(2);
    expect(r1.permissionCount).toBe(3);
    expect(r2.members).toBe(0);
    expect(r2.permissionCount).toBe(1);
    expect(r1.active).not.toBe(r2.active);
  });

  it('los recursos de un rol son los módulos distintos de sus permisos, ordenados', () => {
    const { pestana } = montar();

    expect(pestana.resourcesOf(rol('r1'))).toEqual(['cuentas', 'movimientos']);
  });

  it('un rol en uso no se puede borrar: avisa cuántas personas lo tienen y no abre la confirmación', () => {
    const { store, pestana, toast } = montar();
    const colaborador = rol('r1');
    store.roles.set([colaborador]);
    store.users.set([persona('a', [colaborador])]);

    pestana.pedirBorrado(colaborador);

    expect(pestana.deleting()).toBeNull();
    expect(toast.set).toHaveBeenCalledTimes(1);
    expect(toast.set.mock.calls[0][0]).toContain('1');
  });

  it('un rol sin nadie sí pide confirmación', () => {
    const { store, pestana } = montar();
    const libre = rol('r9');
    store.roles.set([libre]);

    pestana.pedirBorrado(libre);

    expect(pestana.deleting()).toBe(libre);
  });

  it('confirmar borra el rol libre y avisa que quedó', async () => {
    const { store, comandos, pestana, toast } = montar();
    const libre = rol('r9');
    store.roles.set([libre]);
    const borrar = vi.spyOn(comandos, 'eliminarRol').mockResolvedValue(undefined);
    pestana.pedirBorrado(libre);

    await pestana.confirmDelete();

    expect(borrar).toHaveBeenCalledWith(libre);
    expect(pestana.deleting()).toBeNull();
    expect(toast.set.mock.calls.at(-1)?.[0]).toContain('Rol r9');
  });

  it('si el servidor falla avisa con el motivo y el rol sigue en la lista', async () => {
    const { store, comandos, pestana, toast } = montar();
    const libre = rol('r9');
    store.roles.set([libre]);
    vi.spyOn(comandos, 'eliminarRol').mockRejectedValue(new Error('No se puede borrar'));
    pestana.pedirBorrado(libre);

    await pestana.confirmDelete();

    expect(toast.set.mock.calls.at(-1)?.[0]).toContain('No se puede borrar');
    expect(store.roles()).toHaveLength(1);
  });

  it('aunque alguien lo asigne mientras se confirma, un rol en uso no se borra', async () => {
    const { store, comandos, pestana } = montar();
    const libre = rol('r9');
    store.roles.set([libre]);
    const borrar = vi.spyOn(comandos, 'eliminarRol').mockResolvedValue(undefined);
    pestana.pedirBorrado(libre);
    store.users.set([persona('a', [libre])]);

    await pestana.confirmDelete();

    expect(borrar).not.toHaveBeenCalled();
  });

  it('abrir y cerrar la hoja de edición deja los estados limpios', () => {
    const { pestana } = montar();
    const colaborador = rol('r1');

    pestana.editing.set(colaborador);
    pestana.creating.set(true);
    pestana.closeSheet();

    expect(pestana.editing()).toBeNull();
    expect(pestana.creating()).toBe(false);
  });
});
