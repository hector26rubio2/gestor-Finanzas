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
    const rol = { id: 'r1', name: 'Rol', description: null, capabilities: [], permissions: [], isSystem: false };
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
    });

    await componente.saveRole();

    expect(TestBed.inject(DemoStore).toast()).toContain('movimientos.teletransportar');
  });
});
