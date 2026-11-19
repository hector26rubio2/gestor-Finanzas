import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AdministrationApi, ApiAdminOrganization, ApiAdminUser } from '@core/api';
import { RemoteBootstrap } from '@core/session';
import { AppStore, CAPABILITIES } from '@core/state';
import { ADMIN_STORE_PROVIDERS } from '@pages/admin/admin.providers';
import { AdminStore } from '@pages/admin/admin.store';
import { AdminCommands } from '@pages/admin/stores/admin-commands';
import { OrganizationSheetComponent } from './organization-sheet';
import { OrganizationsTabComponent } from './organizations-tab';

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

const persona = (id: string, organizationId: string): ApiAdminUser => ({
  id,
  displayName: `Persona ${id}`,
  email: `${id}@finanzas.local`,
  isActive: true,
  lastSeenAt: null,
  roles: [],
  capabilities: [],
  memberships: [
    {
      id: `m-${id}`,
      organizationId,
      organizationName: organizationId,
      status: 'Active',
      effectiveCapabilities: [],
      effectivePermissions: [],
      roles: [],
    },
  ],
});

const api = {
  addAdminOrganizationMember: vi.fn(() => of(undefined)),
  adminOrganizationMembers: vi.fn(() => of([])),
  adminRoles: vi.fn(() => of({ items: [], page: 1, size: 100, total: 0, totalPages: 1, hasNext: false })),
  adminOrganizationFlags: vi.fn(() => of([])),
  adminUsers: vi.fn(() =>
    of({ items: [] as ApiAdminUser[], page: 1, size: 8, total: 0, totalPages: 1, hasNext: false }),
  ),
  updateAdminOrganization: vi.fn((id: string, body: { name?: string }) => of(organizacion(id, { name: body.name }))),
  setDefaultAdminOrganization: vi.fn(),
  deleteAdminOrganization: vi.fn(() => of(undefined)),
  consolidateAdminOrganizations: vi.fn(() => of({ movedUsers: 3, deletedOrganizations: 1 })),
};
const pollSession = vi.fn(() => Promise.resolve());
const toast = { set: vi.fn() };

function montar(permite: (c: string) => boolean = () => true) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      ...ADMIN_STORE_PROVIDERS,
      { provide: AdministrationApi, useValue: api },
      { provide: RemoteBootstrap, useValue: { pollSession } },
      { provide: AppStore, useValue: { runtime: { mode: 'api' }, toast, currencyCatalog: () => [] } },
      { provide: CAPABILITIES, useValue: { allows: permite } },
    ],
  });
  const store = TestBed.inject(AdminStore);
  store.organizations.set([
    organizacion('o1', { isDefault: true, memberCount: 2 }),
    organizacion('o2', { memberCount: 1 }),
    organizacion('o3', { isActive: false, memberCount: 0 }),
  ]);
  return store;
}

