import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiRequestError, FinanceApiClient } from '../../core/api-client';
import { P } from '../../core/permissions';
import { RUNTIME_CONFIG } from '../../core/runtime';
import { DemoStore } from '../../core/store';
import { AdminComponent } from './admin';

/**
 * Guardar un rol sin haberlo tocado tiene que funcionar.
 *
 * En producción daba 400: el servidor devolvía, mezcladas con los códigos, las cadenas
 * del vocabulario de pantalla que emitía durante la ventana de migración, y luego las
 * rechazaba al recibirlas de vuelta. La consola solo mostraba «no fue posible».
 */
describe('AdminComponent y el guardado de un rol', () => {
  const catalogo = [
    { code: P.movimientos.ver, resource: 'movimientos', action: 1, level: 1, description: 'Entrar' },
    { code: P.movimientos.crear, resource: 'movimientos', action: 3, level: 2, description: 'Registrar' },
  ];

  /** Espía de `saveAdminRole` que conserva el cuerpo enviado, que es lo que se afirma. */
  function espiaDeGuardado() {
    const rol = {
      id: 'r1',
      name: 'Rol',
      description: null,
      capabilities: [],
      permissions: [],
      isSystem: false,
      isActive: true,
    };
    return vi.fn((id: string | null, body: unknown) => of({ ...rol, id: id ?? rol.id, enviado: body }));
  }

  function montar(api: Partial<FinanceApiClient>) {
    window.__FINANZAS_CONFIG__ = { mode: 'demo' };
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: RUNTIME_CONFIG, useValue: { mode: 'demo' } },
        { provide: FinanceApiClient, useValue: api },
      ],
    });
    const componente = TestBed.createComponent(AdminComponent).componentInstance;
    componente.permissionCatalog.set(catalogo);
    return componente;
  }

  beforeEach(() => TestBed.resetTestingModule());

  it('no manda códigos que el catálogo no reconoce', async () => {
    const saveAdminRole = espiaDeGuardado();
    const componente = montar({ saveAdminRole } as unknown as Partial<FinanceApiClient>);

    componente.roleDraft.set({
      id: 'r1',
      name: 'Propietario',
      description: null,
      organizationId: 'o1',
      capabilities: [],
      // Tal como venía del servidor: códigos buenos y códigos ya retirados.
      permissions: [P.movimientos.ver, 'dashboard', 'movement.create', 'movimientos.listar', P.movimientos.crear],
      isSystem: false,
      isActive: true,
    });

    await componente.saveRole();

    const enviado = saveAdminRole.mock.calls[0][1] as { permissions: readonly string[] };
    expect(enviado.permissions).toEqual([P.movimientos.ver, P.movimientos.crear]);
  });

  it('sin catálogo cargado manda lo que había, en vez de vaciar el rol', async () => {
    const saveAdminRole = espiaDeGuardado();
    const componente = montar({ saveAdminRole } as unknown as Partial<FinanceApiClient>);
    componente.permissionCatalog.set([]);

    componente.roleDraft.set({
      id: 'r1',
      name: 'Propietario',
      description: null,
      organizationId: 'o1',
      capabilities: [],
      permissions: [P.movimientos.ver],
      isSystem: false,
      isActive: true,
    });

    await componente.saveRole();

    const enviado = saveAdminRole.mock.calls[0][1] as { permissions: readonly string[] };
    expect(enviado.permissions).toEqual([P.movimientos.ver]);
  });

  it('cuando el servidor rechaza, el aviso dice por qué', async () => {
    const saveAdminRole = vi.fn(() =>
      throwError(
        () =>
          new ApiRequestError(400, {
            status: 400,
            title: 'Petición inválida',
            detail: 'Permiso desconocido: movimientos.teletransportar',
          }),
      ),
    );
    const componente = montar({ saveAdminRole } as unknown as Partial<FinanceApiClient>);

    componente.roleDraft.set({
      id: 'r1',
      name: 'Propietario',
      description: null,
      organizationId: 'o1',
      capabilities: [],
      permissions: [P.movimientos.ver],
      isSystem: false,
      isActive: true,
    });

    await componente.saveRole();

    expect(TestBed.inject(DemoStore).toast()).toContain('movimientos.teletransportar');
  });
});

/**
 * Eliminar, desactivar y paginar roles.
 *
 * El botón de borrar existía en el backend desde antes, pero la consola nunca lo ofrecía:
 * un permiso que nadie podía usar. Lo mismo pasaba con desactivar un rol sin borrarlo.
 */
describe('AdminComponent y las acciones sobre un rol existente', () => {
  const rol = {
    id: 'r1',
    name: 'Auditor',
    description: null,
    capabilities: [],
    permissions: [],
    isSystem: false,
    isActive: true,
    organizationId: 'o1',
  };

  function montar(api: Partial<FinanceApiClient>) {
    window.__FINANZAS_CONFIG__ = { mode: 'demo' };
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: RUNTIME_CONFIG, useValue: { mode: 'demo' } },
        { provide: FinanceApiClient, useValue: api },
      ],
    });
    const componente = TestBed.createComponent(AdminComponent).componentInstance;
    componente.roles.set([rol]);
    return componente;
  }

  beforeEach(() => TestBed.resetTestingModule());

  it('pide confirmación antes de eliminar y no llama al servidor si se cancela', async () => {
    const deleteAdminRole = vi.fn(() => of(undefined));
    const componente = montar({ deleteAdminRole } as unknown as Partial<FinanceApiClient>);
    vi.spyOn(window, 'confirm').mockReturnValue(false);

    await componente.deleteRole(rol);

    expect(deleteAdminRole).not.toHaveBeenCalled();
  });

  it('confirmado, elimina el rol y avisa', async () => {
    const deleteAdminRole = vi.fn(() => of(undefined));
    const adminRoles = vi.fn(() => of({ items: [], page: 1, size: 12, total: 0, totalPages: 1, hasNext: false }));
    const componente = montar({ deleteAdminRole, adminRoles } as unknown as Partial<FinanceApiClient>);
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    await componente.deleteRole(rol);

    expect(deleteAdminRole).toHaveBeenCalledWith('r1');
    expect(TestBed.inject(DemoStore).toast()).toContain('Auditor');
  });

  it('activar y desactivar refleja el nuevo estado sin esperar a recargar', async () => {
    const setAdminRoleActive = vi.fn(() => of(undefined));
    const componente = montar({ setAdminRoleActive } as unknown as Partial<FinanceApiClient>);

    await componente.toggleRoleActive(rol);

    expect(setAdminRoleActive).toHaveBeenCalledWith('r1', false);
    expect(componente.roles()[0].isActive).toBe(false);
  });

  it('la paginación pide la página pedida y actualiza el total', async () => {
    const adminRoles = vi.fn((page: number) =>
      of({ items: [{ ...rol, id: `r${page}` }], page, size: 12, total: 20, totalPages: 2, hasNext: page === 1 }),
    );
    const componente = montar({ adminRoles } as unknown as Partial<FinanceApiClient>);
    componente.rolesTotal.set(20);

    await componente.loadRolesPage(2);

    expect(adminRoles).toHaveBeenCalledWith(2, 12);
    expect(componente.roles()[0].id).toBe('r2');
    expect(componente.rolesPage()).toBe(2);
  });
});
