import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdministrationApi, ApiPermissionDescriptor } from '@core/api';
import { RemoteBootstrap } from '@core/session';
import { AppStore, CAPABILITIES } from '@core/state';
import { ADMIN_STORE_PROVIDERS } from '@pages/admin/admin.providers';
import { AdminPermissionsStore } from '@pages/admin/stores/admin-permissions.store';
import { PermissionCatalogComponent } from './permission-catalog';

const permiso = (code: string, description: string, level = 1): ApiPermissionDescriptor => ({
  code,
  resource: code.split('.')[0],
  action: 1,
  level,
  description,
});

const CATALOGO = [
  permiso('cuentas.ver', 'Ver cuentas'),
  permiso('cuentas.crear', 'Crear cuentas'),
  permiso('dashboard.ver', 'Ver el tablero'),
];

const api = {
  setPermissionDescription: vi.fn(() => of(undefined)),
  superAdminPermissions: vi.fn(() => of(CATALOGO)),
};
const toast = { set: vi.fn() };

function montar(puedeEditar = true) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      ...ADMIN_STORE_PROVIDERS,
      { provide: AdministrationApi, useValue: api },
      { provide: RemoteBootstrap, useValue: { pollSession: vi.fn() } },
      { provide: AppStore, useValue: { runtime: { mode: 'api' }, toast } },
      { provide: CAPABILITIES, useValue: { allows: () => puedeEditar } },
    ],
  });
  const permisos = TestBed.inject(AdminPermissionsStore);
  permisos.catalog.set(CATALOGO);
  const catalogo = TestBed.createComponent(PermissionCatalogComponent).componentInstance;
  return { permisos, catalogo };
}

describe('Administración: catálogo de capacidades', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('listar', () => {
    it('agrupa por recurso, en el orden en que llegan', () => {
      const { catalogo } = montar();

      expect(catalogo.grupos().map((g) => [g.recurso, g.permisos.length])).toEqual([
        ['cuentas', 2],
        ['dashboard', 1],
      ]);
    });

    it('filtra por código o por descripción, sin importar mayúsculas', () => {
      const { catalogo } = montar();

      catalogo.filtro.set('CREAR');
      expect(catalogo.visibles().map((p) => p.code)).toEqual(['cuentas.crear']);

      catalogo.filtro.set('tablero');
      expect(catalogo.visibles().map((p) => p.code)).toEqual(['dashboard.ver']);

      catalogo.filtro.set('   ');
      expect(catalogo.visibles()).toHaveLength(3);
    });

    it('un filtro sin resultados deja los grupos vacíos', () => {
      const { catalogo } = montar();

      catalogo.filtro.set('zzz');

      expect(catalogo.grupos()).toEqual([]);
    });
  });

  describe('editar una descripción', () => {
    it('solo cuenta como cambiada si difiere de la guardada', () => {
      const { catalogo } = montar();
      const ver = CATALOGO[0];

      expect(catalogo.cambiado(ver)).toBe(false);
      catalogo.escribir(ver.code, 'Ver cuentas');
      expect(catalogo.cambiado(ver)).toBe(false);
      catalogo.escribir(ver.code, '  Mirar las cuentas ');
      expect(catalogo.cambiado(ver)).toBe(true);
    });

    it('guardar manda la descripción sin espacios, recarga el catálogo y limpia el borrador', async () => {
      const { permisos, catalogo } = montar();
      const ver = CATALOGO[0];
      const nuevo = [permiso('cuentas.ver', 'Mirar las cuentas'), ...CATALOGO.slice(1)];
      api.superAdminPermissions.mockReturnValueOnce(of(nuevo));
      catalogo.escribir(ver.code, '  Mirar las cuentas ');

      await catalogo.guardar(ver);

      expect(api.setPermissionDescription).toHaveBeenCalledWith('cuentas.ver', 'Mirar las cuentas');
      expect(permisos.catalog()[0].description).toBe('Mirar las cuentas');
      expect(catalogo.borradores()['cuentas.ver']).toBeUndefined();
      expect(catalogo.guardando()).toBeNull();
      expect(toast.set).toHaveBeenCalledTimes(1);
    });

    it('guardar sin cambios no llama al servidor', async () => {
      const { catalogo } = montar();

      await catalogo.guardar(CATALOGO[0]);

      expect(api.setPermissionDescription).not.toHaveBeenCalled();
    });

    it('sin permiso de editar no se guarda aunque haya borrador', async () => {
      const { catalogo } = montar(false);
      catalogo.escribir('cuentas.ver', 'Otra cosa');

      await catalogo.guardar(CATALOGO[0]);

      expect(catalogo.puedeEditar).toBe(false);
      expect(api.setPermissionDescription).not.toHaveBeenCalled();
    });

    it('restablecer manda una descripción vacía, que el servidor toma como «la de fábrica»', async () => {
      const { catalogo } = montar();

      await catalogo.restablecer(CATALOGO[1]);

      expect(api.setPermissionDescription).toHaveBeenCalledWith('cuentas.crear', null);
    });

    it('si el servidor falla avisa, conserva el borrador y suelta el botón', async () => {
      const { catalogo } = montar();
      api.setPermissionDescription.mockReturnValueOnce(throwError(() => new Error('No se pudo')));
      catalogo.escribir('cuentas.ver', 'Algo nuevo');

      await catalogo.guardar(CATALOGO[0]);

      expect(toast.set).toHaveBeenCalledWith('No se pudo');
      expect(catalogo.borradores()['cuentas.ver']).toBe('Algo nuevo');
      expect(catalogo.guardando()).toBeNull();
    });
  });

  describe('lo que ven los roles', () => {
    it('al guardar un rol solo viajan permisos que existen en el catálogo', () => {
      const { permisos } = montar();

      expect(permisos.conocidos(['cuentas.ver', 'inventado.ver', 'dashboard.ver'])).toEqual([
        'cuentas.ver',
        'dashboard.ver',
      ]);
    });

    it('con el catálogo aún sin cargar no se descarta nada', () => {
      const { permisos } = montar();
      permisos.catalog.set([]);

      expect(permisos.conocidos(['cuentas.ver', 'otro.ver'])).toEqual(['cuentas.ver', 'otro.ver']);
    });

    it('los grupos del selector de roles siguen al catálogo cuando cambia una descripción', async () => {
      const { permisos } = montar();
      const nuevo = [permiso('cuentas.ver', 'Mirar las cuentas'), ...CATALOGO.slice(1)];
      api.superAdminPermissions.mockReturnValueOnce(of(nuevo));

      await permisos.guardarDescripcion('cuentas.ver', 'Mirar las cuentas');

      expect(permisos.groups()[0].items[0].description).toBe('Mirar las cuentas');
    });
  });
});