describe('Administración: organizaciones', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('la lista', () => {
    it('oculta las archivadas hasta que se piden', () => {
      montar();
      const pestana = TestBed.createComponent(OrganizationsTabComponent).componentInstance;

      expect(pestana.visibleOrganizations().map((o) => o.id)).toEqual(['o1', 'o2']);

      pestana.showArchived.set(true);
      expect(pestana.visibleOrganizations().map((o) => o.id)).toEqual(['o1', 'o2', 'o3']);
    });

    it('las filas traen moneda, miembros y marcan la predeterminada', () => {
      montar();
      const pestana = TestBed.createComponent(OrganizationsTabComponent).componentInstance;

      const [o1, o2] = pestana.rows();

      expect(o1.members).toBe(2);
      expect(o1.currency).toBe('COP');
      expect(o1.defaultSort).toBe('0');
      expect(o2.defaultSort).toBe('1');
    });

    it('solo se borra una organización archivada y no predeterminada', () => {
      const store = montar();
      const pestana = TestBed.createComponent(OrganizationsTabComponent).componentInstance;
      const [o1, o2, o3] = store.organizations();

      expect(pestana.canDelete(o1)).toBe(false);
      expect(pestana.canDelete(o2)).toBe(false);
      expect(pestana.canDelete(o3)).toBe(true);
    });

    it('solo una organización activa puede ser la predeterminada', () => {
      const store = montar();
      const pestana = TestBed.createComponent(OrganizationsTabComponent).componentInstance;

      expect(pestana.canMakeDefault(store.organizations()[1])).toBe(true);
      expect(pestana.canMakeDefault(store.organizations()[2])).toBe(false);
    });

    it('sin el permiso de editar no se borra, ni se fija, ni se consolida', () => {
      const store = montar(() => false);
      const pestana = TestBed.createComponent(OrganizationsTabComponent).componentInstance;

      expect(pestana.canDelete(store.organizations()[2])).toBe(false);
      expect(pestana.canMakeDefault(store.organizations()[1])).toBe(false);
      expect(pestana.canConsolidate()).toBe(false);
    });

    it('consolidar mueve a todos a la predeterminada, recarga y avisa cuántos', async () => {
      const store = montar();
      vi.spyOn(store, 'cargar').mockResolvedValue(undefined);
      const pestana = TestBed.createComponent(OrganizationsTabComponent).componentInstance;

      expect(pestana.canConsolidate()).toBe(true);
      await pestana.consolidate();

      expect(api.consolidateAdminOrganizations).toHaveBeenCalledTimes(1);
      expect(pollSession).toHaveBeenCalledTimes(1);
      expect(toast.set.mock.calls.at(-1)?.[0]).toContain('3');
    });

    it('borrar una archivada la quita de la lista', async () => {
      const store = montar();
      const pestana = TestBed.createComponent(OrganizationsTabComponent).componentInstance;
      pestana.deleting.set(store.organizations()[2]);

      await pestana.confirmDelete();

      expect(api.deleteAdminOrganization).toHaveBeenCalledWith('o3');
      expect(store.organizations().map((o) => o.id)).not.toContain('o3');
    });
  });

  describe('la hoja de una organización', () => {
    function abrir(store: AdminStore, id = 'o2') {
      const fixture = TestBed.createComponent(OrganizationSheetComponent);
      fixture.componentRef.setInput('organization', store.organizations().find((o) => o.id === id) ?? null);
      fixture.detectChanges();
      return fixture.componentInstance;
    }

    afterEach(() => vi.useRealTimers());

    it('al abrirla carga miembros, roles y banderas de esa organización', async () => {
      const store = montar();
      abrir(store);
      await Promise.resolve();

      expect(api.adminOrganizationMembers).toHaveBeenCalledWith('o2');
      expect(api.adminRoles).toHaveBeenCalledWith(1, 100, 'o2');
      expect(api.adminOrganizationFlags).toHaveBeenCalledWith('o2');
    });

    it('el nombre solo cuenta como cambiado si no está vacío y difiere del actual', () => {
      const hoja = abrir(montar());

      expect(hoja.nameChanged()).toBe(false);
      hoja.name.set('   ');
      expect(hoja.nameChanged()).toBe(false);
      hoja.name.set('Org o2');
      expect(hoja.nameChanged()).toBe(false);
      hoja.name.set('  Nuevo nombre ');
      expect(hoja.nameChanged()).toBe(true);
    });

    it('renombrar manda el nombre sin espacios y actualiza la lista', async () => {
      const store = montar();
      const hoja = abrir(store);
      hoja.name.set('  Equipo Norte ');

      await hoja.rename(store.organizations()[1]);

      expect(api.updateAdminOrganization).toHaveBeenCalledWith('o2', { name: 'Equipo Norte' });
      expect(store.organizations().find((o) => o.id === 'o2')?.name).toBe('Equipo Norte');
      expect(hoja.renaming()).toBe(false);
    });

    it('si renombrar falla avisa con el motivo y suelta el botón', async () => {
      const store = montar();
      api.updateAdminOrganization.mockReturnValueOnce(throwError(() => new Error('Nombre repetido')));
      const hoja = abrir(store);
      hoja.name.set('Otro');

      await hoja.rename(store.organizations()[1]);

      expect(toast.set.mock.calls.at(-1)?.[0]).toContain('Nombre repetido');
      expect(hoja.renaming()).toBe(false);
    });

    it('agregar a alguien de otra organización lo anota como mudanza sin tocar el servidor', () => {
      const store = montar();
      const hoja = abrir(store, 'o2');
      const ana = persona('ana', 'o1');

      hoja.add(ana, store.organizations()[1]);

      expect(store.hasPendingMove(ana)).toBe(true);
      expect(store.pendingMembersOf('o2')).toEqual(['ana']);
      expect(store.targetOrganizationId(ana)).toBe('o2');
      expect(hoja.isMember(ana, 'o2')).toBe(true);
      expect(api.addAdminOrganizationMember).not.toHaveBeenCalled();
    });

    it('agregarlo a donde ya está no deja nada pendiente', () => {
      const store = montar();
      const hoja = abrir(store, 'o1');
      const ana = persona('ana', 'o1');

      hoja.add(ana, store.organizations()[0]);

      expect(store.hasPendingMove(ana)).toBe(false);
    });

    it('guardar la mudanza hace una sola llamada, relee personas y refresca la sesión', async () => {
      const store = montar();
      const ana = persona('ana', 'o1');
      store.users.set([ana]);
      api.adminUsers.mockReturnValue(
        of({ items: [persona('ana', 'o2')], page: 1, size: 25, total: 1, totalPages: 1, hasNext: false }),
      );
      store.setUserOrganization(ana, 'o2');

      await TestBed.inject(AdminCommands).guardarBorrador();

      expect(api.addAdminOrganizationMember).toHaveBeenCalledTimes(1);
      expect(api.addAdminOrganizationMember).toHaveBeenCalledWith('o2', 'ana');
      expect(pollSession).toHaveBeenCalledTimes(1);
      expect(store.dirty()).toBe(false);
      expect(store.userOrganizationId(store.users()[0])).toBe('o2');
    });

    it('si la mudanza falla, la persona sigue en su organización y el borrador queda para reintentar', async () => {
      const store = montar();
      const ana = persona('ana', 'o1');
      store.users.set([ana]);
      api.addAdminOrganizationMember.mockReturnValueOnce(throwError(() => new Error('Sin cupo')));
      store.setUserOrganization(ana, 'o2');

      await TestBed.inject(AdminCommands).guardarBorrador();

      expect(store.dirty()).toBe(true);
      expect(store.failures()[0].reason).toBe('Sin cupo');
      expect(store.userOrganizationId(store.users()[0])).toBe('o1');
    });

    it('buscar personas espera una pausa y busca con el texto recortado', async () => {
      vi.useFakeTimers();
      const store = montar();
      const hoja = abrir(store);

      hoja.onQuery('  an');
      hoja.onQuery('  ana ');
      expect(api.adminUsers).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(300);

      expect(api.adminUsers).toHaveBeenCalledTimes(1);
      expect(api.adminUsers).toHaveBeenCalledWith(1, 8, 'ana');
    });

    it('vaciar la búsqueda borra los resultados sin llamar al servidor', () => {
      const hoja = abrir(montar());
      hoja.results.set([persona('ana', 'o1')]);

      hoja.onQuery('   ');

      expect(hoja.results()).toEqual([]);
      expect(api.adminUsers).not.toHaveBeenCalled();
    });
  });
});
